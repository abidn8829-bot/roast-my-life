// Run with: node --test src/lib/safety.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import type Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEVEL1_FALLBACK_LINES,
  isPakistan,
  outputLooksUnsafe,
  parseLevel,
  resolveSafety,
  ruleFloorLevel,
  supportLinesOrFallback,
  validateSupportLines,
} from "./safety.ts";
import { generateSupportLines, recordFlag, runSafetyGrading } from "./safety-server.ts";

// ---------------------------------------------------------------------------
// parseLevel / resolveSafety
// ---------------------------------------------------------------------------

test("parseLevel accepts only 0, 1, 2 (number or numeric string)", () => {
  assert.equal(parseLevel(0), 0);
  assert.equal(parseLevel(1), 1);
  assert.equal(parseLevel(2), 2);
  assert.equal(parseLevel("2"), 2);
  assert.equal(parseLevel(" 1 "), 1);
  for (const bad of [3, -1, 1.5, "high", "", null, undefined, {}, [], true, NaN]) assert.equal(parseLevel(bad), null);
});

test("resolveSafety: unsure = higher level (max of AI and rule filter)", () => {
  assert.deepEqual(resolveSafety(0, 0), { kind: "level", level: 0 });
  assert.deepEqual(resolveSafety(0, 1), { kind: "level", level: 1 });
  assert.deepEqual(resolveSafety(1, 2), { kind: "level", level: 2 });
  assert.deepEqual(resolveSafety(2, 0), { kind: "level", level: 2 });
});

test("resolveSafety: AI failed and no rule matched = unavailable (never a roast, never a flag)", () => {
  assert.deepEqual(resolveSafety(null, 0), { kind: "unavailable" });
  assert.deepEqual(resolveSafety(undefined, 0), { kind: "unavailable" });
  assert.deepEqual(resolveSafety("maybe", 0), { kind: "unavailable" });
});

test("resolveSafety: AI failed but a rule matched = the rule level stands", () => {
  assert.deepEqual(resolveSafety(null, 2), { kind: "level", level: 2 });
  assert.deepEqual(resolveSafety(undefined, 1), { kind: "level", level: 1 });
});

// ---------------------------------------------------------------------------
// Rule filter on the approved test messages
// ---------------------------------------------------------------------------

const LEVEL2_MESSAGES = [
  "I don't want to live anymore",
  "I want to end it all",
  "Everyone would be better off without me",
  "I don't think I will ever succeed, nothing works for me, I've tried so many things. Why me? I don't want to live a life like this.",
  "I keep thinking about hurting myself",
  "I wish I could just disappear and never wake up",
  "Sometimes I think about not being here",
  "mujhe jeene ka mann nahi karta",
  "I'm going to hurt someone",
];

test("rule filter catches the Level 2 test messages (typographic apostrophes too)", () => {
  for (const m of LEVEL2_MESSAGES) assert.equal(ruleFloorLevel(m), 2, m);
  assert.equal(ruleFloorLevel("I don’t want to live anymore"), 2);
  assert.equal(ruleFloorLevel("مجھے جینے کا من نہیں"), 2);
  assert.equal(ruleFloorLevel("main khudkushi karna chahta hoon"), 2);
});

test("rule filter leaves everyday / borderline / friend messages to the AI", () => {
  const notRuleMatched = [
    "My friend told me she wants to hurt herself. What do I do?",
    "I'm dead tired lol, slept 4 hours",
    "This deadline is killing me",
    "I want to kill my phone addiction",
    "I failed my exam again, I'm such an idiot",
    "My sleep schedule is dead",
    "Ugh I hate my life when it's Monday",
    "Gym? I'd rather die",
    "I spent 8000 rupees on food delivery this week",
    "fine",
    "idk",
    "I actually did it",
    "I tried",
    "I failed again",
    "I don't want to live in this city anymore",
    "I don't want to live with my parents",
  ];
  for (const m of notRuleMatched) assert.equal(ruleFloorLevel(m), 0, m);
});

