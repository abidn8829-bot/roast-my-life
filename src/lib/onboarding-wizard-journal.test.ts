// Run with: node --test src/lib/onboarding-wizard-journal.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins the journal look of the onboarding wizard (src/components/onboarding-wizard.tsx) and of the check-in icons
// (src/components/journal-checkin-art.tsx) by reading the source. Nothing here renders a page. The restyle was
// look-only, so besides the look rules this file also pins the visible words and the behaviour markers
// (ph-no-capture, the error box, the upgrade modal beside every screen) so a later edit cannot lose them quietly.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CHECKIN_CHIP_LABELS } from "./safety.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const FILES = ["../components/onboarding-wizard.tsx", "../components/journal-checkin-art.tsx"] as const;
const wizardRaw = read("../components/onboarding-wizard.tsx");
const wizard = stripComments(wizardRaw);

// ---------------------------------------------------------------------------
// the look rules
// ---------------------------------------------------------------------------

test("look rules: no gradients, backdrop blur, glow shadows, emoji, or sage/powder/butter/clay as a text colour", () => {
  for (const file of FILES) {
    const raw = read(file);
    const code = stripComments(raw);
    assert.doesNotMatch(code, /gradient/i, `${file}: gradient`);
    assert.doesNotMatch(code, /\bbg-(linear|radial|conic)-/, `${file}: gradient class`);
    assert.doesNotMatch(code, /(^|[\s"'`:])(from|via|to)-(\[|[a-z]+(-\d{2,3})?(\/\d+)?[\s"'`])/m, `${file}: gradient stop class`);
    assert.doesNotMatch(code, /backdrop-blur|backdrop-filter|\bblur-/, `${file}: blur`);
    assert.doesNotMatch(code, /glow|drop-shadow|shadow-ember|shadow-\[[^\]]*(rgba|#|var)/i, `${file}: glow / coloured shadow`);
    assert.doesNotMatch(raw, /\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️/u, `${file}: emoji`);
    assert.doesNotMatch(code, /\btext-(sage|powder|butter|clay|milestone|progress)\b/, `${file}: a fill colour used as text`);
  }
});

test("no leftover dark-theme pieces in the wizard", () => {
  assert.doesNotMatch(wizard, /DarkScope|data-theme="dark"/, "no dark wrapper (the upgrade modal carries its own journal scope)");
  assert.doesNotMatch(wizard, /\b(text|bg|border)-grade-/, "no grade colours (errors use the errorBox pattern)");
  assert.doesNotMatch(wizard, /\b(border|ring)-ember\b/, "no orange outline / ring from the old look");
  assert.doesNotMatch(wizard, /\bbg-ember-soft\b|\bbg-surface-3\b/, "no old chip / progress fills");
  assert.doesNotMatch(wizard, /\banimate-(bounce|pulse|spin)\b/, "no bouncing, pulsing or spinning pieces");
  assert.doesNotMatch(wizard, /\btext-(9xl|8xl)\b/, "no giant emoji sizes");
  assert.doesNotMatch(wizard, /hover:(brightness|scale)-/, "no old hover effects");
  assert.doesNotMatch(wizard, /\bemoji\b/i, "no emoji fields or constants");
});

test("every screen the wizard shows sits inside <JournalTheme> and marks itself data-journal-screen", () => {
  const inside = (needle: string) => {
    const at = wizard.indexOf(needle);
    assert.notEqual(at, -1, `not found in the wizard: ${needle}`);
    return wizard.lastIndexOf("<JournalTheme", at) > wizard.lastIndexOf("</JournalTheme>", at);
  };
  for (const needle of [
    "Checking your profile...",
    "Daily limit reached",
    "Today&apos;s Check-in",
    "Loading your question...",
    "One more thing...",
    "<PersonaSelector",
    "<LoadingArt",
    "<QuestionProgress",
  ]) {
    assert.ok(inside(needle), `${needle} must be inside <JournalTheme>`);
  }
  const wrappers = wizard.match(/<JournalTheme\b/g)?.length ?? 0;
  const markers = wizard.match(/data-journal-screen/g)?.length ?? 0;
  assert.equal(wrappers, markers, "every journal wrapper carries the data-journal-screen marker (the page swaps its header on it)");
  assert.equal(wrappers, 8, "profile, daily limit, check-in persona, check-in, follow-up, loading, persona, question");
});

// ---------------------------------------------------------------------------
// the error pattern, the upgrade modal, ph-no-capture
// ---------------------------------------------------------------------------

test("errors use the errorBox pattern (role=alert), never coloured text", () => {
  const shown = wizard.match(/\{error \?/g)?.length ?? 0;
  const boxes = wizard.match(/\$\{errorBox\}/g)?.length ?? 0;
  assert.equal(shown, 3, "the loading, question and check-in screens show the error line");
  assert.equal(boxes, shown, "each one is an errorBox");
  assert.equal(wizard.match(/role="alert"/g)?.length ?? 0, shown);
});

test("the upgrade modal is still beside each of the six screens that had it, and is never wrapped", () => {
  assert.equal(wizard.match(/<UpgradeModal\b/g)?.length ?? 0, 6, "daily-limit, check-in persona, check-in, loading, persona, question");
  for (const part of wizard.split("<UpgradeModal").slice(0, -1)) {
    // the element right before each modal is the end of a journal wrapper or of a fragment child, never a dark scope
    assert.match(part.trimEnd(), /<\/JournalTheme>$/, "the modal follows its journal screen");
  }
});

test("every text area still carries ph-no-capture (what people type must stay out of session recordings)", () => {
  const textareas = wizard.match(/<textarea\b/g)?.length ?? 0;
  assert.equal(textareas, 3, "question text answer, custom check-in answer, follow-up answer");
  assert.equal(wizard.match(/ph-no-capture/g)?.length ?? 0, textareas);
  for (const tag of wizard.match(/<textarea[\s\S]*?\/>/g) ?? []) assert.match(tag, /className=\{`ph-no-capture /);
});

// ---------------------------------------------------------------------------
// the words: look-only, so every visible string is pinned (the emoji were the only thing deleted)
// ---------------------------------------------------------------------------

test("visible words are unchanged on the restyled screens", () => {
  for (const words of [
    "Checking your profile...",
    "Daily limit reached",
    "Back to dashboard",
    "Today&apos;s Check-in",
    "Loading your question...",
    '"How did your habits go yesterday?"',
    "Custom answer",
    'placeholder="Your answer..."',
    "Continue →",
    "One more thing...",
    "Get Roasted →",
    "You've used today's check-ins. Come back tomorrow.",
    "Couldn't load today's check-in. Please try again.",
    "Today\\'s check-in isn't ready yet. Please try again.",
    "Couldn't save your check-in. Try again.",
  ]) {
    assert.ok(wizardRaw.includes(words), `missing words: ${words}`);
  }
});

test("the check-in buttons are still rendered from the shared label list, each with its own hand-drawn icon", () => {
  assert.match(wizard, /CHECKIN_CHIP_LABELS\.map\(/);
  assert.match(wizard, /const Icon = CHECKIN_CHIP_ICONS\[i\];/);
  assert.match(wizard, /<PencilIcon \/>/);
  const art = stripComments(read("../components/journal-checkin-art.tsx"));
  const list = art.match(/export const CHECKIN_CHIP_ICONS = \[([^\]]*)\] as const;/);
  assert.ok(list, "CHECKIN_CHIP_ICONS not found");
  assert.equal(list[1].split(",").filter((x) => x.trim()).length, CHECKIN_CHIP_LABELS.length, "one icon per preset label");
  // decoration only: hidden from screen readers, no text of its own
  assert.equal(art.match(/aria-hidden="true"/g)?.length ?? 0, 1, "the shared <Icon> wrapper hides the drawing");
  assert.doesNotMatch(art, /<text\b/);
});
