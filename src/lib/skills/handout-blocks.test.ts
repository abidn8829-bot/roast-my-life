// Run with: node --test src/lib/skills/handout-blocks.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { inlineParts, parseHandout, type HandoutBlock } from "./handout-blocks.ts";

const partsOf = (b: HandoutBlock | undefined) => {
  assert.ok(b && b.kind !== "list");
  return b.parts;
};
const itemsOf = (b: HandoutBlock | undefined) => {
  assert.ok(b && b.kind === "list");
  return b.items;
};
const flat = (parts: Array<{ text: string; bold: boolean }>) => parts.map((p) => (p.bold ? `*${p.text}*` : p.text)).join("");

test("inlineParts: **bold** becomes a bold piece; an unmatched ** stays plain", () => {
  assert.deepEqual(inlineParts("a **b** c"), [{ text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false }]);
  assert.deepEqual(inlineParts("a ** b"), [{ text: "a ** b", bold: false }]);
  assert.deepEqual(inlineParts(""), [{ text: "", bold: false }]);
});

test("parseHandout: paragraphs, headings, bullet and numbered lists", () => {
  const blocks = parseHandout("# Title\nFirst line\nsecond line\n\n- one\n- **two**\n* three\n\n1. a\n2) b\n\nEnd");
  assert.deepEqual(blocks.map((b) => b.kind), ["heading", "paragraph", "list", "list", "paragraph"]);
  assert.equal(flat(partsOf(blocks[0])), "Title");
  assert.equal(flat(partsOf(blocks[1])), "First line second line");
  assert.deepEqual(itemsOf(blocks[2]).map(flat), ["one", "*two*", "three"]);
  assert.deepEqual(itemsOf(blocks[3]).map(flat), ["a", "b"]);
});

test("parseHandout: empty text, windows line endings, and markup is kept as plain text, never turned into HTML", () => {
  assert.deepEqual(parseHandout(""), []);
  assert.deepEqual(parseHandout("   \n\n"), []);
  assert.deepEqual(parseHandout(undefined as never), []);
  const crlf = parseHandout("one\r\ntwo\r\n\r\nthree");
  assert.equal(crlf.length, 2);
  const html = parseHandout("<script>alert(1)</script> [x](javascript:alert(1))");
  assert.equal(html.length, 1);
  assert.equal(flat(partsOf(html[0])), "<script>alert(1)</script> [x](javascript:alert(1))");
  // a heading line is one block, and a bullet right after a paragraph ends the paragraph
  const mixed = parseHandout("para\n- item\n## Head");
  assert.deepEqual(mixed.map((b) => b.kind), ["paragraph", "list", "heading"]);
});
