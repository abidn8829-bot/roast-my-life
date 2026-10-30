// Prints the six persona roasts for ONE fixed, fictional input, using the REAL prompt builder
// (src/lib/roast-personas.ts) and the REAL model call settings the routes use, so you can read them
// and check the voice, the medium intensity and the emoji use before anything ships.
//
// It touches NO database and writes nothing to disk. The input below is made up; no user text is
// involved. Each persona is one Groq call. The API key is read from the environment and handed to
// the SDK; it is never printed. Errors print the error class and HTTP status only.
//
// Run (PowerShell, from the project folder; the key is read from .env.local, never typed here):
//   node --env-file=.env.local scripts/persona-preview.mjs             the six first-time roasts (150-200 words)
//   node --env-file=.env.local scripts/persona-preview.mjs --checkin   the six check-in roasts (100 words max, plain text)
//   node --env-file=.env.local scripts/persona-preview.mjs --only drill_sergeant,toxic_friend   only these ids
//   node --env-file=.env.local scripts/persona-preview.mjs --pause 3000   wait this many ms between calls (default 1500)
//
// What it checks per roast (printed, never enforced): word count (roast 150-200, check-in <= 100),
// emoji count (roast 8-12, check-in 4-6), and the longest run of emojis in a row (must be <= 2).
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

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const isEmoji = (g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(g); // pictographs, flags, keycaps
function measure(text) {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  let emojis = 0;
  let run = 0;
  let maxRun = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (isEmoji(segment)) {
      emojis += 1;
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else if (!/^\s+$/.test(segment)) {
      run = 0; // whitespace between two emojis does not break a run
    }
  }
  return { words, emojis, maxRun };
}

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
          messages: P.buildRoastMessages(buildPersonaPrompt(persona.id, "roast"), P.formatUserMessage(ANSWERS, null, undefined, undefined)),
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
  const m = measure(text);
  rows.push({ persona, m });
  console.log(`=== ${persona.emoji} ${persona.label} (${persona.id}) ===`);
  console.log(`  ${m.words} words | ${m.emojis} emojis | longest emoji run ${m.maxRun}${note}\n`);
  console.log(text || "  (no text came back)");
  console.log("");
}

const range = checkin ? { words: [1, 100], emojis: [4, 6] } : { words: [150, 200], emojis: [8, 12] };
console.log("Summary (target: " + `${checkin ? "up to 100" : "150-200"} words, ${range.emojis[0]}-${range.emojis[1]} emojis, runs <= 2):`);
for (const row of rows) {
  if (row.failed) {
    console.log(`  ${row.persona.label.padEnd(18)} call failed`);
    continue;
  }
  const { words, emojis, maxRun } = row.m;
  const ok = words >= range.words[0] && words <= range.words[1] && emojis >= range.emojis[0] && emojis <= range.emojis[1] && maxRun <= 2;
  console.log(`  ${row.persona.label.padEnd(18)} ${String(words).padStart(3)} words  ${String(emojis).padStart(2)} emojis  run ${maxRun}  ${ok ? "ok" : "CHECK"}`);
}
