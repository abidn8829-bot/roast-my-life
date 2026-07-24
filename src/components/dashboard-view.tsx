"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { ACHIEVEMENTS, type UserAchievements } from "@/lib/achievements";
import { formatWeekLabel, snippet } from "@/lib/format-week";
import type { CategoryScores } from "@/lib/roast-types";
import { ProWaitlistModal } from "@/components/pro-waitlist-modal";

export type DashboardRoast = {
  id: string;
  roast_text: string;
  week_start_date: string;
  share_slug: string;
  life_score: number | null;
  funny_title: string | null;
  category_scores: CategoryScores | null;
  created_at: string;
};

export type ScoreHistoryEntry = {
  life_score: number;
  category_grades: CategoryScores;
  recorded_at: string;
};

type CategoryDelta = {
  key: keyof CategoryScores;
  label: string;
  current: number;
  delta: number;
};

type Props = {
  name: string;
  roasts: DashboardRoast[];
  scoreHistory: ScoreHistoryEntry[];
  streak: number;
  currentStreak: number;
  longestStreak: number;
  achievements: UserAchievements;
  newlyUnlockedAchievements: string[];
  isPro: boolean;
};

const CATEGORY_LABELS: { key: keyof CategoryScores; label: string }[] = [
  { key: "sleep", label: "Sleep" },
  { key: "fitness", label: "Fitness" },
  { key: "discipline", label: "Discipline" },
  { key: "focus", label: "Focus" },
  { key: "spending", label: "Spending" },
];

function getScoreColor(score: number): string {
  if (score <= 40) return "text-red-400";
  if (score <= 70) return "text-amber-400";
  return "text-emerald-400";
}

function getScoreGlow(score: number): string {
  if (score <= 40) return "shadow-[0_0_60px_rgba(239,68,68,0.25)]";
  if (score <= 70) return "shadow-[0_0_60px_rgba(245,158,11,0.2)]";
  return "shadow-[0_0_60px_rgba(16,185,129,0.2)]";
}

function formatUnlockedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStreakMessage(streak: number): string {
  if (streak === 1) return "Day 1 of facing reality 👀";
  if (streak === 3) return "3 days of self inflicted damage 🔥";
  if (streak === 7) return "7 day streak — therapy would be cheaper";
  if (streak === 30) return "30 days — you're either improving or masochistic 💀";
  if (streak >= 100) return `${streak} days — you need a new hobby at this point`;
  return `${streak} day streak`;
}

function computeCategoryDeltas(
  current: CategoryScores | null,
  previous: CategoryScores | null,
): CategoryDelta[] {
  if (!current) return [];
  return CATEGORY_LABELS.map(({ key, label }) => {
    const cur = current[key].score;
    const prev = previous?.[key]?.score;
    const delta = prev !== undefined ? cur - prev : 0;
    return { key, label, current: cur, delta };
  });
}

