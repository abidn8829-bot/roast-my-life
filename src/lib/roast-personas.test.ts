// Run with: node --test src/lib/roast-personas.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Part 2 of the persona work: every roast has ONE fixed medium intensity, each persona owns only its voice,
// the check-in uses the persona voice, personas use emojis (card punchline stays emoji-free), and no safety
// gate moved. Prompts are checked by building them with the real builder; the routes and the punchline file
// (which use "@/" imports and cannot be imported here) are checked by reading their source, the same way
// roast-insert.test.ts does.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHECKIN_FORMAT_AND_ACCURACY,
  EMOJI_RULES_CHECKIN,
  EMOJI_RULES_ROAST,
  FREE_PERSONA,
  INTENSITY_RULE,
  ROAST_FORMAT_AND_CONTINUITY,
  ROAST_PERSONAS,
  ROAST_PERSONA_LIST,
  buildPersonaPrompt,
  personaLabel,
  personaSection,
  resolveCheckInPersona,
  type PersonaSurface,
} from "./roast-personas.ts";
import { ROAST_PERSONA_IDS, isRoastPersona, type RoastPersona } from "./roast-types.ts";
import { DEFAULT_PERSONA_PROMPT, FOLLOW_UP_SYSTEM_PROMPT, buildRoastMessages } from "./safety-prompts.ts";
import { OUTPUT_GUARDRAIL, ROAST_FORMAT_OVERRIDE } from "./safety-server.ts";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (relPath: string) => readFileSync(`${SRC}${relPath}`, "utf8");
const readRoot = (relPath: string) => readFileSync(`${ROOT}${relPath}`, "utf8");

const IDS = [...ROAST_PERSONA_IDS] as RoastPersona[];
const SURFACES: PersonaSurface[] = ["roast", "checkin"];
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

// Words no persona voice or shared prompt line may carry. (INTENSITY_RULE itself names three of them in order to
// forbid them, so it is removed before scanning; it is pinned word for word in its own test.)
const FORBIDDEN = /\b(?:destroy\w*|devastat\w*|brutal\w*|savage\w*|no softening|maggot\w*|weak\w*|pathetic|failure\w*|worthless|stupid|ugly|fat|no mercy)\b/i;
const forbiddenIn = (text: string) => text.match(new RegExp(FORBIDDEN.source, "gi")) ?? [];

const withoutIntensity = (text: string) => text.replace(INTENSITY_RULE, "");

// ---------------------------------------------------------------------------
// The approved intensity wording, pinned
// ---------------------------------------------------------------------------

const APPROVED_INTENSITY =
  "INTENSITY (fixed, same for every voice): Medium. Tease the habit, not the person. Use their numbers, be specific and funny, land one sharp closing line, like a friend roasting you at dinner who clearly likes you. Never go after their body, intelligence, looks, background or worth, and never call them a failure, weak or pathetic. Never treat what, how much or when they eat as a flaw; kitchen or food jokes are about habits (for example how often they order delivery). No pep talk, but no cruelty. One honest nudge toward a small next step is fine.";

test("the intensity rule is the approved text, word for word", () => {
  assert.equal(INTENSITY_RULE, APPROVED_INTENSITY);
});

// ---------------------------------------------------------------------------
// (a) minus its persona section, every built prompt is identical across the six personas
// ---------------------------------------------------------------------------

for (const surface of SURFACES) {
  test(`(a) ${surface}: the built prompt minus the persona section is identical for all six personas`, () => {
    const rests = IDS.map((id) => {
      const built = buildPersonaPrompt(id, surface);
      assert.ok(built.startsWith(personaSection(id)), `${id}: the persona section comes first`);
      assert.equal(count(built, personaSection(id)), 1, `${id}: the persona section appears once`);
      return built.replace(personaSection(id), "<PERSONA>");
    });
    for (const rest of rests) assert.equal(rest, rests[0]);
    assert.ok(rests[0]!.startsWith("<PERSONA>\n\n"));
  });
}

test("(a) the persona section is only the voice plus the emoji palette line, nothing else", () => {
  for (const id of IDS) {
    const { voice, palette } = ROAST_PERSONAS[id];
    assert.equal(personaSection(id), `${voice}\nEmoji palette: ${palette.join(" ")}`);
  }
});

// ---------------------------------------------------------------------------
// (b) the intensity rule appears exactly once in every built prompt, and in no voice
// ---------------------------------------------------------------------------

for (const surface of SURFACES) {
  test(`(b) ${surface}: the intensity rule appears exactly once in the built prompt of every persona`, () => {
    for (const id of IDS) assert.equal(count(buildPersonaPrompt(id, surface), INTENSITY_RULE), 1, id);
  });
}

test("(b) the intensity rule appears exactly once in what the roast route really sends to the model", () => {
  for (const id of IDS) {
    const system = buildRoastMessages(buildPersonaPrompt(id, "roast"), "user text")[0]!.content;
    assert.equal(count(system, INTENSITY_RULE), 1, id);
    assert.equal(count(system, "INTENSITY (fixed"), 1, id);
    assert.ok(system.endsWith(ROAST_FORMAT_OVERRIDE), "the JSON format override still comes last");
    assert.ok(system.includes("150-200 words"), "the word target is still there");
    assert.ok(system.includes('"roast_text": "your full roast paragraph here"'), "the JSON shape is still there");
    assert.ok(system.includes(OUTPUT_GUARDRAIL));
  }
});

test("(b) no voice states an intensity of its own", () => {
  for (const id of IDS) {
    const { voice } = ROAST_PERSONAS[id];
    assert.ok(!/INTENSITY|\bmedium\b|\bmild\b|\bgentle\b|\bharsh/i.test(voice), `${id} voice talks about intensity`);
    assert.equal(count(voice, "INTENSITY"), 0);
  }
});

