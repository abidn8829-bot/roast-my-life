// Run with: node --test src/lib/onboarding-history.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Browser Back after onboarding. The wizard (src/components/onboarding-wizard.tsx) is the page for BOTH the
// first roast and the daily check-in. When it finished with router.push, the /onboarding entry stayed in the
// browser history, so Back from the roast page landed on the wizard again. It must REPLACE that entry instead,
// so Back lands on whatever came before (the dashboard).
//
// What this pins down, by reading the wizard's source (the same approach as persona-tone.test.ts):
//   - nothing in the wizard pushes a history entry any more,
//   - the first roast and the daily check-in both replace /onboarding with /roast/<id>?share=1,
//   - router.refresh() still runs right after each of those two (it makes the dashboard reload fresh on Back),
//   - the "Daily limit reached" button replaces with /dashboard,
//   - the wizard's whole list of router calls is exactly the five above, in that order.
// Comments are stripped before scanning, so a commented-out call neither counts as present nor as a push.
// Nothing here runs the wizard, touches a database or calls any AI.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const WIZARD_PATH = fileURLToPath(new URL("../components/onboarding-wizard.tsx", import.meta.url));

/** Removes block comments and `//` line comments (a `//` right after a colon, as in https://, is left alone). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const wizard = stripComments(readFileSync(WIZARD_PATH, "utf8"));

/** Every `router.<method>(` in the wizard, in source order. */
const routerCalls = [...wizard.matchAll(/\brouter\s*\.\s*(\w+)\s*\(/g)].map((match) => match[1]);

test("onboarding history: the comment stripper hides commented-out calls and keeps real ones", () => {
  const sample = [
    "// router.push('/a');",
    "/* router.push('/b'); */",
    "{/* router.push('/c') */}",
    "router.replace('/d'); // router.push('/e')",
    "const url = 'https://example.com';",
    "router.refresh();",
  ].join("\n");
  const cleaned = stripComments(sample);
  assert.doesNotMatch(cleaned, /router\.push/);
  assert.match(cleaned, /router\.replace\('\/d'\);/);
  assert.match(cleaned, /https:\/\/example\.com/);
  assert.match(cleaned, /router\.refresh\(\);/);
});

test("onboarding history: the wizard still takes its router from useRouter()", () => {
  assert.match(wizard, /import \{ useRouter \} from "next\/navigation";/);
  assert.match(wizard, /const router = useRouter\(\);/);
});

test("onboarding history: nothing in the wizard pushes a history entry", () => {
  assert.doesNotMatch(wizard, /\brouter\s*\.\s*push\b/, "router.push would leave /onboarding in the history again");
  assert.doesNotMatch(wizard, /\bpushState\b/, "history.pushState would leave /onboarding in the history again");
});

test("onboarding history: the first roast REPLACES /onboarding with /roast/<id>?share=1, then refreshes", () => {
  assert.match(
    wizard,
    /router\.replace\(\s*`\/roast\/\$\{encodeURIComponent\(roastId\)\}\?share=1`\s*\)\s*;\s*router\.refresh\(\s*\)\s*;/,
  );
});

test("onboarding history: the daily check-in REPLACES /onboarding with /roast/<id>?share=1, then refreshes", () => {
  assert.match(
    wizard,
    /router\.replace\(\s*`\/roast\/\$\{encodeURIComponent\(data\.id\)\}\?share=1`\s*\)\s*;\s*router\.refresh\(\s*\)\s*;/,
  );
});

test('onboarding history: the "Daily limit reached" button REPLACES with /dashboard', () => {
  assert.match(wizard, /onClick=\{\(\)\s*=>\s*router\.replace\(\s*["']\/dashboard["']\s*\)\s*\}/);
});

test("onboarding history: the wizard's whole list of router calls is replace, refresh, replace, refresh, replace", () => {
  assert.deepEqual(routerCalls, ["replace", "refresh", "replace", "refresh", "replace"]);
});

test("onboarding history: router.refresh() runs exactly twice (after the first roast and after the check-in)", () => {
  assert.equal(routerCalls.filter((method) => method === "refresh").length, 2);
});
