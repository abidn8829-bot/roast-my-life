// Run with: node --test src/lib/roast-plan-loading.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// The roast result page loads the plan on the SERVER, together with the roast, so the page is complete in the first
// HTML. What this pins, by reading the source (the same approach as roast-back-link.test.ts):
//   - the owner fetch selects plan_steps, and its id + user_id pairing is intact,
//   - page.tsx validates the plan and passes it down as one prop, and keeps its pinned link and shape,
//   - roast-view.tsx draws a valid plan at once and skips the browser fetch, and keeps the fetch as the fallback,
//   - the plan is PRIVATE: the public share page, the share image and their data helpers never mention plan_steps.
// Nothing here runs a page, touches a database or calls any AI.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parsePlanSteps } from "./parse-plan-steps.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Removes block comments and `//` line comments (a `//` right after a colon, as in https://, is left alone). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

// ---------------------------------------------------------------------------
// the validator
// ---------------------------------------------------------------------------

const GOOD = { challenge: "Put the phone in another room for ten minutes.", steps: [{ step: "Set a timer.", why: "Small starts stick." }, { step: "Leave it out of reach.", why: "Distance beats willpower." }] };

test("parsePlanSteps: accepts a challenge with 2 or 3 filled steps", () => {
  assert.deepEqual(parsePlanSteps(GOOD), GOOD);
  const three = { ...GOOD, steps: [...GOOD.steps, { step: "Third.", why: "Because." }] };
  assert.deepEqual(parsePlanSteps(three), three);
});

test("parsePlanSteps: gives null for anything else (the page then keeps today's browser fetch)", () => {
  const s = GOOD.steps[0];
  for (const bad of [
    null, undefined, "plan", 5, [], [GOOD],
    {}, { challenge: "c" }, { steps: GOOD.steps },
    { ...GOOD, challenge: "" }, { ...GOOD, challenge: "   " }, { ...GOOD, challenge: 5 },
    { ...GOOD, steps: [] }, { ...GOOD, steps: [s] }, { ...GOOD, steps: [s, s, s, s] }, { ...GOOD, steps: "two" },
    { ...GOOD, steps: [s, null] }, { ...GOOD, steps: [s, "x"] },
    { ...GOOD, steps: [s, { step: "", why: "w" }] }, { ...GOOD, steps: [s, { step: "s", why: " " }] },
    { ...GOOD, steps: [s, { step: 1, why: "w" }] }, { ...GOOD, steps: [s, { step: "s" }] },
  ]) {
    assert.equal(parsePlanSteps(bad), null, JSON.stringify(bad));
  }
});

test("parsePlanSteps: copies only challenge and steps", () => {
  const plan = parsePlanSteps({ ...GOOD, extra: "x", steps: GOOD.steps.map((x) => ({ ...x, note: "n" })) });
  assert.deepEqual(plan, GOOD);
});

test("parsePlanSteps: no imports (so this file runs on its own and cannot reach a database)", () => {
  assert.doesNotMatch(stripComments(read("./parse-plan-steps.ts")), /^import\b/m);
});

// ---------------------------------------------------------------------------
// the owner fetch
// ---------------------------------------------------------------------------

