import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GradeRow } from "@/components/journal-roast-ui";
import { JournalTheme } from "@/components/journal-theme";
import { ShareCta } from "@/components/share-cta";
import { cleanRoastText } from "@/lib/clean-roast-text";
import { getShareCardData } from "@/lib/get-share-card";
import { isUuid } from "@/lib/is-uuid";
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
  if ("error" in result) return { title: "Ember AI", robots: { index: false, follow: false } };

  const { lifeScore, funnyTitle, punchline } = result.card;
  const title = `Life score: ${lifeScore}/100 — ${funnyTitle}`;
  const image = { url: `/api/og/${encodeURIComponent(slug)}`, width: 1080, height: 1920 };

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: `"${punchline}" Get roasted at emberai.site`,
    alternates: { canonical: `/share/${encodeURIComponent(slug)}` },
    // A personal result page: let link previews work, keep it out of search results.
    robots: { index: false, follow: false },
    openGraph: { title, description: `"${punchline}"`, url: `/share/${encodeURIComponent(slug)}`, images: [image], type: "website" },
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

  // Journal look: powder mist page, ink green text. Grade letters are ink; the bar is what carries the score.
  return (
    <JournalTheme>
      <main className="flex min-h-screen flex-col items-center px-4 pb-16 pt-6">
        <div className="flex w-full max-w-md flex-col gap-8">
          <header className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-[0.2em] text-text">EMBERAI</span>
            <ShareCta
              location="header"
              className="inline-flex min-h-11 items-center rounded-full bg-text px-5 text-sm font-medium text-on-accent transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text"
            >
              Get roasted →
            </ShareCta>
          </header>

          <section className="flex flex-col items-center gap-3 text-center">
            <p className="text-[13px] font-medium text-text-muted">Their life score</p>
            <div className="font-display flex items-baseline gap-2 text-[96px] font-medium leading-none tabular-nums text-text">
              {lifeScore}
              <span className="text-[30px] text-text-muted">/100</span>
            </div>
            <span
              className="block h-3 w-full max-w-[16rem] overflow-hidden rounded-[3px] border border-text bg-powder"
              role="img"
              aria-label={`Life score: ${lifeScore} out of 100`}
            >
              <span className="block h-full bg-bar" style={{ width: `${Math.max(0, Math.min(100, lifeScore))}%` }} />
            </span>
            <h1 className="font-display mt-2 break-words text-[34px] font-medium leading-[1.1]">{funnyTitle}</h1>
          </section>

          {categoryScores && (
            <section>
              <h2 className="sr-only">Category scores</h2>
              <ul className="divide-y divide-border rounded-[18px] border border-border bg-surface px-5">
                {CATEGORIES.map(({ key, label }) => {
                  const { score, grade } = categoryScores[key];
                  return <GradeRow key={key} label={label} grade={grade} score={score} />;
                })}
              </ul>
            </section>
          )}

          <section className="rounded-[20px] border border-text bg-surface p-6 text-center">
            <p className="font-display break-words text-[24px] font-medium leading-snug">&ldquo;{punchline}&rdquo;</p>
          </section>

          {roastText && (
            <section className="flex flex-col gap-3">
              <h2 className="text-center text-[13px] font-medium text-text-muted">The full roast</h2>
              <div className="rounded-[18px] border border-border bg-surface p-5">
                <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.6]">{cleanRoastText(roastText)}</p>
              </div>
            </section>
          )}

          <section className="flex flex-col items-center gap-3 rounded-[18px] border border-border bg-surface px-6 py-8 text-center">
            <h2 className="font-display text-[28px] font-medium leading-[1.15]">Think your life scores higher?</h2>
            <p className="text-sm text-text-muted">
              Answer 5 questions. Get graded. Get roasted. Free.
            </p>
            <ShareCta
              location="footer"
              className="mt-2 inline-flex h-14 w-full items-center justify-center rounded-xl bg-text text-base font-medium text-on-accent transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text"
            >
              Get your own roast
            </ShareCta>
            <p className="text-xs text-text-faint">emberai.site</p>
          </section>
        </div>
      </main>
    </JournalTheme>
  );
}
