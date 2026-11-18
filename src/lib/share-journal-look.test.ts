// Run with: node --test src/lib/share-journal-look.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins the journal look of the share features (share sheet, share buttons, the public share page, the share image)
// and the error pages' retry handler, by reading the source. Nothing here renders anything. Look only: the share
// actions, events and the image's size are pinned so the restyle cannot quietly change them.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const CHANGED_FILES = [
  "../components/share-sheet.tsx",
  "../components/share-buttons.tsx",
  "../components/roast-view.tsx",
  "../app/share/[slug]/page.tsx",
  "../app/api/og/[id]/route.tsx",
  "../app/error.tsx",
  "../app/global-error.tsx",
] as const;

// The one emoji that may stay: the text a person posts to X is the message they send, not a drawn icon, and changing
// it would change what the button does. Everything else in these files must be emoji-free.
const TWEET_TEXT = "I just got roasted 💀 ${shareUrl}";

// ---------------------------------------------------------------------------
// the look rules, for every changed file
// ---------------------------------------------------------------------------

test("look rules: no gradients, blur, glow shadows, emoji, or sage/powder/butter/clay as a text colour", () => {
  for (const file of CHANGED_FILES) {
    const raw = read(file);
    const code = stripComments(raw);
    assert.doesNotMatch(code, /gradient/i, `${file}: gradient`);
    assert.doesNotMatch(code, /\bbg-(linear|radial|conic)-/, `${file}: gradient class`);
    assert.doesNotMatch(code, /(^|[\s"'`:])(from|via|to)-(\[|[a-z]+(-\d{2,3})?(\/\d+)?[\s"'`])/m, `${file}: gradient stop class`);
    assert.doesNotMatch(code, /backdrop-blur|backdrop-filter|\bblur-|filter:\s*["'`]?blur/, `${file}: blur`);
    assert.doesNotMatch(code, /glow|drop-shadow|boxShadow|shadow-ember|shadow-\[[^\]]*(rgba|#|var)/i, `${file}: glow / coloured shadow`);
    assert.doesNotMatch(raw.split(TWEET_TEXT).join(""), /\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️/u, `${file}: emoji`);
    assert.doesNotMatch(code, /\btext-(sage|powder|butter|clay|milestone|progress|bar)\b/, `${file}: a fill colour used as text`);
  }
});

test("look rules: no coloured grade text (no grade-a..f colours, no per-grade colour helper) in any changed file", () => {
  for (const file of CHANGED_FILES) {
    const code = stripComments(read(file));
    assert.doesNotMatch(code, /\btext-grade-|\bbg-grade-|\bborder-grade-/, `${file}: grade colour class`);
    assert.doesNotMatch(code, /gradeOgColor|gradeColor|scoreTextColor|scoreGlow|getGradeColor|getScoreColor/, `${file}: grade colour helper`);
    assert.doesNotMatch(code, /var\(--grade-/, `${file}: grade colour variable`);
  }
});

test("look rules: no hard-coded brand colours (WhatsApp green, Instagram pink, old ember orange, old dark greys)", () => {
  for (const file of CHANGED_FILES) {
    const code = stripComments(read(file));
    assert.doesNotMatch(code, /#25D366|#E4405F|#FF3D00|#ff5a36|#0a0a0b|#111111|#1a1a1a|#d4d4d8|#6b6b70/i, `${file}: a brand or dark colour`);
    assert.doesNotMatch(code, /ember-legacy|panel-legacy|control-legacy|line-legacy|line-subtle-legacy|DarkScope/, `${file}: a legacy dark token`);
  }
});

// ---------------------------------------------------------------------------
// share sheet and buttons: light, neutral, behaviour untouched
// ---------------------------------------------------------------------------

test("roast-view: the share sheet is no longer wrapped in DarkScope and is still wired as before", () => {
  const view = stripComments(read("../components/roast-view.tsx"));
  assert.doesNotMatch(view, /DarkScope|journal-onboarding-ui/);
  assert.match(view, /<ShareSheet\s+roastId=\{roastId\}\s+shareSlug=\{shareSlug\}\s+onClose=\{closeShareSheet\}/);
});

test("share-sheet: journal surfaces and journal buttons; every share action and event is unchanged", () => {
  const raw = read("../components/share-sheet.tsx");
  const sheet = stripComments(raw);
  assert.match(sheet, /bg-surface/);
  assert.match(sheet, /\{primaryButton\}|className=\{primaryButton\}/);
  assert.match(sheet, /className=\{outlineButton\}/);
  // behaviour
  assert.match(sheet, /navigator\.share\(\{ files: \[file\] \}\)/);
  assert.match(sheet, /method: "native_share"/);
  assert.match(sheet, /method: "manual_save"/);
  assert.match(sheet, /method: "copy_link"/);
  assert.match(sheet, /method: "save_image"/);
  assert.match(sheet, /posthog\.capture\("share_sheet_shown"\)/);
  assert.match(sheet, /posthog\.capture\("share_sheet_dismissed", \{ reason \}\)/);
  assert.match(sheet, /copyText\(shareUrl\)/);
  assert.match(sheet, /downloadFile\(file\)/);
  // wording
  for (const words of ["This is embarrassing.", "Show it off before you fix it.", "Share to Instagram Story", "Copy Link", "Save Image", "Skip for now", "Preparing…"]) {
    assert.ok(raw.includes(words), `still says: ${words}`);
  }
});

test("share-buttons: four neutral ink-hairline buttons with hand-drawn icons; links, labels and events unchanged", () => {
  const raw = read("../components/share-buttons.tsx");
  const code = stripComments(raw);
  for (const label of ["Share on WhatsApp", "Share on X", "Save for Instagram", "Download report card"]) {
    assert.ok(code.includes(`aria-label="${label}"`), label);
  }
  assert.equal(code.match(/className=\{btnBase\}/g)?.length, 4, "every button uses the one neutral style");
  assert.doesNotMatch(code, /hover:border-\[|hover:bg-\[|hover:border-ember|hover:bg-ember/, "no brand-colour hover");
  assert.doesNotMatch(code, /useId|<defs>|fill="#|fill=\{`/, "no gradient id, no coloured fill");
  assert.doesNotMatch(code, /stroke="var\(--ember\)"/);
  assert.match(code, /stroke="var\(--text\)"/, "icons are ink strokes");
  assert.match(code, /focus-visible:outline/);
  // behaviour
  assert.equal(code.match(/posthog\.capture\('roast_shared'\)/g)?.length, 4);
  assert.match(code, /https:\/\/wa\.me\/\?text=/);
  assert.match(code, /https:\/\/twitter\.com\/intent\/tweet\?text=/);
  assert.match(code, /a\.download = "roast-my-life\.png"/);
  assert.ok(raw.includes(TWEET_TEXT), "the tweet text is exactly what it was");
});

// ---------------------------------------------------------------------------
// the public share page
// ---------------------------------------------------------------------------

test("share page: journal wrapper, grade letters drawn by GradeRow (ink + bar), no per-grade colour", () => {
  const raw = read("../app/share/[slug]/page.tsx");
  const page = stripComments(raw);
  assert.match(page, /<JournalTheme>/);
  assert.match(page, /<GradeRow key=\{key\} label=\{label\} grade=\{grade\} score=\{score\} \/>/);
  assert.doesNotMatch(page, /style=\{\{[^}]*(color|background)/, "no inline colours: nothing is coloured by grade");
  assert.doesNotMatch(page, /scoreToGrade|grades"/, "the page no longer imports the grade colour helpers");
  // the overall score: ink number, bar fill
  assert.match(page, /bg-bar/);
  // the data and links are the same
  assert.match(page, /getShareCardData\(slug\)/);
  assert.match(page, /isUuid\(slug\)/);
  assert.match(page, /location="header"/);
  assert.match(page, /location="footer"/);
  for (const words of ["Their life score", "The full roast", "Think your life scores higher?", "Answer 5 questions. Get graded. Get roasted. Free.", "Get your own roast", "Get roasted →"]) {
    assert.ok(raw.includes(words), `still says: ${words}`);
  }
});

// ---------------------------------------------------------------------------
// the share image
// ---------------------------------------------------------------------------

test("share image: a light journal card, same size and cache header, grade letter in ink with a bar", () => {
  const raw = read("../app/api/og/[id]/route.tsx");
  const code = stripComments(raw);
  assert.match(code, /const MIST = "#dce6ee";/);
  assert.match(code, /const INK = "#293a35";/);
  assert.match(code, /const POWDER = "#b9c9d8";/);
  assert.match(code, /const BAR = "#566b5b";/);
  assert.match(code, /background: MIST/);
  assert.match(code, /width: 1080,\s*height: 1920,/);
  assert.match(code, /public, max-age=60, s-maxage=3600, stale-while-revalidate=86400/);
  assert.match(code, /getShareCardData\(id\)/);
  // text colours: only ink or the muted ink grey. Fills (powder, bar) are never a text colour.
  const textColours = [...code.matchAll(/\bcolor:\s*([A-Za-z0-9_"#]+)/g)].map((m) => m[1]);
  assert.ok(textColours.length >= 6, "found the text colours");
  for (const c of textColours) assert.ok(c === "INK" || c === "MUTED", `a text colour that is not ink or muted ink: ${c}`);
  // the grade letter is ink, and a bar fill follows it
  assert.match(code, /\{row\.grade\}/);
  assert.match(code, /background: BAR/);
  // every literal hex in the file is one of the journal values
  const hexes = new Set([...code.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
  for (const hex of hexes) assert.ok(["#dce6ee", "#ecf1f6", "#293a35", "#555750", "#b9c9d8", "#566b5b"].includes(hex), `not a journal value: ${hex}`);
  // no fonts loaded or fetched
  assert.doesNotMatch(code, /fonts:|fetch\(|arrayBuffer|readFile/);
});

// ---------------------------------------------------------------------------
// the error pages: Next's retry, same words
// ---------------------------------------------------------------------------

test("error pages: Try again calls Next's retry (re-fetches server data); reset is gone; the words are unchanged", () => {
  for (const file of ["../app/error.tsx", "../app/global-error.tsx"] as const) {
    const raw = read(file);
    const code = stripComments(raw);
    assert.match(code, /\{ retry \}: \{ error: Error & \{ digest\?: string \}; retry: \(\) => void \}/, `${file}: retry prop`);
    assert.match(code, /onClick=\{\(\) => retry\(\)\}/, `${file}: button calls retry`);
    assert.doesNotMatch(code, /\breset\b/, `${file}: no reset`);
    assert.match(raw, /Try again/);
    assert.match(raw, /Go Home/);
  }
  assert.match(read("../app/error.tsx"), /const ERROR_MESSAGE = "Something went wrong\. Try again\.";/);
  assert.match(read("../app/global-error.tsx"), /Something went wrong\. Try again\./);
});
