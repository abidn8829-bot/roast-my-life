// Tests for scripts/pack-to-sql.mjs. Run:  node --test scripts/pack-to-sql.test.mjs
// Uses a tiny made-up week file built below (no real pack content). Writes only to a temp
// folder outside the repo, and touches no database.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readPack, buildSql, REPO_ROOT } from "./pack-to-sql.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "pack-to-sql.mjs");

function day(n, extra = {}) {
  const f = {
    learn_title: `Learn ${n}`,
    source: "S1",
    correct: "B",
    ...extra,
  };
  return [
    `## DAY ${n}`,
    `learn_title: ${f.learn_title}`,
    "learn_body: |",
    "  First line of the lesson.",
    "",
    "  Second paragraph with a quote: it's fine.",
    `fact: Fact ${n}`,
    `source: ${f.source}`,
    `do_prompt: Do thing ${n}`,
    `prove_question: Question ${n}?`,
    "options:",
    "- A Alpha",
    "- B Beta",
    "- C Gamma",
    `correct: ${f.correct}`,
    `explanation: Because ${n}`,
    `hint: Hint ${n}`,
    "",
  ].join("\n");
}

function fixture({ days = [1, 2, 3, 4, 5], dayExtra = {}, sourceExtra = "verified_on: 2026-01-02", test = null, month = true, header = {} } = {}) {
  const h = { pack: "tiny-pack", month: "1", week: "1", ...header };
  return [
    `# PACK: ${h.pack}`,
    `# MONTH: ${h.month}`,
    `# WEEK: ${h.week}`,
    "title: Tiny week",
    "goal: Learn the tiny thing",
    "",
    "## SOURCES",
    "- ref: S1",
    "  title: A made-up source",
    "  author_or_publisher: Nobody",
    "  year: 2020",
    "  url: https://example.com/one",
    `  ${sourceExtra}`,
    "  verified_how: opened the page",
    "- ref: S2",
    "  title: Another made-up source",
    "  url: https://example.com/two",
    "  verified_on: 2026-01-03",
    "  verified_how: read it",
    "",
    "## HANDOUT",
    "Handout text, with a backslash \\ and a 'quote'.",
    "",
    "Second handout paragraph.",
    "",
    ...days.map((n) => day(n, dayExtra[n] ?? {})),
    "## TEST",
    test ??
      [
        "- covers_day: 1",
        "  question: Test question one?",
        "  options:",
        "  - A Yes",
        "  - B No",
        "  correct: A",
        "  explanation: Because one",
        "- covers_day: 5",
        "  question: Test question two?",
        "  options:",
        "  - A One",
        "  - B Two",
        "  - C Three",
        "  correct: C",
        "  explanation: Because two",
      ].join("\n"),
    "",
    month ? ["## MONTH", "month_title: Tiny month", "teaser_line: A tiny teaser"].join("\n") : "",
    "",
  ].join("\n");
}

function errorsOf(text) {
  const { pack, errors } = readPack(text);
  assert.equal(pack, null, "expected the file to be rejected");
  assert.ok(errors.length > 0);
  return errors.join("\n");
}

test("a valid file gives SQL with on conflict and no delete", () => {
  const { pack, errors } = readPack(fixture());
  assert.deepEqual(errors, []);
  const sql = buildSql(pack);
  assert.match(sql, /on conflict/i);
  assert.match(sql, /do update set/i);
  assert.doesNotMatch(sql, /delete/i);
  assert.doesNotMatch(sql, /\b(drop|truncate)\b/i);
  assert.match(sql, /^begin;$/m);
  assert.match(sql, /^commit;$/m);
  // the read-back query is the last statement and counts steps, test items and sources
  const tail = sql.slice(sql.lastIndexOf("-- read-back"));
  assert.match(tail, /as steps/);
  assert.match(tail, /as test_items/);
  assert.match(tail, /as sources/);
  assert.match(tail, /expect steps = 5, test_items = 2, sources = 2/);
});

