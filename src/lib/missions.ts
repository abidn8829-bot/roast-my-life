import type { ProComparison } from "@/lib/arc-comparisons";
import {
  addDays,
  ARC_CATEGORIES,
  ARC_CATEGORY_LABELS,
  daysBetween,
  isArcCategory,
  nextGradeCutoff,
  type ArcCategory,
} from "@/lib/arc-trend";
import { scoreToGrade } from "@/lib/grades";
import type { CategoryScores } from "@/lib/roast-types";

export const MISSION_LENGTH = 7;
const NEEDS_WORK_PERCENTILE = 50;

export type MissionStatus = "active" | "completed" | "failed" | "abandoned";
export type MissionDayStatus = "pending" | "done" | "missed";
export type MissionDay = {
  day: number;
  date: string;
  step: string | null;
  why: string | null;
  status: MissionDayStatus;
};

export type MissionRow = {
  id: string;
  user_id: string;
  category: ArcCategory;
  status: MissionStatus;
  start_date: string;
  end_date: string;
  baseline_score: number;
  target_score: number;
  target_label: string;
  root_cause: string | null;
  days: MissionDay[];
  outcome_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type MissionView = {
  id: string;
  category: ArcCategory;
  label: string;
  status: MissionStatus;
  startDate: string;
  endDate: string;
  dayNumber: number;
  baselineScore: number;
  targetScore: number;
  targetLabel: string;
  currentScore: number;
  rootCause: string | null;
  days: MissionDay[];
  today: MissionDay | null;
  tomorrow: MissionDay | null;
  /** Latest saved step with text — shown if today's step couldn't be generated. */
  fallbackStep: { step: string; why: string | null } | null;
  outcomeSummary: string | null;
};

function parseDay(raw: unknown): MissionDay | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const day = Number(o.day);
  if (!Number.isInteger(day) || day < 1 || day > MISSION_LENGTH || typeof o.date !== "string") return null;
  const status = o.status === "done" || o.status === "missed" ? o.status : "pending";
  return {
    day,
    date: o.date,
    step: typeof o.step === "string" && o.step.trim() ? o.step : null,
    why: typeof o.why === "string" && o.why.trim() ? o.why : null,
    status,
  };
}

