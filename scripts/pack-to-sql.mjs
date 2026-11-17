// Converts ONE week file (Markdown, kept OUTSIDE the repo) into a SQL file you paste into the
// Supabase SQL editor by hand. It contains no pack content itself: it only reads the file you give it.
//
//   node scripts/pack-to-sql.mjs <week-file.md> <output.sql>
//
// What it does NOT do: touch any database (it only writes a text file), delete anything (the SQL
// only ever uses insert ... on conflict ... do update / do nothing), or write inside the repo
// folder (it refuses, symlinks and ".." included). Nothing is written unless the whole file is valid:
// every problem found is listed, and no output file is created.
//
// ---------------------------------------------------------------------------------------------
// FILE FORMAT (section 3 of the plan). One file per week.
//
//   # PACK: critical-thinking         pack id (lowercase letters, digits, hyphens)
//   # MONTH: 1                        1..6
//   # WEEK: 1                         1..24, and the month must be ceil(week / 4)
//   title: ...
//   goal: ...
//
//   ## SOURCES
//   - ref: S1
//     title: ...
//     author_or_publisher: ...        optional
//     year: 2020                      optional, 4 digits
//     url: https://...
//     verified_on: 2026-11-17         required, a real date YYYY-MM-DD
//     verified_how: ...
//   - ref: S2
//     ...
//
//   ## HANDOUT
//   Free text, up to the next known "## " heading (SOURCES, HANDOUT, DAY n, TEST, MONTH).
//
//   ## DAY 1                          exactly five of these: DAY 1 .. DAY 5, each with ALL of:
//   learn_title: ...
//   learn_body: |                     "|" then the lines, each indented by at least one space
//     first line
//     second line
//   fact: ...
//   source: S1                        must be a ref from ## SOURCES
//   do_prompt: ...
//   prove_question: ...
//   options:                          2 to 5 lines, letters A, B, C ... in order
//   - A first option
//   - B second option
//   correct: B                        must be one of the letters above
//   explanation: ...
//   hint: ...
//
//   ## TEST                           1 to 8 items; position = their order in the file
//   - covers_day: 1                   must be one of the DAY numbers in this file
//     question: ...
//     options:
//     - A first option
//     - B second option
//     correct: A
//     explanation: ...
//
//   ## MONTH                          optional; once per month file. Without it, the month row is
//   month_title: ...                  created with no titles (or left as it is if it already exists).
//   teaser_line: ...
//
// Other rules: a value is the rest of its line, taken literally (no quote handling). A key may
// appear once. Unknown keys and unknown lines are errors, so a typo cannot silently drop text.
// A source's url must start with http:// or https://.
// ---------------------------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const SECTION_RE = /^##[ \t]+(SOURCES|HANDOUT|TEST|MONTH|DAY[ \t]+\d+)[ \t]*$/i;
const SOURCE_KEYS = ["ref", "title", "author_or_publisher", "year", "url", "verified_on", "verified_how"];
const DAY_KEYS = [
  "learn_title", "learn_body", "fact", "source", "do_prompt",
  "prove_question", "options", "correct", "explanation", "hint",
];
const TEST_KEYS = ["covers_day", "question", "options", "correct", "explanation"];
const MONTH_KEYS = ["month_title", "teaser_line"];
const HEADER_KEYS = ["title", "goal"];

const trunc = (s) => (s.length > 60 ? `${s.slice(0, 57)}...` : s);

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