// ---------------------------------------------------------------------------
// (c) no forbidden word in any voice or any shared prompt
// ---------------------------------------------------------------------------

const punchlineSource = () => {
  const m = read("lib/card-punchline.ts").match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
  assert.ok(m, "card-punchline SYSTEM_PROMPT not found");
  return m[1]!;
};

test("(c) the scan itself catches every word on the list (so a clean result means something)", () => {
  for (const bad of ["destroy them", "Destroyed", "a devastating insult", "BRUTAL facts", "savage", "No softening", "maggot", "weakness", "pathetic", "persistent failures", "worthless", "stupid", "ugly", "so fat", "No Mercy"]) {
    assert.ok(forbiddenIn(bad).length > 0, bad);
  }
  for (const fine of ["fate", "father", "fatigue", "a small, doable next step", "the oven was never on"]) {
    assert.equal(forbiddenIn(fine).length, 0, fine);
  }
});

test("(c) no forbidden word in any persona voice", () => {
  for (const id of IDS) assert.deepEqual(forbiddenIn(ROAST_PERSONAS[id].voice), [], id);
});

test("(c) no forbidden word in any shared prompt: format, continuity, emoji rules, check-in rules, follow-up question, punchline", () => {
  const shared: Record<string, string> = {
    ROAST_FORMAT_AND_CONTINUITY,
    CHECKIN_FORMAT_AND_ACCURACY,
    EMOJI_RULES_ROAST,
    EMOJI_RULES_CHECKIN,
    FOLLOW_UP_SYSTEM_PROMPT,
    "card punchline SYSTEM_PROMPT": punchlineSource(),
    DEFAULT_PERSONA_PROMPT: withoutIntensity(DEFAULT_PERSONA_PROMPT),
  };
  for (const [name, text] of Object.entries(shared)) assert.deepEqual(forbiddenIn(text), [], name);
});

test("(c) no forbidden word anywhere in a built prompt (intensity rule excluded), for every persona and surface", () => {
  for (const surface of SURFACES) for (const id of IDS) assert.deepEqual(forbiddenIn(withoutIntensity(buildPersonaPrompt(id, surface))), [], `${id}/${surface}`);
});

test("(c) the old harsh wording is gone from the prompts it lived in", () => {
  const all = [
    ...IDS.flatMap((id) => SURFACES.map((s) => buildPersonaPrompt(id, s))),
    FOLLOW_UP_SYSTEM_PROMPT,
    punchlineSource(),
    read("app/api/roast/route.ts"),
    read("app/api/check-in/route.ts"),
  ].join("\n");
  for (const phrase of ["No softening", "Just brutal facts", "Never assume improvement", "persistent failures", "full brutal intensity", "less brutal", "devastating", "Match the intensity", "under 40 = savage", "zero filter", "I raised you better", "MAGGOT", "Tone example", "repeats are fine", "100 words max", "performance improvement plan"]) {
    assert.equal(all.includes(phrase), false, phrase);
  }
});

test("(c) the savage-grandma and drill-sergeant voices rule out family guilt and name-calling without using the words", () => {
  assert.match(ROAST_PERSONAS.savage_grandma.voice, /never use family guilt/);
  assert.match(ROAST_PERSONAS.drill_sergeant.voice, /Never give the recruit insulting nicknames or put-downs/);
  assert.match(ROAST_PERSONAS.toxic_friend.voice, /keep the gossip about the habit, never the person/);
});

// ---------------------------------------------------------------------------
// (d) every persona has a palette; the emoji rules are present
// ---------------------------------------------------------------------------

const graphemes = (s: string) => [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s)].map((x) => x.segment);

test("(d) every persona has a palette of real, distinct emojis that includes its own icon", () => {
  for (const id of IDS) {
    const { palette, emoji } = ROAST_PERSONAS[id];
    assert.ok(palette.length >= 8, `${id} palette too small for "8 to 12 emojis, never repeat one"`);
    assert.equal(new Set(palette).size, palette.length, `${id} palette has a repeat`);
    for (const e of palette) {
      assert.equal(graphemes(e).length, 1, `${id}: "${e}" is not a single emoji`);
      assert.match(e, /\p{Extended_Pictographic}/u, `${id}: "${e}" is not an emoji`);
    }
    assert.ok(palette.includes(emoji), `${id} palette does not include its icon ${emoji}`);
  }
});

test("(d) the emoji rules are in every built prompt: the counts, the two-next-to-each-other cap, no emoji in place of a word, the palette", () => {
  for (const id of IDS) {
    const roast = buildPersonaPrompt(id, "roast");
    const checkin = buildPersonaPrompt(id, "checkin");
    assert.equal(count(roast, "8 to 12 emojis"), 1, id);
    assert.equal(count(checkin, "4 to 6 emojis"), 1, id);
    for (const built of [roast, checkin]) {
      assert.ok(built.includes("Never put more than two emojis next to each other."), id);
      assert.ok(built.includes("Never use an emoji in place of a word."), id);
      assert.equal(count(built, `Emoji palette: ${ROAST_PERSONAS[id].palette.join(" ")}`), 1, id);
    }
    assert.equal(roast.includes("4 to 6 emojis"), false);
    assert.equal(checkin.includes("8 to 12 emojis"), false);
  }
});

// Death-themed emojis: the output guardrail says never to joke about death, and an emoji is invisible to the word-based
// output filter, so none may be offered to the model in any persona's palette (or anywhere else a built prompt carries one).
const DEATH_EMOJIS = ["💀", "☠", "⚰", "⚱", "🪦"]; // skull, skull and crossbones, coffin, funeral urn, headstone
const withoutVariationSelectors = (s: string) => s.replace(/\p{Variation_Selector}/gu, "");
const deathEmojisIn = (text: string) => DEATH_EMOJIS.filter((e) => withoutVariationSelectors(text).includes(e));

