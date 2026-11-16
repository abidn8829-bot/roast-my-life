// Guards the plan claims: these strings stood for things the app never delivered (a hidden "full read",
// extra categories, a "most popular" badge, an Elite tier and its waitlist). None may come back in source.
// Plain Node: run with `node --test src/lib/honest-claims.test.ts`.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const SELF = fileURLToPath(import.meta.url);

const FORBIDDEN = ["Unlock My Full Read", "unlocking soon", "MOST POPULAR", "elite-waitlist"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs|css|md|json|html)$/.test(name) ? [path] : [];
  });
}

test("no source file under src makes a plan claim the app does not deliver", () => {
  const files = sourceFiles(SRC).filter((file) => file !== SELF);
  assert.ok(files.length > 50, "the walk must actually find the source files");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const phrase of FORBIDDEN) {
      assert.equal(text.includes(phrase), false, `${relative(SRC, file)} contains "${phrase}"`);
    }
  }
});