test("rule filter: strong Level 1 phrases", () => {
  assert.equal(ruleFloorLevel("I feel so alone"), 1);
  assert.equal(ruleFloorLevel("main bohat akela feel kar raha hoon"), 1);
  assert.equal(ruleFloorLevel("I cried all night. I'm so tired of everything"), 1);
  assert.equal(ruleFloorLevel("I feel like a total failure and everyone is ahead of me"), 1);
});

test("rule filter looks at every text it is given", () => {
  assert.equal(ruleFloorLevel("fine", "How did it go?", "I want to end it all"), 2);
  assert.equal(ruleFloorLevel(null, undefined, ""), 0);
});

// ---------------------------------------------------------------------------
// Output check: whole-word matching
// ---------------------------------------------------------------------------

const ORDINARY_ROAST_SENTENCES = [
  "Your emotional range is basically one nap and a snack.",
  "You're emotionally exhausted from scrolling the same three apps for six hours.",
  "Sleeping four hours a night and calling it a lifestyle? You're dead tired and proud of it.",
  "You're killing it at one thing: ordering food at 2am.",
  "Go ahead and cry about the 40 dollars on delivery, but the app will still charge you tomorrow.",
  "I died laughing when you said you'd start the gym on Monday. Again.",
  "Your screen time is 9 hours, which is a full-time job with worse benefits.",
  "The only thing you're consistent at is being inconsistent.",
  "Your sleep schedule is deader than your New Year's resolutions.",
  "You told yourself you'd read more. The book is crying on your shelf.",
  "Wow, three workouts this week. Your couch filed a missing person report.",
  "Your discipline grade is a D, which stands for Dramatic.",
  "You spend more on coffee than on groceries, and it shows in your focus score.",
  "Emotional damage? No, that's just your credit card statement.",
  "You said you'd quit TikTok. TikTok said, see you in five minutes.",
  "Honestly, your dedication to doing nothing is almost inspiring.",
  "That's a lot of rupees for food you could have cooked in ten minutes.",
  "Your phone is the only relationship you maintain daily.",
  "Keep it up and your focus will need its own wake-up call.",
  "You don't have a spending problem, you have a hobby that delivers.",
];

test("output check lets ordinary roast sentences through (20 samples)", () => {
  assert.ok(ORDINARY_ROAST_SENTENCES.length >= 15);
  for (const s of ORDINARY_ROAST_SENTENCES) assert.equal(outputLooksUnsafe(s), false, s);
});

test("output check blocks text that mocks sadness, self-harm or pain", () => {
  const bad = [
    "Just kill yourself already, your streak is dead anyway.",
    "Nobody would miss you if you deleted the app.",
    "Cry about it, you sad loser.",
    "kys",
    "Maybe go die in a corner.",
    "Your depression sleep schedule is hilarious.",
    "Self-harm would be less painful than your spending report.",
    "You're so emo about your screen time.",
    "The world would be better off without you and your food delivery habit.",
    "Suicide watch called, it wants its energy back.",
    "Forever alone, just like your fitness grade.",
    "You're dead inside, just like your gym membership.",
  ];
  for (const s of bad) assert.equal(outputLooksUnsafe(s), true, s);
});

test("output check ignores empty values and checks every text", () => {
  assert.equal(outputLooksUnsafe(null, undefined, ""), false);
  assert.equal(outputLooksUnsafe("fine roast", "go die"), true);
});

// ---------------------------------------------------------------------------
// Level 1 AI lines
// ---------------------------------------------------------------------------

test("support lines: good lines pass, opener duplicate is dropped", () => {
  assert.deepEqual(validateSupportLines(["It sounds like you feel very alone right now.", "That is a lot to carry."]), [
    "It sounds like you feel very alone right now.",
    "That is a lot to carry.",
  ]);
  assert.deepEqual(validateSupportLines(["That sounds really heavy.", "Feeling this alone hurts."]), ["Feeling this alone hurts."]);
});

