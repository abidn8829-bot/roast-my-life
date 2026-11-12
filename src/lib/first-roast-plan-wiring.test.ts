// Run with: node --test src/lib/first-roast-plan-wiring.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins how src/lib/first-roast-plan.ts is wired into src/app/api/roast/route.ts, by reading the route source (the same
// approach as roast-insert.test.ts), plus two behaviour checks with fake clients. No network, no Groq, no database.
// What this protects: the roast is saved whether or not a plan exists; the plan call only starts after every gate and
// output exit; the plan columns come only from the helper's result; the slow side calls have their own timeouts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { planRowFields } from "./first-roast-plan.ts";
import { insertRoastRowWith } from "./roast-insert.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Removes block comments and `//` line comments (a `//` right after a colon, as in https://, is left alone). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const route = stripComments(read("../app/api/roast/route.ts"));
const at = (needle: string | RegExp) => {
  const index = typeof needle === "string" ? route.indexOf(needle) : route.search(needle);
  assert.notEqual(index, -1, `not found in the roast route: ${needle}`);
  return index;
};

// ---------------------------------------------------------------------------
// the plan call
// ---------------------------------------------------------------------------

test("wiring: the roast route imports and calls generateFirstRoastPlan exactly once", () => {
  assert.match(route, /import \{[^}]*\bgenerateFirstRoastPlan\b[^}]*\} from "@\/lib\/first-roast-plan";/);
  assert.equal(route.match(/generateFirstRoastPlan\(/g)?.length, 1);
  assert.match(route, /const planPromise = generateFirstRoastPlan\(groq, \{ answers, categoryScores: category_scores \}\);/);
});

test("wiring: the plan call starts only after every gate, safety exit and the roast output check, and before the insert", () => {
  const plan = at("generateFirstRoastPlan(");
  // every one of these exits is in the route BEFORE the plan call (their last use is too, except the later output blocks)
  for (const needle of ["gentleGate(", "checkDailyLimit(", "ruleFloorLevel(", "runSafetyClassify(", "respondUnavailable("]) {
    assert.ok(at(needle) < plan, `${needle} must come before the plan call`);
  }
  assert.ok(route.lastIndexOf("respondFlagged(") !== -1);
  // the flagged exits that decide on the roast call's own safety level come before it
  assert.ok(at("if (decision.level !== 0)") < plan, "the roast call's own safety decision comes before the plan call");
  assert.ok(at("if (outputLooksUnsafe(roastText))") < plan, "the roast output check comes before the plan call");
  assert.ok(at("calculateCategoryScores(answers)") < plan, "the category scores exist before the plan call");
  assert.ok(plan < at("insertRoastRow(user.id"), "the plan call comes before the insert");
  assert.equal(route.match(/insertRoastRow\(/g)?.length, 1, "still exactly one insert");
});

test("wiring: the plan is awaited next to the punchline, so it cannot delay the roast beyond the helper's own 8 s timeout", () => {
  assert.match(route, /const cardPunchline = await punchlinePromise;\s*const firstRoastPlan = await planPromise;/);
  const helper = stripComments(read("./first-roast-plan.ts"));
  assert.match(helper, /const PLAN_CALL_OPTIONS = \{ timeout: 8_000, maxRetries: 0 \} as const;/);
  assert.match(helper, /\bPLAN_CALL_OPTIONS,\s*\);/, "the options are passed to the Groq call");
});

// ---------------------------------------------------------------------------
// what is saved
// ---------------------------------------------------------------------------

test("wiring: plan_steps and suggestion_line enter baseRow only through planRowFields(helper result)", () => {
  const baseRow = route.match(/const baseRow = \{[\s\S]*?\n  \};/);
  assert.ok(baseRow, "baseRow not found");
  assert.match(baseRow[0], /\.\.\.planRowFields\(firstRoastPlan\),/);
  assert.doesNotMatch(baseRow[0], /\bplan_steps\s*:|\bsuggestion_line\s*:/, "no hand-written plan keys, and never a null one");
  assert.doesNotMatch(baseRow[0], /\btone\b/);
  assert.match(route, /import \{[^}]*\bplanRowFields\b[^}]*\} from "@\/lib\/first-roast-plan";/);
  assert.equal(route.match(/\bplan_steps\b|\bsuggestion_line\b/g), null, "the route itself never names the columns");
});

