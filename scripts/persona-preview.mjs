// Prints the six persona roasts for ONE fixed, fictional input, using the REAL prompt builder
// (src/lib/roast-personas.ts) and the REAL model call settings the routes use, so you can read them
// and check the voice, the medium intensity and the emoji use before anything ships.
//
// It touches NO database and writes nothing to disk. The input below is made up; no user text is
// involved. Each persona is one Groq call. The API key is read from the environment and handed to
// the SDK; it is never printed. Errors print the error class and HTTP status only.
//
// Run (PowerShell, from the project folder; the key is read from .env.local, never typed here):
//   node --env-file=.env.local scripts/persona-preview.mjs             the six first-time roasts (150-200 words, aim about 170)
//   node --env-file=.env.local scripts/persona-preview.mjs --checkin   the six check-in roasts (80-95 words, hard maximum 100, plain text)
//   node --env-file=.env.local scripts/persona-preview.mjs --only drill_sergeant,toxic_friend   only these ids
//   node --env-file=.env.local scripts/persona-preview.mjs --pause 3000   wait this many ms between calls (default 1500)
//
// Every roast is checked against each prompt rule and prints "ok" or "CHECK" per rule (printed, never enforced):
//   words         roast 150-200, check-in 80-100
//   emojis        roast 8-12, check-in 4-6
//   run           no more than 2 emojis next to each other
//   keycap        no keycap digit emojis (7 with a box around it, and the 10 / 1234 emojis)
//   repeat        the same emoji is never used twice
//   spread        emojis are spread over the text, not dumped at the end
//   sentence-end  an emoji never sits inside a sentence (a lowercase word right after it can mean it stands in for a word)
//   numbers       only numbers that are in the input (nothing computed). Heuristic: it also flags "3am"-style numbers
// Needs Node 22.18 or newer (it imports the .ts files directly) and GROQ_API_KEY in .env.local.

import Groq from "groq-sdk";

const argv = process.argv.slice(2);
function optValue(name) {
  const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i === -1) return undefined;
  return argv[i].includes("=") ? argv[i].slice(name.length + 1) : argv[i + 1];
}
const KNOWN = ["--checkin", "--only", "--pause", "--help"];
for (const a of argv) {
  if (a.startsWith("--") && !KNOWN.some((k) => a === k || a.startsWith(`${k}=`))) {
    console.error(`Unknown option ${a}. Options: ${KNOWN.join("  ")}`);
    process.exit(2);
  }
}
if (argv.includes("--help")) {
  console.log("node --env-file=.env.local scripts/persona-preview.mjs [--checkin] [--only id1,id2] [--pause ms]");
  process.exit(0);
}
const checkin = argv.includes("--checkin");
const pauseMs = optValue("--pause") === undefined ? 1500 : Number(optValue("--pause"));
if (!Number.isFinite(pauseMs) || pauseMs < 0 || pauseMs > 120000) {
  console.error("--pause needs a number of milliseconds between 0 and 120000, for example --pause 3000");
  process.exit(2);
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
const nodeMinor = Number(process.versions.node.split(".")[1]);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 18 && !process.features?.typescript)) {
  console.error(`Node ${process.versions.node} is too old for this script. Install Node 22.18 or newer (node -v to check).`);
  process.exit(2);
}