test("support lines: every rule violation falls back", () => {
  const bad: unknown[] = [
    "not an array",
    [],
    ["a", "b", "c"],
    [42],
    ["It will get better soon."],
    ["Everything will be okay."],
    ["You'll feel better tomorrow."],
    ["You should talk to someone."],
    ["Try to get some sleep."],
    ["She probably doesn't care about you."],
    ["Your friend thinks you are overreacting."],
    ["This sounds like depression."],
    ["Maybe see a therapist."],
    ["It's your fault for waiting."],
    ["That is rough lol."],
    ["I will not roast you today."],
    ["That sounds so hard \u{1F614}."],
    ["First sentence. Second sentence here."],
    ["No ending punctuation"],
    ["This line is way too long because it keeps going and going and going and going and going well past the limit."],
    ["کچھ بھی نہیں."],
  ];
  for (const b of bad) assert.equal(validateSupportLines(b), null, JSON.stringify(b));
  assert.deepEqual(supportLinesOrFallback(["It will get better."]), [...LEVEL1_FALLBACK_LINES]);
  assert.deepEqual(supportLinesOrFallback(undefined), [...LEVEL1_FALLBACK_LINES]);
});

// ---------------------------------------------------------------------------
// Country
// ---------------------------------------------------------------------------

test("isPakistan: only an exact PK header counts", () => {
  const h = (v: string | null) => ({ get: (n: string) => (n === "x-vercel-ip-country" ? v : null) });
  assert.equal(isPakistan(h("PK")), true);
  assert.equal(isPakistan(h("pk")), true);
  assert.equal(isPakistan(h("US")), false);
  assert.equal(isPakistan(h("")), false);
  assert.equal(isPakistan(h(null)), false);
  assert.equal(isPakistan(null), false);
});

// ---------------------------------------------------------------------------
// The AI calls, with a fake Groq client (no network)
// ---------------------------------------------------------------------------

function fakeGroq(reply: () => unknown) {
  const calls: unknown[] = [];
  const groq = {
    chat: {
      completions: {
        create: async (body: unknown) => {
          calls.push(body);
          const r = reply();
          if (r instanceof Error) throw r;
          return { choices: [{ message: { content: typeof r === "string" ? r : JSON.stringify(r) } }] };
        },
      },
    },
  } as unknown as Groq;
  return { groq, calls };
}

const gradingInput = { answer: "fine", question: "q", activeTheme: "t", categoryScores: {} };

test("grading call: returns the AI level and keeps the grading fields", async () => {
  const { groq, calls } = fakeGroq(() => ({ safety_level: 0, grade_updates: { sleep: "B" }, suggestion_line: "Keep going." }));
  const r = await runSafetyGrading(groq, "m", gradingInput);
  assert.equal(r.aiLevel, 0);
  assert.deepEqual(r.gradeUpdates, { sleep: "B" });
  assert.equal(r.suggestionLine, "Keep going.");
  assert.equal(calls.length, 1); // exactly one AI call
});

test("grading call: level 1 and 2 come through", async () => {
  for (const lvl of [1, 2]) {
    const { groq } = fakeGroq(() => ({ safety_level: lvl, grade_updates: {}, suggestion_line: "" }));
    assert.equal((await runSafetyGrading(groq, "m", gradingInput)).aiLevel, lvl);
  }
});

test("grading call: API error, bad JSON and missing/invalid level all give aiLevel null", async () => {
  const errors: Array<() => unknown> = [
    () => new Error("boom: could not parse I want to end it all"),
    () => "this is not json",
    () => ({ grade_updates: {}, suggestion_line: "x" }),
    () => ({ safety_level: "high" }),
  ];
  const original = console.error;
  const logged: string[] = [];
  console.error = (...a: unknown[]) => logged.push(a.map((x) => JSON.stringify(x)).join(" "));
  try {
    for (const e of errors) {
      const { groq } = fakeGroq(e);
      assert.equal((await runSafetyGrading(groq, "m", gradingInput)).aiLevel, null);
    }
  } finally {
    console.error = original;
  }
  // No error log may contain any of the text from the failed call.
  assert.ok(!logged.join("\n").includes("end it all"), "error log leaked text");
  assert.ok(!logged.join("\n").includes("boom"), "error log leaked the error message");
});

