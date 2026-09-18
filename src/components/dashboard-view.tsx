"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { ACHIEVEMENTS, type UserAchievements } from "@/lib/achievements";
import { formatWeekLabel, snippet } from "@/lib/format-week";
import type { CategoryScores } from "@/lib/roast-types";
import { ProWaitlistModal } from "@/components/pro-waitlist-modal";
import { playUnlockSound } from "@/lib/unlock-sound";
import { scoreGlow, scoreTextColor } from "@/lib/grades";

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
      <p className="text-sm text-text-faint">
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
        <span className="text-xs font-semibold uppercase tracking-widest text-text-faint">
          Score trend
        </span>
        <span className="text-xs text-text-muted">
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
            <stop offset="0%" stopColor="#ff5a36" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff5a36" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${points[points.length - 1]!.x} ${height - padding} L ${points[0]!.x} ${height - padding} Z`}
          fill="url(#trendGradient)"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#ff5a36"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#1c1c1f" stroke="#ff5a36" strokeWidth="2" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fill="#98979c"
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

function AchievementCelebration({
  achievementId,
  onDismiss,
}: {
  achievementId: string;
  onDismiss: () => void;
}) {
  const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);

  useEffect(() => {
    playUnlockSound();
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievementId]);

  if (!achievement) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div
        role="status"
        onClick={onDismiss}
        className="animate-achievement-pop-in pointer-events-auto flex max-w-sm cursor-pointer items-center gap-4 rounded-2xl border border-ember/40 bg-surface px-6 py-5 shadow-[0_0_40px_rgba(255,90,54,0.25)]"
      >
        <span className="text-5xl leading-none" aria-hidden>
          {achievement.emoji}
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ember">
            Achievement unlocked
          </p>
          <p className="mt-1 text-base font-bold text-text">{achievement.title}</p>
          <p className="mt-0.5 text-xs text-text-muted">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardView({ name, roasts, scoreHistory, streak, longestStreak, achievements, newlyUnlockedAchievements, isPro }: Props) {
  const [showProWaitlistModal, setShowProWaitlistModal] = useState(false);
  const [celebrationQueue, setCelebrationQueue] = useState<string[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<string | null>(null);
  const latest = roasts[0] ?? null;

  useEffect(() => {
    for (const achievementId of newlyUnlockedAchievements) {
      posthog.capture("achievement_unlocked", { achievement_id: achievementId });
    }
    if (newlyUnlockedAchievements.length > 0) {
      setCelebrationQueue(newlyUnlockedAchievements);
      // This render already consumed the pending-achievement cookie (if any) — clear it
      // so refreshing /dashboard doesn't replay the celebration.
      fetch("/api/clear-pending-achievement", { method: "POST", keepalive: true }).catch(() => {});
    }
  }, [newlyUnlockedAchievements]);

  useEffect(() => {
    if (activeCelebration || celebrationQueue.length === 0) return;
    const [next, ...rest] = celebrationQueue;
    setActiveCelebration(next ?? null);
    setCelebrationQueue(rest);
  }, [celebrationQueue, activeCelebration]);

  // Check if user has already roasted today (for free users)
  const hasRoastedToday = !isPro && latest && (() => {
    const today = new Date().toISOString().split('T')[0];
    const roastDate = new Date(latest.created_at).toISOString().split('T')[0];
    return today === roastDate;
  })();

  // Check if user has any activity (roast or check-in) today, for the streak banner
  const hasActivityToday = Boolean(latest) && (() => {
    const today = new Date().toISOString().split('T')[0];
    const activityDate = new Date(latest!.created_at).toISOString().split('T')[0];
    return today === activityDate;
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
      {activeCelebration && (
        <AchievementCelebration
          achievementId={activeCelebration}
          onDismiss={() => setActiveCelebration(null)}
        />
      )}

      <header>
        <h1 className="text-2xl font-bold text-text">
          Hey {name} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Your damage report, updated weekly
        </p>
      </header>

      {/* Daily streak banner */}
      {streak > 0 && (
        <div
          className={`flex items-center justify-start gap-3 rounded-xl border px-5 py-3 ${
            hasActivityToday ? "border-ember/40 bg-ember-soft" : "border-border bg-surface"
          }`}
        >
          <span
            aria-hidden
            className={`text-3xl leading-none ${hasActivityToday ? "" : "opacity-50 grayscale"}`}
          >
            {hasActivityToday ? "🔥" : "⏳"}
          </span>
          <span
            className={`text-2xl font-black tabular-nums ${
              hasActivityToday ? "text-ember" : "text-text-muted"
            }`}
          >
            {streak}
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-text-faint">
            day streak
          </span>
          {!hasActivityToday && (
            <span className="text-[11px] text-text-faint">
              · keep it going today
            </span>
          )}
        </div>
      )}

      {latest && latest.life_score !== null ? (
        <>
          {/* Hero — Life Score */}
          <section
            className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface-2 to-surface p-8 text-center ${scoreGlow(latest.life_score)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember">
              Life Score
            </p>
            <p
              className={`mt-2 text-7xl font-black tabular-nums ${scoreTextColor(latest.life_score)}`}
            >
              {latest.life_score}
            </p>
            <p className="mt-3 text-lg font-semibold text-text">
              {latest.funny_title ?? "Certified Disaster"}
            </p>
            <p className="mt-1 text-xs text-text-faint">out of 100</p>
          </section>

          {/* Streak */}
          {streak > 0 && (
            <div className="rounded-xl border border-ember/30 bg-ember-soft px-5 py-4 text-center">
              <p className="text-base font-semibold text-ember">
                {getStreakMessage(streak)}
              </p>
              {longestStreak > streak && (
                <p className="mt-1 text-xs text-text-faint">
                  Best: {longestStreak} days
                </p>
              )}
            </div>
          )}

          {/* Best / Worst */}
          {allScores.length > 1 && bestScore !== null && worstScore !== null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-grade-a/40 bg-grade-a/10 p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-grade-a/80">
                  Best ever
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums text-grade-a">
                  {bestScore}
                </p>
              </div>
              <div className="rounded-xl border border-grade-f/40 bg-grade-f/10 p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-grade-f/80">
                  Worst ever
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums text-grade-f">
                  {worstScore}
                </p>
              </div>
            </div>
          )}

          {/* Score trend */}
          {scoresWithValues.length >= 2 && (
            <section className="rounded-xl border border-border bg-surface-2 p-5">
              <ScoreTrend scores={scoresWithValues} />
            </section>
          )}

          {/* Category breakdown */}
          {categoryDeltas.length > 0 && (
            <section className="rounded-xl border border-border bg-surface-2 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-faint">
                Category breakdown
              </h2>
              {scoreHistory.length > 1 ? (
                <div className="space-y-4">
                  {improved.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-grade-a">
                        Improved vs last time
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {improved.map((c) => (
                          <span
                            key={c.key}
                            className="rounded-xl border border-grade-a/40 bg-grade-a/10 px-3 py-1.5 text-sm text-grade-a"
                          >
                            {c.label} ↑ +{c.delta}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {worsened.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-grade-f">
                        Got worse vs last time
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {worsened.map((c) => (
                          <span
                            key={c.key}
                            className="rounded-xl border border-grade-f/40 bg-grade-f/10 px-3 py-1.5 text-sm text-grade-f"
                          >
                            {c.label} ↓ {c.delta}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {improved.length === 0 && worsened.length === 0 && (
                    <p className="text-sm text-text-muted">
                      No changes since last roast — consistency is… something
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoryDeltas.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-xl border border-border bg-surface-3 px-3 py-2 text-center"
                    >
                      <p className="text-xs text-text-faint">{c.label}</p>
                      <p className="text-lg font-bold tabular-nums text-text">
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
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-5xl" aria-hidden>
            🔥
          </p>
          <p className="mt-4 text-lg font-semibold text-text">
            No Life Score yet
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Get roasted once to unlock your dashboard
          </p>
        </div>
      )}

      {/* CTA */}
      {hasRoastedToday ? (
        <button
          type="button"
          onClick={() => setShowProWaitlistModal(true)}
          className="block w-full rounded-xl bg-ember px-4 py-4 text-center text-base font-semibold text-white shadow-[0_0_24px_rgba(255,90,54,0.3)] transition hover:brightness-110"
        >
          Join Pro Waitlist 🔥
        </button>
      ) : (
        <Link
          href="/onboarding"
          className="block w-full rounded-xl bg-ember px-4 py-4 text-center text-base font-semibold text-white shadow-[0_0_24px_rgba(255,90,54,0.3)] transition hover:brightness-110"
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
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-faint">
            Recent roasts
          </h2>
          <div className="flex flex-col gap-3">
            {recentRoasts.map((r) => (
              <Link
                key={r.id}
                href={`/roast/${r.id}`}
                className="group block rounded-xl border border-border bg-surface-2 p-4 transition hover:border-ember/40 hover:bg-surface-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-faint">
                      Week of {formatWeekLabel(r.week_start_date)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted group-hover:text-text">
                      {snippet(r.roast_text, 120)}
                    </p>
                    {r.funny_title && (
                      <p className="mt-2 text-xs font-medium text-ember">
                        {r.funny_title}
                      </p>
                    )}
                  </div>
                  {r.life_score !== null && (
                    <span
                      className={`shrink-0 rounded-xl border border-border bg-surface-3 px-3 py-2 text-xl font-black tabular-nums ${scoreTextColor(r.life_score)}`}
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
      <section className="rounded-xl border border-border bg-surface-2 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-faint">
          Achievements
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACHIEVEMENTS.map((achievement) => {
            const state = achievements[achievement.id];
            const unlocked = Boolean(state?.unlocked_at);
            const progress = state?.progress ?? 0;
            const target = achievement.target;
            const progressPct = target ? Math.min(100, Math.round((progress / target) * 100)) : 0;
            const justUnlocked = newlyUnlockedAchievements.includes(achievement.id);
            return (
              <div
                key={achievement.id}
                className={`relative rounded-xl border p-4 text-center transition-all duration-200 [transition-timing-function:ease] ${
                  unlocked
                    ? "border-ember/60 bg-ember-soft hover:scale-105"
                    : "border-border bg-surface-3 opacity-60"
                } ${justUnlocked ? "animate-achievement-glow" : ""}`}
                title={achievement.description}
              >
                <p className="text-[60px] leading-none">{unlocked ? achievement.emoji : "🔒"}</p>
                <p
                  className={`mt-2 text-xs font-bold ${unlocked ? "text-text" : "text-text-muted"}`}
                >
                  {achievement.title}
                </p>
                <p className={`mt-1 text-[10px] leading-tight ${unlocked ? "text-text-muted" : "text-text-faint"}`}>
                  {achievement.description}
                </p>
                {target ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={`h-full rounded-full tabular-nums transition-all duration-200 [transition-timing-function:ease] ${unlocked ? "bg-ember" : "bg-grade-a"}`}
                        style={{ width: `${unlocked ? 100 : progressPct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-medium tabular-nums text-text-muted">
                      {unlocked ? target : progress}/{target}
                    </p>
                  </div>
                ) : unlocked ? (
                  <p className="mt-2 text-[10px] font-semibold text-ember">✓ Unlocked</p>
                ) : null}
                {unlocked ? (
                  <p className="mt-1 text-[10px] text-ember">
                    Unlocked {formatUnlockedDate(state!.unlocked_at!)}
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] italic leading-tight text-text-faint">
                    Unlock by: {achievement.hint}
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