test("(d) the death-emoji check catches every emoji on the list, with or without a variation selector", () => {
  for (const e of ["💀", "☠️", "☠", "⚰️", "⚰", "⚱️", "🪦"]) assert.ok(deathEmojisIn(`a ${e} b`).length > 0, e);
  for (const fine of ["😬", "🫠", "🙃", "🌙", "😴", "🥩", "😭"]) assert.deepEqual(deathEmojisIn(fine), [], fine);
});

test("(d) no death-themed emoji (💀 ☠️ ⚰️ ⚱️ 🪦) in any persona's palette, icon or built prompt", () => {
  for (const id of IDS) {
    const { palette, emoji, blurb } = ROAST_PERSONAS[id];
    for (const e of palette) assert.deepEqual(deathEmojisIn(e), [], `${id} palette has ${e}`);
    assert.deepEqual(deathEmojisIn(emoji), [], `${id} icon`);
    assert.deepEqual(deathEmojisIn(blurb), [], `${id} blurb`);
    for (const surface of SURFACES) assert.deepEqual(deathEmojisIn(buildPersonaPrompt(id, surface)), [], `${id}/${surface} built prompt`);
  }
});

// ---------------------------------------------------------------------------
// (e) the check-in uses the persona voice, has no harsh wording, keeps its format and accuracy rules
// ---------------------------------------------------------------------------

test("(e) the check-in prompt contains the persona's voice for each of the six personas", () => {
  for (const id of IDS) assert.ok(buildPersonaPrompt(id, "checkin").includes(ROAST_PERSONAS[id].voice), id);
  const voices = new Set(IDS.map((id) => buildPersonaPrompt(id, "checkin")));
  assert.equal(voices.size, 6, "six different check-in prompts");
});

test("(e) the check-in prompt has no harsh intensity wording and no intensity swing by direction", () => {
  for (const id of IDS) {
    const built = buildPersonaPrompt(id, "checkin");
    assert.ok(!/full brutal intensity|less brutal|noticeably lighter|devastatingly|no sugarcoating|no encouragement/i.test(built), id);
    assert.ok(built.includes("Either way, keep the same medium intensity."), id);
  }
});

test("(e) the check-in keeps its format: plain text, 80 to 95 words (hard maximum 100), no JSON", () => {
  for (const id of IDS) {
    const built = buildPersonaPrompt(id, "checkin");
    assert.ok(built.includes("Write 80 to 95 words, hard maximum 100."));
    assert.ok(built.includes("Output plain text only, no markdown: no asterisks, bold, italics, headings, bullets or hashtags"));
    assert.ok(built.includes('no "One-liner:" label'));
    assert.ok(!built.includes("roast_text") && !/valid JSON/i.test(built), "the check-in roast is not JSON");
  }
});

test("(e) the check-in keeps every accuracy rule, word for word", () => {
  for (const sentence of [
    'Only cite a specific category\'s numeric score if it appears in "Categories graded this check-in" below, always as its exact was-to-now change — never invent, approximate, or reference a score for a category not listed there.',
    "The life score is a separate overall 0-100 average across all 5 categories — never present it as if it were a single category's score.",
    "use their specific numbers, name the exact apps they mentioned",
  ]) {
    for (const id of IDS) assert.ok(buildPersonaPrompt(id, "checkin").includes(sentence), `${id}: ${sentence.slice(0, 50)}`);
  }
});

test("(e) the /api/check-in route builds its roast prompt from the persona and still appends the output guardrail", () => {
  const route = read("app/api/check-in/route.ts");
  assert.equal(count(route, 'buildPersonaPrompt(resolvedPersona, "checkin")'), 1);
  assert.match(route, /content: `\$\{buildPersonaPrompt\(resolvedPersona, "checkin"\)\}\\n\\n\$\{OUTPUT_GUARDRAIL\}`/);
  assert.doesNotMatch(route, /brutally honest|CHECKIN_SYSTEM_PROMPT/, "the old inline prompt is gone");
});

test("(e) check-in persona: free always default; Pro gets the request, else the last roast, else default; junk is never used", () => {
  for (const id of IDS) {
    assert.equal(resolveCheckInPersona("free", id, id), FREE_PERSONA, `free + ${id}`);
    assert.equal(resolveCheckInPersona(null, id, "drill_sergeant"), FREE_PERSONA);
    assert.equal(resolveCheckInPersona(undefined, id, id), FREE_PERSONA);
    assert.equal(resolveCheckInPersona("pro", id, "default"), id, `pro + requested ${id}`);
  }
  assert.equal(resolveCheckInPersona("pro", undefined, "toxic_friend"), "toxic_friend", "pro, nothing sent: the last roast's persona");
  assert.equal(resolveCheckInPersona("pro", undefined, null), "default");
  assert.equal(resolveCheckInPersona("pro", "Chef Overcooked", "savage_grandma"), "savage_grandma", "a label is not an id: ignored");
  assert.equal(resolveCheckInPersona("pro", { evil: true }, "nope"), "default");
  assert.equal(resolveCheckInPersona("pro", 7, undefined), "default");
});

// ---------------------------------------------------------------------------
// (f) the card punchline prompt: no "savage" wording, still no emoji
// ---------------------------------------------------------------------------

