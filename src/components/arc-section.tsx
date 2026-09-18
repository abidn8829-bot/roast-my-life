"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gradeColor, scoreTextColor, scoreToGrade } from "@/lib/grades";
import type { Grade } from "@/lib/roast-types";

type FreeLayerEntry = {
  category: string;
  label: string;
  fromGrade: Grade;
  toGrade: Grade;
};

type ProComparison = {
  category: string;
  label: string;
  userScore: number;
  userGrade: Grade;
  avgScore: number | null;
  percentile: number | null;
  sampleSize: number;
  insufficientSample: boolean;
};

type Tip = {
  category: string;
  label: string;
  steps: { step: string; why: string }[];
};

type ArcResponse =
  | { hasEnoughHistory: false }
  | { hasEnoughHistory: true; freeLayer: FreeLayerEntry[]; weeksSpan: number | null; locked: true }
  | {
      hasEnoughHistory: true;
      freeLayer: FreeLayerEntry[];
      weeksSpan: number | null;
      locked: false;
      pro: { comparisons: ProComparison[]; tip: Tip | null; asOf: string | null; source: "snapshot" | "live" };
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
          <span className="text-xs text-text-faint">Not enough Ember users graded on this yet</span>
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

function formatAsOf(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-faint">
          Your Arc So Far
        </h2>
        <p className="text-sm text-text-faint">Loading…</p>
      </section>
    );
  }

  if (!data.hasEnoughHistory) {
    return (
      <section className="rounded-xl border border-border bg-surface-2 p-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-faint">
          Your Arc So Far
        </h2>
        <p className="text-sm text-text-muted">
          Not enough history yet — check in at least twice to see how your grades are moving.
        </p>
      </section>
    );
  }

  const { freeLayer, weeksSpan } = data;
  const spanText = weeksSpan ? (weeksSpan === 1 ? "over the last week" : `over ${weeksSpan} weeks`) : "";

  return (
    <section className="rounded-xl border border-border bg-surface-2 p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-faint">
        Your Arc So Far
      </h2>

      {freeLayer.length > 0 ? (
        <ul className="space-y-2">
          {freeLayer.map((entry) => (
            <li key={entry.category} className="flex items-center gap-2 text-sm text-text">
              <span className="font-medium">{entry.label}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${gradeColor(entry.fromGrade)}`}>
                {entry.fromGrade}
              </span>
              <span className="text-text-faint">→</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${gradeColor(entry.toGrade)}`}>
                {entry.toGrade}
              </span>
              <span className="text-text-faint">{spanText}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">
          No grade changes yet {spanText} — consistency is… something
        </p>
      )}

      {data.locked ? (
        <div className="relative mt-5">
          <div aria-hidden className="pointer-events-none space-y-3 blur-sm select-none">
            <PercentileRow label="Sleep" percentile={72} />
            <PercentileRow label="Discipline" percentile={45} />
            <PercentileRow label="Spending" percentile={88} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-2/80 p-4 text-center">
            <p className="text-sm font-semibold text-text">See how you compare to other Ember users</p>
            <p className="text-xs text-text-muted">
              Plus a detailed plan for closing the gap on your weakest category — Pro only.
            </p>
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
      ) : variant === "compact" ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-ember/30 bg-ember-soft px-4 py-3">
          <p className="text-sm text-text">See how you compare to other Ember users</p>
          <Link href="/arc" className="shrink-0 text-sm font-semibold text-ember hover:brightness-110">
            View your full Arc →
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
                Where you stand
              </p>
              <p className="text-xs text-text-faint">
                {data.pro.source === "snapshot" && data.pro.asOf ? `as of ${formatAsOf(data.pro.asOf)}` : "just now"}
              </p>
            </div>
            <div className="space-y-3">
              {data.pro.comparisons.map((c) => (
                <PercentileRow key={c.category} label={c.label} percentile={c.insufficientSample ? null : c.percentile} />
              ))}
            </div>
          </div>

          {data.pro.tip && (
            <div className="rounded-xl border border-ember/30 bg-ember-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-ember">
                Close the gap — {data.pro.tip.label}
              </p>
              <ol className="mt-2 space-y-2">
                {data.pro.tip.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text">
                    <span className="font-semibold text-ember">{i + 1}.</span>
                    <span>
                      <span className="font-medium">{s.step}</span>
                      <span className="block text-xs text-text-muted">{s.why}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
