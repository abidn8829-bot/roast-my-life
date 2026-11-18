// Run with: node --test src/lib/skills/notebook-texts.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// The safety classifier reads only the first 500 characters of each text it is given. A note can be 600 characters,
// so the note is handed over as overlapping pieces. These tests prove every character is read, using the REAL
// runSafetyClassify with a fake Groq client that records what the model would have been sent.
import assert from "node:assert/strict";
import { test } from "node:test";
import type Groq from "groq-sdk";
import { runSafetyClassify } from "../safety-server.ts";
import { CLASSIFIER_OVERLAP, CLASSIFIER_READ_LIMIT, classifierTexts, clipNote } from "./notebook-texts.ts";

/** A fake Groq client that answers level 0 and keeps the user message of every call. */
function fakeGroq() {
  const sent: string[] = [];
  const groq = {
    chat: {
      completions: {
        create: async (args: { messages: Array<{ role: string; content: string }> }) => {
          sent.push(args.messages.find((m) => m.role === "user")?.content ?? "");
          return { choices: [{ message: { content: '{"safety_level": 0}' } }] };
        },
      },
    },
  } as unknown as Groq;
  return { groq, sent };
}

/** n different characters (no repeats), so where a piece sits in the note can be told exactly. */
const unique = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(0x4e00 + i)).join("");

/** 600 distinct, readable characters: "0000 0001 0002 ..." style words, so any position can be identified. */
const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + (i % 26))).join("");

test("a 600-character note becomes two pieces: characters 1 to 500 and 451 to 600", () => {
  const note = letters(600);
  const pieces = classifierTexts(note);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0], note.slice(0, 500));
  assert.equal(pieces[1], note.slice(450, 600));
  assert.equal(CLASSIFIER_READ_LIMIT, 500);
  assert.equal(CLASSIFIER_OVERLAP, 50);
});

test("a note of 500 characters or fewer is one piece, and an empty or blank note gives none", () => {
  assert.deepEqual(classifierTexts("hello there"), ["hello there"]);
  assert.equal(classifierTexts(letters(500)).length, 1);
  assert.deepEqual(classifierTexts(""), []);
  assert.deepEqual(classifierTexts("   \n\t  "), []);
});

test("every piece is within what the classifier reads (500 characters)", () => {
  for (const n of [1, 499, 500, 501, 549, 550, 551, 600]) {
    for (const piece of classifierTexts(letters(n))) assert.ok(piece.length <= 500, `${n}: ${piece.length}`);
  }
});

test("pieces are built from the whitespace-collapsed text, the same collapse the classifier does", () => {
  const note = "a".repeat(100) + " ".repeat(300) + "b".repeat(100) + "\n\n\n" + "c".repeat(90);
  const collapsed = note.replace(/\s+/g, " ").trim();
  const pieces = classifierTexts(note);
  assert.equal(pieces.length, 1, "after the collapse it is short enough for one piece");
  assert.equal(pieces[0], collapsed);
});

test("every character of a note is inside at least one piece (any length 1 to 600)", () => {
  for (let n = 1; n <= 600; n++) {
    const note = unique(n); // every character different, so a piece's position in the note is certain
    const pieces = classifierTexts(note);
    const covered = new Array(n).fill(false);
    let from = 0;
    for (const piece of pieces) {
      const at = note.indexOf(piece);
      assert.ok(at >= 0 && at <= from, `piece not found in note, or it leaves a gap (length ${n})`);
      for (let i = at; i < at + piece.length; i++) covered[i] = true;
      from = at + piece.length;
    }
    assert.ok(covered.every(Boolean), `a character was left out for length ${n}`);
  }
});

test("a phrase that crosses position 500 appears whole in at least one piece, wherever it sits", () => {
  const phrase = "x".repeat(50); // the longest the overlap guarantees: 50 characters
  for (let start = 450; start <= 500; start++) {
    const note = letters(600).split("");
    for (let i = 0; i < phrase.length; i++) note[start + i] = "x";
    const pieces = classifierTexts(note.join(""));
    assert.ok(
      pieces.some((p) => p.includes(phrase)),
      `a 50-character phrase starting at position ${start + 1} was cut in two`,
    );
  }
  // and a realistic one, written across the boundary
  const text = letters(480) + " i want to end it all " + letters(98);
  assert.ok(text.length <= 600);
  const pieces = classifierTexts(text);
  assert.ok(pieces.some((p) => p.includes("i want to end it all")));
  assert.ok(!pieces[0]!.includes("i want to end it all"), "the first piece alone really does cut it (so the overlap is what saves it)");
});

test("characters made of two UTF-16 units are never cut in half, and still all get covered", () => {
  const note = "😀".repeat(600); // 600 characters, 1200 units
  assert.equal(Array.from(clipNote(note)).length, 600);
  const pieces = classifierTexts(clipNote(note));
  assert.ok(pieces.length >= 3);
  for (const piece of pieces) {
    assert.ok(piece.length <= 500);
    assert.equal(piece, Array.from(piece).join(""), "no lone half of a character");
    assert.ok(Array.from(piece).every((c) => c === "😀"));
  }
  assert.equal(Array.from(pieces[pieces.length - 1]!).length > 0, true);
});

test("clipNote cuts to 600 whole characters, like saveNotebookEntry", () => {
  assert.equal(clipNote("a".repeat(700)).length, 600);
  assert.equal(clipNote("short"), "short");
  assert.equal(Array.from(clipNote("é".repeat(601))).length, 600);
});

// ---------------------------------------------------------------------------
// The real classifier, with a fake client
// ---------------------------------------------------------------------------

test("PROOF: given the note as ONE text, the classifier never sees the last 100 characters (why the pieces exist)", async () => {
  const note = letters(500) + "TAIL-MARKER-" + "z".repeat(88); // 600 characters, a marker after position 500
  assert.equal(note.length, 600);
  const { groq, sent } = fakeGroq();
  assert.equal(await runSafetyClassify(groq, "m", [note]), 0);
  assert.equal(sent.length, 1);
  assert.ok(!sent[0]!.includes("TAIL-MARKER"), "the old way: the tail is cut off");
});

test("PROOF: given the pieces, the classifier is sent every character of the note, including the last 100", async () => {
  const note = letters(500) + "TAIL-MARKER-" + "z".repeat(88);
  const { groq, sent } = fakeGroq();
  assert.equal(await runSafetyClassify(groq, "m", classifierTexts(note)), 0);
  assert.equal(sent.length, 1, "one call, two pieces");
  assert.ok(sent[0]!.includes("TAIL-MARKER-" + "z".repeat(88)), "the last 100 characters reached the model");
  assert.ok(sent[0]!.includes(note.slice(0, 500)), "and so did the first 500");
  // every character of the note is somewhere in what was sent
  const last100 = note.slice(500);
  assert.ok(sent[0]!.includes(last100));
});

test("PROOF: a phrase at the very end (characters 590 to 600) reaches the classifier", async () => {
  const note = "a".repeat(590) + "end it all";
  const { groq, sent } = fakeGroq();
  await runSafetyClassify(groq, "m", classifierTexts(note));
  assert.ok(sent[0]!.includes("end it all"));
  const { groq: g2, sent: s2 } = fakeGroq();
  await runSafetyClassify(g2, "m", [note]);
  assert.ok(!s2[0]!.includes("end it all"), "as one text it would have been cut");
});