test("(f) the punchline prompt has no savage wording, a fixed medium intensity, and still bans emojis", () => {
  const p = punchlineSource();
  assert.doesNotMatch(p, /savage/i);
  assert.doesNotMatch(p, /Match the intensity/);
  assert.match(p, /Same medium intensity at every score; only the angle changes/);
  assert.match(p, /No hashtags, no emojis, no quotation marks, no slurs/);
  assert.doesNotMatch(p, /\p{Extended_Pictographic}/u, "the prompt itself uses no emoji");
  assert.match(p, /Return strict JSON only: \{"punchline":"\.\.\."\}/, "the JSON shape is unchanged");
});

// The real cleanPunchline from card-punchline.ts, run as written (types stripped). The file cannot be imported
// (it uses "@/" imports), so its two limits and the function are cut out of the source and evaluated.
function loadCleanPunchline(): (raw: unknown) => string | null {
  const src = read("lib/card-punchline.ts");
  const limits = src.match(/^const MAX_WORDS = \d+;\nconst MAX_CHARS = \d+;/m);
  const fn = src.match(/^export function cleanPunchline[\s\S]*?^}$/m);
  assert.ok(limits && fn, "cleanPunchline not found in card-punchline.ts");
  const strip = (nodeModule as unknown as { stripTypeScriptTypes: (code: string) => string }).stripTypeScriptTypes;
  return new Function(`${strip(`${limits[0]}\n${fn[0].replace("export ", "")}`)}\nreturn cleanPunchline;`)() as (raw: unknown) => string | null;
}

test("(f) the punchline cleaner removes emojis (the share image font has none, so each would be fetched from a CDN)", () => {
  const clean = loadCleanPunchline();
  assert.equal(clean("Seven hours of TikTok 📱🔥 is a job with no pay"), "Seven hours of TikTok is a job with no pay");
  assert.equal(clean("Chef 👨‍🍳 says the oven was never on ❤️"), "Chef says the oven was never on");
  assert.equal(clean("Thumbs 👍🏽 up for 1️⃣ more nap"), "Thumbs up for 1 more nap");
  assert.equal(clean("Flags 🇵🇰 do not belong on the card"), "Flags do not belong on the card");
  assert.equal(clean("📱🔥💅"), null, "nothing left after removing emojis: unusable, so the caller retries");
});

test("(f) the punchline cleaner still behaves as before for plain lines", () => {
  const clean = loadCleanPunchline();
  assert.equal(clean('"Seven hours of TikTok is a job"'), "Seven hours of TikTok is a job", "quotes are stripped");
  assert.equal(clean("Line one\nline two here"), "Line one line two here", "newlines become spaces");
  assert.equal(clean("short"), null, "under 8 characters");
  assert.equal(clean("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"), null, "over 14 words");
  assert.equal(clean(42), null);
  assert.equal(clean("Naïve café ünïcode stays — and so do numbers like 7"), "Naïve café ünïcode stays — and so do numbers like 7");
});

// The real stripEmoji from the share-image route, run as written (types stripped). The route cannot be imported (it uses
// "@/" imports and JSX), so the function is cut out of its source and evaluated.
function loadStripEmoji(): (text: string) => string {
  const fn = read("app/api/og/[id]/route.tsx").match(/^function stripEmoji[\s\S]*?^}$/m);
  assert.ok(fn, "stripEmoji not found in the share-image route");
  const strip = (nodeModule as unknown as { stripTypeScriptTypes: (code: string) => string }).stripTypeScriptTypes;
  return new Function(`${strip(fn[0])}\nreturn stripEmoji;`)() as (text: string) => string;
}

test("(f) the share image's stripEmoji removes every kind of emoji and keeps the words", () => {
  const strip = loadStripEmoji();
  assert.equal(strip("Night Owl 🦉 Rookie"), "Night Owl Rookie");
  assert.equal(strip("Seven hours 📱🔥 of TikTok"), "Seven hours of TikTok");
  assert.equal(strip("Chef 👨‍🍳 on the pass ❤️"), "Chef on the pass");
  assert.equal(strip("Thumbs 👍🏽 up, 1️⃣ nap, flag 🇵🇰"), "Thumbs up, 1 nap, flag");
  assert.equal(strip("  spaced   out \n title  "), "spaced out title");
  assert.equal(strip("📱🔥💅"), "", "nothing left: the route then uses its fallback text");
  assert.equal(strip("Naïve café — 7 hours, 60 dollars"), "Naïve café — 7 hours, 60 dollars", "letters, accents, dashes and digits are untouched");
});

test("(f) the share image strips emojis from BOTH free-text fields before anything is drawn, with a fallback if nothing is left", () => {
  const og = read("app/api/og/[id]/route.tsx");
  assert.match(og, /const funnyTitle = stripEmoji\(result\.card\.funnyTitle\) \|\| "Your Life";/);
  assert.match(og, /const punchline = stripEmoji\(result\.card\.punchline\) \|\| "Your life choices spoke for themselves\.";/);
  // The raw card fields are read in exactly one place (the lines above), so the JSX can only ever draw the stripped values.
  assert.equal(count(og, "result.card.funnyTitle"), 1);
  assert.equal(count(og, "result.card.punchline"), 1);
  assert.doesNotMatch(og, /const \{[^}]*\b(?:funnyTitle|punchline)\b[^}]*\} = result\.card/, "the fields must not be destructured raw");
  assert.match(og, /\{funnyTitle\}/);
  assert.match(og, /truncate\(punchline, 180\)/);
  assert.doesNotMatch(og, /emoji:/, "no emoji option (which would turn on the CDN fetch) is passed to ImageResponse");
});

test("(f) the share image still draws no roast text and no emoji of its own", () => {
  const og = read("app/api/og/[id]/route.tsx");
  assert.doesNotMatch(og, /roast_text|roastText/, "the share image must not draw the roast");
  assert.doesNotMatch(og, /\p{Extended_Pictographic}/u, "the share image source has no emoji");
  assert.doesNotMatch(og, /emoji:/, "no emoji option (which would fetch emoji images) is passed to ImageResponse");
});

