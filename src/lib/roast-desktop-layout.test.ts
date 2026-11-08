// Run with: node --test src/lib/roast-desktop-layout.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins the desktop result page (the two-page spread from 1280px up) by reading the source, the same approach as
// roast-back-link.test.ts. Nothing here renders a page, touches a database or calls any AI.
// What it protects: the breakpoint, the plan band only when a plan exists, an inert check-in button (nothing is wired
// to it yet), no "/dashboard" text outside the one pinned link, no text hidden by gradients, blur or fixed heights.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { weakestCategory } from "./weakest-category.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const view = stripComments(read("../components/roast-view.tsx"));
const ui = stripComments(read("../components/journal-roast-ui.tsx"));
const share = stripComments(read("../components/share-buttons.tsx"));
const page = stripComments(read("../app/roast/[id]/page.tsx"));
const css = read("../app/globals.css");

// ---------------------------------------------------------------------------
// the breakpoint
// ---------------------------------------------------------------------------

test("desktop: the spread, the wide container and the short-screen variant exist, all from 1280px", () => {
  assert.match(view, /min-\[1280px\]:grid-cols-\[minmax\(0,52fr\)_minmax\(0,48fr\)\]/, "left page about 52 percent, right page about 48 (minmax(0, ...) so a very long word cannot widen a page)");
  assert.match(page, /min-\[1280px\]:max-w-\[1320px\] min-\[1280px\]:px-10/, "a wider container from 1280px: 1320px wide with 40px side padding is about 1240px of content");
  assert.match(page, /max-w-\[40rem\]/, "the 40rem column stays below 1280px");
  assert.match(css, /@custom-variant compact \(@media \(min-width: 1280px\) and \(max-height: 759px\)\);/);
  assert.match(view, /\bcompact:/);
  // nothing in the new layout uses a different desktop breakpoint
  for (const [name, code] of [["roast-view", view], ["journal-roast-ui", ui], ["share-buttons", share], ["page", page]] as const) {
    // page.tsx also keeps its old tablet padding for 640px to 1279px only (max-[1279px]), so it never fights the desktop padding
    const others = [...code.matchAll(/\b(?:min|max)-\[(\d+)px\]:/g)].map((m) => m[1]).filter((px) => px !== "1280" && !(name === "page" && px === "1279"));
    assert.deepEqual(others, [], `${name} uses a breakpoint other than 1280px`);
    assert.doesNotMatch(code, /\b(?:lg|xl|2xl|md):/, `${name} uses a named breakpoint`);
  }
});

