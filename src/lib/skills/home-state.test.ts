// Run with: node --test src/lib/skills/home-state.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { dueNote, homeAction, percentDone, positionLine } from "./home-state.ts";

const open = { open: true, month: 1, weekNo: 2, dayNo: 3 } as const;
const wait = { open: false, month: 1, weekNo: 2, dayNo: 3, opensAt: null } as const;
const locked = { locked: true, month: 2, teaser: "t" } as const;
const done = { done: true } as const;

test("homeAction: the open step wins; reviews fill the waiting and finished states", () => {
  assert.deepEqual(homeAction(open, 0), { kind: "session", label: "Start today's session" });
  assert.deepEqual(homeAction(open, 4), { kind: "session", label: "Start today's session" });
  assert.deepEqual(homeAction(wait, 0), { kind: "wait", label: "Come back tomorrow" });
  assert.deepEqual(homeAction(wait, 3), { kind: "review", label: "Review (3 due)" });
  assert.deepEqual(homeAction(done, 0), { kind: "wait", label: "Come back tomorrow" });
  assert.deepEqual(homeAction(done, 1), { kind: "review", label: "Review (1 due)" });
  assert.equal(homeAction(locked, 0), null, "a locked month shows the upgrade panel instead of a button");
  assert.deepEqual(homeAction(locked, 2), { kind: "review", label: "Review (2 due)" });
  assert.deepEqual(homeAction(open, NaN), { kind: "session", label: "Start today's session" });
});

test("positionLine: 'Month n · Week n · Day n' only for an open or waiting step", () => {
  assert.equal(positionLine(open), "Month 1 · Week 2 · Day 3");
  assert.equal(positionLine(wait), "Month 1 · Week 2 · Day 3");
  assert.equal(positionLine(locked), null);
  assert.equal(positionLine(done), null);
});

test("dueNote: only beside an open session", () => {
  assert.equal(dueNote(open, 1), "1 review is due");
  assert.equal(dueNote(open, 3), "3 reviews are due");
  assert.equal(dueNote(open, 0), null);
  for (const n of [wait, locked, done]) assert.equal(dueNote(n, 5), null);
});

test("percentDone: 0 to 100, never NaN", () => {
  assert.equal(percentDone(0, 0), 0);
  assert.equal(percentDone(5, 10), 50);
  assert.equal(percentDone(11, 10), 100);
  assert.equal(percentDone(-1, 10), 0);
  assert.equal(percentDone(NaN, 10), 0);
});

test("no word in this file says missed or failed", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(new URL("./home-state.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(text, /missed|failed/i);
});