// Reads "key: value" lines (and one "options:" list, and "key: |" blocks when allowed).
// lines: [{ n, text }]. Returns { values, options, optionsLine }. Problems go to err(line, message).
function parseKeyValues(lines, allowed, { allowBlock }, err) {
  const values = {};
  const options = [];
  let optionsLine = 0;
  let i = 0;
  while (i < lines.length) {
    const { n, text } = lines[i];
    i += 1;
    if (text.trim() === "") continue;
    const m = /^\s*([a-z_]+)[ \t]*:[ \t]*(.*)$/.exec(text);
    if (!m) {
      err(n, `cannot read this line: "${trunc(text.trim())}"`);
      continue;
    }
    const key = m[1];
    const val = m[2].trim();
    if (!allowed.includes(key)) {
      err(n, `unknown key "${key}" (allowed here: ${allowed.join(", ")})`);
      continue;
    }
    if (key === "options") {
      if (optionsLine) err(n, 'duplicate key "options"');
      else optionsLine = n;
      if (val !== "") err(n, 'put nothing after "options:"; list the options on the next lines as "- A text"');
      while (i < lines.length) {
        const t = lines[i].text;
        if (t.trim() === "") { i += 1; continue; }
        const om = /^\s*-\s+([A-Za-z])[ \t]+(\S.*)$/.exec(t);
        if (!om) break;
        options.push({ letter: om[1].toUpperCase(), text: om[2].trim(), line: lines[i].n });
        i += 1;
      }
      continue;
    }
    if (key in values) err(n, `duplicate key "${key}"`);
    if (val === "|") {
      if (!allowBlock) {
        err(n, `"${key}" must be written on one line here`);
        continue;
      }
      const buf = [];
      while (i < lines.length && (lines[i].text.trim() === "" || /^[ \t]/.test(lines[i].text))) {
        buf.push(lines[i].text);
        i += 1;
      }
      while (buf.length && buf[buf.length - 1].trim() === "") buf.pop();
      while (buf.length && buf[0].trim() === "") buf.shift();
      if (!buf.length) {
        err(n, `"${key}: |" needs the text on the following lines, each indented by at least one space`);
        continue;
      }
      const indent = Math.min(...buf.filter((l) => l.trim() !== "").map((l) => /^[ \t]*/.exec(l)[0].length));
      values[key] = buf.map((l) => l.slice(Math.min(indent, /^[ \t]*/.exec(l)[0].length)).replace(/[ \t]+$/, "")).join("\n");
      continue;
    }
    if (val === "") {
      err(n, `"${key}" is empty`);
      continue;
    }
    values[key] = val;
    values[`__line_${key}`] = n;
  }
  return { values, options, optionsLine };
}

// Splits a list section into items. A new item starts at a line "- key: value" for a known key.
function splitItems(lines, allowed, err) {
  const items = [];
  let cur = null;
  for (const { n, text } of lines) {
    if (text.trim() === "") {
      if (cur) cur.lines.push({ n, text });
      continue;
    }
    const m = /^-[ \t]+([a-z_]+)[ \t]*:(.*)$/.exec(text);
    if (m && allowed.includes(m[1])) {
      cur = { line: n, lines: [{ n, text: `${m[1]}:${m[2]}` }] };
      items.push(cur);
      continue;
    }
    if (!cur) {
      err(n, `expected a list item that starts with "- ${allowed[0]}: ...", got: "${trunc(text.trim())}"`);
      continue;
    }
    cur.lines.push({ n, text });
  }
  return items;
}

function checkMultipleChoice(where, parsed, err) {
  const { values, options, optionsLine } = parsed;
  if (!optionsLine) {
    err(0, `${where}: missing "options:"`);
    return null;
  }
  if (options.length < 2 || options.length > 5) {
    err(optionsLine, `${where}: needs 2 to 5 options, found ${options.length}`);
    return null;
  }
  const expected = options.map((_, i) => String.fromCharCode(65 + i));
  const bad = options.findIndex((o, i) => o.letter !== expected[i]);
  if (bad !== -1) {
    err(options[bad].line, `${where}: options must be lettered ${expected.join(", ")} in order; found "${options[bad].letter}" where "${expected[bad]}" belongs`);
    return null;
  }
  const letter = (values.correct ?? "").trim().toUpperCase();
  if (!letter) {
    err(0, `${where}: missing "correct:"`);
    return null;
  }
  const idx = expected.indexOf(letter);
  if (idx === -1) {
    err(values.__line_correct ?? 0, `${where}: correct is "${trunc(values.correct)}" but the options are ${expected.join(", ")}`);
    return null;
  }
  return { options: options.map((o) => o.text), correct: idx };
}

function isRealDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function walkStrings(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) value.forEach((v) => walkStrings(v, visit));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => walkStrings(v, visit));
}

