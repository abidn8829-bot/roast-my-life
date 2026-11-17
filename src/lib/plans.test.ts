// Plan numbers and plan wording (src/lib/plans.ts). Run with: node --test src/lib/plans.test.ts
//
// What this guards:
//   - every number shown in the Free / Pro lists, the comparison rows and the ready-made sentences is one of
//     the plan constants, and the constants hold the values the code enforces;
//   - the wording says "voices" and carries none of the claims removed earlier;
//   - the Arc route takes its trend days from plans.ts instead of typing them;
//   - plans.ts can be loaded in a browser: nothing it imports (directly or further down) imports plans.ts
//     back, and nothing it imports is server-only.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const read = (relPath: string) => readFileSync(join(SRC, relPath), "utf8");

// plans.ts and the files it imports use "@/..." paths, which plain Node does not know. This maps them to
// src/ for THIS test file only (no tsconfig, package.json or build change).
function resolveAlias(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;
  const base = join(SRC, specifier.slice(2));
  return [`${base}.ts`, `${base}.tsx`, base].find((p) => existsSync(p)) ?? null;
}
// registerHooks exists in the Node versions that run these tests, but the installed type package predates it.
type ResolveHook = (specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void }).registerHooks({
  resolve(specifier, context, nextResolve) {
    const file = resolveAlias(specifier);
    return nextResolve(file ? pathToFileURL(file).href : specifier, context);
  },
});

const plans = await import("./plans.ts");
const { MISSION_LENGTH } = await import("./missions.ts");
const { MIN_SAMPLE_SIZE } = await import("./percentile.ts");
const { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } = await import("./daily-limit.ts");
const { ROAST_PERSONA_IDS } = await import("./roast-types.ts");
const { ARC_CATEGORIES } = await import("./arc-trend.ts");

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

test("the plan constants hold the values the code enforces", () => {
  // Changing a limit must be a deliberate change here too.
  assert.equal(plans.FREE_DAILY_LIMIT, 1);
  assert.equal(plans.PRO_DAILY_LIMIT, 2);
  assert.equal(plans.FREE_TREND_DAYS, 7);
  assert.equal(plans.PRO_TREND_DAYS, 30);
  assert.equal(plans.FREE_HISTORY_LIMIT, 12);
  assert.equal(plans.PRO_HISTORY_LIMIT, 100);
  assert.equal(plans.FREE_VOICE_COUNT, 1);
  assert.equal(plans.VOICE_COUNT, 6);
  assert.equal(plans.CATEGORY_COUNT, 5);
  assert.equal(plans.MISSION_LENGTH, 7);
  assert.equal(plans.MIN_SAMPLE_SIZE, 10);
  assert.equal(plans.PRO_PRICE, "$6.99");
});

test("plans.ts re-exports the numbers defined elsewhere; it does not keep a second copy", () => {
  assert.equal(plans.FREE_DAILY_LIMIT, FREE_DAILY_LIMIT);
  assert.equal(plans.PRO_DAILY_LIMIT, PRO_DAILY_LIMIT);
  assert.equal(plans.MISSION_LENGTH, MISSION_LENGTH);
  assert.equal(plans.MIN_SAMPLE_SIZE, MIN_SAMPLE_SIZE);
  assert.equal(plans.VOICE_COUNT, ROAST_PERSONA_IDS.length);
  assert.equal(plans.CATEGORY_COUNT, ARC_CATEGORIES.length);
  const source = read("lib/plans.ts");
  assert.match(source, /export \{ FREE_DAILY_LIMIT, PRO_DAILY_LIMIT, MISSION_LENGTH, MIN_SAMPLE_SIZE \};/);
  assert.doesNotMatch(source, /export const (FREE_DAILY_LIMIT|PRO_DAILY_LIMIT|MISSION_LENGTH|MIN_SAMPLE_SIZE)\b/);
});

test("the Free list says exactly what the code does, with every number from a constant", () => {
  assert.deepEqual(plans.FREE_FEATURES, [
    `${FREE_DAILY_LIMIT} roast or check-in a day`,
    `The default voice (${plans.FREE_VOICE_COUNT} of ${ROAST_PERSONA_IDS.length})`,
    `${ARC_CATEGORIES.length} categories graded, A to F`,
    `${plans.FREE_TREND_DAYS}-day trend`,
    `Your last ${plans.FREE_HISTORY_LIMIT} results on your dashboard`,
  ]);
  assert.deepEqual(plans.FREE_FEATURES.map(numbersIn), [[1], [1, 6], [5], [7], [12]]);
});