test("grading call is told the level definitions and puts safety_level first", async () => {
  const { groq, calls } = fakeGroq(() => ({ safety_level: 0, grade_updates: {}, suggestion_line: "x" }));
  await runSafetyGrading(groq, "m", gradingInput);
  const body = calls[0] as { messages: Array<{ role: string; content: string }>; response_format: unknown };
  const system = body.messages[0]!.content;
  assert.match(system, /unsure between 0 and 1, choose 1/i);
  assert.match(system, /unsure between 1 and 2, choose 2/i);
  assert.match(system, /I don't want to live a life like this/);
  assert.match(system, /FIRST key/);
});

test("support lines call: valid lines are used, invalid or failing calls fall back", async () => {
  const ok = fakeGroq(() => ({ lines: ["It sounds like you feel very alone.", "That is a lot to hold."] }));
  assert.deepEqual(await generateSupportLines(ok.groq, "m", ["I feel alone"]), ["It sounds like you feel very alone.", "That is a lot to hold."]);

  const promise = fakeGroq(() => ({ lines: ["It will get better.", "You will be fine."] }));
  assert.deepEqual(await generateSupportLines(promise.groq, "m", ["x"]), [...LEVEL1_FALLBACK_LINES]);

  const original = console.error;
  console.error = () => {};
  try {
    const failing = fakeGroq(() => new Error("timeout"));
    assert.deepEqual(await generateSupportLines(failing.groq, "m", ["x"]), [...LEVEL1_FALLBACK_LINES]);
  } finally {
    console.error = original;
  }
  assert.equal(ok.calls.length, 1);
});

test("support lines prompt carries every strict rule", async () => {
  const { groq, calls } = fakeGroq(() => ({ lines: ["It sounds heavy.", "That is hard."] }));
  await generateSupportLines(groq, "m", ["x"]);
  const system = (calls[0] as { messages: Array<{ content: string }> }).messages[0]!.content;
  for (const needle of [
    "Reflect the feeling",
    "Never guess what another person thinks or feels",
    "Never blame",
    "Never promise",
    "Never joke or roast",
    "No persona voice",
    "No emojis",
    "No medical advice and no diagnosis",
    "ONE short sentence",
  ]) {
    assert.ok(system.includes(needle), needle);
  }
});

// ---------------------------------------------------------------------------
// Flag write: user id + level only
// ---------------------------------------------------------------------------

test("recordFlag inserts only user_id and level, and logs only a code on failure", async () => {
  const inserted: unknown[] = [];
  const ok = {
    from: (table: string) => {
      assert.equal(table, "safety_flags");
      return { insert: async (row: unknown) => (inserted.push(row), { error: null }) };
    },
  } as unknown as SupabaseClient;
  assert.equal(await recordFlag(ok, "user-1", 2), true);
  assert.deepEqual(inserted, [{ user_id: "user-1", level: 2 }]);

  const original = console.error;
  const logged: string[] = [];
  console.error = (...a: unknown[]) => logged.push(a.join(" "));
  try {
    const failing = {
      from: () => ({ insert: async () => ({ error: { code: "42P01", message: "relation safety_flags does not exist: I want to end it all" } }) }),
    } as unknown as SupabaseClient;
    assert.equal(await recordFlag(failing, "user-1", 1), false);
    const throwing = { from: () => { throw new Error("secret text"); } } as unknown as SupabaseClient;
    assert.equal(await recordFlag(throwing, "user-1", 1), false);
  } finally {
    console.error = original;
  }
  assert.deepEqual(logged, ["[safety] flag write failed code=42P01", "[safety] flag write failed code=exception"]);
});