// ---------------------------------------------------------------------------
// (g) every gate still comes before the persona prompt is built, in both routes
// ---------------------------------------------------------------------------

test("(g) /api/roast: pause, phrase filter, classifier, flagged and unavailable exits all come before the persona prompt is built", () => {
  const route = read("app/api/roast/route.ts");
  assert.equal(count(route, "buildPersonaPrompt("), 1, "the persona prompt is built in exactly one place");
  const builds = route.indexOf("buildPersonaPrompt(");
  const readsPersona = route.indexOf("= parseAnswers(body)");
  assert.ok(route.indexOf("gentleGate(") !== -1 && route.indexOf("gentleGate(") < readsPersona, "gentleGate runs before the persona is even read from the request");
  for (const needle of ["gentleGate(", "ruleFloorLevel(", "runSafetyClassify(", "respondFlagged(", "respondUnavailable("]) {
    const first = route.indexOf(needle);
    assert.ok(first !== -1, `the roast route no longer contains ${needle}`);
    assert.ok(first < builds, `${needle} must come before the persona prompt is built`);
  }
  assert.ok(route.indexOf("insertRoastRow(user.id") > builds, "the insert still comes last");
});

test("(g) /api/check-in: pause, phrase filter, safety check, flagged and unavailable exits all come before the persona prompt is built", () => {
  const route = read("app/api/check-in/route.ts");
  assert.equal(count(route, "buildPersonaPrompt("), 1, "the persona prompt is built in exactly one place");
  const builds = route.indexOf("buildPersonaPrompt(");
  assert.ok(route.indexOf("gentleGate(") !== -1 && route.indexOf("gentleGate(") < route.indexOf("resolveCheckInPersona("), "gentleGate runs before the persona is resolved");
  for (const needle of ["gentleGate(", "ruleFloorLevel(", "runCheckInSafety(", "respondFlagged(", "respondUnavailable("]) {
    const first = route.indexOf(needle);
    assert.ok(first !== -1, `the check-in route no longer contains ${needle}`);
    assert.ok(first < builds, `${needle} must come before the persona prompt is built`);
  }
  // The "question" action (unchanged) never builds a persona prompt.
  const question = route.slice(route.indexOf('body.action === "question"'), route.indexOf("const category = body.category"));
  assert.ok(question.length > 100 && !question.includes("buildPersonaPrompt("));
  assert.ok(route.indexOf("insertRoastRow(user.id") > builds, "the insert still comes last");
});

