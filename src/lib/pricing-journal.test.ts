// Run with: node --test src/lib/pricing-journal.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins the journal look of the pricing page and the upgrade modal by reading the source (same approach as
// roast-desktop-layout.test.ts). Nothing here renders a page, touches a database or calls any AI.
// What it protects:
//   - no gradient, glow, shadow, blur, orange, emoji or text check mark; sage / powder / butter / clay / progress are
//     never text colours (they are fills and strokes only);
//   - no plan number is typed in either file (7, 30, 12, 100, the voice count) or spelled out: every Free/Pro line
//     is read from lib/plans.ts;
//   - the modal and the page keep their behaviour (getUpgradeUrl, window.open, onClose) and the honest wording
//     (voices, and none of the removed claims).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const FILES = {
  "components/pricing-page.tsx": stripComments(read("../components/pricing-page.tsx")),
  "components/upgrade-modal.tsx": stripComments(read("../components/upgrade-modal.tsx")),
  "components/journal-plan-ui.tsx": stripComments(read("../components/journal-plan-ui.tsx")),
  "app/pricing/page.tsx": stripComments(read("../app/pricing/page.tsx")),
};
const pricing = FILES["components/pricing-page.tsx"];
const modal = FILES["components/upgrade-modal.tsx"];
const page = FILES["app/pricing/page.tsx"];
const css = read("../app/globals.css");

// ---------------------------------------------------------------------------
// the look
// ---------------------------------------------------------------------------