test("options are stored without letters and the correct letter becomes a 0-based number", () => {
  const { pack } = readPack(fixture());
  assert.deepEqual(pack.days[0].options, ["Alpha", "Beta", "Gamma"]);
  assert.equal(pack.days[0].correct, 1); // B
  assert.equal(pack.tests[0].correct, 0); // A
  assert.equal(pack.tests[1].correct, 2); // C
  const sql = buildSql(pack);
  assert.ok(sql.includes(`'["Alpha","Beta","Gamma"]'::jsonb, 1::smallint`));
});

test("test item position follows file order; covers_day is kept", () => {
  const { pack } = readPack(fixture());
  assert.deepEqual(pack.tests.map((t) => [t.position, t.coversDay]), [[1, 1], [2, 5]]);
});

test("every string is escaped: quotes doubled, multi-line block kept", () => {
  const { pack } = readPack(fixture());
  const sql = buildSql(pack);
  assert.ok(sql.includes("it''s fine"));
  assert.ok(sql.includes("a backslash \\ and a ''quote''"));
  assert.match(pack.days[0].learnBody, /^First line of the lesson\.\n\nSecond paragraph/);
  // an injection attempt stays inside one string literal
  const evil = fixture().replace("goal: Learn the tiny thing", "goal: x'); drop table skill_packs; --");
  const out = buildSql(readPack(evil).pack);
  assert.ok(out.includes("x''); drop table skill_packs; --"));
});

test("month 1 is free and others are not; MONTH section is optional", () => {
  const withMonth = buildSql(readPack(fixture()).pack);
  assert.match(withMonth, /'Tiny month', 'A tiny teaser', true\)/);
  const noMonth = buildSql(readPack(fixture({ month: false })).pack);
  assert.match(noMonth, /on conflict \(pack_id, month_no\) do nothing/);
  assert.doesNotMatch(noMonth, /Tiny month/);
  const m2 = readPack(fixture({ month: false, header: { month: "2", week: "5" } })).pack;
  assert.match(buildSql(m2), /values \('tiny-pack', 2::smallint, false\)/);
});

test("rejects a correct letter that is not an option", () => {
  const msg = errorsOf(fixture({ dayExtra: { 3: { correct: "D" } } }));
  assert.match(msg, /DAY 3/);
  assert.match(msg, /correct is "D"/);
  assert.match(errorsOf(fixture({ dayExtra: { 2: { correct: "Z" } } })), /DAY 2/);
});

test("rejects a test item whose correct letter is not an option", () => {
  const t = ["- covers_day: 1", "  question: q?", "  options:", "  - A x", "  - B y", "  correct: C", "  explanation: e"].join("\n");
  assert.match(errorsOf(fixture({ test: t })), /test item 1.*correct is "C"/);
});

test("rejects a week that does not have exactly 5 days", () => {
  assert.match(errorsOf(fixture({ days: [1, 2, 4, 5] })), /exactly 5 days/);
  assert.match(errorsOf(fixture({ days: [1, 2, 3, 4, 5, 5] })), /exactly 5 days/);
  assert.match(errorsOf(fixture({ days: [1, 2, 3, 4, 6] })), /exactly 5 days/);
});

test("rejects a source without verified_on", () => {
  const msg = errorsOf(fixture({ sourceExtra: "" }));
  assert.match(msg, /missing "verified_on:"/);
});

test("rejects a verified_on that is not a real date", () => {
  assert.match(errorsOf(fixture({ sourceExtra: "verified_on: 2026-02-30" })), /not a real date/);
  assert.match(errorsOf(fixture({ sourceExtra: "verified_on: yesterday" })), /not a real date/);
});

test("rejects a test item whose covers_day does not exist", () => {
  const t = ["- covers_day: 7", "  question: q?", "  options:", "  - A x", "  - B y", "  correct: A", "  explanation: e"].join("\n");
  assert.match(errorsOf(fixture({ test: t })), /covers_day "7" is not a day in this file/);
  const missingDay = fixture({ days: [1, 2, 3, 4] });
  assert.match(errorsOf(missingDay), /covers_day "5" is not a day in this file/);
});

