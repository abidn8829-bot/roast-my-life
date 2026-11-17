// Run with: node --test src/lib/skills/access.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { FREE_MONTH_COUNT, canOpenMonth, isFreeMonth } from "./access.ts";
import type { Tier } from "./types.ts";

const access = (month: number, tier: Tier) => canOpenMonth({ monthIsFree: isFreeMonth(month), tier });

test("only month 1 is free", () => {
  assert.equal(FREE_MONTH_COUNT, 1);
  assert.equal(isFreeMonth(1), true);
  for (const m of [2, 3, 4, 5, 6]) assert.equal(isFreeMonth(m), false, `month ${m}`);
});

test("free users: month 1 open, months 2 to 6 locked", () => {
  assert.equal(access(1, "free"), "open");
  for (const m of [2, 3, 4, 5, 6]) assert.equal(access(m, "free"), "locked", `month ${m}`);
});

test("Pro users: all six months open", () => {
  for (const m of [1, 2, 3, 4, 5, 6]) assert.equal(access(m, "pro"), "open", `month ${m}`);
});

test("lapsed Pro (tier is free again): months 2 to 6 lock straight away, month 1 stays open", () => {
  assert.equal(access(4, "pro"), "open");
  assert.equal(access(4, "free"), "locked");
  assert.equal(access(1, "free"), "open");
});

test("bad input never opens a month", () => {
  for (const m of [0, -1, 1.5, NaN, Infinity]) assert.equal(isFreeMonth(m), false, String(m));
  assert.equal(canOpenMonth({ monthIsFree: false, tier: "gold" as unknown as Tier }), "locked");
  assert.equal(canOpenMonth({ monthIsFree: undefined as unknown as boolean, tier: "free" }), "locked");
});