// Parses and validates a week file. Returns { pack, errors }. pack is null when errors is not empty.
export function readPack(rawText) {
  const errors = [];
  const err = (line, message) => errors.push(line ? `line ${line}: ${message}` : message);
  const lines = rawText.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");

  // ---- split into header lines and sections
  const headerLines = [];
  const sections = [];
  let cur = null;
  lines.forEach((text, idx) => {
    const n = idx + 1;
    const m = SECTION_RE.exec(text);
    if (m) {
      const name = m[1].toUpperCase().replace(/[ \t]+/g, " ");
      const isDay = name.startsWith("DAY");
      cur = { kind: isDay ? "DAY" : name, dayNo: isDay ? Number(name.split(" ")[1]) : null, line: n, lines: [] };
      sections.push(cur);
      return;
    }
    if (/^##(\s|$)/.test(text) && !(cur && cur.kind === "HANDOUT")) {
      err(n, `unknown section heading "${trunc(text.trim())}" (known: SOURCES, HANDOUT, DAY 1..5, TEST, MONTH)`);
      return;
    }
    if (cur) cur.lines.push({ n, text });
    else headerLines.push({ n, text });
  });

  // ---- header
  const head = { pack: null, month: null, week: null };
  const headRest = [];
  for (const { n, text } of headerLines) {
    if (text.trim() === "") continue;
    const m = /^#[ \t]+(PACK|MONTH|WEEK)[ \t]*:[ \t]*(.*)$/i.exec(text);
    if (m) {
      const k = m[1].toLowerCase();
      if (head[k] !== null) err(n, `duplicate "# ${m[1].toUpperCase()}:"`);
      head[k] = { value: m[2].trim(), line: n };
    } else headRest.push({ n, text });
  }
  const headKv = parseKeyValues(headRest, HEADER_KEYS, { allowBlock: false }, err).values;

  const pack = { packId: "", monthNo: 0, weekNo: 0, title: "", goal: "", handout: "", sources: [], days: [], tests: [], month: null };

  if (!head.pack || !head.pack.value) err(0, 'missing "# PACK: <id>" line');
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(head.pack.value)) err(head.pack.line, `pack id "${trunc(head.pack.value)}" must be lowercase letters, digits and hyphens (like critical-thinking)`);
  else pack.packId = head.pack.value;

  if (!head.month || !/^\d+$/.test(head.month.value) || Number(head.month.value) < 1 || Number(head.month.value) > 6) {
    err(head.month ? head.month.line : 0, '"# MONTH:" must be a number from 1 to 6');
  } else pack.monthNo = Number(head.month.value);

  if (!head.week || !/^\d+$/.test(head.week.value) || Number(head.week.value) < 1 || Number(head.week.value) > 24) {
    err(head.week ? head.week.line : 0, '"# WEEK:" must be a number from 1 to 24');
  } else pack.weekNo = Number(head.week.value);

  if (pack.monthNo && pack.weekNo && pack.monthNo !== Math.ceil(pack.weekNo / 4)) {
    err(head.week.line, `week ${pack.weekNo} belongs to month ${Math.ceil(pack.weekNo / 4)}, but the file says month ${pack.monthNo}`);
  }

  for (const k of ["title", "goal"]) {
    if (!headKv[k]) err(0, `missing "${k}:" (after the # PACK / # MONTH / # WEEK lines)`);
  }
  pack.title = headKv.title ?? "";
  pack.goal = headKv.goal ?? "";

  // ---- sections: each of SOURCES, HANDOUT, TEST, MONTH at most once
  const once = {};
  for (const s of sections) {
    if (s.kind === "DAY") continue;
    if (once[s.kind]) err(s.line, `section "## ${s.kind}" appears twice`);
    once[s.kind] = s;
  }
  for (const need of ["SOURCES", "HANDOUT", "TEST"]) {
    if (!once[need]) err(0, `missing section "## ${need}"`);
  }

  // ---- SOURCES
  if (once.SOURCES) {
    const items = splitItems(once.SOURCES.lines, SOURCE_KEYS, err);
    if (!items.length) err(once.SOURCES.line, "## SOURCES has no items");
    const seen = new Set();
    for (const item of items) {
      const kv = parseKeyValues(item.lines, SOURCE_KEYS, { allowBlock: false }, err).values;
      const where = `source at line ${item.line}`;
      for (const k of ["ref", "title", "url", "verified_on", "verified_how"]) {
        if (!kv[k]) err(item.line, `${where}: missing "${k}:"${k === "verified_on" ? " (every source needs the date you checked it)" : ""}`);
      }
      if (kv.ref) {
        if (!/^[A-Za-z0-9._-]+$/.test(kv.ref)) err(item.line, `${where}: ref "${trunc(kv.ref)}" may only use letters, digits, dot, dash and underscore`);
        if (seen.has(kv.ref)) err(item.line, `${where}: ref "${kv.ref}" is used twice`);
        seen.add(kv.ref);
      }
      if (kv.url && !/^https?:\/\/\S+$/.test(kv.url)) err(item.line, `${where}: url must start with http:// or https:// and contain no spaces`);
      if (kv.verified_on && !isRealDate(kv.verified_on)) err(item.line, `${where}: verified_on "${trunc(kv.verified_on)}" is not a real date written YYYY-MM-DD`);
      if (kv.year && !/^\d{4}$/.test(kv.year)) err(item.line, `${where}: year "${trunc(kv.year)}" must be 4 digits`);
      pack.sources.push({
        ref: kv.ref ?? "", title: kv.title ?? "", author: kv.author_or_publisher ?? null,
        year: kv.year ? Number(kv.year) : null, url: kv.url ?? "", verifiedOn: kv.verified_on ?? "", verifiedHow: kv.verified_how ?? "",
      });
    }
  }

  // ---- HANDOUT
  if (once.HANDOUT) {
    const buf = once.HANDOUT.lines.map((l) => l.text);
    while (buf.length && buf[buf.length - 1].trim() === "") buf.pop();
    while (buf.length && buf[0].trim() === "") buf.shift();
    pack.handout = buf.join("\n");
    if (!pack.handout) err(once.HANDOUT.line, "## HANDOUT is empty");
  }

  // ---- DAYS: exactly 5
  const daySections = sections.filter((s) => s.kind === "DAY");
  const dayNos = daySections.map((s) => s.dayNo);
  const dupDays = dayNos.filter((d, i) => dayNos.indexOf(d) !== i);
  const exactlyFive = daySections.length === 5 && [1, 2, 3, 4, 5].every((d) => dayNos.includes(d)) && !dupDays.length;
  if (!exactlyFive) {
    err(0, `a week needs exactly 5 days (## DAY 1 to ## DAY 5, each once); this file has: ${dayNos.length ? dayNos.map((d) => `DAY ${d}`).join(", ") : "none"}`);
  }
  const refs = new Set(pack.sources.map((s) => s.ref));
  for (const s of daySections) {
    const where = `DAY ${s.dayNo}`;
    const parsed = parseKeyValues(s.lines, DAY_KEYS, { allowBlock: true }, (n, m) => err(n, `${where}: ${m}`));
    const kv = parsed.values;
    for (const k of DAY_KEYS) {
      if (k === "options" || k === "correct") continue;
      if (!kv[k]) err(s.line, `${where}: missing "${k}:"`);
    }
    if (kv.source && !refs.has(kv.source)) err(kv.__line_source ?? s.line, `${where}: source "${trunc(kv.source)}" is not in ## SOURCES`);
    const mc = checkMultipleChoice(where, parsed, (n, m) => err(n || s.line, m));
    pack.days.push({
      dayNo: s.dayNo, learnTitle: kv.learn_title ?? "", learnBody: kv.learn_body ?? "", fact: kv.fact ?? "",
      source: kv.source ?? "", doPrompt: kv.do_prompt ?? "", proveQuestion: kv.prove_question ?? "",
      options: mc ? mc.options : [], correct: mc ? mc.correct : 0, explanation: kv.explanation ?? "", hint: kv.hint ?? "",
    });
  }
  pack.days.sort((a, b) => a.dayNo - b.dayNo);

  // ---- TEST
  if (once.TEST) {
    const items = splitItems(once.TEST.lines, TEST_KEYS, err);
    if (!items.length) err(once.TEST.line, "## TEST has no items");
    if (items.length > 8) err(once.TEST.line, `## TEST has ${items.length} items; the most allowed is 8`);
    items.forEach((item, i) => {
      const where = `test item ${i + 1} (line ${item.line})`;
      const parsed = parseKeyValues(item.lines, TEST_KEYS, { allowBlock: false }, err);
      const kv = parsed.values;
      for (const k of ["covers_day", "question", "explanation"]) {
        if (!kv[k]) err(item.line, `${where}: missing "${k}:"`);
      }
      let coversDay = 0;
      if (kv.covers_day) {
        if (!/^\d+$/.test(kv.covers_day) || !dayNos.includes(Number(kv.covers_day)) || Number(kv.covers_day) < 1 || Number(kv.covers_day) > 5) {
          err(item.line, `${where}: covers_day "${trunc(kv.covers_day)}" is not a day in this file (days found: ${dayNos.join(", ") || "none"})`);
        } else coversDay = Number(kv.covers_day);
      }
      const mc = checkMultipleChoice(where, parsed, (n, m) => err(n || item.line, m));
      pack.tests.push({
        position: i + 1, coversDay, question: kv.question ?? "", options: mc ? mc.options : [],
        correct: mc ? mc.correct : 0, explanation: kv.explanation ?? "",
      });
    });
  }

  // ---- MONTH (optional)
  if (once.MONTH) {
    const kv = parseKeyValues(once.MONTH.lines, MONTH_KEYS, { allowBlock: false }, err).values;
    for (const k of MONTH_KEYS) if (!kv[k]) err(once.MONTH.line, `## MONTH: missing "${k}:"`);
    pack.month = { title: kv.month_title ?? "", teaser: kv.teaser_line ?? "" };
  }

  // ---- no control characters anywhere (they cannot be stored safely)
  walkStrings(pack, (s) => {
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) err(0, `text contains a control character near "${trunc(s.replace(/[^ -￿]/g, "?"))}"`);
  });

  return { pack: errors.length ? null : pack, errors };
}

