// Run with: node --test src/lib/skills/wording.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// A static check: no text a user could ever see in the skills code may say "missed" or "failed". Nothing in a
// learning plan is ever "missed", and a test is passed or not yet passed, never "failed".
// It reads every .ts file in this folder except the tests, parses it with the TypeScript compiler already in
// devDependencies, and looks only at string and template text (not comments, not names in the code).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const FORBIDDEN = /missed|failed/i;
const dir = fileURLToPath(new URL(".", import.meta.url));

/** Every piece of string / template text in `source`. */
function stringsIn(source: string, fileName = "x.ts"): string[] {
  const out: string[] = [];
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) out.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) out.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

test("the checker itself: it finds forbidden words in strings and ignores comments and names", () => {
  assert.deepEqual(stringsIn(`const a = "You missed it"; const b = 'ok'; const c = \`x \${1} Failed\`;`), [
    "You missed it",
    "ok",
    "x ",
    " Failed",
  ]);
  assert.deepEqual(stringsIn(`// missed failed\n/* failed */ const missedCount = 1; const failedTotal = 2;`), []);
  assert.ok(stringsIn(`const t = "Test FAILED";`).some((s) => FORBIDDEN.test(s)));
});

test("no string in src/lib/skills (tests excluded) contains the words missed or failed", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  assert.ok(files.length >= 4, "expected types, access, schedule and grade");
  for (const f of files) {
    for (const s of stringsIn(readFileSync(dir + f, "utf8"), f)) {
      assert.equal(FORBIDDEN.test(s), false, `${f}: "${s}"`);
    }
  }
});