test("the Pro list says exactly what the code does, with every number from a constant", () => {
  const lines = plans.PRO_FEATURES.map((f: { title: string; desc: string }) => [f.title, f.desc]);
  assert.deepEqual(lines.map(([title]: string[]) => title), [
    `${PRO_DAILY_LIMIT} roasts or check-ins a day`,
    `All ${ROAST_PERSONA_IDS.length} voices`,
    `${plans.PRO_TREND_DAYS}-day trend`,
    `${MISSION_LENGTH}-day missions`,
    "See how you compare with other Ember users",
    `Your last ${plans.PRO_HISTORY_LIMIT} results on your dashboard`,
  ]);
  assert.equal(lines[0][1], `Free gets ${FREE_DAILY_LIMIT} a day. Pro gets ${PRO_DAILY_LIMIT}.`);
  assert.equal(lines[2][1], "Plus the change since your first day.");
  assert.equal(lines[3][1], "On your weakest category.");
  assert.equal(lines[4][1], `Shown once at least ${MIN_SAMPLE_SIZE} people have a score.`);
  assert.equal(lines[5][1], `Free shows your last ${plans.FREE_HISTORY_LIMIT}.`);
  assert.deepEqual(lines.map(([title, desc]: string[]) => numbersIn(`${title} ${desc}`)), [[2, 1, 2], [6], [30], [7], [10], [100, 12]]);
  // Every item has both lines: the three screens that show this list render a title and a second line.
  for (const [title, desc] of lines) assert.ok(title.trim() && desc.trim());
});

test("the comparison rows are built from the same constants", () => {
  assert.deepEqual(plans.PLAN_COMPARISON, [
    { label: "Roasts or check-ins a day", free: `${FREE_DAILY_LIMIT}`, pro: `${PRO_DAILY_LIMIT}` },
    { label: "Voices", free: "Default only", pro: `All ${ROAST_PERSONA_IDS.length}` },
    { label: "Categories graded", free: `${ARC_CATEGORIES.length}`, pro: `${ARC_CATEGORIES.length}` },
    { label: "Trend", free: `${plans.FREE_TREND_DAYS} days`, pro: `${plans.PRO_TREND_DAYS} days, plus the change since your first day` },
    { label: "Results on your dashboard", free: `Last ${plans.FREE_HISTORY_LIMIT}`, pro: `Last ${plans.PRO_HISTORY_LIMIT}` },
    { label: `${MISSION_LENGTH}-day missions`, free: "No", pro: "Yes" },
    { label: "Compare with other Ember users", free: "No", pro: `Yes, once ${MIN_SAMPLE_SIZE} people have a score` },
  ]);
  const rows = plans.PLAN_COMPARISON.map((r: { label: string; free: string; pro: string }) => numbersIn(`${r.label} | ${r.free} | ${r.pro}`));
  assert.deepEqual(rows, [[1, 2], [6], [5, 5], [7, 30], [12, 100], [7], [10]]);
});

test("the ready-made sentences are built from the same constants", () => {
  assert.equal(plans.UPGRADE_BANNER_TEXT, `Free plan: ${FREE_DAILY_LIMIT} roast or check-in a day.`);
  assert.equal(plans.UPGRADE_LIMIT_TEXT, `You've used today's free roast or check-in. Pro gets ${PRO_DAILY_LIMIT} a day.`);
  assert.equal(
    plans.RESULT_UPSELL_TEXT,
    `Want more from Ember? Pro adds a second roast or check-in each day, all ${ROAST_PERSONA_IDS.length} voices and ${MISSION_LENGTH}-day missions.`,
  );
  assert.equal(plans.RESULT_UPSELL_BUTTON, "See Pro");
  // "a second roast or check-in" is only true while Pro gets exactly one more than Free.
  assert.equal(PRO_DAILY_LIMIT - FREE_DAILY_LIMIT, 1);
});

