// Checking answers in "learn a skill": one answer, and the weekly test. PURE functions: no database, no clock, no I/O.
// (No "@/" imports on purpose: src/lib/skills/*.test.ts import this with Node.)
//
// The weekly test has 5 questions (one per day). The pass mark is 4 right out of 5. Change the two numbers
// below to change the rule; nothing else needs to move.
// A "weak day" is a day whose question was answered wrongly.

import type { WeeklyAnswer, WeeklyResult } from "./types.ts";

/** Questions in the weekly test. */
export const WEEKLY_TEST_SIZE = 5;
/** Right answers needed to pass the weekly test. */
export const WEEKLY_PASS_MARK = 4;

/** True when the chosen index is a whole number and is the right one. Anything else (NaN, 1.5, null) is wrong. */
export function isCorrect(chosenIndex: number, correctIndex: number): boolean {
  return Number.isInteger(chosenIndex) && Number.isInteger(correctIndex) && chosenIndex === correctIndex;
}

/** Score the weekly test. Never throws; the input is not changed. */
export function gradeWeeklyTest(answers: readonly WeeklyAnswer[]): WeeklyResult {
  const list = (answers ?? []).filter((a) => a && typeof a === "object");
  const weak = new Set<number>();
  let score = 0;
  for (const a of list) {
    if (isCorrect(a.chosenIndex, a.correctIndex)) score += 1;
    else weak.add(a.day);
  }
  return {
    score,
    total: list.length,
    passed: score >= WEEKLY_PASS_MARK,
    weakDays: [...weak].sort((x, y) => x - y),
  };
}
