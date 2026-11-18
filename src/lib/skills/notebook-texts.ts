// Prepares a notebook note for the safety checks. Pure: no database, no network, no clock.
// (No "@/" imports on purpose: src/lib/skills/*.test.ts load this file directly with Node.)
//
// Why this exists: runSafetyClassify (src/lib/safety-server.ts) reads at most the first 500 characters of EACH text
// it is given, after collapsing whitespace. A note can be 600 characters, so handed over as one text its last 100
// characters would never be read. The note is therefore handed over as overlapping pieces, so every character is
// inside at least one piece of 500 or fewer characters. The classifier itself is not changed.
//
// Pieces are built from the whitespace-collapsed text (the same collapse the classifier does), so what is counted
// here is what the classifier sees. For a note of 600 characters or fewer: piece 1 = characters 1 to 500,
// piece 2 = characters 451 to 600 (a 50-character overlap). A phrase of up to 50 characters that crosses
// position 500 therefore lies whole inside piece 2. Longer input (only possible with characters that take two
// UTF-16 units) simply gets more pieces by the same rule. A piece never starts or ends in the middle of a
// two-unit character.

import { NOTEBOOK_MAX_CHARS } from "./skills-server.ts";

/** What the classifier reads per text (safety-server.ts clips each text to this). */
export const CLASSIFIER_READ_LIMIT = 500;
/** How much neighbouring pieces share. */
export const CLASSIFIER_OVERLAP = 50;

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** The note as it will be saved: cut to the 600-character limit, counted in whole characters (as skills-server does). */
export function clipNote(text: string): string {
  return Array.from(text).slice(0, NOTEBOOK_MAX_CHARS).join("");
}

/** The pieces to hand to runSafetyClassify, in order. Empty when the note has no visible text. */
export function classifierTexts(note: string): string[] {
  const text = note.replace(/\s+/g, " ").trim();
  if (text === "") return [];
  const pieces: string[] = [];
  let start = 0;
  for (;;) {
    let end = Math.min(start + CLASSIFIER_READ_LIMIT, text.length);
    if (end < text.length && isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
    pieces.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - CLASSIFIER_OVERLAP;
    if (isLowSurrogate(text.charCodeAt(start))) start -= 1;
  }
  return pieces;
}