test("(g) the persona builder depends on no safety file (it only builds wording; every gate lives in the routes)", () => {
  const imports = [...read("lib/roast-personas.ts").matchAll(/^import[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0 && imports.every((s) => !/safety|supabase|groq/i.test(s!)), imports.join(", "));
});

// ---------------------------------------------------------------------------
// (h) ids, labels, single source of truth
// ---------------------------------------------------------------------------

test("(h) all six ids are accepted, an unknown id becomes default, in the builder and in the roast route", () => {
  for (const id of IDS) assert.equal(isRoastPersona(id), true);
  assert.deepEqual(ROAST_PERSONA_LIST.map((p) => p.id), IDS, "the picker order is the id order");
  assert.equal(buildPersonaPrompt("not-a-persona" as RoastPersona, "roast"), buildPersonaPrompt("default", "roast"));
  assert.equal(buildPersonaPrompt("not-a-persona" as RoastPersona, "checkin"), buildPersonaPrompt("default", "checkin"));
  assert.match(read("app/api/roast/route.ts"), /const persona = isRoastPersona\(b\.persona\) \? b\.persona : "default";/);
});

test("(h) the public labels, and gordon_ramsay is Chef Overcooked", () => {
  assert.equal(personaLabel("gordon_ramsay"), "Chef Overcooked");
  assert.deepEqual(IDS.map(personaLabel), ["Ember", "Chef Overcooked", "Drill Sergeant", "Toxic Best Friend", "Corporate Manager", "Savage Grandma"]);
  assert.deepEqual(IDS.map((id) => ROAST_PERSONAS[id].emoji), ["🔥", "👨‍🍳", "🎖️", "💅", "💼", "👵"]);
});

test("(h) one source of truth: no second id list, and no UI file writes a persona name of its own", () => {
  const personas = read("lib/roast-personas.ts");
  assert.doesNotMatch(personas, /\[\s*"default"\s*,\s*"gordon_ramsay"/, "roast-personas.ts must not carry an id array; the ids live in roast-types.ts");
  assert.match(personas, /Record<RoastPersona, PersonaDef>/);
  assert.match(personas, /ROAST_PERSONA_IDS\.map\(\(id\) => ROAST_PERSONAS\[id\]\)/);
  for (const file of ["components/persona-selector.tsx", "components/home-page.tsx", "lib/plans.ts"]) {
    const text = read(file);
    for (const id of IDS.filter((i) => i !== "default")) {
      assert.equal(text.includes(personaLabel(id)), false, `${file} hard-codes the label "${personaLabel(id)}"`);
    }
    assert.match(text, /roast-personas/, `${file} reads from roast-personas.ts`);
  }
});

test("(h) every persona has a public blurb, and none uses a harsh word", () => {
  for (const id of IDS) {
    const { blurb, label } = ROAST_PERSONAS[id];
    assert.ok(blurb.length >= 8 && blurb.length <= 40, id);
    assert.deepEqual(forbiddenIn(blurb), [], `${id} blurb`);
    assert.doesNotMatch(blurb, /disappoint|toxic/i, `${id} blurb`);
    assert.ok(label.length > 0);
  }
});

// ---------------------------------------------------------------------------
// (i) the builder file loads in plain Node
// ---------------------------------------------------------------------------

test('(i) roast-personas.ts has no "@/" imports, and imports only ./roast-types.ts', () => {
  const src = read("lib/roast-personas.ts");
  assert.doesNotMatch(src, /from\s+["']@\//);
  assert.doesNotMatch(src, /import\s*\(\s*["']@\//);
  const specifiers = [...src.matchAll(/^import[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(specifiers, ["./roast-types.ts"]);
});

// ---------------------------------------------------------------------------
// The safety eval and the preview script
// ---------------------------------------------------------------------------

test("the safety eval still measures the real default roast prompt", () => {
  assert.equal(DEFAULT_PERSONA_PROMPT, buildPersonaPrompt("default", "roast"));
  assert.match(readRoot("scripts/safety-eval.mjs"), /P\.buildRoastMessages\(P\.DEFAULT_PERSONA_PROMPT,/);
});

test("the preview script exists, is read-only (no database), and never prints the key", () => {
  assert.ok(existsSync(`${ROOT}scripts/persona-preview.mjs`));
  const script = readRoot("scripts/persona-preview.mjs");
  assert.doesNotMatch(script, /supabase/i, "the preview script must not touch the database");
  assert.match(script, /process\.env\.GROQ_API_KEY/);
  // The key is read once, handed to the SDK, and never appears in a log line.
  for (const line of script.split("\n").filter((l) => /console\.(log|error|warn)/.test(l))) {
    assert.doesNotMatch(line, /apiKey|process\.env/, `a log line can print the key: ${line.trim()}`);
  }
});

// ---------------------------------------------------------------------------
// (j) reliability rules, added after the real-model preview: emoji placement, tone cues, numbers, length
// ---------------------------------------------------------------------------

const EMOJI_PLACEMENT_RULES = [
  "Put an emoji at the end of a sentence, roughly one every second sentence, spread across the whole text from the first sentences to the last.",
  "Never put more than two emojis next to each other.",
  "Never put all of them at the end.",
  "Never repeat the same emoji (so never use more emojis than your palette has).",
  "Never use number or keycap emojis.",
  "Never use an emoji in place of a word.",
];

for (const surface of SURFACES) {
  test(`(j) ${surface}: every concrete emoji rule is in the built prompt of every persona, exactly once`, () => {
    for (const id of IDS) {
      const built = buildPersonaPrompt(id, surface);
      for (const rule of EMOJI_PLACEMENT_RULES) assert.equal(count(built, rule), 1, `${id}: ${rule}`);
      assert.ok(!built.includes("repeats are fine"), `${id}: the old "repeats are fine" contradicts "never repeat"`);
      assert.ok(!/in a row/.test(built), `${id}: the old "in a row" wording is gone`);
    }
  });
}

test('(j) "never repeat the same emoji" can be obeyed: every palette has at least as many distinct emojis as the roast minimum', () => {
  const roastRange = EMOJI_RULES_ROAST.match(/Use (\d+) to (\d+) emojis/);
  const checkinRange = EMOJI_RULES_CHECKIN.match(/Use (\d+) to (\d+) emojis/);
  assert.ok(roastRange && checkinRange);
  assert.deepEqual([Number(roastRange[1]), Number(roastRange[2]), Number(checkinRange[1]), Number(checkinRange[2])], [8, 12, 4, 6]);
  for (const id of IDS) {
    const distinct = new Set(ROAST_PERSONAS[id].palette.map(withoutVariationSelectors));
    assert.equal(distinct.size, ROAST_PERSONAS[id].palette.length, `${id} palette repeats an emoji`);
    assert.ok(distinct.size >= Number(roastRange[1]), `${id}: ${distinct.size} emojis cannot give a roast of ${roastRange[1]} without repeating one`);
  }
});

test("(j) no palette contains a number or keycap emoji", () => {
  for (const id of IDS) {
    for (const e of ROAST_PERSONAS[id].palette) {
      assert.doesNotMatch(e, /\p{Me}|🔟|🔢|\d/u, `${id} palette has a number/keycap emoji: ${e}`);
    }
  }
});

const OLD_TONE_EXAMPLES = [
  "Seven hours on TikTok is a full-time job with no salary.",
  "Right. Five hours of sleep is an undercooked night, and the oven was never even on.",
  "Reveille was 0600; you reported for duty at noon.",
  "Babe, not you ordering delivery three nights a week and calling it meal prep.",
  "Let's circle back on the 2 a.m. scrolling cadence.",
  "Sweetheart, in my day the phone stayed on the wall, and we all slept just fine.",
];
const CUES_INTRO = "Tone cues, fragments only (riff on them in your own words, never copy them): ";
const cuesOf = (voice: string) => {
  const at = voice.indexOf(CUES_INTRO);
  assert.ok(at !== -1, "the voice has no tone cues");
  return [...voice.slice(at + CUES_INTRO.length).matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
};

test("(j) every voice ends with tone cues: short fragments, no full sentence, no numbers, and no old example", () => {
  for (const id of IDS) {
    const { voice } = ROAST_PERSONAS[id];
    assert.ok(!/Tone example/i.test(voice), `${id}: still has a tone example`);
    assert.ok(voice.endsWith(".") && voice.slice(voice.indexOf(CUES_INTRO)).split('"').length >= 5, `${id}: the cues are the last thing in the voice`);
    const cues = cuesOf(voice);
    assert.ok(cues.length >= 2, `${id}: needs at least two cues`);
    for (const cue of cues) {
      assert.ok(cue.split(/\s+/).length <= 6, `${id}: "${cue}" is longer than a fragment`);
      assert.match(cue, /^[a-z]/, `${id}: "${cue}" starts like a sentence (capital letter)`);
      assert.doesNotMatch(cue, /[.!?;:,\d]/, `${id}: "${cue}" has sentence punctuation, a comma or a digit`);
    }
  }
});

test("(j) none of the six old tone-example sentences survives anywhere in a built prompt", () => {
  const all = IDS.flatMap((id) => SURFACES.map((s) => buildPersonaPrompt(id, s))).join("\n");
  for (const old of OLD_TONE_EXAMPLES) assert.equal(all.includes(old), false, old);
});

test("(j) the 'performance improvement plan' line is neither an instruction nor a quote anywhere, and Corporate keeps a varied dry closing line", () => {
  for (const id of IDS) {
    for (const surface of SURFACES) assert.doesNotMatch(buildPersonaPrompt(id, surface), /performance improvement plan/i, `${id}/${surface}`);
    const { voice, blurb, label } = ROAST_PERSONAS[id];
    assert.doesNotMatch(`${voice} ${blurb} ${label}`, /performance improvement plan/i, id);
  }
  assert.match(ROAST_PERSONAS.corporate_manager.voice, /End with a dry, reassuring line in manager-speak that this is nothing formal, worded differently every time\./);
});

for (const surface of SURFACES) {
  test(`(j) ${surface}: only numbers the user gave; never compute ratios, percentages or scores`, () => {
    for (const id of IDS) {
      const built = buildPersonaPrompt(id, surface);
      assert.equal(count(built, "Use only numbers the user gave you"), 1, id);
      assert.equal(count(built, "do not compute new ratios, percentages or scores."), 1, id);
      assert.equal(built.includes("plus the was-to-now scores listed below"), surface === "checkin", `${id}: the check-in (only) may also cite the listed was-to-now scores`);
    }
  });
}

test("(j) length rules: the roast aims for about 170 words and never under 150; the check-in is 80 to 95, hard maximum 100", () => {
  for (const id of IDS) {
    const roast = buildPersonaPrompt(id, "roast");
    const checkin = buildPersonaPrompt(id, "checkin");
    assert.equal(count(roast, "Write 150-200 words: aim for about 170 words, never under 150."), 1, id);
    assert.equal(count(checkin, "Write 80 to 95 words, hard maximum 100."), 1, id);
    assert.ok(!checkin.includes("100 words max") && !checkin.includes("150-200"), `${id}: the check-in must not carry the old or the roast limit`);
    assert.ok(!roast.includes("hard maximum 100") && !roast.includes("80 to 95"), `${id}: the roast must not carry the check-in limit`);
  }
});

// ---- the preview script's rule checks: the real block from scripts/persona-preview.mjs, run on crafted texts ----

type RuleResult = { rule: string; ok: boolean; detail: string };
function loadPreviewRules(): { evaluate: (text: string, kind: "roast" | "checkin", input: string) => RuleResult[] } {
  const src = readRoot("scripts/persona-preview.mjs");
  const a = src.indexOf("// ---- rules:start");
  const b = src.indexOf("// ---- rules:end");
  assert.ok(a !== -1 && b > a, "the rules block markers are missing from the preview script");
  return new Function(`${src.slice(a, b)}\nreturn { evaluate };`)() as ReturnType<typeof loadPreviewRules>;
}
const { evaluate } = loadPreviewRules();

const INPUT = "Phone screen time: 7 hours per day\nAverage sleep: 5 hours per night\nWeekly food delivery spending: $60";
const SENTENCE = "Your phone keeps a steady schedule and the habits agree with it."; // 12 words, no digits
const EMOJIS = ["🔥", "😴", "📱", "🏋️", "🍕", "🌙", "😬", "🙃", "🥩", "🧂", "🍽️", "📋", "🚨", "📢"];
const text = (sentences: number, after: Record<number, string> = {}, sentence = SENTENCE) =>
  Array.from({ length: sentences }, (_, i) => (after[i] ? `${sentence} ${after[i]}` : sentence)).join(" ");
const spreadAfter = (indexes: number[]): Record<number, string> => Object.fromEntries(indexes.map((at, i) => [at, EMOJIS[i]!]));
const failing = (rs: RuleResult[]) => rs.filter((r) => !r.ok).map((r) => r.rule);
const RULE_NAMES = ["words", "emojis", "run", "keycap", "repeat", "spread", "sentence-end", "numbers"];

const GOOD_ROAST = text(14, spreadAfter([0, 1, 3, 4, 6, 7, 9, 11, 13])); // 168 words, 9 distinct emojis, spread out
const GOOD_CHECKIN = text(7, spreadAfter([0, 2, 3, 5, 6])); // 84 words, 5 distinct emojis

test("(j) preview script: a compliant roast and a compliant check-in pass every rule, and every rule is reported", () => {
  const roast = evaluate(GOOD_ROAST, "roast", INPUT);
  assert.deepEqual(roast.map((r) => r.rule), RULE_NAMES);
  assert.deepEqual(failing(roast), [], JSON.stringify(roast.filter((r) => !r.ok)));
  const checkin = evaluate(GOOD_CHECKIN, "checkin", INPUT);
  assert.deepEqual(failing(checkin), [], JSON.stringify(checkin.filter((r) => !r.ok)));
});

test("(j) preview script: word count ranges (roast 150-200, check-in 80-100)", () => {
  assert.deepEqual(failing(evaluate(text(12, spreadAfter([0, 1, 3, 4, 6, 7, 9, 11])), "roast", INPUT)), ["words"], "144 words is under 150");
  assert.deepEqual(failing(evaluate(text(17, spreadAfter([0, 1, 3, 5, 7, 9, 11, 13, 15])), "roast", INPUT)), ["words"], "204 words is over 200");
  assert.deepEqual(failing(evaluate(text(13, spreadAfter([0, 1, 3, 4, 6, 7, 9, 12])), "roast", INPUT)), [], "156 words is fine");
  assert.deepEqual(failing(evaluate(text(9, spreadAfter([0, 2, 4, 6, 8])), "checkin", INPUT)), ["words"], "108 words is over the check-in maximum of 100");
  assert.deepEqual(failing(evaluate(text(6, spreadAfter([0, 1, 3, 4, 5])), "checkin", INPUT)), ["words"], "72 words is under 80");
});

test("(j) preview script: emoji count ranges (roast 8-12, check-in 4-6)", () => {
  assert.deepEqual(failing(evaluate(text(14, spreadAfter([0, 2, 4, 6, 8, 10, 12])), "roast", INPUT)), ["emojis"], "7 emojis is under 8");
  assert.deepEqual(failing(evaluate(text(7, spreadAfter([0, 3, 6])), "checkin", INPUT)), ["emojis"], "3 emojis is under 4");
  assert.deepEqual(failing(evaluate(text(7, spreadAfter([0, 1, 2, 3, 4, 5, 6])), "checkin", INPUT)), ["emojis"], "7 emojis is over 6");
});

test("(j) preview script: flags more than two emojis in a row, even with spaces between them", () => {
  const dumped = text(14, spreadAfter([0, 1, 3, 4, 6, 7, 9, 11, 12])).replace(/$/, ` ${EMOJIS.slice(9).join(" ")}`);
  assert.ok(failing(evaluate(dumped, "roast", INPUT)).includes("run"), "a block of emojis at the end");
  const three = text(14, { ...spreadAfter([0, 1, 3, 4, 6, 7, 9, 11, 13]), 5: "📋 🚨 📢" });
  const r = evaluate(three, "roast", INPUT);
  assert.ok(failing(r).includes("run") && /run 3/.test(r.find((x) => x.rule === "run")!.detail), "three next to each other in the middle");
  assert.ok(!failing(evaluate(text(14, { ...spreadAfter([0, 1, 3, 4, 6, 7, 9, 11, 13]), 5: "📋 🚨" }), "roast", INPUT)).includes("run"), "two next to each other is allowed");
});

test("(j) preview script: flags keycap digit emojis (7 in a box, and the 10 / 1234 emojis)", () => {
  const keycap = String.fromCodePoint(0x37, 0xfe0f, 0x20e3);
  for (const bad of [keycap, "🔟", "🔢"]) {
    const r = evaluate(text(14, { ...spreadAfter([0, 1, 3, 4, 6, 7, 9, 11]), 13: bad }), "roast", INPUT);
    assert.ok(failing(r).includes("keycap"), `${bad.length} chars: ${JSON.stringify(r.filter((x) => !x.ok))}`);
  }
  assert.ok(!failing(evaluate(GOOD_ROAST, "roast", INPUT)).includes("keycap"));
});

test("(j) preview script: flags a repeated emoji, with or without its variation selector", () => {
  assert.ok(failing(evaluate(text(14, { ...spreadAfter([0, 1, 3, 4, 6, 7, 9, 11]), 13: "🔥" }), "roast", INPUT)).includes("repeat"));
  const bare = String.fromCodePoint(0x1f3cb); // the weight lifter without its variation selector
  assert.ok(failing(evaluate(text(14, { ...spreadAfter([0, 1, 3, 4, 6, 7, 9, 11]), 13: bare }), "roast", INPUT)).includes("repeat"), "🏋️ and 🏋 are the same emoji");
});

test("(j) preview script: flags emojis dumped at the end instead of spread across the text", () => {
  const lateOnly = text(14, { 9: "🔥 😴", 10: "📱 🏋️", 11: "🍕 🌙", 12: "😬 🙃", 13: "🥩 🧂" });
  const r = evaluate(lateOnly, "roast", INPUT);
  assert.ok(failing(r).includes("spread"), JSON.stringify(r.find((x) => x.rule === "spread")));
  assert.ok(!failing(evaluate(GOOD_ROAST, "roast", INPUT)).includes("spread"));
});

test("(j) preview script: flags an emoji inside a sentence (a lowercase word right after it can mean it replaces a word)", () => {
  const poweredRobot = text(14, spreadAfter([0, 1, 3, 4, 6, 7, 9, 11])).replace("keeps a steady", "keeps a 🧂-powered steady");
  assert.ok(failing(evaluate(poweredRobot, "roast", INPUT)).includes("sentence-end"), "emoji followed by -powered");
  const replacesWord = text(14, spreadAfter([0, 1, 3, 4, 6, 7, 9, 11])).replace("the habits", "the 🧂 habits");
  assert.ok(failing(evaluate(replacesWord, "roast", INPUT)).includes("sentence-end"), "emoji followed by a lowercase word");
  assert.ok(!failing(evaluate(GOOD_ROAST, "roast", INPUT)).includes("sentence-end"), "an emoji after a full stop followed by a capital is fine");
});

test("(j) preview script: flags numbers that are not in the input (ratios, percentages, computed totals)", () => {
  const withInvented = `${GOOD_ROAST} That is 49 hours a week at a 0.71 ratio, or 30% of your life.`;
  const r = evaluate(withInvented, "roast", INPUT).find((x) => x.rule === "numbers")!;
  assert.equal(r.ok, false);
  assert.match(r.detail, /49/);
  assert.match(r.detail, /0\.71/);
  assert.match(r.detail, /30/);
  const given = `${GOOD_ROAST} You gave 7 hours, 5 hours of sleep and $60 of delivery.`;
  assert.equal(evaluate(given, "roast", INPUT).find((x) => x.rule === "numbers")!.ok, true, "numbers from the input are allowed, with or without a $ or a full stop");
});
