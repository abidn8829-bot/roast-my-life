// Run with: node --test src/lib/skills/schedule.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LAST_REVIEW_STAGE,
  NEW_STEP_GAP_HOURS,
  REVIEW_INTERVAL_DAYS,
  applyReview,
  buildReviewQueue,
  newReviewItem,
  nextNewStep,
} from "./schedule.ts";
import type { ReviewItem, ReviewStage } from "./types.ts";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const M = 60_000;
const H = 3_600_000;
const D = 24 * H;

// ---------------------------------------------------------------------------
// (a) The next new step
// ---------------------------------------------------------------------------

test("constants are the agreed numbers", () => {
  assert.equal(NEW_STEP_GAP_HOURS, 20);
  assert.deepEqual([...REVIEW_INTERVAL_DAYS], [1, 3, 7, 14]);
  assert.equal(LAST_REVIEW_STAGE, 3);
});

test("20-hour edge: 19h59 after the last step is still closed, 20h00 is open, 20h01 is open", () => {
  const done = NOW;
  assert.equal(nextNewStep(3, done, done + 19 * H + 59 * M).open, false);
  assert.equal(nextNewStep(3, done, done + 20 * H).open, true);
  assert.equal(nextNewStep(3, done, done + 20 * H + M).open, true);
  assert.equal(nextNewStep(3, done, done).open, false);
  assert.equal(nextNewStep(3, done, done).opensAt, done + 20 * H);
});

test("a gap of 30 days gives the same next step: nothing is skipped", () => {
  const done = NOW;
  const soon = nextNewStep(7, done, done + 21 * H);
  const late = nextNewStep(7, done, done + 30 * D);
  assert.equal(soon.stepIndex, 7);
  assert.equal(late.stepIndex, 7);
  assert.equal(late.open, true);
  assert.equal(late.opensAt, soon.opensAt); // the opening time still counts from the last completion
});

test("the first step is always open (nothing completed yet)", () => {
  assert.deepEqual(nextNewStep(0, null, NOW), { stepIndex: 0, opensAt: null, open: true });
});

test("bad input never opens a step early and never throws", () => {
  assert.equal(nextNewStep(3, NaN, NOW).open, false);
  assert.equal(nextNewStep(3, NOW, NaN).open, false);
  assert.equal(nextNewStep(-2, null, NOW).stepIndex, 0);
  assert.equal(nextNewStep(2.5, null, NOW).stepIndex, 0);
});

// ---------------------------------------------------------------------------
// (b) Review stages
// ---------------------------------------------------------------------------

test("a new item starts at stage 0, due after 1 day", () => {
  assert.deepEqual(newReviewItem("a", 1, NOW), { id: "a", month: 1, stage: 0, dueAt: NOW + 1 * D });
});

test("correct goes up one stage and is due after that stage's wait: 0 to 1 (3 days), 1 to 2 (7 days), 2 to 3 (14 days)", () => {
  assert.deepEqual(applyReview(0, true, NOW), { retired: false, stage: 1, dueAt: NOW + 3 * D });
  assert.deepEqual(applyReview(1, true, NOW), { retired: false, stage: 2, dueAt: NOW + 7 * D });
  assert.deepEqual(applyReview(2, true, NOW), { retired: false, stage: 3, dueAt: NOW + 14 * D });
});

test("correct at stage 3 retires the item", () => {
  assert.deepEqual(applyReview(3, true, NOW), { retired: true });
});

test("wrong goes back to stage 0 (due after 1 day) from every stage", () => {
  for (const stage of [0, 1, 2, 3] as ReviewStage[]) {
    assert.deepEqual(applyReview(stage, false, NOW), { retired: false, stage: 0, dueAt: NOW + 1 * D }, `from stage ${stage}`);
  }
});

test("walking an item all the way through: 0, 1, 2, 3, retired", () => {
  let stage: ReviewStage = 0;
  const seen: number[] = [stage];
  for (;;) {
    const out = applyReview(stage, true, NOW);
    if (out.retired) break;
    stage = out.stage;
    seen.push(stage);
  }
  assert.deepEqual(seen, [0, 1, 2, 3]);
});

// ---------------------------------------------------------------------------
// (c) The review queue
// ---------------------------------------------------------------------------

const item = (id: string, month: number, dueAt: number, stage: ReviewStage = 0): ReviewItem => ({ id, month, stage, dueAt });

test("only due items are in the queue; an item due exactly now is in", () => {
  const items = [item("past", 1, NOW - H), item("now", 1, NOW), item("later", 1, NOW + 1)];
  assert.deepEqual(buildReviewQueue(items, "pro", NOW).map((i) => i.id), ["past", "now"]);
});

test("free users: items from locked months (2 to 6) are left out, month 1 stays", () => {
  const items = [1, 2, 3, 4, 5, 6].map((m) => item(`m${m}`, m, NOW - H));
  assert.deepEqual(buildReviewQueue(items, "free", NOW).map((i) => i.id), ["m1"]);
});

test("Pro users: items from every month are in the queue", () => {
  const items = [1, 2, 3, 4, 5, 6].map((m) => item(`m${m}`, m, NOW - H));
  assert.equal(buildReviewQueue(items, "pro", NOW).length, 6);
});

test("lapsed Pro: month 4 items leave the queue, and come back when the user is on Pro again", () => {
  const items = [item("keep", 1, NOW - H), item("pro-month", 4, NOW - 2 * H)];
  assert.deepEqual(buildReviewQueue(items, "pro", NOW).map((i) => i.id), ["pro-month", "keep"]);
  assert.deepEqual(buildReviewQueue(items, "free", NOW).map((i) => i.id), ["keep"]);
  assert.deepEqual(buildReviewQueue(items, "pro", NOW + 7 * D).map((i) => i.id), ["pro-month", "keep"]);
});

test("oldest due first, ties by id; the input is not changed; bad rows are ignored", () => {
  const items = [item("b", 1, NOW - H), item("a", 1, NOW - H), item("old", 1, NOW - 5 * H)];
  const copy = structuredClone(items);
  assert.deepEqual(buildReviewQueue(items, "free", NOW).map((i) => i.id), ["old", "a", "b"]);
  assert.deepEqual(items, copy);
  assert.deepEqual(buildReviewQueue([null as unknown as ReviewItem, item("x", 1, NaN)], "pro", NOW), []);
  assert.deepEqual(buildReviewQueue(items, "pro", NaN), []);
});
