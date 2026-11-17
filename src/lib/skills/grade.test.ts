// Run with: node --test src/lib/skills/grade.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { WEEKLY_PASS_MARK, WEEKLY_TEST_SIZE, gradeWeeklyTest, isCorrect } from "./grade.ts";
import type { WeeklyAnswer } from "./types.ts";

/** A 5-question test where the days in `wrongDays` are answered wrongly. */
function test5(wrongDays: number[]): WeeklyAnswer[] {
  return [1, 2, 3, 4, 5].map((day) => ({ day, correctIndex: 2, chosenIndex: wrongDays.includes(day) ? 0 : 2 }));
}

test("constants: 5 questions, pass mark 4", () => {
  assert.equal(WEEKLY_TEST_SIZE, 5);
  assert.equal(WEEKLY_PASS_MARK, 4);
});

test("isCorrect: only the exact right index counts", () => {
  assert.equal(isCorrect(2, 2), true);
  assert.equal(isCorrect(0, 0), true); // index 0 is a real answer
  assert.equal(isCorrect(1, 2), false);
  for (const bad of [NaN, 1.5, Infinity, -1, null, undefined, "2"]) {
    assert.equal(isCorrect(bad as unknown as number, 2), false, String(bad));
  }
  assert.equal(isCorrect(NaN, NaN), false);
});

test("pass mark edge: 3 of 5 does not pass, 4 of 5 passes, 5 of 5 passes", () => {
  assert.equal(gradeWeeklyTest(test5([1, 2])).passed, false); // 3 right
  assert.equal(gradeWeeklyTest(test5([1, 2])).score, 3);
  assert.equal(gradeWeeklyTest(test5([4])).passed, true); // 4 right
  assert.equal(gradeWeeklyTest(test5([4])).score, 4);
  assert.equal(gradeWeeklyTest(test5([])).passed, true); // 5 right
});

test("0 of 5 does not pass and every day is weak", () => {
  const r = gradeWeeklyTest(test5([1, 2, 3, 4, 5]));
  assert.deepEqual(r, { score: 0, total: 5, passed: false, weakDays: [1, 2, 3, 4, 5] });
});

test("weak days are the days answered wrongly, in day order, even when the answers arrive shuffled", () => {
  const shuffled = test5([2, 5]).reverse();
  const r = gradeWeeklyTest(shuffled);
  assert.deepEqual(r.weakDays, [2, 5]);
  assert.equal(r.score, 3);
  assert.equal(r.total, 5);
});

test("a perfect week has no weak days", () => {
  assert.deepEqual(gradeWeeklyTest(test5([])).weakDays, []);
});

test("bad input: a non-integer pick is wrong; empty / missing lists never throw; the input is not changed", () => {
  const answers = test5([]);
  answers[0] = { day: 1, correctIndex: 2, chosenIndex: NaN };
  const copy = structuredClone(answers);
  const r = gradeWeeklyTest(answers);
  assert.equal(r.score, 4);
  assert.deepEqual(r.weakDays, [1]);
  assert.deepEqual(answers.map((a) => a.day), copy.map((a) => a.day));
  assert.deepEqual(gradeWeeklyTest([]), { score: 0, total: 0, passed: false, weakDays: [] });
  assert.equal(gradeWeeklyTest(undefined as unknown as WeeklyAnswer[]).passed, false);
});
