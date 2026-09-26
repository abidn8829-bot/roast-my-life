import { scoreToGrade } from "@/lib/grades";
import type { CategoryScores, Grade } from "@/lib/roast-types";
import { toDateKey } from "@/lib/streak";

export const ARC_CATEGORIES = ["sleep", "fitness", "discipline", "focus", "spending"] as const;
export type ArcCategory = (typeof ARC_CATEGORIES)[number];
export const ARC_CATEGORY_LABELS: Record<ArcCategory, string> = {
  sleep: "Sleep",
  fitness: "Fitness",
  discipline: "Discipline",
  focus: "Focus",
  spending: "Spending",
};

export function isArcCategory(value: unknown): value is ArcCategory {
  return typeof value === "string" && ARC_CATEGORIES.includes(value as ArcCategory);
}

/** Same UTC calendar-day convention as lib/streak.ts. */
export function todayKey(): string {
  return toDateKey(new Date().toISOString());
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().split("T")[0]!;
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86400000);
}

export type TrendSample = { recordedAt: string; lifeScore: number; categories: CategoryScores };
export type DayPoint = { date: string; lifeScore: number; categories: CategoryScores };

/** One point per UTC day (the latest sample that day), oldest first. */
export function buildDailySeries(samples: TrendSample[]): DayPoint[] {
  const latestByDay = new Map<string, TrendSample>();
  for (const s of samples) {
    const key = toDateKey(s.recordedAt);
    const existing = latestByDay.get(key);
    if (!existing || Date.parse(s.recordedAt) >= Date.parse(existing.recordedAt)) latestByDay.set(key, s);
  }
  return [...latestByDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, s]) => ({ date, lifeScore: s.lifeScore, categories: s.categories }));
}

/** Last known point on or before dateKey (values carry forward between check-ins). */
export function pointAsOf(series: DayPoint[], dateKey: string): DayPoint | null {
  let found: DayPoint | null = null;
  for (const p of series) {
    if (p.date <= dateKey) found = p;
    else break;
  }
  return found;
}

export type Direction = "up" | "down" | "flat";
export type Delta = { fromScore: number; fromGrade: Grade; direction: Direction; since: string };
export type CategoryTrend = {
  category: ArcCategory;
  label: string;
  score: number;
  grade: Grade;
  yesterday: Delta | null;
  week: Delta | null;
  dayOne: Delta | null;
};

function delta(from: DayPoint | null, category: ArcCategory, nowScore: number): Delta | null {
  if (!from) return null;
  const fromScore = from.categories[category].score;
  return {
    fromScore,
    fromGrade: from.categories[category].grade,
    direction: nowScore > fromScore ? "up" : nowScore < fromScore ? "down" : "flat",
    since: from.date,
  };
}

/**
 * Per-category change vs yesterday, vs 7 days ago, and vs day 1. `now` is the
 * live latest check-in. Comparisons use the last value known on that date; if
 * the user is newer than 7 days, "week" falls back to their first day.
 */
export function buildCategoryTrends(series: DayPoint[], now: CategoryScores, today: string): CategoryTrend[] {
  const first = series[0] ?? null;
  const yesterdayPoint = pointAsOf(series, addDays(today, -1));
  const weekPoint = pointAsOf(series, addDays(today, -7)) ?? (first && first.date < today ? first : null);
  return ARC_CATEGORIES.map((category) => {
    const score = now[category].score;
    return {
      category,
      label: ARC_CATEGORY_LABELS[category],
      score,
      grade: now[category].grade,
      yesterday: delta(yesterdayPoint, category, score),
      week: delta(weekPoint, category, score),
      dayOne: first && first.date < today ? delta(first, category, score) : null,
    };
  });
}

/** Sparkline points inside the last `windowDays` days (inclusive of today). */
export function sparklineWindow(series: DayPoint[], today: string, windowDays: number): { date: string; lifeScore: number }[] {
  const start = addDays(today, -(windowDays - 1));
  return series.filter((p) => p.date >= start && p.date <= today).map((p) => ({ date: p.date, lifeScore: p.lifeScore }));
}

/** Lowest score that earns the next letter grade up (scoreToGrade cut-offs), or null at A. */
export function nextGradeCutoff(score: number): number | null {
  const current = scoreToGrade(score);
  const cutoffs: Record<Grade, number | null> = { F: 40, D: 60, C: 75, B: 90, A: null };
  return cutoffs[current];
}