function ScoreTrend({ scores }: { scores: number[] }) {
  if (scores.length < 2) {
    return (
      <p className="text-sm text-neutral-500">
        Need at least 2 roasts to see a trend
      </p>
    );
  }

  const width = 280;
  const height = 80;
  const padding = 12;
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;

  const points = scores.map((score, i) => {
    const x =
      padding + (i / (scores.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((score - min) / range) * (height - padding * 2);
    return { x, y, score };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const trend =
    scores[scores.length - 1]! > scores[0]!
      ? "up"
      : scores[scores.length - 1]! < scores[0]!
        ? "down"
        : "flat";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Score trend
        </span>
        <span className="text-xs text-neutral-400">
          {trend === "up" && "📈 Trending up"}
          {trend === "down" && "📉 Trending down"}
          {trend === "flat" && "➡️ Holding steady"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-20"
        aria-label="Life score trend over last roasts"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF3D00" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF3D00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${points[points.length - 1]!.x} ${height - padding} L ${points[0]!.x} ${height - padding} Z`}
          fill="url(#trendGradient)"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#FF3D00"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#0A0A0A" stroke="#FF3D00" strokeWidth="2" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fill="#a3a3a3"
              fontSize="10"
              fontWeight="600"
            >
              {p.score}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DashboardView({ name, roasts, scoreHistory, streak, currentStreak, longestStreak, achievements, newlyUnlockedAchievements, isPro }: Props) {
  const [showProWaitlistModal, setShowProWaitlistModal] = useState(false);
  const latest = roasts[0] ?? null;

  useEffect(() => {
    for (const achievementId of newlyUnlockedAchievements) {
      posthog.capture("achievement_unlocked", { achievement_id: achievementId });
    }
  }, [newlyUnlockedAchievements]);

  // Check if user has already roasted today (for free users)
  const hasRoastedToday = !isPro && latest && (() => {
    const today = new Date().toISOString().split('T')[0];
    const roastDate = new Date(latest.created_at).toISOString().split('T')[0];
    return today === roastDate;
  })();

  const scoresWithValues = scoreHistory
    .slice(0, 4)
    .reverse()
    .map((entry) => entry.life_score);

  const allScores = scoreHistory.map((entry) => entry.life_score);

  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;
  const worstScore = allScores.length > 0 ? Math.min(...allScores) : null;

  const categoryDeltas = computeCategoryDeltas(
    scoreHistory[0]?.category_grades ?? null,
    scoreHistory[1]?.category_grades ?? null,
  );

  const improved = categoryDeltas.filter((c) => c.delta > 0);
  const worsened = categoryDeltas.filter((c) => c.delta < 0);

  const recentRoasts = roasts.slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-[#FAFAFA]">
          Hey {name} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Your damage report, updated weekly
        </p>
      </header>

      {latest && latest.life_score !== null ? (
        <>
          {/* Hero — Life Score */}
          <section
            className={`relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-[#141414] to-[#0A0A0A] p-8 text-center ${getScoreGlow(latest.life_score)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF3D00]">
              Life Score
            </p>
            <p
              className={`mt-2 text-7xl font-black tabular-nums ${getScoreColor(latest.life_score)}`}
            >
              {latest.life_score}
            </p>
            <p className="mt-3 text-lg font-semibold text-neutral-200">
              {latest.funny_title ?? "Certified Disaster"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">out of 100</p>
          </section>

          {/* Streak */}
          {currentStreak > 0 && (
            <div className="rounded-xl border border-[#FF3D00]/30 bg-[#FF3D00]/10 px-5 py-4 text-center">
              <p className="text-base font-semibold text-[#FF3D00]">
                {getStreakMessage(currentStreak)}
              </p>
              {longestStreak > currentStreak && (
                <p className="mt-1 text-xs text-neutral-500">
                  Best: {longestStreak} days
                </p>
              )}
            </div>
          )}

          {/* Best / Worst */}
          {allScores.length > 1 && bestScore !== null && worstScore !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-emerald-500">
                  Best ever
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-400">
                  {bestScore}
                </p>
              </div>
              <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-red-500">
                  Worst ever
                </p>
                <p className="mt-1 text-3xl font-black text-red-400">
                  {worstScore}
                </p>
              </div>
            </div>
          )}

          {/* Score trend */}
          {scoresWithValues.length >= 2 && (
            <section className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
              <ScoreTrend scores={scoresWithValues} />
            </section>
          )}

          {/* Category breakdown */}
          {categoryDeltas.length > 0 && (
            <section className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Category breakdown
              </h2>
              {scoreHistory.length > 1 ? (
                <div className="space-y-4">
                  {improved.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-emerald-400">
                        Improved vs last time
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {improved.map((c) => (
                          <span
                            key={c.key}
                            className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300"
                          >
                            {c.label} ↑ +{c.delta}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {worsened.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-red-400">
                        Got worse vs last time
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {worsened.map((c) => (
                          <span
                            key={c.key}
                            className="rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-1.5 text-sm text-red-300"
                          >
                            {c.label} ↓ {c.delta}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {improved.length === 0 && worsened.length === 0 && (
                    <p className="text-sm text-neutral-400">
                      No changes since last roast — consistency is… something
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoryDeltas.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-lg border border-neutral-800 bg-[#141414] px-3 py-2 text-center"
                    >
                      <p className="text-xs text-neutral-500">{c.label}</p>
                      <p className="text-lg font-bold text-[#FAFAFA]">
                        {Math.round(c.current / 10)}/10
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-700 bg-[#111111] p-10 text-center">
          <p className="text-5xl" aria-hidden>
            🔥
          </p>
          <p className="mt-4 text-lg font-semibold text-neutral-200">
            No Life Score yet
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            Get roasted once to unlock your dashboard
          </p>
        </div>
      )}

      {/* CTA */}
      {hasRoastedToday ? (
        <button
          type="button"
          onClick={() => setShowProWaitlistModal(true)}
          className="block w-full rounded-xl bg-[#FF3D00] px-4 py-4 text-center text-base font-semibold text-white shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110"
        >
          Join Pro Waitlist 🔥
        </button>
      ) : (
        <Link
          href="/onboarding"
          className="block w-full rounded-xl bg-[#FF3D00] px-4 py-4 text-center text-base font-semibold text-white shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110"
        >
          Get Roasted This Week
        </Link>
      )}

      <ProWaitlistModal
        isOpen={showProWaitlistModal}
        onClose={() => setShowProWaitlistModal(false)}
      />

      {/* Last 3 roast reports */}
      {recentRoasts.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Recent roasts
          </h2>
          <div className="flex flex-col gap-3">
            {recentRoasts.map((r) => (
              <Link
                key={r.id}
                href={`/roast/${r.id}`}
                className="group block rounded-xl border border-neutral-800 bg-[#141414] p-4 transition hover:border-[#FF3D00]/40 hover:bg-[#1a1a1a]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-500">
                      Week of {formatWeekLabel(r.week_start_date)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-300 group-hover:text-neutral-200">
                      {snippet(r.roast_text, 120)}
                    </p>
                    {r.funny_title && (
                      <p className="mt-2 text-xs font-medium text-[#FF3D00]">
                        {r.funny_title}
                      </p>
                    )}
                  </div>
                  {r.life_score !== null && (
                    <span
                      className={`shrink-0 rounded-lg border border-neutral-700 bg-[#0A0A0A] px-3 py-2 text-xl font-black tabular-nums ${getScoreColor(r.life_score)}`}
                    >
                      {r.life_score}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Achievement badges */}
      <section className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Achievements
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACHIEVEMENTS.map((achievement) => {
            const state = achievements[achievement.id];
            const unlocked = Boolean(state?.unlocked_at);
            const progress = state?.progress ?? 0;
            const target = achievement.target;
            const progressPct = target ? Math.min(100, Math.round((progress / target) * 100)) : 0;
            return (
              <div
                key={achievement.id}
                className={`relative rounded-xl border p-4 text-center transition-all duration-300 ease-out ${
                  unlocked
                    ? "scale-105 border-[#FF3D00]/40 bg-[#FF3D00]/10 shadow-[0_0_20px_rgba(255,61,0,0.35)]"
                    : "scale-100 border-neutral-800 bg-[#0A0A0A] opacity-50 grayscale"
                }`}
                title={achievement.description}
              >
                <p className="text-2xl">{unlocked ? achievement.emoji : "🔒"}</p>
                <p
                  className={`mt-2 text-xs font-bold ${unlocked ? "text-[#FAFAFA]" : "text-neutral-500"}`}
                >
                  {achievement.title}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-neutral-500">
                  {achievement.description}
                </p>
                {target ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${unlocked ? "bg-[#FF3D00]" : "bg-[#FF3D00]/40"}`}
                        style={{ width: `${unlocked ? 100 : progressPct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-medium text-neutral-400">
                      {unlocked ? target : progress}/{target}
                    </p>
                  </div>
                ) : unlocked ? (
                  <p className="mt-2 text-[10px] font-semibold text-[#FF3D00]">✓ Unlocked</p>
                ) : null}
                {unlocked ? (
                  <p className="mt-1 text-[10px] text-neutral-500">
                    Unlocked {formatUnlockedDate(state!.unlocked_at!)}
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] italic leading-tight text-neutral-600">
                    Earn by: {achievement.hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