export function parseMissionRow(raw: Record<string, unknown>): MissionRow | null {
  if (!isArcCategory(raw.category)) return null;
  const days = Array.isArray(raw.days)
    ? raw.days.map(parseDay).filter((d): d is MissionDay => d !== null).sort((a, b) => a.day - b.day)
    : [];
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    category: raw.category,
    status: raw.status as MissionStatus,
    start_date: String(raw.start_date),
    end_date: String(raw.end_date),
    baseline_score: Number(raw.baseline_score),
    target_score: Number(raw.target_score),
    target_label: String(raw.target_label ?? ""),
    root_cause: typeof raw.root_cause === "string" ? raw.root_cause : null,
    days,
    outcome_summary: typeof raw.outcome_summary === "string" ? raw.outcome_summary : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

/** 1-based mission day for `today` (can exceed 7 once the window has passed). */
export function missionDayNumber(startDate: string, today: string): number {
  return Math.max(1, daysBetween(startDate, today) + 1);
}

/**
 * Lowest percentile under 50 (when there's enough sample), otherwise the
 * lowest current score. Categories already at A have no "next grade" to aim
 * for and are skipped. Null when everything is an A.
 */
export function pickMissionCategory(
  comparisons: ProComparison[] | null,
  latest: CategoryScores,
): { category: ArcCategory; emberAvg: number | null } | null {
  const candidates = ARC_CATEGORIES.filter((c) => nextGradeCutoff(latest[c].score) !== null);
  if (candidates.length === 0) return null;

  const avgFor = (c: ArcCategory) => comparisons?.find((x) => x.category === c && !x.insufficientSample)?.avgScore ?? null;

  const ranked = (comparisons ?? []).filter(
    (c) => candidates.includes(c.category) && !c.insufficientSample && c.percentile !== null && c.percentile < NEEDS_WORK_PERCENTILE,
  );
  if (ranked.length > 0) {
    const weakest = ranked.reduce((worst, c) => (c.percentile! < worst.percentile! ? c : worst));
    return { category: weakest.category, emberAvg: avgFor(weakest.category) };
  }

  const lowest = candidates.reduce((worst, c) => (latest[c].score < latest[worst].score ? c : worst));
  return { category: lowest, emberAvg: avgFor(lowest) };
}

/**
 * Target = the lower of the Ember average and the next grade's cut-off, and
 * always above the current score. A check-in that bumps the grade once always
 * lands on or above the cut-off, so the target is always reachable.
 */
export function computeTarget(currentScore: number, emberAvg: number | null): { target: number; label: string } | null {
  const cutoff = nextGradeCutoff(currentScore);
  if (cutoff === null) return null;
  if (emberAvg !== null && emberAvg > currentScore && emberAvg < cutoff) {
    return { target: Math.ceil(emberAvg), label: "Ember average" };
  }
  return { target: cutoff, label: `next grade (${scoreToGrade(cutoff)})` };
}

export type SettleResult = {
  days: MissionDay[];
  changed: boolean;
  finishedStatus: "completed" | "failed" | null;
  /** Day that still needs an AI-generated step, if any. */
  stepNeeded: { day: number; date: string } | null;
};

/**
 * Brings a mission up to `today`: past pending days become missed, skipped
 * days are filled in as missed, and the mission finishes when the target is
 * hit, day 7 is marked, or the 7-day window has passed.
 */
export function settleMission(mission: MissionRow, currentScore: number, today: string): SettleResult {
  let changed = false;
  const n = missionDayNumber(mission.start_date, today);
  const days = mission.days.map((d) => {
    if (d.status === "pending" && d.date < today) {
      changed = true;
      return { ...d, status: "missed" as const };
    }
    return d;
  });

  for (let k = 1; k <= Math.min(n - 1, MISSION_LENGTH); k++) {
    if (!days.some((d) => d.day === k)) {
      days.push({ day: k, date: addDays(mission.start_date, k - 1), step: null, why: null, status: "missed" });
      changed = true;
    }
  }
  days.sort((a, b) => a.day - b.day);

  const lastDay = days.find((d) => d.day === MISSION_LENGTH);
  let finishedStatus: SettleResult["finishedStatus"] = null;
  if (currentScore >= mission.target_score) finishedStatus = "completed";
  else if (n > MISSION_LENGTH || (lastDay && lastDay.status !== "pending")) finishedStatus = "failed";

  let stepNeeded: SettleResult["stepNeeded"] = null;
  if (!finishedStatus) {
    const todayEntry = days.find((d) => d.day === n);
    if (!todayEntry || (!todayEntry.step && todayEntry.status === "pending")) {
      stepNeeded = { day: n, date: addDays(mission.start_date, n - 1) };
    } else if (todayEntry.status !== "pending" && n < MISSION_LENGTH && !days.some((d) => d.day === n + 1)) {
      stepNeeded = { day: n + 1, date: addDays(mission.start_date, n) };
    }
  }

  return { days, changed, finishedStatus, stepNeeded };
}

function normalizeStep(step: string): string {
  return step.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function repeatsPreviousStep(step: string, days: MissionDay[]): boolean {
  const n = normalizeStep(step);
  return days.some((d) => d.step !== null && normalizeStep(d.step) === n);
}

export function templateOutcomeSummary(mission: MissionRow, currentScore: number, status: MissionStatus): string {
  const done = mission.days.filter((d) => d.status === "done").length;
  const label = ARC_CATEGORY_LABELS[mission.category];
  const verb = status === "completed" ? "Hit the target" : status === "abandoned" ? "Abandoned" : "Missed the target";
  return `${verb}: ${label} went ${Math.round(mission.baseline_score)} → ${Math.round(currentScore)} (target ${Math.round(mission.target_score)}), ${done}/${MISSION_LENGTH} days done.`;
}

export function toMissionView(mission: MissionRow, currentScore: number, today: string): MissionView {
  const n = Math.min(missionDayNumber(mission.start_date, today), MISSION_LENGTH);
  const withStep = [...mission.days].reverse().find((d) => d.step !== null);
  return {
    id: mission.id,
    category: mission.category,
    label: ARC_CATEGORY_LABELS[mission.category],
    status: mission.status,
    startDate: mission.start_date,
    endDate: mission.end_date,
    dayNumber: n,
    baselineScore: Math.round(mission.baseline_score),
    targetScore: Math.round(mission.target_score),
    targetLabel: mission.target_label,
    currentScore: Math.round(currentScore),
    rootCause: mission.root_cause,
    days: mission.days,
    today: mission.days.find((d) => d.date === today) ?? null,
    tomorrow: mission.days.find((d) => d.date === addDays(today, 1)) ?? null,
    fallbackStep: withStep?.step ? { step: withStep.step, why: withStep.why } : null,
    outcomeSummary: mission.outcome_summary,
  };
}
