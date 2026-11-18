// What the skills home says and offers, worked out from getHome's answer. Pure: no React, no database, no clock.
// (No "@/" imports on purpose: the tests in this folder load this file directly with Node.)

import type { HomeNext } from "./skills-server.ts";

export type HomeAction =
  | { kind: "session"; label: string }
  | { kind: "review"; label: string }
  | { kind: "wait"; label: string };

export const START_LABEL = "Start today's session";
export const WAIT_LABEL = "Come back tomorrow";
export const reviewLabel = (due: number) => `Review (${due} due)`;

const hasDue = (due: number) => Number.isFinite(due) && due > 0;

/**
 * The ONE primary button.
 *   the next step is open            -> "Start today's session"
 *   waiting, or the pack is finished -> "Review (n due)" if reviews are due, else "Come back tomorrow"
 *   the next step is in a locked month -> "Review (n due)" if reviews are due, else no button (the upgrade panel is shown)
 */
export function homeAction(next: HomeNext, dueReviews: number): HomeAction | null {
  if ("locked" in next) return hasDue(dueReviews) ? { kind: "review", label: reviewLabel(dueReviews) } : null;
  if ("done" in next || next.open === false) {
    return hasDue(dueReviews) ? { kind: "review", label: reviewLabel(dueReviews) } : { kind: "wait", label: WAIT_LABEL };
  }
  return { kind: "session", label: START_LABEL };
}

/** "Month 1 · Week 2 · Day 3" for a step that is open or waiting; null when finished or locked. */
export function positionLine(next: HomeNext): string | null {
  if ("locked" in next || "done" in next) return null;
  return `Month ${next.month} · Week ${next.weekNo} · Day ${next.dayNo}`;
}

/** A short note when the main button is the session but reviews are waiting too. */
export function dueNote(next: HomeNext, dueReviews: number): string | null {
  if ("locked" in next || "done" in next || next.open === false || !hasDue(dueReviews)) return null;
  return dueReviews === 1 ? "1 review is due" : `${dueReviews} reviews are due`;
}

export const EMPTY_LINE = "Start with Week 1, Day 1";
export const DONE_LINE = "You have finished every step in this pack.";

/** Whole percent of steps done, 0 to 100. */
export function percentDone(done: number, total: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}
