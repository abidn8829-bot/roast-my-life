"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArcSparkline } from "@/components/arc-sparkline";
import { MissionCard } from "@/components/mission-card";
import type { ProComparison } from "@/lib/arc-comparisons";
import type { CategoryTrend, Delta } from "@/lib/arc-trend";
import { gradeColor, scoreTextColor, scoreToGrade } from "@/lib/grades";
import type { Grade } from "@/lib/roast-types";

type Trend = {
  windowDays: number;
  lifeScoreNow: number;
  sparkline: { date: string; lifeScore: number }[];
  categories: CategoryTrend[];
};

type ArcResponse =
  | { hasEnoughHistory: false }
  | { hasEnoughHistory: true; today: string; locked: true; trend: Trend }
  | {
      hasEnoughHistory: true;
      today: string;
      locked: false;
      trend: Trend;
      pro: { comparisons: ProComparison[]; asOf: string; source: "snapshot" | "live" };
    };

function percentileBarClass(grade: Grade): string {
  switch (grade) {
    case "A":
      return "bg-grade-a";
    case "B":
      return "bg-grade-b";
    case "C":
      return "bg-grade-c";
    case "D":
      return "bg-grade-d";
    case "F":
      return "bg-grade-f";
  }
}

function PercentileRow({ label, percentile }: { label: string; percentile: number | null }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-text">{label}</span>
        {percentile === null ? (
          <span className="text-xs text-text-faint">Not enough Ember users in this category yet</span>
        ) : (
          <span className={`text-xs font-semibold ${scoreTextColor(percentile)}`}>ahead of {percentile}%</span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        {percentile !== null && (
          <div
            className={`h-full rounded-full transition-all duration-200 ${percentileBarClass(scoreToGrade(percentile))}`}
            style={{ width: `${percentile}%` }}
          />
        )}
      </div>
    </div>
  );
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function DeltaChip({ label, delta, score, grade }: { label: string; delta: Delta | null; score: number; grade: Grade }) {
  if (!delta) {
    return (
      <span className="flex flex-col items-center rounded-lg bg-surface-3 px-2 py-1 text-[11px] text-text-faint">
        <span>{label}</span>
        <span>—</span>
      </span>
    );
  }
  const diff = Math.round(score - delta.fromScore);
  const arrow = delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "▬";
  const tone = delta.direction === "up" ? "text-grade-a" : delta.direction === "down" ? "text-grade-f" : "text-text-faint";
  const detail = delta.fromGrade !== grade ? `${delta.fromGrade}→${grade}` : diff === 0 ? "same" : `${diff > 0 ? "+" : ""}${diff}`;
  return (
    <span
      className="flex flex-col items-center rounded-lg bg-surface-3 px-2 py-1 text-[11px]"
      title={`${label}: ${delta.fromGrade} (${Math.round(delta.fromScore)}) on ${formatDate(delta.since)} → ${grade} (${Math.round(score)}) now`}
    >
      <span className="text-text-faint">{label}</span>
      <span className="font-semibold text-text">
        <span className={tone} aria-hidden>
          {arrow}
        </span>{" "}
        {detail}
      </span>
    </span>
  );
}

function YouVsYou({ trend, today, isPro, compact }: { trend: Trend; today: string; isPro: boolean; compact: boolean }) {
  const first = trend.sparkline[0];
  const windowChange = first ? trend.lifeScoreNow - first.lifeScore : 0;
  const weekChanges = trend.categories.filter((c) => c.week && c.week.fromGrade !== c.grade);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm text-text">
            Life Score <span className={`text-lg font-bold tabular-nums ${scoreTextColor(trend.lifeScoreNow)}`}>{trend.lifeScoreNow}</span>
          </p>
          <p className="text-xs text-text-faint">
            {first && trend.sparkline.length > 1
              ? `${windowChange > 0 ? "▲ +" : windowChange < 0 ? "▼ " : "▬ "}${windowChange === 0 ? "flat" : windowChange} over ${trend.windowDays} days`
              : `last ${trend.windowDays} days`}
          </p>
        </div>
        <ArcSparkline points={trend.sparkline} windowDays={trend.windowDays} today={today} />
        {trend.sparkline.length < 2 && (
          <p className="mt-1 text-xs text-text-faint">One check-in in this window so far. Check in tomorrow to start your line.</p>
        )}
      </div>

      {compact ? (
        weekChanges.length > 0 ? (
          <ul className="space-y-1.5">
            {weekChanges.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-sm text-text">
                <span className="font-medium">{c.label}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${gradeColor(c.week!.fromGrade)}`}>{c.week!.fromGrade}</span>
                <span className="text-text-faint">→</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${gradeColor(c.grade)}`}>{c.grade}</span>
                <span className="text-text-faint">this week</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No grade changes this week. Consistency is… something.</p>
        )
      ) : (
        <ul className="space-y-2">
          {trend.categories.map((c) => (
            <li key={c.category} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${gradeColor(c.grade)}`}>{c.grade}</span>
                <span className="truncate text-sm font-medium text-text">{c.label}</span>
                <span className="text-xs tabular-nums text-text-faint">{Math.round(c.score)}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <DeltaChip label="1d" delta={c.yesterday} score={c.score} grade={c.grade} />
                <DeltaChip label="7d" delta={c.week} score={c.score} grade={c.grade} />
                {isPro && <DeltaChip label="Day 1" delta={c.dayOne} score={c.score} grade={c.grade} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-faint">{children}</p>
      {right && <p className="text-xs text-text-faint">{right}</p>}
    </div>
  );
}

type Props = { variant?: "compact" | "full" };

export function ArcSection({ variant = "full" }: Props) {
  const [data, setData] = useState<ArcResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/arc")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<ArcResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;
  if (!data) {
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-faint">Your Arc So Far</h2>
        <p className="text-sm text-text-faint">Loading…</p>
      </section>
    );
  }

  if (!data.hasEnoughHistory) {
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-faint">Your Arc So Far</h2>
        <p className="text-sm text-text-muted">
          Not enough history yet — check in at least twice to see how your grades are moving.
        </p>
      </section>
    );
  }

  const isPro = !data.locked;
  const compact = variant === "compact";

  return (
    <section className="space-y-6 rounded-xl border border-border bg-surface-2 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-text-faint">Your Arc So Far</h2>

      <div>
        {!compact && <SectionLabel right={isPro ? "30 days · since day 1" : "last 7 days"}>You vs you</SectionLabel>}
        <YouVsYou trend={data.trend} today={data.today} isPro={isPro} compact={compact} />
        {!compact && !isPro && (
          <p className="mt-2 text-xs text-text-faint">Pro sees 30 days and every category since day 1.</p>
        )}
      </div>

      {compact ? (
        <MissionCard isPro={isPro} variant="compact" />
      ) : (
        <>
          <div>
            <SectionLabel right={!data.locked ? (data.pro.asOf === data.today ? "as of today" : `as of ${formatDate(data.pro.asOf)}`) : undefined}>
              You vs Ember users
            </SectionLabel>
            {data.locked ? (
              <div className="relative">
                <div aria-hidden className="pointer-events-none space-y-3 blur-sm select-none">
                  <PercentileRow label="Sleep" percentile={72} />
                  <PercentileRow label="Discipline" percentile={45} />
                  <PercentileRow label="Spending" percentile={88} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-2/80 p-4 text-center">
                  <p className="text-sm font-semibold text-text">See how you compare to other Ember users, updated daily</p>
                  <a
                    href={process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL || "/pricing"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Upgrade to Pro 🔥
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {data.pro.comparisons.map((c) => (
                  <PercentileRow key={c.category} label={c.label} percentile={c.insufficientSample ? null : c.percentile} />
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Your mission</SectionLabel>
            <MissionCard isPro={isPro} variant="full" />
          </div>
        </>
      )}

      {compact && !isPro && (
        <Link href="/arc" className="block text-right text-sm font-semibold text-ember hover:brightness-110">
          View your full Arc →
        </Link>
      )}
    </section>
  );
}
