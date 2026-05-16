import Link from "next/link";
import { gradeColor } from "@/lib/grades";
import { formatWeekLabel, snippet } from "@/lib/format-week";
import { getWeekStartDate } from "@/lib/week-start";
import type { OnboardingAnswers, ReportCard } from "@/lib/roast-types";

export type DashboardRoast = {
  id: string;
  roast_text: string;
  report_card: ReportCard;
  week_start_date: string;
  share_slug: string;
  answers: OnboardingAnswers | null;
};

type Props = {
  name: string;
  roasts: DashboardRoast[];
};

const GRADE_LABELS: { key: keyof ReportCard; label: string }[] = [
  { key: "screenTime", label: "Screen Time" },
  { key: "sleep", label: "Sleep" },
  { key: "spending", label: "Spending" },
  { key: "productivity", label: "Productivity" },
];

function statValue(
  key: keyof ReportCard,
  answers: OnboardingAnswers | null,
): string {
  if (!answers) return "—";
  switch (key) {
    case "screenTime":
      return `${answers.phoneHours}h / day`;
    case "sleep":
      return `${answers.sleepHours}h avg`;
    case "spending":
      return `$${answers.foodDeliverySpend} / wk`;
    case "productivity":
      return answers.neverDoThing.length > 28
        ? `${answers.neverDoThing.slice(0, 28)}…`
        : answers.neverDoThing;
  }
}

export function DashboardView({ name, roasts }: Props) {
  const currentWeek = getWeekStartDate();
  const thisWeek =
    roasts.find((r) => r.week_start_date === currentWeek) ?? roasts[0] ?? null;

  const seenWeeks = new Set<string>();
  const previous: DashboardRoast[] = [];
  for (const r of roasts) {
    if (thisWeek && r.id === thisWeek.id) continue;
    if (seenWeeks.has(r.week_start_date)) continue;
    seenWeeks.add(r.week_start_date);
    previous.push(r);
    if (previous.length >= 4) break;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-[#FAFAFA]">
          Hey {name} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-400">Your weekly reality check</p>
      </header>

      {thisWeek ? (
        <>
          <Link
            href={`/roast/${thisWeek.id}`}
            className="block rounded-xl border border-neutral-800 bg-[#111111] p-5 transition hover:border-[#FF3D00]/40"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[#FF3D00]">
              This week&apos;s roast
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">
              {snippet(thisWeek.roast_text)}
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {GRADE_LABELS.map(({ key, label }) => (
                <div
                  key={key}
                  className={`rounded-lg border px-1 py-2 text-center ${gradeColor(thisWeek.report_card[key])}`}
                >
                  <span className="block text-[9px] uppercase text-neutral-500">
                    {label.split(" ")[0]}
                  </span>
                  <span className="text-lg font-bold">
                    {thisWeek.report_card[key]}
                  </span>
                </div>
              ))}
            </div>
          </Link>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Your stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {GRADE_LABELS.map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-xl border border-neutral-800 bg-[#141414] p-4"
                >
                  <p className="text-xs text-neutral-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#FAFAFA]">
                    {statValue(key, thisWeek.answers)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-bold ${gradeColor(thisWeek.report_card[key])}`}
                  >
                    {thisWeek.report_card[key]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-700 bg-[#111111] p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🔥
          </p>
          <p className="mt-3 text-neutral-400">
            No roast yet this week. Ready to get judged?
          </p>
        </div>
      )}

      <Link
        href="/onboarding"
        className="block w-full rounded-xl bg-[#FF3D00] px-4 py-4 text-center text-base font-semibold text-white shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110"
      >
        Get Roasted This Week
      </Link>

      {previous.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Previous roasts
          </h2>
          <ul className="flex flex-col gap-2">
            {previous.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/roast/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-[#141414] px-4 py-3 transition hover:border-neutral-600"
                >
                  <span className="text-sm text-neutral-300">
                    Week of {formatWeekLabel(r.week_start_date)}
                  </span>
                  <span className="flex gap-1.5">
                    {GRADE_LABELS.map(({ key }) => (
                      <span
                        key={key}
                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${gradeColor(r.report_card[key])}`}
                      >
                        {r.report_card[key]}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