test("saving: with a plan the row gets plan_steps { challenge, steps } and suggestion_line; without one it gets neither key", () => {
  const plan = {
    challenge: "Put the phone in another room for ten minutes.",
    planSteps: [
      { step: "Set a ten minute timer.", why: "A small start is easy to keep." },
      { step: "Leave the phone out of reach until it rings.", why: "Distance beats willpower." },
    ],
    suggestionLine: "Your phone time is the biggest thing to work on, so start with one ten minute break today.",
  };
  const base = { roast_text: "r", life_score: 50, card_punchline: "p" };
  const withPlan = { ...base, ...planRowFields(plan) };
  const withoutPlan = { ...base, ...planRowFields(null) };
  assert.deepEqual(withPlan, {
    ...base,
    plan_steps: { challenge: plan.challenge, steps: plan.planSteps },
    suggestion_line: plan.suggestionLine,
  });
  assert.deepEqual(withoutPlan, base);
  assert.equal("plan_steps" in withoutPlan, false);
  assert.equal("suggestion_line" in withoutPlan, false);
});

test("saving: the plan shape is the one the result page reads (challenge and steps)", () => {
  const view = read("../components/roast-view.tsx");
  assert.match(view, /planSteps\.challenge/);
  assert.match(view, /Array\.isArray\(planSteps\.steps\)/);
  const checkIn = read("../app/api/check-in/route.ts");
  assert.match(checkIn, /type ChallengePlan = \{ challenge: string; steps: PlanStep\[\] \};/);
  assert.match(checkIn, /plan_steps: plan/);
});

test("saving: when the insert retries without card_punchline, the plan columns are still in the retried row", async () => {
  const payloads: Record<string, unknown>[] = [];
  let attempt = 0;
  const service = {
    from: () => ({
      insert: (payload: Record<string, unknown>) => ({
        select: async () => {
          payloads.push(payload);
          attempt += 1;
          return attempt === 1
            ? { data: null, error: { code: "42703", message: 'column "card_punchline" does not exist' } }
            : { data: [{ id: "new-id" }], error: null };
        },
      }),
    }),
  };
  const row = { roast_text: "r", card_punchline: "p", ...planRowFields({ challenge: "c", planSteps: [{ step: "s1", why: "w1" }, { step: "s2", why: "w2" }], suggestionLine: "l" }) };
  const result = await insertRoastRowWith(() => service as never, "user-1", row);
  assert.deepEqual(result, { data: { id: "new-id" }, error: null });
  assert.equal(payloads.length, 2);
  assert.ok("card_punchline" in payloads[0]);
  assert.ok(!("card_punchline" in payloads[1]), "the retry drops card_punchline");
  for (const payload of payloads) {
    assert.deepEqual(payload.plan_steps, { challenge: "c", steps: [{ step: "s1", why: "w1" }, { step: "s2", why: "w2" }] });
    assert.equal(payload.suggestion_line, "l");
  }
});

// ---------------------------------------------------------------------------
// the slow side calls
// ---------------------------------------------------------------------------

test("wiring: the memory call and the punchline call have a 10 s timeout and no retries", () => {
  assert.match(route, /const SIDE_CALL_OPTIONS = \{ timeout: 10_000, maxRetries: 0 \} as const;/);
  // memory: the options are the second argument of its create() call
  const memory = route.slice(at("const memoryCompletion = await groq.chat.completions.create("), at("const memoryContent"));
  assert.match(memory, /\}, SIDE_CALL_OPTIONS\);/);
  // punchline: its helper makes the calls, so it is handed a client built with the same limits
  assert.match(route, /const punchlineGroq = new Groq\(\{ apiKey, \.\.\.SIDE_CALL_OPTIONS \}\);/);
  assert.match(route, /generateCardPunchline\(punchlineGroq, MODEL,/);
  assert.doesNotMatch(route, /generateCardPunchline\(groq,/);
});

test("wiring: the route comment no longer claims the side calls each have a timeout 'of their own' by luck", () => {
  const raw = read("../app/api/roast/route.ts");
  assert.doesNotMatch(raw, /each with a timeout of its own/);
  assert.match(raw, /SIDE_CALL_OPTIONS/);
});

test("wiring: the main pinned shapes are untouched (one persona prompt, gates before it, insert last)", () => {
  assert.equal(route.match(/buildPersonaPrompt\(/g)?.length, 1);
  assert.ok(at("gentleGate(") < at("buildPersonaPrompt("));
  assert.ok(at("buildPersonaPrompt(") < at("insertRoastRow(user.id"));
  assert.ok(at("await gentleGate(supabase, user.id)") < at("new Groq("), "the pause gate still comes before the first Groq client");
});
