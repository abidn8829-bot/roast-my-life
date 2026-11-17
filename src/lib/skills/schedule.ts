// When things come up in "learn a skill": the next new step, review stages, and the review queue.
// PURE functions: they get "now" as epoch milliseconds and return the answer. No database, no clock, no I/O.
// (No "@/" imports on purpose: src/lib/skills/*.test.ts import this with Node.)
//
// (a) Next new step: opens 20 hours after the last step was completed. Waiting longer changes nothing: after a gap
//     of 30 days the user gets the SAME next step. Nothing is ever counted against them, and no step is skipped.
// (b) Review stages: 0 = due after 1 day, 1 = 3 days, 2 = 7 days, 3 = 14 days.
//     Correct moves up one stage. Wrong goes back to stage 0. Correct at stage 3 retires the item.
// (c) Review queue: free users do not see items from locked months. Pro users see everything that is due.

import { canOpenMonth, isFreeMonth } from "./access.ts";
import type { ReviewItem, ReviewOutcome, ReviewStage, Tier } from "./types.ts";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** A new step opens this many hours after the previous one was completed. */
export const NEW_STEP_GAP_HOURS = 20;

/** Days until an item is due again, by stage (index = stage). Change a number here to change the schedule. */
export const REVIEW_INTERVAL_DAYS: readonly [number, number, number, number] = [1, 3, 7, 14];

/** The last stage. A correct answer here retires the item. */
export const LAST_REVIEW_STAGE: ReviewStage = 3;

export type NextStep = {
  /** Which step comes next (0-based). Always the number of steps already completed, however long the gap. */
  stepIndex: number;
  /** When it opens (epoch ms), or null when no step has been completed yet (the first step is always open). */
  opensAt: number | null;
  open: boolean;
};

/**
 * The next new step. `completedSteps` is how many steps the user has finished; `lastCompletedAt` is when the most
 * recent one was completed (null when none). The step number never depends on the clock, so a long gap cannot skip one.
 */
export function nextNewStep(completedSteps: number, lastCompletedAt: number | null, now: number): NextStep {
  const stepIndex = Number.isInteger(completedSteps) && completedSteps > 0 ? completedSteps : 0;
  if (lastCompletedAt === null) return { stepIndex, opensAt: null, open: true };
  if (!Number.isFinite(lastCompletedAt) || !Number.isFinite(now)) return { stepIndex, opensAt: null, open: false };
  const opensAt = lastCompletedAt + NEW_STEP_GAP_HOURS * HOUR_MS;
  return { stepIndex, opensAt, open: now >= opensAt };
}

/** A brand-new review item: stage 0, due after the first interval. */
export function newReviewItem(id: string, month: number, learnedAt: number): ReviewItem {
  return { id, month, stage: 0, dueAt: learnedAt + REVIEW_INTERVAL_DAYS[0] * DAY_MS };
}

/**
 * What one review does to an item. Correct: up one stage (retired after stage 3). Wrong: back to stage 0.
 * `now` is when the review was answered; the next due time counts from then.
 */
export function applyReview(stage: ReviewStage, correct: boolean, now: number): ReviewOutcome {
  if (correct) {
    if (stage >= LAST_REVIEW_STAGE) return { retired: true };
    const next = (stage + 1) as ReviewStage;
    return { retired: false, stage: next, dueAt: now + REVIEW_INTERVAL_DAYS[next] * DAY_MS };
  }
  return { retired: false, stage: 0, dueAt: now + REVIEW_INTERVAL_DAYS[0] * DAY_MS };
}

/**
 * The items to review now: due items only, oldest first. Free users do not get items from locked months
 * (they stay stored and come back if the user is on Pro again). Never throws; the input is not changed.
 */
export function buildReviewQueue(items: readonly ReviewItem[], tier: Tier, now: number): ReviewItem[] {
  if (!Number.isFinite(now)) return [];
  const due: ReviewItem[] = [];
  for (const item of items ?? []) {
    if (!item || !Number.isFinite(item.dueAt) || item.dueAt > now) continue;
    if (canOpenMonth({ monthIsFree: isFreeMonth(item.month), tier }) !== "open") continue;
    due.push(item);
  }
  return due.sort((a, b) => a.dueAt - b.dueAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
