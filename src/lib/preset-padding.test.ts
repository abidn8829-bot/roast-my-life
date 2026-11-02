// Run with: node --test src/lib/preset-padding.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// A bare preset answer ("I tried") must not make the check-in roast invent habits, and an unchanged score
// (100 to 100) must not be handed to the roast model as a change.
//   (a) the built check-in prompt carries both new sentences, for all six voices
//   (b) the new text has no banned intensity word, no JSON and no roast_text
//   (c) the pure helper drops same-number scores and keeps real changes (missing numbers are dropped too)
//   (d) the route uses the helper, for the prompt line only
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { changedScoresForPrompt, formatChangedScores } from "./changed-scores.ts";
import { CHECKIN_FORMAT_AND_ACCURACY, buildPersonaPrompt } from "./roast-personas.ts";
import { ROAST_PERSONA_IDS } from "./roast-types.ts";

const SAME_NUMBERS =
  "If a listed category's was and now numbers are the same, nothing changed there: do not quote it as a change (say it held, or leave it out).";
const BARE_ANSWER =
  'If the check-in answer is only a few words with no detail (for example "I tried"), you know nothing about what they actually did: react to the answer itself and to the numbers, never name or invent any habit, purchase, food, app, time or reason, and treat the continuity memory as background on the topic only, never as things they just told you.';
const NEW_TEXT = `${SAME_NUMBERS} ${BARE_ANSWER}`;
const CITE_RULE_END = "reference a score for a category not listed there.";

// The same list as roast-personas.test.ts (c).
const FORBIDDEN = /\b(?:destroy\w*|devastat\w*|brutal\w*|savage\w*|no softening|maggot\w*|weak\w*|pathetic|failure\w*|worthless|stupid|ugly|fat|no mercy)\b/i;

const route = readFileSync(fileURLToPath(new URL("../app/api/check-in/route.ts", import.meta.url)), "utf8");

// (a)
test("(a) the built check-in prompt carries both new sentences, right after the cite rule, for all six voices", () => {
  assert.equal(ROAST_PERSONA_IDS.length, 6);
  for (const id of ROAST_PERSONA_IDS) {
    const built = buildPersonaPrompt(id, "checkin");
    assert.ok(built.includes(SAME_NUMBERS), `${id}: same-number sentence`);
    assert.ok(built.includes(BARE_ANSWER), `${id}: bare-answer sentence`);
    assert.ok(built.includes(`${CITE_RULE_END} ${NEW_TEXT} The life score`), `${id}: placed after the cite rule and before the life score rule`);
  }
});

test("(a) the new sentences are check-in only: the first-roast prompt does not carry them", () => {
  for (const id of ROAST_PERSONA_IDS) {
    const built = buildPersonaPrompt(id, "roast");
    assert.ok(!built.includes(SAME_NUMBERS) && !built.includes(BARE_ANSWER), id);
  }
});

// (b)
test("(b) the new text has no banned intensity word, no JSON and no roast_text", () => {
  assert.deepEqual(NEW_TEXT.match(new RegExp(FORBIDDEN.source, "gi")) ?? [], []);
  assert.ok(!/[{}[\]]/.test(NEW_TEXT) && !/json|roast_text/i.test(NEW_TEXT));
  assert.ok(CHECKIN_FORMAT_AND_ACCURACY.includes(NEW_TEXT));
});

// (c)
test("(c) the helper drops a same-number score (spending 100 to 100) and keeps a real change (40 to 60)", () => {
  assert.deepEqual(changedScoresForPrompt([{ key: "spending", was: 100, now: 100 }]), {});
  assert.deepEqual(changedScoresForPrompt([{ key: "sleep", was: 40, now: 60 }]), { sleep: { was: 40, now: 60 } });
  assert.deepEqual(
    changedScoresForPrompt([
      { key: "spending", was: 100, now: 100 },
      { key: "sleep", was: 40, now: 60 },
      { key: "focus", was: 75, now: 60 },
    ]),
    { sleep: { was: 40, now: 60 }, focus: { was: 75, now: 60 } },
  );
});

test("(c) a null, undefined or non-finite number has no exact was-to-now change, so it is dropped (and never throws)", () => {
  assert.deepEqual(changedScoresForPrompt([{ key: "sleep", was: null, now: 60 }]), {});
  assert.deepEqual(changedScoresForPrompt([{ key: "sleep", was: undefined, now: 60 }]), {});
  assert.deepEqual(changedScoresForPrompt([{ key: "sleep", was: 40, now: null }]), {});
  assert.deepEqual(changedScoresForPrompt([{ key: "sleep", was: Number.NaN, now: 60 }]), {});
  assert.deepEqual(changedScoresForPrompt([]), {});
});

test("(c) a change to or from 0 is kept (0 is a real score, not a missing one)", () => {
  assert.deepEqual(changedScoresForPrompt([{ key: "fitness", was: 0, now: 40 }]), { fitness: { was: 0, now: 40 } });
  assert.deepEqual(changedScoresForPrompt([{ key: "fitness", was: 40, now: 0 }]), { fitness: { was: 40, now: 0 } });
});

test("(c) the prompt line says none when nothing changed, never an empty {} ", () => {
  const none = formatChangedScores({});
  assert.match(none, /^none \(no category score changed this check-in\)$/);
  assert.ok(!none.includes("{"));
  assert.equal(formatChangedScores({ sleep: { was: 40, now: 60 } }), '{"sleep":{"was":40,"now":60}}');
});

// (d)
test("(d) the route builds the prompt's score list with the helper and prints it with formatChangedScores", () => {
  assert.match(route, /import \{ changedScoresForPrompt, formatChangedScores \} from "@\/lib\/changed-scores";/);
  assert.match(route, /const changedCategoryScores = changedScoresForPrompt\(/);
  assert.match(route, /separate from life score\): \$\{formatChangedScores\(changedCategoryScores\)\}\\n/);
  assert.ok(!route.includes("JSON.stringify(changedCategoryScores)"), "the raw, unfiltered list is no longer sent");
});

test("(d) the filtered list feeds ONLY the roast prompt: it is not saved, scored or passed anywhere else", () => {
  const uses = route.split("\n").filter((l) => l.includes("changedCategoryScores"));
  assert.equal(uses.length, 2, uses.join("\n")); // the declaration and the one prompt line
  assert.ok(uses.some((l) => l.includes("formatChangedScores(changedCategoryScores)") && l.includes('role: "user"')));
  // The saved scores and the life score are still computed from the unfiltered updates.
  assert.match(route, /const newGrade = filteredGradeUpdates\[key\];\n\s+if \(newGrade\) updatedCategoryScores\[key\] = /);
  assert.match(route, /const lifeScore = calculateLifeScore\(updatedCategoryScores\);/);
  assert.match(route, /category_scores: updatedCategoryScores/);
});