// ---------------------------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------------------------

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qNull = (s) => (s === null || s === undefined ? "null" : q(s));
const jsonb = (arr) => `${q(JSON.stringify(arr))}::jsonb`;
const sm = (n) => `${Number(n)}::smallint`;

export function buildSql(pack) {
  const P = q(pack.packId);
  const W = pack.weekNo;
  const weekFilter = `w.pack_id = ${P} and w.week_no = ${W}`;
  const out = [];
  const push = (s = "") => out.push(s);

  push(`-- Generated by scripts/pack-to-sql.mjs. Pack ${pack.packId}, month ${pack.monthNo}, week ${W}.`);
  push("-- Only insert ... on conflict ... do update / do nothing: it adds or changes rows and never removes any. Safe to run again.");
  push("-- NOT RUN YET. Read it, then paste it into the Supabase SQL editor (migration 031 must be applied first).");
  push("-- One transaction: if the final check fails, nothing is saved.");
  push();
  push("begin;");
  push("set local standard_conforming_strings = on;");
  push();
  push("-- pack (title and summary are set by hand later; an existing pack is left alone)");
  push(`insert into public.skill_packs (id) values (${P}) on conflict (id) do nothing;`);
  push();
  push("-- month (is_free: month 1 only)");
  if (pack.month) {
    push("insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free)");
    push(`values (${P}, ${sm(pack.monthNo)}, ${q(pack.month.title)}, ${q(pack.month.teaser)}, ${pack.monthNo === 1})`);
    push("on conflict (pack_id, month_no) do update set");
    push("  title = excluded.title, teaser_line = excluded.teaser_line, is_free = excluded.is_free;");
  } else {
    push("insert into public.skill_months (pack_id, month_no, is_free)");
    push(`values (${P}, ${sm(pack.monthNo)}, ${pack.monthNo === 1})`);
    push("on conflict (pack_id, month_no) do nothing;");
  }
  push();
  push("-- week");
  push("insert into public.skill_weeks (pack_id, month_no, week_no, title, goal_line, handout_md)");
  push(`values (${P}, ${sm(pack.monthNo)}, ${sm(W)}, ${q(pack.title)}, ${q(pack.goal)}, ${q(pack.handout)})`);
  push("on conflict (pack_id, week_no) do update set");
  push("  month_no = excluded.month_no, title = excluded.title, goal_line = excluded.goal_line, handout_md = excluded.handout_md;");
  push();
  push("-- sources");
  for (const s of pack.sources) {
    push("insert into public.skill_sources (week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)");
    push(`select w.id, ${q(s.ref)}, ${q(s.title)}, ${qNull(s.author)}, ${s.year === null ? "null::smallint" : sm(s.year)}, ${q(s.url)}, ${q(s.verifiedOn)}::date, ${q(s.verifiedHow)}`);
    push(`from public.skill_weeks w where ${weekFilter}`);
    push("on conflict (week_id, ref) do update set");
    push("  title = excluded.title, author_or_publisher = excluded.author_or_publisher, year = excluded.year,");
    push("  url = excluded.url, verified_on = excluded.verified_on, verified_how = excluded.verified_how;");
    push();
  }
  push("-- steps (days 1 to 5)");
  for (const d of pack.days) {
    push("insert into public.skill_steps (week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,");
    push("  prove_question, prove_options, prove_correct, prove_explanation, hint)");
    push(`select w.id, ${sm(d.dayNo)}, ${q(d.learnTitle)}, ${q(d.learnBody)}, ${q(d.fact)}, s.id, ${q(d.doPrompt)},`);
    push(`  ${q(d.proveQuestion)}, ${jsonb(d.options)}, ${sm(d.correct)}, ${q(d.explanation)}, ${q(d.hint)}`);
    push("from public.skill_weeks w");
    push(`join public.skill_sources s on s.week_id = w.id and s.ref = ${q(d.source)}`);
    push(`where ${weekFilter}`);
    push("on conflict (week_id, day_no) do update set");
    push("  learn_title = excluded.learn_title, learn_body = excluded.learn_body, fact_line = excluded.fact_line,");
    push("  source_id = excluded.source_id, do_prompt = excluded.do_prompt, prove_question = excluded.prove_question,");
    push("  prove_options = excluded.prove_options, prove_correct = excluded.prove_correct,");
    push("  prove_explanation = excluded.prove_explanation, hint = excluded.hint;");
    push();
  }
  push("-- test items (position = order in the file)");
  for (const t of pack.tests) {
    push('insert into public.skill_test_items (week_id, "position", covers_day, question, options, correct, explanation)');
    push(`select w.id, ${sm(t.position)}, ${sm(t.coversDay)}, ${q(t.question)}, ${jsonb(t.options)}, ${sm(t.correct)}, ${q(t.explanation)}`);
    push(`from public.skill_weeks w where ${weekFilter}`);
    push('on conflict (week_id, "position") do update set');
    push("  covers_day = excluded.covers_day, question = excluded.question, options = excluded.options,");
    push("  correct = excluded.correct, explanation = excluded.explanation;");
    push();
  }

  const nSources = pack.sources.length;
  const nTests = pack.tests.length;
  push("-- final check: the database must now hold exactly what the file has for this week. This script");
  push("-- never removes rows, so a leftover row from an older version of the file stops the load (nothing saved).");
  push("do $$");
  push("declare steps_found integer; tests_found integer; sources_found integer;");
  push("begin");
  push(`  select count(*) into steps_found from public.skill_steps x join public.skill_weeks w on w.id = x.week_id where ${weekFilter};`);
  push(`  select count(*) into tests_found from public.skill_test_items x join public.skill_weeks w on w.id = x.week_id where ${weekFilter};`);
  push(`  select count(*) into sources_found from public.skill_sources x join public.skill_weeks w on w.id = x.week_id where ${weekFilter};`);
  push(`  if steps_found <> 5 or tests_found <> ${nTests} or sources_found <> ${nSources} then`);
  push(`    raise exception 'Week load aborted for pack ${pack.packId} week ${W}: the database has % steps, % test items, % sources; the file has 5, ${nTests}, ${nSources}. This script never removes rows: take the stale rows out by hand or fix the file. Nothing was saved.', steps_found, tests_found, sources_found;`);
  push("  end if;");
  push("end");
  push("$$;");
  push();
  push("commit;");
  push();
  push(`-- read-back: expect steps = 5, test_items = ${nTests}, sources = ${nSources}`);
  push("select w.pack_id, w.month_no, w.week_no,");
  push("  (select count(*) from public.skill_steps x where x.week_id = w.id) as steps,");
  push("  (select count(*) from public.skill_test_items x where x.week_id = w.id) as test_items,");
  push("  (select count(*) from public.skill_sources x where x.week_id = w.id) as sources");
  push(`from public.skill_weeks w where ${weekFilter};`);
  return `${out.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------
// Output path guard: never write inside the repo folder
// ---------------------------------------------------------------------------------------------

// Resolves symlinks for every part that exists, and ".." the way the file system does (a ".."
// after a symlink goes to the symlink target's parent), so a link cannot smuggle a path into the repo.
export function realResolve(p) {
  const sepRe = path.sep === "\\" ? /[\\/]+/ : /\/+/;
  const root = path.isAbsolute(p) ? path.parse(p).root : null;
  let cur = fs.realpathSync.native(root ?? process.cwd());
  const rest = root ? p.slice(root.length) : p;
  for (const seg of rest.split(sepRe).filter(Boolean)) {
    if (seg === ".") continue;
    if (seg === "..") {
      cur = path.dirname(cur);
      continue;
    }
    const next = path.join(cur, seg);
    try {
      fs.lstatSync(next);
      cur = fs.realpathSync.native(next);
    } catch {
      cur = next;
    }
  }
  return cur;
}

export function isInside(child, parent) {
  const rel = path.relative(parent, child);
  if (rel === "") return true;
  if (path.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}

// Returns the real output path, or throws an Error whose message says what is wrong.
export function checkOutputPath(outPath, inputPath, repoRoot = REPO_ROOT) {
  if (!outPath) throw new Error("No output file given.");
  if (!/\.sql$/i.test(outPath)) throw new Error(`The output file must end in .sql (got "${outPath}"). This protects your .md file from being overwritten.`);
  const real = realResolve(outPath);
  const repoReal = fs.realpathSync.native(repoRoot);
  if (isInside(real, repoReal)) {
    throw new Error(`Refusing to write inside the repo folder (${repoReal}). Generated SQL contains pack content and must stay outside the repo. Choose a path outside it, for example in your Documents folder.`);
  }
  if (inputPath && fs.existsSync(inputPath) && real === fs.realpathSync.native(inputPath)) {
    throw new Error("The output file would overwrite the input file.");
  }
  let st = null;
  try { st = fs.statSync(real); } catch { /* does not exist yet: fine */ }
  if (st && st.isDirectory()) throw new Error(`The output path is a folder: ${real}`);
  const dir = path.dirname(real);
  let dst = null;
  try { dst = fs.statSync(dir); } catch { /* checked below */ }
  if (!dst || !dst.isDirectory()) throw new Error(`The output folder does not exist: ${dir}. Create it first.`);
  return real;
}

// ---------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------

export function run(argv, io = { log: console.log, error: console.error }) {
  const [inputPath, outputPath] = argv;
  if (!inputPath || !outputPath || argv.length > 2) {
    io.error("Usage: node scripts/pack-to-sql.mjs <week-file.md> <output.sql>\nThe output must be outside the repo folder.");
    return 2;
  }
  let realOut;
  try {
    realOut = checkOutputPath(outputPath, inputPath);
  } catch (e) {
    io.error(`NOT WRITTEN. ${e.message}`);
    return 2;
  }
  let text;
  try {
    text = fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    io.error(`NOT WRITTEN. Cannot read the input file: ${e.message}`);
    return 2;
  }
  const { pack, errors } = readPack(text);
  if (!pack) {
    io.error(`NOT WRITTEN. ${errors.length} problem${errors.length === 1 ? "" : "s"} found in ${path.basename(inputPath)}:`);
    for (const e of errors) io.error(`  - ${e}`);
    return 1;
  }
  const sql = buildSql(pack);
  fs.writeFileSync(realOut, sql, "utf8");
  io.log(`Wrote ${realOut}`);
  io.log(`Pack ${pack.packId}, month ${pack.monthNo}, week ${pack.weekNo}: 5 days, ${pack.sources.length} sources, ${pack.tests.length} test items.`);
  io.log("Nothing was run against any database. Read the SQL, then paste it into the Supabase SQL editor.");
  return 0;
}

function isMain() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = run(process.argv.slice(2));
}