test("owner fetch: plan_steps is selected, and every id lookup is still paired with the owner filter", () => {
  const lookup = stripComments(read("./fetch-own-roast.ts"));
  assert.match(lookup, /\.select\("[^"]*\bsuggestion_line, plan_steps"\)/);
  assert.match(lookup, /plan_steps: data\.plan_steps \?\? undefined,/);
  const byId = lookup.match(/\.eq\("id", roastId\)/g) ?? [];
  const byIdAndOwner = lookup.match(/\.eq\("id", roastId\)\s*\.eq\("user_id", userId\)/g) ?? [];
  assert.ok(byId.length >= 1);
  assert.equal(byIdAndOwner.length, byId.length, 'every .eq("id", roastId) is followed by .eq("user_id", userId)');
});

// ---------------------------------------------------------------------------
// the page
// ---------------------------------------------------------------------------

test("page: the plan is validated on the server and passed down as initialPlan", () => {
  const page = stripComments(read("../app/roast/[id]/page.tsx"));
  assert.match(page, /import \{ parsePlanSteps \} from "@\/lib\/parse-plan-steps";/);
  assert.match(page, /initialPlan=\{parsePlanSteps\(roast\.plan_steps\)\}/);
  assert.equal(page.match(/parsePlanSteps\(/g)?.length, 1);
});

test("page: the pinned pieces are intact (one dashboard link, no other link, owner order, backfill call)", () => {
  const page = stripComments(read("../app/roast/[id]/page.tsx"));
  const links = [...page.matchAll(/<Link\b[\s\S]*?<\/Link>/g)].map((m) => m[0]);
  assert.equal(links.length, 1);
  assert.match(links[0], /^<Link\s+href="\/dashboard"/);
  assert.match(links[0], />\s*Back to dashboard\s*<\/Link>$/);
  assert.deepEqual([...page.matchAll(/\bhref=(\{[^}]*\}|"[^"]*")/g)].map((m) => m[1]), ['"/dashboard"']);
  assert.doesNotMatch(page, /<a\b/);
  assert.match(page, /backfillCardPunchline\(supabase, roast, user\.id\)/);
  assert.ok(page.indexOf("fetchOwnRoastById(supabase, roastId, user.id)") < page.indexOf("parsePlanSteps(roast.plan_steps)"), "the plan is only read after the owner lookup");
});

// ---------------------------------------------------------------------------
// the view
// ---------------------------------------------------------------------------

test("view: a valid server plan is drawn at once and the browser fetch is skipped; the fetch stays as the fallback", () => {
  const view = stripComments(read("../components/roast-view.tsx"));
  assert.match(view, /initialPlan\?: ChallengePlan \| null;/);
  assert.match(view, /initialPlan = null,/);
  assert.match(view, /const visiblePlan = initialPlan \?\? plan;/);
  // the effect returns before it touches the browser client when a plan was passed
  const effect = view.slice(view.indexOf("useEffect(() => {\n    if (initialPlan) return;"));
  assert.ok(effect.startsWith("useEffect"), "the effect starts with the skip");
  assert.ok(effect.indexOf("if (initialPlan) return;") < effect.indexOf("createSupabaseBrowserClient()"), "the skip comes before the fetch");
  assert.match(effect, /\.select\("plan_steps"\)\s*\.eq\("id", roastId\)\s*\.maybeSingle\(\)/, "the fallback fetch is unchanged");
  assert.match(effect, /\[roastId, initialPlan\]\);/);
  // the plan section is drawn from the combined value
  assert.match(view, /\{visiblePlan && \(/);
  assert.match(view, /\{visiblePlan\.challenge\}/);
  assert.match(view, /visiblePlan\.steps\.map\(/);
});

test("view: the text /dashboard is still absent (pinned by roast-back-link.test.ts)", () => {
  assert.doesNotMatch(stripComments(read("../components/roast-view.tsx")), /\/dashboard/);
});

// ---------------------------------------------------------------------------
// privacy: the plan never reaches a public page
// ---------------------------------------------------------------------------

test("privacy: the public share page, the share image and their data helpers never mention plan_steps or the plan", () => {
  for (const file of [
    "../app/share/[slug]/page.tsx",
    "../app/api/og/[id]/route.tsx",
    "./get-share-card.ts",
    "./get-roast-public.ts",
    "../components/share-cta.tsx",
  ]) {
    const code = read(file);
    assert.doesNotMatch(code, /plan_steps|planSteps|initialPlan|ChallengePlan|parse-plan-steps/, `${file} must not touch the plan`);
  }
});

test("privacy: the public pages read only through the two public database functions, never the roasts table directly", () => {
  for (const file of ["./get-share-card.ts", "./get-roast-public.ts"]) {
    const code = stripComments(read(file));
    assert.match(code, /\.rpc\("get_roast_(for_og|by_share_slug)"/);
    assert.doesNotMatch(code, /\.from\(\s*["']roasts["']\s*\)/, `${file} must not read the roasts table directly`);
  }
});
