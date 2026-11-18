// Run with: node --test src/lib/skills/quiz-state.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { optionLetter, optionState, outcomeLabel, usableOptions } from "./quiz-state.ts";

test("usableOptions: 2 to 5 pieces of text, otherwise nothing", () => {
  assert.deepEqual(usableOptions(["a", "b"]), ["a", "b"]);
  assert.equal(usableOptions(["a", "b", "c", "d", "e"]).length, 5);
  for (const bad of [[], ["a"], ["a", "b", "c", "d", "e", "f"], ["a", 2], ["a", " "], null, undefined, "ab" as never]) {
    assert.deepEqual(usableOptions(bad as never), []);
  }
});

test("optionLetter: A to E, nothing else", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(optionLetter), ["A", "B", "C", "D", "E"]);
  for (const bad of [-1, 5, 1.5, NaN]) assert.equal(optionLetter(bad), "");
});

test("optionState: before an answer everything is idle; only the picked option is right or wrong", () => {
  for (let i = 0; i < 4; i++) assert.equal(optionState(i, null, null), "idle");
  assert.equal(optionState(1, 1, null), "idle");
  assert.equal(optionState(1, 1, "right"), "right");
  assert.equal(optionState(0, 1, "right"), "dim");
  assert.equal(optionState(1, 1, "wrong"), "wrong");
  assert.equal(optionState(0, 1, "wrong"), "idle", "after a wrong answer the others stay open");
  assert.equal(optionState(0, null, "right"), "idle");
});

test("outcomeLabel: words for the result, never 'wrong' or 'failed'", () => {
  assert.equal(outcomeLabel("right"), "Right");
  assert.equal(outcomeLabel("wrong"), "Not quite");
  assert.equal(outcomeLabel(null), "");
  for (const o of ["right", "wrong", null] as const) assert.doesNotMatch(outcomeLabel(o), /wrong|failed|missed/i);
});
