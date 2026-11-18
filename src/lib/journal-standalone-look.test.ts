// Run with: node --test src/lib/journal-standalone-look.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins the journal look of the stand-alone pages (safety pages, push prompt, error pages, the roast "why" line) by
// reading the source. Nothing here renders a page. Two things are protected:
//   1. the look rules (no gradients, blur, glow, emoji, or sage/powder/butter/clay used as TEXT colour)
//   2. the safety pages' WORDS, links, phone numbers and the ph-no-capture / stop-recording behaviour: the restyle
//      was look-only, so every visible string is pinned here again, independent of src/lib/safety.ts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { FINDAHELPLINE_URL, GENTLE_TEXT, LEVEL1_TEXT, LEVEL2_TEXT, UNAVAILABLE_TEXT } from "./safety.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const CHANGED_FILES = [
  "../components/roast-view.tsx",
  "../components/safety-page.tsx",
  "../components/push-permission-prompt.tsx",
  "../app/error.tsx",
  "../app/global-error.tsx",
] as const;

// ---------------------------------------------------------------------------
// the look rules
// ---------------------------------------------------------------------------

test("look rules: no gradients, backdrop blur, glow shadows, emoji, or sage/powder/butter/clay as a text colour", () => {
  for (const file of CHANGED_FILES) {
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

test("roast-view: the plan 'why' line is no longer text-powder; it uses the band's own light text colour (ink on the ink band would vanish)", () => {
  const view = stripComments(read("../components/roast-view.tsx"));
  assert.match(view, /<p className="break-words text-sm text-bg\/85 [^"]*">\{s\.why\}<\/p>/);
  assert.match(view, /<section className="[^"]*rounded-\[18px\] bg-text [^"]*text-bg/, "the band is still the ink-green band with light text");
});

// ---------------------------------------------------------------------------
// the safety pages: words pinned
// ---------------------------------------------------------------------------

test("safety wording (snapshot): the approved text constants are exactly these words", () => {
  assert.equal(FINDAHELPLINE_URL, "https://findahelpline.com");
  assert.deepEqual({ ...LEVEL2_TEXT }, {
    title: "I'm worried about you, and I'm glad you said something.",
    safety: "Your safety matters more than anything on this app.",
    emergency: "If you might act on these thoughts, or you are in danger right now, call emergency services.",
    pakistanEmergency: "In Pakistan: 1122",
    elsewhereEmergency: "Anywhere else: call your local emergency number.",
    localEmergency: "Call your local emergency number.",
    talkHeading: "Talk to someone who can help",
    rozan: "Rozan Counseling Helpline (Pakistan): 0304 111 1741",
    linkLabel: "Find a helpline in your country",
    tellSomeone:
      "If you can, tell someone near you: 'I'm not okay. Please stay with me.' If you can, put some distance between yourself and anything you could use to hurt yourself.",
    aiNote: "I'm an AI, so I can't be there with you. You deserve real people.",
    back: "Back to dashboard",
  });
  assert.deepEqual({ ...LEVEL1_TEXT, smallThings: [...LEVEL1_TEXT.smallThings] }, {
    opener: "That sounds really heavy.",
    aiNote:
      "I'm an AI, not a person or a counselor, so I won't pretend to know everything about what you're going through. But I don't want to roast anything right now.",
    smallThingsHeading: "A few small things that can help",
    smallThings: [
      "Tell one person today, even one line: 'I'm having a hard time.'",
      "Drink some water, eat something, and step outside for five minutes.",
      "Write down what's weighing on you. It doesn't have to make sense.",
    ],
    keepsHeavy: "If it keeps feeling this heavy, talking to someone you trust or a counselor can really help.",
    findSupport: "Find support near you",
    back: "Back to dashboard",
    notNow: "Not now",
  });
  assert.deepEqual({ ...UNAVAILABLE_TEXT }, {
    message: "Ember couldn't check this right now. Nothing was saved. Please try again in a few minutes.",
    link: "Find a helpline",
  });
  assert.deepEqual({ ...GENTLE_TEXT }, { back: "Back to dashboard" });
});

test("safety-page.tsx: the words written in the file itself, its links and its phone numbers are exactly the originals", () => {
  const code = stripComments(read("../components/safety-page.tsx"));
  // every text node typed into the JSX (not a {expression}), in order of appearance
  const typed = [...code.matchAll(/>\s*([^<>{}]*[A-Za-z0-9][^<>{}]*?)\s*(?=<)/g)].map((m) => m[1].trim()).filter((t) => t && !/^[()?:\s]+$/.test(t));
  assert.deepEqual(typed, ["In Pakistan:", "1122", "Rozan Counseling Helpline (Pakistan):", "0304 111 1741", "Try again"]);
  // every text expression that is rendered: only the approved constants / helpers
  const rendered = [...code.matchAll(/\{((?:t|LEVEL1_TEXT|GENTLE_TEXT|UNAVAILABLE_TEXT)\.\w+|pauseLine|gentleNoticeText\([^)]*\)|line|item)\}/g)].map((m) => m[1]);
  assert.deepEqual(rendered, [
    "t.title", "t.safety", "t.emergency", "t.elsewhereEmergency", "t.localEmergency", "t.talkHeading", "t.linkLabel", "t.tellSomeone", "t.aiNote", "t.back",
    "t.opener", "line", "t.aiNote", "pauseLine", "t.smallThingsHeading", "item", "item", "t.keepsHeavy", "t.findSupport", "t.back", "t.notNow",
    "UNAVAILABLE_TEXT.message", "LEVEL1_TEXT.back", "UNAVAILABLE_TEXT.link", "gentleNoticeText(minutesLeft)", "GENTLE_TEXT.back",
  ]);
  // links and phone numbers
  assert.deepEqual([...code.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ["tel:1122", "tel:03041111741", "/dashboard", "/dashboard", "/dashboard", "/dashboard", "/dashboard"]);
  assert.match(code, /href=\{FINDAHELPLINE_URL\} target="_blank" rel="noopener noreferrer"/);
  assert.match(code, /label=\{t\.linkLabel\}/);
  assert.match(code, /label=\{t\.findSupport\}/);
  assert.match(code, /label=\{UNAVAILABLE_TEXT\.link\}/);
});

test("safety-page.tsx: stays private (ph-no-capture, session recording stopped) and keeps its break-notice marker", () => {
  const code = stripComments(read("../components/safety-page.tsx"));
  assert.match(code, /const shell =\s*"ph-no-capture /);
  assert.equal((code.match(/className=\{shell\}/g) ?? []).length, 4, "all four pages sit in the ph-no-capture shell");
  assert.match(code, /posthog\.stopSessionRecording\(\)/);
  assert.equal((code.match(/usePrivateScreen\(\)/g) ?? []).length, 3, "the hook is called by the two support pages and the unavailable page (as before)");
  assert.equal((code.match(/data-break-notice/g) ?? []).length, 1);
  assert.match(code, /<div data-break-notice className=\{shell\}>/);
  // still no persona, roast, grade, streak, share or upsell, and no emoji
  assert.doesNotMatch(code, /persona|roast|share|streak|upgrade|pricing/i);
});

// ---------------------------------------------------------------------------
// the push prompt: look only
// ---------------------------------------------------------------------------

test("push prompt: same words, same push code; the card is scoped (no <JournalTheme>, which would repaint the dark dashboard)", () => {
  const code = stripComments(read("../components/push-permission-prompt.tsx"));
  assert.match(code, /Want Ember to roast you when you forget to check in\?/);
  assert.match(code, />\s*No\s*</);
  assert.match(code, /busy \? "\.\.\." : "Turn on"/);
  assert.match(code, /export function PushPermissionPrompt\(\)/);
  assert.match(code, /fetch\("\/api\/push\/subscribe"/);
  assert.match(code, /ember_push_prompt_dismissed/);
  assert.doesNotMatch(code, /JournalTheme|data-theme/);
});

// ---------------------------------------------------------------------------
// the error pages
// ---------------------------------------------------------------------------

test("error pages: friendly message, a Try again button wired to Next's retry (it re-fetches server data), and the raw error is never shown", () => {
  for (const file of ["../app/error.tsx", "../app/global-error.tsx"]) {
    const code = stripComments(read(file));
    assert.match(code, /^"use client";/, `${file}: error boundaries are client components`);
    assert.match(code, /Something went wrong\. Try again\./, file);
    assert.match(code, /onClick=\{\(\) => retry\(\)\}/, file);
    assert.match(code, />\s*Try again\s*</, file);
    assert.doesNotMatch(code, /\berror\.(message|digest|stack|name|cause)\b/, `${file}: raw error text`);
    assert.doesNotMatch(code, /\{\s*error\s*\}|\{String\(error\)\}|JSON\.stringify\(error/, `${file}: raw error`);
    assert.doesNotMatch(code, /console\./, `${file}: nothing logged`);
  }
  assert.match(stripComments(read("../app/global-error.tsx")), /<html lang="en">[\s\S]*<body /);
  assert.match(stripComments(read("../app/error.tsx")), /<JournalTheme>/);
});