test("desktop: below 1280px the pages are 'contents', so the phone keeps its single stacked column in the old order", () => {
  const wrappers = view.match(/className="contents min-\[1280px\]:/g) ?? [];
  assert.ok(wrappers.length >= 5, `expected the spread, both pages, the bottom bar and its right group, found ${wrappers.length}`);
  assert.match(view, /<div className="flex w-full flex-col gap-12 pb-12 min-\[1280px\]:gap-3\.5/);
  // the upgrade card stays for the phone and is hidden on desktop; the quiet link is desktop only; same condition
  assert.match(view, /rounded-xl border border-ember\/30 bg-ember-soft p-5 text-center min-\[1280px\]:hidden/);
  assert.match(view, /className="hidden min-\[1280px\]:flex min-\[1280px\]:items-center min-\[1280px\]:gap-3"/);
  assert.equal(view.match(/subscriptionTier !== "pro"/g)?.length, 2);
});

// ---------------------------------------------------------------------------
// the plan band
// ---------------------------------------------------------------------------

test("plan band: the band, the plan text and the check-in panel exist only inside {visiblePlan && (...)}", () => {
  assert.equal(view.match(/\{visiblePlan && \(/g)?.length, 1);
  const open = view.indexOf("{visiblePlan && (");
  const closeAt = view.indexOf('<div className="contents min-[1280px]:flex min-[1280px]:flex-wrap min-[1280px]:items-center min-[1280px]:justify-between');
  assert.ok(open !== -1 && closeAt > open);
  const band = view.slice(open, closeAt);
  for (const text of ["Your Plan", "Do it today. Check in tomorrow.", "Remind me tomorrow", "See if your {lifeScore} moves.", "bg-text px-6 py-6 text-bg", "{visiblePlan.challenge}", "visiblePlan.steps.map("]) {
    assert.ok(band.includes(text), `the band is missing: ${text}`);
  }
  // none of it appears outside the conditional
  const outside = view.slice(0, open) + view.slice(closeAt);
  for (const text of ["Do it today. Check in tomorrow.", "Remind me tomorrow", "bg-text px-6 py-6 text-bg", "visiblePlan.challenge", "visiblePlan.steps"]) {
    assert.ok(!outside.includes(text), `${text} must not be outside the plan conditional`);
  }
});

test("plan band: contrast of the text on the dark band meets WCAG AA (ink band, light text, powder 'why' line)", () => {
  const tokens = (name: string) => {
    const journal = css.slice(css.indexOf('html:has([data-theme="journal"])'));
    const v = journal.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    assert.ok(v, `token --${name} not found`);
    return v;
  };
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const ink = tokens("text"), page = tokens("bg"), powder = "#b9c9d8", muted = tokens("text-muted");
  assert.equal(css.match(/--powder:\s*(#[0-9a-fA-F]{6})/)?.[1].toLowerCase(), powder);
  assert.ok(ratio(page, ink) >= 4.5, `page-colour text on the ink band: ${ratio(page, ink).toFixed(2)}`);
  assert.ok(ratio(powder, ink) >= 4.5, `powder 'why' text on the ink band: ${ratio(powder, ink).toFixed(2)}`);
  assert.ok(ratio(muted, page) >= 4.5, `muted line on the light check-in panel: ${ratio(muted, page).toFixed(2)}`);
  assert.ok(ratio(ink, page) >= 4.5);
});

test("check-in button: a real <button type=\"button\"> whose click goes only through the reminder hook, with no push call of its own in the view", () => {
  const at = view.indexOf("Remind me tomorrow");
  const start = view.lastIndexOf("<button", at);
  const tag = view.slice(start, at);
  assert.match(tag, /^<button\s+type="button"/);
  // its only handler calls the hook's request(); the hook (use-plan-reminder.ts) is where asking and saving happen
  assert.equal(tag.match(/\bon[A-Z][A-Za-z]*=/g)?.length, 1, "exactly one handler on the button");
  assert.match(tag, /onClick=\{\(\) => void reminder\.request\(\)\}/);
  assert.match(view, /const reminder = usePlanReminder\(/);
  assert.doesNotMatch(tag, /\bform\b|\bhref\b/);
  // roast-view.tsx makes no push call of its own: no permission or push words, and no new fetch (the one fetch
  // left is the reaction buttons' call that was already there)
  assert.doesNotMatch(view, /Notification|pushManager|serviceWorker|requestPermission|\/api\/push/, "no permission request or push call");
  assert.equal(view.match(/\bfetch\(/g)?.length, 1, "no new fetch in roast-view.tsx");
  assert.match(view, /fetch\(`\/api\/roast\/\$\{roastId\}\/reaction`/);
});

// ---------------------------------------------------------------------------
// grades
// ---------------------------------------------------------------------------

test("weakest category: the lowest score wins, the first one listed wins a tie, nothing gives null", () => {
  assert.equal(weakestCategory({ sleep: { score: 90 }, fitness: { score: 20 }, discipline: { score: 60 }, focus: { score: 20 }, spending: { score: 75 } }), "fitness");
  assert.equal(weakestCategory({ focus: { score: 0 }, sleep: { score: 100 } }), "focus");
  assert.equal(weakestCategory({ a: { score: 50 }, b: { score: 50 } }), "a");
  assert.equal(weakestCategory({}), null);
  assert.equal(weakestCategory(null), null);
  assert.equal(weakestCategory(undefined), null);
});

test("grades: the rows come in the order and with the numbers R1 used, and the circle follows weakestCategory", () => {
  assert.match(view, /Object\.entries\(categoryScores\)\.map\(\(\[key, data\]\) => \(/);
  assert.match(view, /<GradeRow key=\{key\} label=\{key\} grade=\{data\.grade\} score=\{data\.score\} weakest=\{key === weakestKey\} \/>/);
  assert.match(view, /const weakestKey = weakestCategory\(categoryScores\);/);
  assert.match(ui, /\{Math\.round\(score \/ 10\)\}\/10/);
  assert.match(ui, /bg-bar/);
  assert.match(css, /--bar: #566b5b;/);
});

// ---------------------------------------------------------------------------
// accessibility and behaviour that must not change
// ---------------------------------------------------------------------------

test("a11y: one h1, a visually hidden heading for the grade list, and every icon button keeps its label", () => {
  assert.equal(view.match(/<h1\b/g)?.length, 1);
  assert.match(view, /<h2 className="sr-only">Category scores<\/h2>/);
  for (const label of ["Share on WhatsApp", "Share on X", "Save for Instagram", "Download report card"]) assert.ok(share.includes(`aria-label="${label}"`), label);
  assert.match(view, /aria-label=\{`React \$\{emoji\}`\}/);
  assert.match(share, /focus-visible:outline/);
});

test("behaviour: share events, reactions, 'Roast me again' and the share sheet are still wired as before", () => {
  assert.equal(share.match(/posthog\.capture\('roast_shared'\)/g)?.length, 4);
  assert.match(view, /onClick=\{\(\) => void onReaction\(emoji\)\}/);
  assert.match(view, /onClick=\{\(\) => void handleRoastAgain\(\)\}/);
  assert.match(view, /<ShareSheet\s+roastId=\{roastId\}\s+shareSlug=\{shareSlug\}\s+onClose=\{closeShareSheet\}/);
  assert.match(view, /\/api\/roast\/\$\{roastId\}\/reaction/);
});

test("behaviour: the persona signature is drawn only for a roast that has a known persona", () => {
  assert.match(view, /\{persona && isRoastPersona\(persona\) \? \(/);
  assert.match(view, /<PersonaIcon id=\{persona\} \/>/);
  assert.doesNotMatch(view, /persona = "default"/, "no default: a roast without a persona gets no doodle and no signature");
});

// ---------------------------------------------------------------------------
// what must not appear
// ---------------------------------------------------------------------------

test('the text "/dashboard" appears nowhere in the result page files except the one Link in page.tsx', () => {
  for (const [name, code] of [["roast-view", view], ["journal-roast-ui", ui], ["share-buttons", share]] as const) {
    assert.doesNotMatch(code, /\/dashboard/, `${name} must not contain /dashboard`);
  }
  assert.equal(page.match(/\/dashboard/g)?.length, 1);
  assert.match(page, /<Link href="\/dashboard" className=\{roastBackLink\}>/);
});

test("look: no gradients, blur, glow or shadows in the result page files", () => {
  for (const [name, code] of [["roast-view", view], ["journal-roast-ui", ui]] as const) {
    assert.doesNotMatch(code, /\bbg-gradient|\bbackdrop-|\bblur\b|\bblur-|\bdrop-shadow|shadow-ember-glow|\bshadow-|\bfrom-[a-z]|\bvia-[a-z]|\bto-[a-z]/, `${name} has a gradient, blur or glow class`);
    assert.doesNotMatch(code, /<(linear|radial)Gradient/, `${name} draws an SVG gradient`);
  }
});

test("text: no text block has a fixed height, clipping or truncation, so a long roast or plan grows the page", () => {
  const blocks = [...view.matchAll(/<(p|h1|h2|li|section|span)\b[^>]*?className=(?:"([^"]*)"|\{`([^`]*)`\})/g)];
  assert.ok(blocks.length > 20, "found the text blocks");
  for (const m of blocks) {
    const classes = m[2] ?? m[3] ?? "";
    assert.doesNotMatch(classes, /(^|\s)(?:min-\[1280px\]:|compact:)?(?:h-|max-h-|line-clamp|truncate|text-ellipsis|overflow-hidden|overflow-y-hidden)/, `fixed height or clipping on: ${classes}`);
  }
  assert.doesNotMatch(view, /\bline-clamp|\btruncate\b|text-ellipsis|max-h-/);
  // the roast text itself: at least 14px everywhere
  const roastClasses = view.match(/whitespace-pre-wrap break-words ([^"]*)"/)?.[1] ?? "";
  const sizes = [...roastClasses.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length >= 2 && sizes.every((n) => n >= 14), `roast text sizes: ${sizes}`);
});

test("motion: the new pieces add no animation and no transition", () => {
  for (const [name, code] of [["roast-view", view], ["journal-roast-ui", ui]] as const) {
    assert.doesNotMatch(code, /\banimate-|\bduration-|@keyframes/, `${name} adds an animation`);
  }
});