test("rejects a day whose source is not listed", () => {
  assert.match(errorsOf(fixture({ dayExtra: { 4: { source: "S9" } } })), /DAY 4: source "S9" is not in ## SOURCES/);
});

test("rejects a week number in the wrong month, and unknown keys", () => {
  assert.match(errorsOf(fixture({ header: { month: "1", week: "5" } })), /week 5 belongs to month 2/);
  assert.match(errorsOf(fixture().replace("hint: Hint 2", "hnit: Hint 2")), /unknown key "hnit"/);
});

test("rejects more than 8 test items", () => {
  const item = (i) => ["- covers_day: 1", `  question: q${i}?`, "  options:", "  - A x", "  - B y", "  correct: A", "  explanation: e"].join("\n");
  const t = Array.from({ length: 9 }, (_, i) => item(i + 1)).join("\n");
  assert.match(errorsOf(fixture({ test: t })), /most allowed is 8/);
});

test("accepts Windows line endings", () => {
  const { errors } = readPack(fixture().replace(/\n/g, "\r\n"));
  assert.deepEqual(errors, []);
});

// ---- command line: output path guard, and nothing is written for an invalid file

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pack-to-sql-test-"));
}

function runCli(input, output) {
  return spawnSync(process.execPath, [SCRIPT, input, output], { encoding: "utf8" });
}

test("CLI: a valid file writes SQL to a folder outside the repo", () => {
  const dir = tmpDir();
  const input = path.join(dir, "week01.md");
  const output = path.join(dir, "week01.sql");
  fs.writeFileSync(input, fixture());
  const r = runCli(input, output);
  assert.equal(r.status, 0, r.stderr);
  const sql = fs.readFileSync(output, "utf8");
  assert.match(sql, /on conflict/);
  assert.doesNotMatch(sql, /delete/i);
});

test("CLI: refuses to write inside the repo folder (plain, '..', and via a symlink)", () => {
  const dir = tmpDir();
  const input = path.join(dir, "week01.md");
  fs.writeFileSync(input, fixture());

  const direct = path.join(REPO_ROOT, "zz-should-not-exist.sql");
  const viaDots = path.join(REPO_ROOT, "scripts", "..", "zz-should-not-exist-2.sql");
  const attempts = [direct, viaDots];

  const link = path.join(dir, "link-to-repo");
  try {
    fs.symlinkSync(REPO_ROOT, link, "dir");
    attempts.push(path.join(link, "zz-should-not-exist-3.sql"));
    // a ".." after a symlink goes to the link target's parent, not the link's parent
    attempts.push(path.join(link, "scripts", "..", "zz-should-not-exist-4.sql"));
  } catch {
    // symlinks are not allowed on this machine (for example Windows without developer mode); skip those two
  }

  for (const out of attempts) {
    const r = runCli(input, out);
    assert.notEqual(r.status, 0, `should have refused ${out}`);
    assert.match(r.stderr, /Refusing to write inside the repo folder/);
    assert.equal(fs.existsSync(out), false, `${out} must not exist`);
  }
  // nothing leaked into the repo through any path
  for (const name of fs.readdirSync(REPO_ROOT)) assert.ok(!name.startsWith("zz-should-not-exist"), name);
});

test("CLI: an invalid file writes nothing and lists the problems", () => {
  const dir = tmpDir();
  const input = path.join(dir, "bad.md");
  const output = path.join(dir, "bad.sql");
  fs.writeFileSync(input, fixture({ days: [1, 2, 3, 4], dayExtra: { 1: { correct: "Q" } } }));
  const r = runCli(input, output);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NOT WRITTEN/);
  assert.match(r.stderr, /exactly 5 days/);
  assert.match(r.stderr, /DAY 1/);
  assert.equal(fs.existsSync(output), false);
});

test("CLI: refuses an output that is not .sql, so the .md file cannot be overwritten", () => {
  const dir = tmpDir();
  const input = path.join(dir, "week01.md");
  fs.writeFileSync(input, fixture());
  const r = runCli(input, input);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /must end in \.sql/);
  assert.equal(fs.readFileSync(input, "utf8"), fixture());
});

test("CLI: usage message without arguments", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage: node scripts\/pack-to-sql\.mjs/);
});
