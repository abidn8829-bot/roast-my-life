// Run with: node --test src/lib/skills/enabled.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { skillsEnabled } from "./enabled.ts";

function withSwitch<T>(value: string | undefined, fn: () => T): T {
  const before = process.env.SKILLS_ENABLED;
  if (value === undefined) delete process.env.SKILLS_ENABLED;
  else process.env.SKILLS_ENABLED = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.SKILLS_ENABLED;
    else process.env.SKILLS_ENABLED = before;
  }
}

test("skillsEnabled is true only for the exact text 1", () => {
  assert.equal(withSwitch("1", skillsEnabled), true);
});

test("skillsEnabled is false for anything else, including when it is not set", () => {
  for (const v of [undefined, "", "0", "true", "TRUE", "yes", "on", " 1", "1 ", "01", "11", "1\n"]) {
    assert.equal(withSwitch(v, skillsEnabled), false, `value ${JSON.stringify(v)}`);
  }
});

test("skillsEnabled reads the setting on every call (no value is remembered)", () => {
  assert.equal(withSwitch("1", skillsEnabled), true);
  assert.equal(withSwitch("0", skillsEnabled), false);
  assert.equal(withSwitch("1", skillsEnabled), true);
});
