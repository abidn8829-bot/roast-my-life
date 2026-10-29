// Run with: node --test src/lib/persona-tone.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Part 1 of the persona work: tone is gone (nothing chooses it, sends it, reads it or writes it), the
// Gordon Ramsay persona has a new PUBLIC name but keeps its stored id, and the persona the user picked is
// the one the request carries. Everything here is plain Node: pure functions are imported, and the routes
// and components are checked by reading their source (the same approach as roast-insert.test.ts).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import * as nodeModule from "node:module";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ROAST_PERSONA_IDS, isRoastPersona } from "./roast-types.ts";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SELF = fileURLToPath(import.meta.url);

const read = (relPath: string) => readFileSync(join(SRC, relPath), "utf8");

function walk(dir: string, exts: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, exts, out);
    else if (exts.test(name)) out.push(path);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).split("\\").join("/");

// The six stored ids. Written out here on purpose: a change to the list must be a change to this test too.
const SIX_IDS = ["default", "gordon_ramsay", "drill_sergeant", "toxic_friend", "corporate_manager", "savage_grandma"];

// ---------------------------------------------------------------------------
// The real parseAnswers from the roast route, run as written (its types are stripped, nothing else changes).
// The route cannot be imported directly (it uses "@/" imports), so its source is cut out and evaluated.
// ---------------------------------------------------------------------------

type Parsed = { answers: Record<string, unknown>; mode: string; persona: string; followUpAnswer?: string } | null;

function loadParseAnswers(): (body: unknown) => Parsed {
  const source = read("app/api/roast/route.ts");
  const match = source.match(/^function parseAnswers[\s\S]*?^}$/m);
  assert.ok(match, "parseAnswers not found in the roast route");
  const strip = (nodeModule as unknown as { stripTypeScriptTypes: (code: string) => string }).stripTypeScriptTypes;
  const js = strip(match[0]);
  return new Function("isRoastPersona", `${js}\nreturn parseAnswers;`)(isRoastPersona) as (body: unknown) => Parsed;
}

const validBody = { phoneHours: 6, worstApp: "TikTok", sleepHours: 6, foodDeliverySpend: 40, neverDoThing: "go to the gym" };

// ---------------------------------------------------------------------------
// (a) persona ids
// ---------------------------------------------------------------------------

test("(a) the shared persona list is exactly the six stored ids, gordon_ramsay included", () => {
  assert.deepEqual([...ROAST_PERSONA_IDS], SIX_IDS);
  for (const id of SIX_IDS) assert.equal(isRoastPersona(id), true, id);
});

test("(a) anything that is not one of the six ids is rejected (including the old public label)", () => {
  for (const value of ["Gordon Ramsay", "Chef Overcooked", "chef_overcooked", "DEFAULT", "gordon_ramsay ", "", "toString", "__proto__", null, undefined, 5, {}, ["default"]]) {
    assert.equal(isRoastPersona(value), false, String(value));
  }
});

test("(a) /api/roast: all six ids are accepted as sent; an unknown or missing id becomes default", () => {
  const parseAnswers = loadParseAnswers();
  for (const id of SIX_IDS) assert.equal(parseAnswers({ ...validBody, persona: id })?.persona, id, id);
  for (const value of ["Gordon Ramsay", "nope", "", 7, null, {}]) {
    assert.equal(parseAnswers({ ...validBody, persona: value })?.persona, "default", String(value));
  }
  assert.equal(parseAnswers({ ...validBody })?.persona, "default", "no persona sent");
});