test("no number is typed into the wording: plans.ts builds every one from a constant", () => {
  const source = read("lib/plans.ts");
  const start = source.indexOf("export const FREE_FEATURES");
  assert.ok(start > 0);
  // Everything from the lists down. Drop comments and ${...} holes, then no digit may be left.
  const wording = source
    .slice(start)
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    .replace(/\$\{[^}]*\}/g, "");
  assert.doesNotMatch(wording, /\d/, "a digit is typed directly into the plan wording");
});

test('the wording says "voices" and carries none of the removed claims', () => {
  const all = [
    ...plans.FREE_FEATURES,
    ...plans.PRO_FEATURES.flatMap((f: { title: string; desc: string }) => [f.title, f.desc]),
    ...plans.PLAN_COMPARISON.flatMap((r: { label: string; free: string; pro: string }) => [r.label, r.free, r.pro]),
    plans.UPGRADE_BANNER_TEXT,
    plans.UPGRADE_LIMIT_TEXT,
    plans.RESULT_UPSELL_TEXT,
    plans.RESULT_UPSELL_BUTTON,
  ].join("\n");
  // Written as patterns so this file never contains the phrases honest-claims.test.ts forbids in src.
  assert.doesNotMatch(all, /personas?/i);
  assert.doesNotMatch(all, /unlocking\s+soon/i);
  assert.doesNotMatch(all, /most\s+popular/i);
  assert.doesNotMatch(all, /\belite\b/i);
  assert.doesNotMatch(all, /full\s+read/i);
  assert.doesNotMatch(all, /stack up|everyone else/i);
  assert.match(all, /voices/);
});

test("the Arc route takes its trend days from plans.ts and types neither number itself", () => {
  const route = read("app/api/user/arc/route.ts");
  assert.match(route, /import \{ FREE_TREND_DAYS, PRO_TREND_DAYS \} from "@\/lib\/plans";/);
  assert.match(route, /const windowDays = isPro \? PRO_TREND_DAYS : FREE_TREND_DAYS;/);
  assert.match(route, /addDays\(today, -PRO_TREND_DAYS\)/);
  assert.doesNotMatch(route, /WINDOW_DAYS/);
  assert.doesNotMatch(route, /\b(7|30)\b/, "a bare trend number is typed in the Arc route");
});

// ---------------------------------------------------------------------------
// Import safety. Follows the imports that survive into the bundle (an `import type` is erased and
// pulls in no code) from plans.ts outward.
// ---------------------------------------------------------------------------

function valueImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const m of source.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+"([^"]+)";/gm)) found.push(m[1]!);
  for (const m of source.matchAll(/^import\s+"([^"]+)";/gm)) found.push(m[1]!);
  return found;
}

function resolveLocal(from: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return resolveAlias(specifier);
  if (!specifier.startsWith(".")) return null; // a package
  const base = join(dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(p) && /\.tsx?$/.test(p)) ?? null;
}

test("plans.ts is safe to load in a browser: no circular import, nothing server-only", () => {
  const entry = join(SRC, "lib/plans.ts");
  const seen = new Set<string>();
  const packages = new Set<string>();
  const stack: string[] = [];

  function visit(file: string) {
    assert.ok(!stack.includes(file), `circular import: ${[...stack, file].map((f) => relative(SRC, f)).join(" -> ")}`);
    if (seen.has(file)) return;
    seen.add(file);
    stack.push(file);
    for (const specifier of valueImports(file)) {
      const local = resolveLocal(file, specifier);
      if (local) visit(local);
      else packages.add(specifier);
    }
    stack.pop();
  }
  visit(entry);

  const files = [...seen].map((f) => relative(SRC, f).split("\\").join("/")).sort();
  assert.deepEqual(files, [
    "lib/arc-trend.ts",
    "lib/daily-limit.ts",
    "lib/grades.ts",
    "lib/missions.ts",
    "lib/percentile.ts",
    "lib/plans.ts",
    "lib/roast-personas.ts",
    "lib/roast-types.ts",
    "lib/streak.ts",
  ]);
  // No package at all is pulled in as code (daily-limit.ts and others import Supabase TYPES only).
  assert.deepEqual([...packages], []);
  for (const file of seen) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /server-only|next\/headers|next\/server|SERVICE_ROLE|supabase\/service|supabase\/server/, `${relative(SRC, file)} is server-side`);
    assert.doesNotMatch(source, /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV)/, `${relative(SRC, file)} reads a server setting`);
  }
});
