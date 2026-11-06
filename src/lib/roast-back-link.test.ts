// Run with: node --test src/lib/roast-back-link.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// The roast result page (src/app/roast/[id]/page.tsx) has a visible "Back to dashboard" link at the top, so a
// user can leave the page without the browser Back button. What this pins down, by reading the source (the same
// approach as onboarding-history.test.ts):
//   - it is ONE normal next/link <Link href="/dashboard"> with the text "Back to dashboard", and nothing else
//     on the page links anywhere,
//   - it is OWNER-ONLY: it sits in the branch that is only reached after the logged-out redirect and the
//     "not your roast" not-found (fetchOwnRoastById filters on user_id), and before the public /share fallback,
//   - the public pages never link to /dashboard: /dashboard is behind login, so a logged-out visitor of a shared
//     roast who clicked it would be bounced to the login page.
// Comments are stripped before scanning, so a commented-out link does not count as present.
// This checks the source only; the layout (phone width, no overlap) is checked in a browser. Nothing here
// runs the page, touches a database or calls any AI.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Removes block comments and `//` line comments (a `//` right after a colon, as in https://, is left alone). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const page = stripComments(read("../app/roast/[id]/page.tsx"));

test("roast back link: the comment stripper hides a commented-out link and keeps real code", () => {
  const sample = [
    '{/* <Link href="/dashboard">Back to dashboard</Link> */}',
    '// <Link href="/dashboard">Back to dashboard</Link>',
    'const url = "https://example.com";',
    '<Link href="/dashboard">Back to dashboard</Link>',
  ].join("\n");
  const cleaned = stripComments(sample);
  assert.equal(cleaned.match(/<Link /g)?.length, 1);
  assert.match(cleaned, /https:\/\/example\.com/);
});

test("roast back link: the page uses the normal Link from next/link", () => {
  assert.match(page, /import Link from "next\/link";/);
});

test('roast back link: there is exactly one link, <Link href="/dashboard">, reading "Back to dashboard"', () => {
  const links = [...page.matchAll(/<Link\b[\s\S]*?<\/Link>/g)].map((match) => match[0]);
  assert.equal(links.length, 1, "exactly one <Link> on the roast page");
  assert.match(links[0], /^<Link\s+href="\/dashboard"/, 'its target must be exactly "/dashboard"');
  assert.match(links[0], />\s*Back to dashboard\s*<\/Link>$/, 'its visible text must be "Back to dashboard"');
});

test("roast back link: nothing else on the page links anywhere (no plain <a>, no second target)", () => {
  const hrefs = [...page.matchAll(/\bhref=(\{[^}]*\}|"[^"]*")/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, ['"/dashboard"']);
  assert.doesNotMatch(page, /<a\b/, "a plain <a> would reload the whole page instead of a client-side navigation");
});

test("roast back link: the link is owner-only: after the logged-out redirect and the not-your-roast not-found, before the public /share fallback", () => {
  const at = (pattern: RegExp) => {
    const index = page.search(pattern);
    assert.notEqual(index, -1, `not found in the page source: ${pattern}`);
    return index;
  };
  const loggedOutRedirect = at(/redirect\(`\/login\?next=\/roast\/\$\{roastId\}`\)/);
  const ownRoastLookup = at(/fetchOwnRoastById\(supabase, roastId, user\.id\)/);
  const notYoursNotFound = at(/if \(!roast\) \{\s*notFound\(\);\s*\}/);
  const link = at(/<Link\b/);
  const publicFallback = at(/redirect\(`\/share\/\$\{encodeURIComponent\(roastId\)\}`\)/);
  assert.ok(loggedOutRedirect < ownRoastLookup, "the logged-out redirect comes before the lookup");
  assert.ok(ownRoastLookup < notYoursNotFound, "the lookup comes before the not-found");
  assert.ok(notYoursNotFound < link, "the link comes after the not-found guard");
  assert.ok(link < publicFallback, "the link comes before the public /share fallback");
});

test("roast back link: the owner guards are intact: a logged-out viewer is redirected, a roast that is not yours is not found", () => {
  assert.match(page, /if \(!user\) \{\s*redirect\(`\/login\?next=\/roast\/\$\{roastId\}`\);\s*\}/);
  assert.match(page, /fetchOwnRoastById\(supabase, roastId, user\.id\)/);
  assert.match(page, /if \(!roast\) \{\s*notFound\(\);\s*\}/);
  // The lookup itself only returns a roast whose user_id is the viewer's: every lookup by roast id in
  // fetch-own-roast.ts is paired with the owner filter (no query is left unscoped).
  const lookup = stripComments(read("../lib/fetch-own-roast.ts"));
  const byId = lookup.match(/\.eq\("id", roastId\)/g) ?? [];
  const byIdAndOwner = lookup.match(/\.eq\("id", roastId\)\s*\.eq\("user_id", userId\)/g) ?? [];
  assert.ok(byId.length >= 1, "fetchOwnRoastById looks the roast up by id");
  assert.equal(byIdAndOwner.length, byId.length, 'every .eq("id", roastId) is followed by .eq("user_id", userId)');
});

test("roast back link: no public page or shared component links to /dashboard (a logged-out visitor would be bounced to login)", () => {
  for (const file of ["../app/share/[slug]/page.tsx", "../components/share-cta.tsx", "../components/roast-view.tsx"]) {
    assert.doesNotMatch(stripComments(read(file)), /\/dashboard/, `${file} must not link to /dashboard`);
  }
});