test("(a) /api/check-in: persona is checked against the same shared list, no second hard-coded list", () => {
  const checkIn = read("app/api/check-in/route.ts");
  const roast = read("app/api/roast/route.ts");
  assert.match(checkIn, /const requestedPersona = isRoastPersona\(body\.persona\) \? body\.persona : undefined;/);
  assert.match(roast, /const persona = isRoastPersona\(b\.persona\) \? b\.persona : "default";/);
  for (const [name, text] of [["check-in", checkIn], ["roast", roast]] as const) {
    assert.doesNotMatch(text, /["']drill_sergeant["']\s*,\s*["']toxic_friend["']/, `${name} route must not carry its own persona list`);
  }
});

test("(a) the roast route still has a prompt for every one of the six ids", () => {
  const roast = read("app/api/roast/route.ts");
  const block = roast.slice(roast.indexOf("const PERSONA_PROMPTS"));
  for (const id of SIX_IDS) assert.match(block, new RegExp(`^  ${id}:`, "m"), `PERSONA_PROMPTS has no ${id}`);
});

// ---------------------------------------------------------------------------
// (b) a stray "tone" in the request is ignored and never stored
// ---------------------------------------------------------------------------

test("(b) /api/roast: a stray tone is ignored: no error, not in the parsed result", () => {
  const parseAnswers = loadParseAnswers();
  for (const tone of ["no_mercy", "destroy_me", "normal", "garbage", 3, null, {}]) {
    const parsed = parseAnswers({ ...validBody, persona: "drill_sergeant", tone });
    assert.ok(parsed, `a request carrying tone=${String(tone)} must still be valid`);
    assert.equal("tone" in parsed, false);
    assert.equal(parsed.persona, "drill_sergeant");
    assert.equal(parsed.mode, "roast");
  }
});

test("(b) neither route reads a tone from the request or from a saved row", () => {
  for (const file of ["app/api/roast/route.ts", "app/api/check-in/route.ts"]) {
    const code = read(file)
      .split("\n")
      .filter((line) => !line.trim().startsWith("//")) // the comments explain the ignored field
      .join("\n");
    assert.doesNotMatch(code, /\b(?:b|body|parsed|previous|previousRoast)\.tone\b/, `${file} reads a tone`);
    assert.doesNotMatch(code, /\bRoastTone\b|\bresolvedTone\b|\brequestedTone\b|SYSTEM_PROMPTS/, `${file} still has tone code`);
  }
});

test("(b) no roast insert and no roasts read carries a tone, so the column default applies", () => {
  const roast = read("app/api/roast/route.ts");
  const baseRow = roast.match(/const baseRow = \{[\s\S]*?\n  \};/);
  assert.ok(baseRow, "baseRow not found");
  assert.doesNotMatch(baseRow[0], /\btone\b/);

  const checkIn = read("app/api/check-in/route.ts");
  const insert = checkIn.match(/insertRoastRow\(user\.id, \{[\s\S]*?\}\);/);
  assert.ok(insert, "check-in insert not found");
  assert.doesNotMatch(insert[0], /\btone\b/);
  assert.match(insert[0], /persona: resolvedPersona/, "the persona is still saved on a check-in row");

  assert.doesNotMatch(checkIn.match(/\.select\("id, roast_text[^"]*"\)/)?.[0] ?? "tone", /tone/);
  assert.doesNotMatch(read("app/api/user/previous-answers/route.ts"), /\btone\b/);
});

test("(b) old rows keep working: the legacy column and type are still there, as optional", () => {
  assert.match(read("lib/roast-types.ts"), /tone\?: RoastTone;/);
  assert.match(read("lib/roast-types.ts"), /export type RoastTone = "normal" \| "no_mercy" \| "destroy_me";/);
  assert.match(read("../supabase/migrations/007_tone_mode.sql"), /add column if not exists tone text default 'normal'/);
  assert.match(read("app/api/user/previous-answers/route.ts"), /persona: previousRoast\.persona \?\? "default"/, "a null persona on an old row still reads as default");
});

// ---------------------------------------------------------------------------
// (c) the public label changed, the stored id did not
// ---------------------------------------------------------------------------

test("(c) the picker shows Chef Overcooked and still stores gordon_ramsay, with the same icon", () => {
  assert.match(read("components/persona-selector.tsx"), /\{ id: "gordon_ramsay", name: "Chef Overcooked", emoji: "👨‍🍳"/);
  assert.match(read("components/home-page.tsx"), /\{ name: "Chef Overcooked", emoji: "👨‍🍳"/);
  assert.match(read("lib/plans.ts"), /Chef Overcooked/);
});

test("(c) the persona prompt no longer names a real person", () => {
  const roast = read("app/api/roast/route.ts");
  assert.match(roast, /^  gordon_ramsay: `You are Chef Overcooked, the screaming chef who remembers everything\./m);
});

test("(c) no file outside the id token mentions the old name (Gordon Ramsay or any ramsay)", () => {
  const files = [
    ...walk(join(ROOT, "src"), /\.(ts|tsx|css)$/),
    ...walk(join(ROOT, "scripts"), /\.(mjs|js|ts)$/),
    ...walk(join(ROOT, "supabase"), /\.sql$/),
    ...walk(join(ROOT, "public"), /\.(html|txt|svg|json)$/),
    join(ROOT, "README.md"),
  ].filter((file) => file !== SELF);
  const offenders: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8").replace(/gordon_ramsay/g, "");
    if (/ramsay/i.test(text)) offenders.push(rel(file));
  }
  assert.deepEqual(offenders, []);
});

test("(c) the id gordon_ramsay is still the stored value everywhere it is used", () => {
  assert.equal(SIX_IDS.includes("gordon_ramsay"), true);
  assert.match(read("lib/roast-types.ts"), /"gordon_ramsay"/);
  assert.match(read("components/persona-selector.tsx"), /id: "gordon_ramsay"/);
  assert.match(read("app/api/roast/route.ts"), /^  gordon_ramsay: `/m);
});

// ---------------------------------------------------------------------------
// (d) no tone picker anywhere, and the wizard sends the persona it was given
// ---------------------------------------------------------------------------

test("(d) the tone picker is gone and nothing imports it", () => {
  assert.equal(existsSync(join(SRC, "components/tone-selector.tsx")), false);
  const offenders: string[] = [];
  for (const file of walk(SRC, /\.(ts|tsx)$/)) {
    if (file === SELF) continue;
    if (/tone-selector|ToneSelector/.test(readFileSync(file, "utf8"))) offenders.push(rel(file));
  }
  assert.deepEqual(offenders, []);
});

test("(d) the wizard has no tone step, no tone state and sends no tone in either request", () => {
  const wizard = read("components/onboarding-wizard.tsx");
  assert.doesNotMatch(wizard, /\btone\b/i);
  assert.doesNotMatch(wizard, /RoastTone|selectedTone|onToneSelect/);
  const bodies = [...wizard.matchAll(/body: JSON\.stringify\(\{[\s\S]*?\}\),/g)].map((m) => m[0]);
  assert.equal(bodies.length, 3, "the wizard makes three JSON requests: check-in question, roast, check-in submit");
  for (const body of bodies) assert.doesNotMatch(body, /tone/);
});

test("(d) no tone copy is left on the landing page, pricing page, FAQ or plans", () => {
  const copy = ["components/home-page.tsx", "components/pricing-page.tsx", "components/upgrade-modal.tsx", "app/pricing/page.tsx", "lib/plans.ts"].map(read).join("\n");
  assert.doesNotMatch(copy, /\bevery tone\b|\band tone\b|\broast tones?\b|\bNo Mercy\b|\bDestroy Me\b|Pick Your Intensity|\bTONES\b/);
  assert.match(read("lib/plans.ts"), /title: "All 6 personas"/);
});

test("(d) the persona picker bug: the roast request carries the persona it was handed, not stale state", () => {
  const wizard = read("components/onboarding-wizard.tsx");
  const callback = wizard.match(/const generateRoast = useCallback\(async \(persona: RoastPersona\) => \{[\s\S]*?\n  \}, \[/);
  assert.ok(callback, "generateRoast must take the persona as an argument");
  assert.doesNotMatch(callback[0], /selectedPersona/, "generateRoast must not read the persona from state");
  assert.match(callback[0], /mode: "roast",\s*persona,/);
  // Picking a persona sets the state AND roasts with that very value in the same click.
  assert.match(wizard, /function onPersonaSelect\(persona: RoastPersona\) \{\s*setSelectedPersona\(persona\);\s*void generateRoast\(persona\);\s*\}/);
  // The follow-up step (the persona was picked earlier) passes the settled state.
  assert.match(wizard, /function onFollowUpSubmit\(\) \{[\s\S]*?void generateRoast\(selectedPersona\);/);
  assert.equal(wizard.match(/generateRoast\(/g)?.length, 2, "every call site passes a persona");
  assert.doesNotMatch(wizard, /setStep\("tone"\)/);
});

// ---------------------------------------------------------------------------
// (e) the safety gates still come before any persona is read or chosen
// ---------------------------------------------------------------------------

test("(e) /api/roast: pause, phrase filter, classifier and fail-closed exits all come before persona is read or chosen", () => {
  const route = read("app/api/roast/route.ts");
  const readsPersona = route.indexOf("= parseAnswers(body)");
  const choosesPersona = route.indexOf("PERSONA_PROMPTS[persona]");
  assert.ok(readsPersona !== -1 && choosesPersona !== -1);
  assert.equal(route.match(/PERSONA_PROMPTS\[/g)?.length, 1, "the persona prompt is picked in exactly one place");
  assert.ok(route.indexOf("gentleGate(") !== -1 && route.indexOf("gentleGate(") < readsPersona, "gentleGate must run before the persona is read from the request");
  for (const needle of ["gentleGate(", "ruleFloorLevel(", "runSafetyClassify(", "respondFlagged(", "respondUnavailable("]) {
    const first = route.indexOf(needle);
    assert.ok(first !== -1, `route no longer contains ${needle}`);
    assert.ok(first < choosesPersona, `${needle} must come before the persona prompt is chosen`);
  }
});

test("(e) /api/check-in: pause and safety come before persona is read; no persona text is ever in a prompt", () => {
  const route = read("app/api/check-in/route.ts");
  const readsPersona = route.indexOf("isRoastPersona(body.persona)");
  assert.ok(readsPersona !== -1);
  assert.ok(route.indexOf("gentleGate(") !== -1 && route.indexOf("gentleGate(") < readsPersona, "gentleGate must run before the persona is read");
  const rollsOut = route.indexOf("${CHECKIN_SYSTEM_PROMPT}");
  assert.ok(rollsOut !== -1);
  for (const needle of ["runCheckInSafety(", "respondFlagged(", "respondUnavailable("]) {
    assert.ok(route.indexOf(needle) !== -1 && route.indexOf(needle) < rollsOut, `${needle} must come before the check-in roast prompt`);
  }
  assert.doesNotMatch(route, /PERSONA_PROMPTS/, "the check-in prompt does not use persona voices (that is Part 2)");
});

test("(e) the check-in roast prompt is the one fixed string, unchanged by tone removal", () => {
  const route = read("app/api/check-in/route.ts");
  assert.equal(route.match(/const CHECKIN_SYSTEM_PROMPT = "/g)?.length, 1);
  assert.match(route, /keep it at full brutal intensity/, "wording is untouched in Part 1; the intensity rewrite is Part 2");
  assert.doesNotMatch(route, /CHECKIN_SYSTEM_PROMPTS|CHECKIN_SYSTEM_PROMPT_NORMAL/);
});
