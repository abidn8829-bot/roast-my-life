import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareCta } from "@/components/share-cta";
import { getShareCardData } from "@/lib/get-share-card";
import { isUuid } from "@/lib/is-uuid";
import { gradeOgColor, scoreToGrade } from "@/lib/grades";
import type { CategoryScores } from "@/lib/roast-types";
import { SITE_URL } from "@/lib/site";

// Public, cookie-free page: safe to cache so a shared link opens instantly.
export const revalidate = 300;

const CATEGORIES: { key: keyof CategoryScores; label: string }[] = [
  { key: "sleep", label: "Sleep" },
  { key: "fitness", label: "Fitness" },
  { key: "discipline", label: "Discipline" },
  { key: "focus", label: "Focus" },
  { key: "spending", label: "Spending" },
];

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  // Public pages are keyed by share_slug only, never the private roast UUID.
  const result = isUuid(slug) ? ({ error: "not_found" } as const) : await getShareCardData(slug);
  if ("error" in result) return { title: "Emberai", robots: { index: false, follow: false } };

  const { lifeScore, funnyTitle, punchline } = result.card;
  const title = `Life score: ${lifeScore}/100 — ${funnyTitle}`;
  const image = { url: `/api/og/${encodeURIComponent(slug)}`, width: 1080, height: 1920 };

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: `"${punchline}" Get roasted at emberai.site`,
    // A personal result page: let link previews work, keep it out of search results.
    robots: { index: false, follow: false },
    openGraph: { title, description: `"${punchline}"`, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, images: [image.url] },
  };
}

export default async function SharePage({ params }: Params) {
  const { slug } = await params;
  if (isUuid(slug)) notFound();
  const result = await getShareCardData(slug);
  if ("error" in result) {
    if (result.error === "not_found") notFound();
    throw new Error(result.message);
  }

  const { lifeScore, funnyTitle, punchline, categoryScores, roastText } = result.card;
  const scoreColor = gradeOgColor(scoreToGrade(lifeScore));

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg px-4 pb-16 pt-6 text-text">
      <div className="flex w-full max-w-md flex-col gap-8">
        <header className="flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-[0.2em] text-[#FF3D00]">EMBERAI</span>
          <ShareCta
            location="header"
            className="rounded-full bg-[#FF3D00] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            Get roasted →
          </ShareCta>
        </header>

        <section className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-faint">
            Their life score
          </p>
          <div
            className="text-8xl font-black tabular-nums tracking-tighter"
            style={{ color: scoreColor }}
          >
            {lifeScore}
            <span className="text-4xl text-text-faint">/100</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{funnyTitle}</h1>
        </section>

        {categoryScores && (
          <section className="flex flex-col gap-3">
            {CATEGORIES.map(({ key, label }) => {
              const { score, grade } = categoryScores[key];
              const color = gradeOgColor(grade);
              return (
                <div
                  key={key}
                  className="flex items-center gap-4 rounded-[18px] bg-[#111111] px-5 py-4"
                  style={{ border: `2px solid ${color}55` }}
                >
                  <span className="w-24 shrink-0 text-base font-bold">{label}</span>
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#262626]"
                    role="img"
                    aria-label={`${label}: ${Math.round(score)} out of 100`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: color }}
                    />
                  </div>
                  <span className="w-7 text-right text-3xl font-black" style={{ color }}>
                    {grade}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        <section className="rounded-[20px] border-2 border-[#FF3D00] bg-[#111111] p-6 text-center">
          <p className="text-xl font-semibold leading-snug">&ldquo;{punchline}&rdquo;</p>
        </section>

        {roastText && (
          <section className="flex flex-col gap-3">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-text-faint">
              The full roast
            </p>
            <div className="rounded-xl border border-border bg-surface-2 p-5">
              <p className="whitespace-pre-wrap text-base leading-relaxed">{roastText}</p>
            </div>
          </section>
        )}

        <section className="flex flex-col items-center gap-3 rounded-[28px] bg-[#111111] px-6 py-8 text-center">
          <h2 className="text-2xl font-black tracking-tight">Think your life scores higher?</h2>
          <p className="text-sm text-text-muted">
            Answer 5 questions. Get graded. Get roasted. Free.
          </p>
          <ShareCta
            location="footer"
            className="mt-2 w-full rounded-2xl bg-[#FF3D00] px-6 py-4 text-lg font-bold text-white transition hover:brightness-110"
          >
            Get your own roast
          </ShareCta>
          <p className="text-xs text-text-faint">emberai.site</p>
        </section>
      </div>
    </main>
  );
}
