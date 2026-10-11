/**
 * Roast text is plain text: it is saved as the model returned it and rendered
 * without a markdown renderer, so stray markdown shows up as literal characters
 * (e.g. **word**, *word*, "**One-liner:**"). This strips it, conservatively.
 *
 * Asterisks are only removed when they come in a pair that hugs the words:
 *   - no whitespace just inside the asterisks, and
 *   - no letter, digit or other asterisk directly outside them,
 * so maths like "5*3*2", "2 * 3 * 4" and a lone "*" are left untouched.
 */

// Hyphen variants the model emits in "One-liner": - U+2010 U+2011 (non-breaking) U+2012 U+2013 U+2014 U+2015 U+2212
const HYPHEN = "[-\\u2010-\\u2015\\u2212]";
const ONE_LINER = `one${HYPHEN}?\\s?liner`;

// "**One-liner:**" / "**One-liner**:" label (any hyphen variant), removed together with its trailing space.
const BOLD_ONE_LINER_LABEL = new RegExp(`\\*\\*\\s*${ONE_LINER}\\s*:?\\s*\\*\\*[ \\t]*:?[ \\t]*`, "giu");
// Unbolded "One-liner:" label, only when it starts a line (so "here's a one-liner: ..." mid-sentence stays).
const PLAIN_ONE_LINER_LABEL = new RegExp(`^([ \\t]*)${ONE_LINER}[ \\t]*:[ \\t]*`, "gimu");

// Safari < 16.4 can't parse lookbehind, so the character before the opening asterisks is captured instead.
const BEFORE = "(^|[^\\p{L}\\p{N}*])";
const AFTER = "(?![\\p{L}\\p{N}*])";
// Words hugged by the asterisks: starts and ends with a non-space, non-asterisk, stays on one line.
const HUG = "([^\\s*](?:[^*\\n]*[^\\s*])?)";

const TRIPLE = new RegExp(`${BEFORE}\\*{3}${HUG}\\*{3}${AFTER}`, "gu");
const BOLD = new RegExp(`${BEFORE}\\*{2}${HUG}\\*{2}${AFTER}`, "gu");
const ITALIC = new RegExp(`${BEFORE}\\*${HUG}\\*${AFTER}`, "gu");

// Markdown heading / bullet markers at the start of a line ("# Title", "- item").
const LINE_HEADING = /^[ \t]{0,3}#{1,6}[ \t]+/gm;
const LINE_BULLET = /^[ \t]*[-•][ \t]+/gm;

function stripPairs(text: string): string {
  return text
    .replace(TRIPLE, "$1$2")
    .replace(BOLD, "$1$2")
    .replace(ITALIC, "$1$2");
}

export function cleanRoastText(text: string): string {
  if (!text) return text;

  let out = text
    .replace(BOLD_ONE_LINER_LABEL, "")
    .replace(PLAIN_ONE_LINER_LABEL, "$1");

  // Nested/adjacent cases ("**a *b* c**") need a second look once the inner pair is gone.
  for (let i = 0; i < 3; i++) {
    const next = stripPairs(out);
    if (next === out) break;
    out = next;
  }

  return out
    .replace(LINE_HEADING, "")
    .replace(LINE_BULLET, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