const apiKey = (process.env.GROQ_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
if (!apiKey) {
  console.error("GROQ_API_KEY is not set. Put it in .env.local and run: node --env-file=.env.local scripts/persona-preview.mjs");
  process.exit(2);
}

const { ROAST_PERSONA_LIST, buildPersonaPrompt } = await import("../src/lib/roast-personas.ts");
const P = await import("../src/lib/safety-prompts.ts");
const { OUTPUT_GUARDRAIL, SAFETY_CALL_OPTIONS, SAFETY_MODEL } = await import("../src/lib/safety-server.ts");
const { cleanRoastText } = await import("../src/lib/clean-roast-text.ts");

const onlyRaw = optValue("--only");
const only = onlyRaw ? onlyRaw.split(",").map((s) => s.trim()).filter(Boolean) : null;
const personas = only ? ROAST_PERSONA_LIST.filter((p) => only.includes(p.id)) : ROAST_PERSONA_LIST;
if (only) {
  const unknown = only.filter((id) => !ROAST_PERSONA_LIST.some((p) => p.id === id));
  if (unknown.length || personas.length === 0) {
    console.error(`--only needs ids from: ${ROAST_PERSONA_LIST.map((p) => p.id).join(", ")}`);
    process.exit(2);
  }
}

// ONE fixed, fictional input (nobody's real answers).
const ANSWERS = { phoneHours: 7, worstApp: "TikTok", sleepHours: 5, foodDeliverySpend: 60, neverDoThing: "go to the gym", socialMediaHours: 4, workoutFrequency: 0 };
// The check-in user message mirrors the one in src/app/api/check-in/route.ts, with fictional values.
const CHECKIN_USER = [
  `Categories graded this check-in (score is 0-100 for that category only, separate from life score): ${JSON.stringify({ sleep: { was: 40, now: 60 } })}`,
  `Category directions this check-in, all 5 (qualitative only, no numbers): ${JSON.stringify({ sleep: "improved", fitness: "same", discipline: "same", focus: "same", spending: "same" })}`,
  "Overall life score (0-100 average across all categories): was 52, now 56 (improved)",
  "Check-in answer: I went to bed at 11 for three nights, but I still scrolled in bed.",
  `Continuity memory: ${JSON.stringify({ activeTheme: "sleep", followUpQuestion: "Did you sleep earlier?", callbackCount: 1, resolved: false })}`,
].join("\n");

// ---- rules:start (plain functions only: src/lib/roast-personas.test.ts loads this block and tests it)
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const isEmoji = (g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Me}/u.test(g); // pictographs, flags, keycaps
const isKeycap = (g) => /\p{Me}/u.test(g) || g === "🔟" || g === "🔢"; // 7 in a box, and the 10 / 1234 emojis
const baseOf = (g) => g.replace(/\p{Variation_Selector}/gu, ""); // the same emoji with or without its variation selector
const numbersIn = (text) => (text.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));
const RANGES = {
  roast: { words: [150, 200], emojis: [8, 12], aim: "aim about 170" },
  checkin: { words: [80, 100], emojis: [4, 6], aim: "aim 80-95" },
};