test("look: no gradient, glow, shadow, blur, orange or legacy ember colour in the pricing page, modal or their parts", () => {
  for (const [name, text] of Object.entries(FILES)) {
    assert.doesNotMatch(text, /gradient/i, `${name}: no gradient`);
    assert.doesNotMatch(text, /glow/i, `${name}: no glow`);
    assert.doesNotMatch(text, /\bshadow\b|\bshadow-|box-shadow|drop-shadow/, `${name}: no shadow (orange or any other)`);
    assert.doesNotMatch(text, /blur|backdrop-|glass/i, `${name}: no glass or blur`);
    assert.doesNotMatch(text, /rgba\(\s*255\s*,\s*61|#ff3d00|#ff5a36|orange/i, `${name}: no orange`);
    assert.doesNotMatch(text, /ember-legacy|DarkScope/, `${name}: no legacy orange token, no DarkScope`);
  }
});

test("look: no emoji and no text check mark anywhere in the four files", () => {
  for (const [name, text] of Object.entries(FILES)) {
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `${name}: no emoji (flame, check box, ...)`);
    assert.doesNotMatch(text, /[✓✔✅☑️]/u, `${name}: no check mark character`);
  }
});

test("look: sage, powder, butter, clay and the other palette fills are never a text colour", () => {
  for (const [name, text] of Object.entries(FILES)) {
    assert.doesNotMatch(
      text,
      /(?:^|[\s"'`:])(?:[a-z-]+:)*text-(?:sage|powder|butter|clay|progress|milestone|bar)\b/,
      `${name}: palette fills are fill or stroke only`,
    );
    assert.doesNotMatch(text, /text-\[var\(--(?:sage|powder|butter|clay|progress|milestone|bar)\)\]/, `${name}: no text-[var(--palette)]`);
  }
});

test("look: the ticks and the flame are inline SVG, and the Pro card is told apart by a fill and a heavier border", () => {
  const parts = FILES["components/journal-plan-ui.tsx"];
  assert.match(parts, /export function PlanTick\(\)[\s\S]*?<svg[\s\S]*?<path/);
  assert.match(parts, /export function EmberFlame\([\s\S]*?<svg[\s\S]*?<path/);
  assert.equal((pricing.match(/<PlanTick \/>/g) ?? []).length, 2, "one tick per Free line and one per Pro line");
  assert.match(pricing, /border-2 border-text bg-sage/, "Pro: 2px ink border on a sage fill");
  assert.match(pricing, /border border-border-strong-legacy bg-surface/, "Free: hairline border on the plain surface");
  assert.match(modal, /<EmberFlame \/>/, "the modal draws the flame itself");
});

test("look: the page sits inside <JournalTheme>; the modal carries its own journal scope that does not reach <html>", () => {
  assert.match(page, /<JournalTheme>\s*<PricingPage \/>\s*<\/JournalTheme>/);
  assert.match(modal, /<JournalScope className="fixed inset-0 z-50 /);
  // The scope gets the journal tokens, but only [data-theme="journal"] is lifted onto <html> by :has().
  assert.match(css, /html:has\(\[data-theme="journal"\]\),\s*\[data-theme="journal"\],\s*\[data-theme="journal-scope"\] \{/);
  assert.doesNotMatch(css, /html:has\(\[data-theme="journal-scope"\]\)/);
});

// ---------------------------------------------------------------------------
// the numbers and the wording
// ---------------------------------------------------------------------------

// What is left once class names, SVG drawings, imports, ids and URLs are removed: the words and strings a reader sees.
function visibleText(source: string): string {
  return source
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/^import .*$/gm, " ")
    .replace(/className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, " ")
    .replace(/const buttonBase = `[^`]*`;/g, " ")
    .replace(/\b(?:id|aria-labelledby|href|rel|target|role|aria-modal|type|data-theme)=(?:"[^"]*"|\{[^}]*\})/g, " ");
}

test("numbers: no plan number is typed in the pricing page, the modal or the pricing metadata", () => {
  for (const [name, text] of [
    ["components/pricing-page.tsx", pricing],
    ["components/upgrade-modal.tsx", modal],
    ["app/pricing/page.tsx", page],
  ] as const) {
    const visible = visibleText(text);
    assert.doesNotMatch(visible, /\b(?:7|30|12|100|6)\b/, `${name}: no typed trend days, history limit or voice count`);
    assert.doesNotMatch(visible, /\b(?:seven|thirty|twelve|hundred|six)\b/i, `${name}: no spelled-out plan number`);
  }
  // The one price on the page that is not a constant is the Free price, which is not a plan limit.
  assert.match(pricing, /\{PRO_PRICE\}/);
  assert.doesNotMatch(pricing, /\$6\.99|6\.99/);
});

test("numbers: every Free and Pro line is read from plans.ts, in the page and in the modal", () => {
  assert.match(pricing, /FREE_FEATURES\.map\(\(f\) =>/);
  assert.match(pricing, /PRO_FEATURES\.map\(\(f\) =>/);
  assert.match(pricing, /import \{ FREE_FEATURES, PRO_FEATURES, PRO_PRICE \} from "@\/lib\/plans";/);
  assert.match(modal, /PRO_FEATURES\.map\(\(f\) =>/);
  assert.match(modal, /import \{ PRO_FEATURES, UPGRADE_LIMIT_TEXT \} from "@\/lib\/plans";/);
  assert.match(modal, /UPGRADE_LIMIT_TEXT/);
  assert.doesNotMatch(modal, /daily-limit|PRO_DAILY_LIMIT|FREE_DAILY_LIMIT/, "the daily limit comes through UPGRADE_LIMIT_TEXT only");
  assert.match(page, /import \{ PRO_PRICE, VOICE_COUNT \} from "@\/lib\/plans";/);
});

// Built from pieces so this file does not itself contain the phrases honest-claims.test.ts forbids in all of src.
const REMOVED_CLAIMS = new RegExp(["\\belite\\b", "wait" + "list", "unlocking" + " soon", "most" + " popular"].join("|"), "i");

test("wording: voices, not personas; none of the removed tier or coming-soon claims", () => {
  for (const [name, text] of Object.entries(FILES)) {
    assert.doesNotMatch(text, /persona/i, `${name}: the word is "voices"`);
    assert.doesNotMatch(text, REMOVED_CLAIMS, `${name}: no removed claim`);
  }
});

// ---------------------------------------------------------------------------
// behaviour that must not change
// ---------------------------------------------------------------------------

test("behaviour: the upgrade link still comes from getUpgradeUrl and the modal still opens it, closes and can be dismissed", () => {
  assert.match(pricing, /href=\{getUpgradeUrl\(userEmail\)\}/);
  assert.match(pricing, /target="_blank"\s+rel="noopener noreferrer"/);
  assert.match(modal, /window\.open\(getUpgradeUrl\(userEmail\), "_blank"\);\s*setLoading\(false\);\s*onClose\(\);/);
  assert.match(modal, /if \(!isOpen\) return null;/);
  assert.match(modal, /onClick=\{onClose\}/);
  assert.match(modal, /onClick=\{handleUpgrade\}/);
  assert.match(modal, /reason = "daily_limit"/);
  assert.match(modal, /Maybe Later/);
  assert.match(modal, /UPGRADE_EMAIL_HINT/);
  assert.match(pricing, /UPGRADE_EMAIL_HINT/);
});