/** One roast against every rule. kind is "roast" or "checkin"; inputText is what the model was given (its numbers are the allowed ones). */
function evaluate(text, kind, inputText) {
  const range = RANGES[kind];
  const parts = [...segmenter.segment(text)].map((x) => x.segment);
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const emojiAt = [];
  parts.forEach((g, i) => {
    if (isEmoji(g)) emojiAt.push(i);
  });
  const emojis = emojiAt.map((i) => parts[i]);

  let run = 0;
  let maxRun = 0;
  for (const g of parts) {
    if (isEmoji(g)) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else if (!/^\s+$/.test(g)) {
      run = 0; // whitespace between two emojis does not break a run
    }
  }

  const keycaps = emojis.filter(isKeycap);
  const counts = new Map();
  for (const e of emojis) counts.set(baseOf(e), (counts.get(baseOf(e)) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([e, n]) => `${e} x${n}`);

  const where = emojiAt.map((i) => i / Math.max(1, parts.length - 1)); // 0 = start of the text, 1 = end
  const lastFifth = where.filter((w) => w > 0.8).length;
  const spreadOk = emojis.length >= 2 && where[0] <= 0.35 && lastFifth <= Math.ceil(emojis.length / 2);

  const inside = [];
  for (const i of emojiAt) {
    let j = i + 1;
    while (j < parts.length && /^\s+$/.test(parts[j])) j += 1;
    const next = parts[j] ?? "";
    const after = parts[j + 1] ?? "";
    if (/^\p{Ll}$/u.test(next) || (next === "-" && /^\p{L}$/u.test(after))) inside.push(parts[i]);
  }

  const given = new Set(numbersIn(inputText));
  const invented = [...new Set(numbersIn(text).filter((n) => !given.has(n)))];

  const [wLo, wHi] = range.words;
  const [eLo, eHi] = range.emojis;
  return [
    { rule: "words", ok: words >= wLo && words <= wHi, detail: `${words} (target ${wLo}-${wHi}, ${range.aim})` },
    { rule: "emojis", ok: emojis.length >= eLo && emojis.length <= eHi, detail: `${emojis.length} (target ${eLo}-${eHi})` },
    { rule: "run", ok: maxRun <= 2, detail: `longest run ${maxRun} (max 2)` },
    { rule: "keycap", ok: keycaps.length === 0, detail: keycaps.length ? keycaps.join(" ") : "none" },
    { rule: "repeat", ok: repeated.length === 0, detail: repeated.length ? repeated.join(", ") : "none repeated" },
    { rule: "spread", ok: spreadOk, detail: emojis.length ? `first at ${Math.round(where[0] * 100)}% of the text, ${lastFifth} of ${emojis.length} in the last fifth` : "no emojis" },
    { rule: "sentence-end", ok: inside.length === 0, detail: inside.length ? `emoji inside a sentence: ${inside.join(" ")}` : "none inside a sentence" },
    { rule: "numbers", ok: invented.length === 0, detail: invented.length ? `not in the input: ${invented.join(", ")}` : "only numbers from the input" },
  ];
}
// ---- rules:end

const roastInput = P.formatUserMessage(ANSWERS, null, undefined, undefined); // the real user message the roast route sends

const groq = new Groq({ apiKey });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rows = [];

console.log(`${checkin ? "CHECK-IN roasts" : "First-time roasts"} for one fictional input, model ${SAFETY_MODEL}. Not saved anywhere.\n`);

for (const [i, persona] of personas.entries()) {
  if (i > 0) await sleep(pauseMs);
  let text = "";
  let note = "";
  try {
    if (checkin) {
      const completion = await groq.chat.completions.create(
        {
          model: SAFETY_MODEL,
          max_tokens: 350,
          reasoning_effort: "low",
          messages: [
            { role: "system", content: `${buildPersonaPrompt(persona.id, "checkin")}\n\n${OUTPUT_GUARDRAIL}` },
            { role: "user", content: CHECKIN_USER },
          ],
        },
        SAFETY_CALL_OPTIONS,
      );
      text = cleanRoastText(completion.choices[0]?.message?.content?.trim() ?? "");
    } else {
      const completion = await groq.chat.completions.create(
        {
          model: SAFETY_MODEL,
          ...P.ROAST_CALL_PARAMS,
          messages: P.buildRoastMessages(buildPersonaPrompt(persona.id, "roast"), roastInput),
        },
        SAFETY_CALL_OPTIONS,
      );
      const parsed = P.parseRoastResponse(completion.choices[0]?.message?.content?.trim() ?? "");
      text = cleanRoastText(parsed.roastText) || parsed.roastText;
      note = parsed.aiLevel === 0 ? "" : ` | safety_level=${parsed.aiLevel === null ? "none" : parsed.aiLevel} (expected 0)`;
    }
  } catch (error) {
    // Class and HTTP status only: never the message, the request or any env value.
    const status = typeof error?.status === "number" ? ` HTTP ${error.status}` : "";
    console.log(`=== ${persona.emoji} ${persona.label} (${persona.id}) ===\n  call failed: ${error?.constructor?.name ?? "Error"}${status}\n`);
    rows.push({ persona, failed: true });
    continue;
  }
  const results = evaluate(text, checkin ? "checkin" : "roast", checkin ? CHECKIN_USER : roastInput);
  rows.push({ persona, results });
  console.log(`=== ${persona.emoji} ${persona.label} (${persona.id}) ===${note}`);
  for (const r of results) console.log(`  ${r.rule.padEnd(13)}${r.ok ? "ok   " : "CHECK"}  ${r.detail}`);
  console.log("");
  console.log(text || "  (no text came back)");
  console.log("");
}

const rules = rows.find((r) => r.results)?.results.map((r) => r.rule) ?? [];
console.log(`Summary (${checkin ? "check-in" : "first-time roast"}; ok or CHECK per rule):`);
console.log(`  ${"".padEnd(18)}${rules.map((r) => r.padEnd(13)).join("")}`);
let toCheck = 0;
for (const row of rows) {
  if (row.failed) {
    console.log(`  ${row.persona.label.padEnd(18)}call failed`);
    continue;
  }
  toCheck += row.results.filter((r) => !r.ok).length;
  console.log(`  ${row.persona.label.padEnd(18)}${row.results.map((r) => (r.ok ? "ok" : "CHECK").padEnd(13)).join("")}`);
}
console.log(toCheck === 0 ? "\nAll rules ok for every roast." : `\n${toCheck} rule(s) marked CHECK: read those roasts above.`);
