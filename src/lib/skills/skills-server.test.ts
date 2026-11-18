// Run with: node --test src/lib/skills/skills-server.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Tests for the server layer of "learn a skill" (src/lib/skills/skills-server.ts).
// No test here touches a real database. A small in-memory fake stands in for the service client, and it can
// be told to misbehave on a write: return an error, no row, two rows, or a row that does not match what was sent.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  answerReview,
  deleteNotebookEntry,
  getDueReviews,
  getHandout,
  getHome,
  getPackMap,
  getTodayStep,
  getWeeklyTest,
  recordProve,
  saveNotebookEntry,
  saveTestResult,
  type TestAnswer,
} from "./skills-server.ts";

// ---------------------------------------------------------------------------
// The fake database
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "upsert" | "update" | "delete";
type Kind = "error" | "zero" | "two" | "mismatch";
type Fault = { table: string; op: Op; kind: Kind; mutate?: (r: Row) => Row };
type Filter = [string, string, unknown];
type LogEntry = { table: string; op: Op; cols: string; payload: unknown; filters: Filter[] };

const SECRET_DB = "PRIVATE-DB-MESSAGE note text prompt text answer text";

const DEFAULTS: Record<string, Row> = {
  skill_step_progress: { do_done: false, prove_correct: false, prove_attempts: 0, completed_at: null },
  skill_enrollments: { started_at: "DEFAULT-START", last_new_step_at: null },
  skill_notebook_entries: { created_at: "DEFAULT-CREATED" },
};

class FakeDb {
  tables: Record<string, Row[]>;
  log: LogEntry[] = [];
  faults: Fault[] = [];
  idCounter = 0;
  throwOnTable: string | null = null;
  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }
  writes() {
    return this.log.filter((l) => l.op !== "select");
  }
  selects(table: string) {
    return this.log.filter((l) => l.op === "select" && l.table === table).map((l) => l.cols);
  }
  rows(table: string) {
    return this.tables[table] ?? [];
  }
}

function project(rows: Row[], cols: string): Row[] {
  const names = cols.split(",").map((c) => c.trim());
  return rows.map((r) => {
    if (names.includes("*")) return structuredClone(r);
    const out: Row = {};
    for (const n of names) if (n in r) out[n] = structuredClone(r[n]);
    return out;
  });
}

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  db: FakeDb;
  table: string;
  op: Op = "select";
  cols = "*";
  returning: string | null = null;
  payload: unknown = null;
  conflict: string[] = [];
  filters: Filter[] = [];
  orderBy: [string, boolean] | null = null;
  limitTo: number | null = null;
  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }
  select(cols = "*") {
    if (this.op === "select") this.cols = cols;
    else this.returning = cols;
    return this;
  }
  insert(p: unknown) { this.op = "insert"; this.payload = p; return this; }
  upsert(p: unknown, opts?: { onConflict?: string }) {
    this.op = "upsert"; this.payload = p; this.conflict = (opts?.onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean); return this;
  }
  update(p: unknown) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push(["eq", c, v]); return this; }
  in(c: string, v: unknown[]) { this.filters.push(["in", c, v]); return this; }
  not(c: string, how: string, v: unknown) { this.filters.push(["not-" + how, c, v]); return this; }
  lte(c: string, v: unknown) { this.filters.push(["lte", c, v]); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orderBy = [c, o?.ascending !== false]; return this; }
  limit(n: number) { this.limitTo = n; return this; }
  then<A, B>(ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null, no?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, no);
  }

  private matches(r: Row): boolean {
    return this.filters.every(([kind, col, v]) => {
      const x = r[col];
      if (kind === "eq") return x === v;
      if (kind === "in") return (v as unknown[]).includes(x);
      if (kind === "not-is") return x !== null && x !== undefined;
      if (kind === "lte") return typeof x === "string" && Date.parse(x) <= Date.parse(String(v));
      throw new Error("fake: unsupported filter " + kind);
    });
  }

  private run(): { data: unknown; error: unknown } {
    const db = this.db;
    if (db.throwOnTable === this.table) throw new Error(SECRET_DB);
    const rows = (db.tables[this.table] ??= []);
    db.log.push({ table: this.table, op: this.op, cols: this.returning ?? this.cols, payload: this.payload, filters: [...this.filters] });
    const fault = db.faults.find((f) => f.table === this.table && f.op === this.op);
    if (fault?.kind === "error") return { data: null, error: { code: "42501", message: SECRET_DB, details: SECRET_DB, hint: SECRET_DB } };
    if (fault?.kind === "zero") return { data: [], error: null }; // a silent failure: nothing was saved

    let out: Row[] = [];
    if (this.op === "select") {
      out = rows.filter((r) => this.matches(r));
      if (this.orderBy) {
        const [c, asc] = this.orderBy;
        out.sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : String(a[c]) > String(b[c]) ? 1 : 0) * (asc ? 1 : -1));
      }
      if (this.limitTo !== null) out = out.slice(0, this.limitTo);
    } else if (this.op === "insert" || this.op === "upsert") {
      const p = this.payload as Row;
      const existing = this.op === "upsert" ? rows.find((r) => this.conflict.every((k) => r[k] === p[k])) : undefined;
      if (existing) {
        Object.assign(existing, structuredClone(p));
        out = [existing];
      } else {
        const fresh: Row = { ...(DEFAULTS[this.table] ?? {}), ...structuredClone(p) };
        if ((this.table === "skill_notebook_entries" || this.table === "skill_test_results") && fresh.id === undefined) fresh.id = `gen-${++db.idCounter}`;
        rows.push(fresh);
        out = [fresh];
      }
    } else if (this.op === "update") {
      out = rows.filter((r) => this.matches(r));
      for (const r of out) Object.assign(r, structuredClone(this.payload as Row));
    } else if (this.op === "delete") {
      out = rows.filter((r) => this.matches(r));
      db.tables[this.table] = rows.filter((r) => !this.matches(r));
    }

    if (this.op !== "select" && this.returning === null) return { data: null, error: null };
    let data = project(out, this.returning ?? this.cols);
    if (fault?.kind === "two" && data[0]) data = [data[0], structuredClone(data[0])];
    if (fault?.kind === "mismatch" && data[0]) data = [fault.mutate ? fault.mutate(data[0]) : { ...data[0], id: "other" }];
    return { data, error: null };
  }
}

function clientOf(db: FakeDb): SupabaseClient {
  return { from: (table: string) => new Query(db, table) } as unknown as SupabaseClient;
}

function capture() {
  const lines: string[] = [];
  const orig = { error: console.error, warn: console.warn, log: console.log, info: console.info };
  const grab = (...args: unknown[]) => { lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")); };
  console.error = grab; console.warn = grab; console.log = grab; console.info = grab;
  return { lines, restore() { console.error = orig.error; console.warn = orig.warn; console.log = orig.log; console.info = orig.info; } };
}

async function quiet<T>(fn: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const cap = capture();
  try {
    return { result: await fn(), lines: cap.lines };
  } finally {
    cap.restore();
  }
}

// ---------------------------------------------------------------------------
// The test world: one pack. Month 1 (free) has week 1 (w1). Month 2 has week 5 (w5). w2 is a short week.
// ---------------------------------------------------------------------------

const U = "u1";
const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);
const H = 3_600_000;
const D = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();
const CORRECT: Record<number, number> = { 1: 1, 2: 2, 3: 0, 4: 1, 5: 2 };
const wrongOf = (day: number) => (CORRECT[day]! + 1) % 3;
const TEST_CORRECT: Record<number, number> = { 1: 2, 2: 0, 3: 1, 4: 2, 5: 0 };
const STEPS_W1 = [1, 2, 3, 4, 5].map((d) => `s1-${d}`);
const STEPS_W2 = ["s2-1", "s2-2", "s2-3"];

function seedTables(): Record<string, Row[]> {
  const weeks: Row[] = [
    { id: "w1", pack_id: "p1", month_no: 1, week_no: 1, title: "Week one", goal_line: "Goal one", handout_md: "HANDOUT-ONE" },
    { id: "w2", pack_id: "p1", month_no: 1, week_no: 2, title: "Week two", goal_line: "Goal two", handout_md: "HANDOUT-TWO" },
    { id: "w5", pack_id: "p1", month_no: 2, week_no: 5, title: "LOCKED-WEEK-TITLE", goal_line: "LOCKED-GOAL", handout_md: "LOCKED-HANDOUT" },
  ];
  const steps: Row[] = [];
  const sources: Row[] = [];
  const items: Row[] = [];
  const stepsFor = (w: string, key: string, days: number[]) => {
    sources.push({ id: `src-${key}`, week_id: w, ref: "S1", title: `Source ${key}`, year: 2020, url: "https://example.test/secret-url" });
    for (const d of days) {
      steps.push({
        id: `s${key}-${d}`, week_id: w, day_no: d, learn_title: `Learn ${key}.${d}`, learn_body: `Body ${key}.${d}`, fact_line: `Fact ${key}.${d}`,
        source_id: `src-${key}`, do_prompt: `Do ${key}.${d}`, prove_question: `Question ${key}.${d}`, prove_options: ["opt-a", "opt-b", "opt-c"],
        prove_correct: CORRECT[d], prove_explanation: `EXPLAIN-${key}-${d}`, hint: `Hint ${key}.${d}`,
      });
    }
  };
  stepsFor("w1", "1", [1, 2, 3, 4, 5]);
  stepsFor("w5", "5", [1, 2, 3, 4, 5]);
  stepsFor("w2", "2", [1, 2, 3]);
  for (const [w, key] of [["w1", "1"], ["w5", "5"]] as const) {
    for (let d = 1; d <= 5; d++) {
      items.push({ id: `t${key}-${d}`, week_id: w, position: d, covers_day: d, question: `TQ-${key}-${d}`, options: ["t0", "t1", "t2"], correct: TEST_CORRECT[d], explanation: `TEXPLAIN-${key}-${d}` });
    }
    for (const [pos, day] of [[6, 1], [7, 2], [8, 3]] as const) {
      items.push({ id: `t${key}-${pos}`, week_id: w, position: pos, covers_day: day, question: `TQ-extra-${key}-${pos}`, options: ["t0", "t1", "t2"], correct: 0, explanation: `TEXPLAIN-extra-${key}-${pos}` });
    }
  }
  return {
    skill_packs: [{ id: "p1", title: "Pack", summary: "S", is_published: true }],
    skill_months: [1, 2, 3, 4, 5, 6].map((m) => ({ pack_id: "p1", month_no: m, title: `Month ${m}`, teaser_line: `Teaser ${m}`, is_free: m === 1 })),
    skill_weeks: weeks,
    skill_sources: sources,
    skill_steps: steps,
    skill_test_items: items,
    skill_enrollments: [],
    skill_step_progress: [],
    skill_review_items: [],
    skill_notebook_entries: [],
    skill_test_results: [],
  };
}

type WorldOptions = { completed?: string[]; lastNewStepAt?: number; reviews?: Row[]; notes?: Row[]; extra?: (t: Record<string, Row[]>) => void };

function world(o: WorldOptions = {}) {
  const t = seedTables();
  for (const id of o.completed ?? []) {
    t.skill_step_progress!.push({ user_id: U, step_id: id, do_done: false, prove_correct: true, prove_attempts: 1, completed_at: iso(NOW - 30 * D) });
  }
  if (o.lastNewStepAt !== undefined) {
    t.skill_enrollments!.push({ user_id: U, pack_id: "p1", started_at: "OLD-START", last_new_step_at: iso(o.lastNewStepAt) });
  }
  t.skill_review_items!.push(...(o.reviews ?? []));
  t.skill_notebook_entries!.push(...(o.notes ?? []));
  o.extra?.(t);
  const db = new FakeDb(t);
  return { db, client: clientOf(db) };
}

const review = (stepId: string, stage: number, dueAt: number, extra: Row = {}): Row => ({
  user_id: U, step_id: stepId, stage, due_at: iso(dueAt), last_correct: true, retired: false, ...extra,
});

const GRADING_WORDS = /prove_correct|prove_explanation|correct|explanation|EXPLAIN-/i;

// ---------------------------------------------------------------------------
// getPackMap
// ---------------------------------------------------------------------------

test("getPackMap: a free user sees month 1 open and months 2 to 6 as title + teaser only", async () => {
  const { db, client } = world();
  const r = await getPackMap(client, "free");
  assert.ok("data" in r);
  const months = r.data.months;
  assert.equal(months.length, 6);
  assert.deepEqual(months[0], {
    month: 1, title: "Month 1", teaser: "Teaser 1", locked: false,
    weeks: [{ weekId: "w1", weekNo: 1, title: "Week one", goalLine: "Goal one" }, { weekId: "w2", weekNo: 2, title: "Week two", goalLine: "Goal two" }],
  });
  for (let m = 2; m <= 6; m++) {
    assert.deepEqual(months[m - 1], { month: m, title: `Month ${m}`, teaser: `Teaser ${m}`, locked: true });
  }
  // the locked weeks are never even asked for, and no step is read
  const weekQueries = db.log.filter((l) => l.table === "skill_weeks");
  assert.equal(weekQueries.length, 1);
  assert.deepEqual(weekQueries[0]!.filters.find((f) => f[1] === "month_no"), ["in", "month_no", [1]]);
  assert.equal(db.selects("skill_steps").length, 0);
  assert.equal(db.selects("skill_test_items").length, 0);
  const text = JSON.stringify(r);
  for (const secret of ["LOCKED-WEEK-TITLE", "LOCKED-GOAL", "LOCKED-HANDOUT", "HANDOUT-ONE", "EXPLAIN", "prove_"]) {
    assert.ok(!text.includes(secret), `the map must not contain ${secret}`);
  }
});

test("getPackMap: a pro user sees every month open, and still never sees steps or handouts", async () => {
  const { db, client } = world();
  const r = await getPackMap(client, "pro");
  assert.ok("data" in r);
  assert.ok(r.data.months.every((m) => m.locked === false));
  const m2 = r.data.months[1]!;
  assert.ok(!m2.locked && m2.weeks.length === 1 && m2.weeks[0]!.title === "LOCKED-WEEK-TITLE");
  assert.equal(db.selects("skill_steps").length, 0);
  assert.ok(!JSON.stringify(r).includes("HANDOUT"));
});

test("getPackMap: a bad tier is treated as free; month rows the database flags as not free stay locked", async () => {
  const bad = await getPackMap(world().client, "gold" as never);
  assert.ok("data" in bad && bad.data.months.filter((m) => !m.locked).length === 1);
  // the database says month 1 is NOT free: the month stays locked even though the code rule says it is free
  const w = world({ extra: (t) => { t.skill_months![0]!.is_free = false; } });
  const r = await getPackMap(w.client, "free");
  assert.ok("data" in r && r.data.months.every((m) => m.locked));
});

test("getPackMap: no published pack, two published packs, an unpublished named pack and a database error", async () => {
  const none = await quiet(() => getPackMap(world({ extra: (t) => { t.skill_packs = []; } }).client, "free"));
  assert.deepEqual(none.result, { error: { code: "no-pack" } });
  const two = await quiet(() => getPackMap(world({ extra: (t) => { t.skill_packs!.push({ id: "p2", is_published: true }); } }).client, "free"));
  assert.deepEqual(two.result, { error: { code: "ambiguous-pack" } });
  const named = await getPackMap(world({ extra: (t) => { t.skill_packs!.push({ id: "p2", is_published: true }); } }).client, "free", { packId: "p1" });
  assert.ok("data" in named && named.data.packId === "p1");
  const unpublished = await quiet(() => getPackMap(world({ extra: (t) => { t.skill_packs!.push({ id: "p3", is_published: false }); } }).client, "free", { packId: "p3" }));
  assert.deepEqual(unpublished.result, { error: { code: "no-pack" } });
  const w = world();
  w.db.faults.push({ table: "skill_months", op: "select", kind: "error" });
  const err = await quiet(() => getPackMap(w.client, "free"));
  assert.deepEqual(err.result, { error: { code: "42501" } });
  assert.deepEqual(err.lines, ["[skills-server] getPackMap error code=42501"]);
});

// ---------------------------------------------------------------------------
// getTodayStep
// ---------------------------------------------------------------------------

test("getTodayStep: a new user gets step 1, with exactly the allowed fields", async () => {
  const { client } = world();
  const r = await getTodayStep(client, U, "free", { now: NOW });
  assert.deepEqual(r, {
    data: {
      open: true, stepId: "s1-1", month: 1, weekNo: 1, dayNo: 1,
      learn_title: "Learn 1.1", learn_body: "Body 1.1", fact_line: "Fact 1.1",
      source: { title: "Source 1", year: 2020 },
      do_prompt: "Do 1.1", prove_question: "Question 1.1", prove_options: ["opt-a", "opt-b", "opt-c"], hint: "Hint 1.1",
    },
  });
});

test("getTodayStep: no answer field ever appears in the output, and the database is never asked for one", async () => {
  for (const tier of ["free", "pro"] as const) {
    for (const completed of [[], STEPS_W1.slice(0, 2), STEPS_W1]) {
      const { db, client } = world({ completed, lastNewStepAt: NOW - 21 * H });
      const r = await getTodayStep(client, U, tier, { now: NOW });
      assert.doesNotMatch(JSON.stringify(r), GRADING_WORDS);
      for (const cols of db.selects("skill_steps")) assert.doesNotMatch(cols, /prove_correct|prove_explanation/);
    }
  }
});

test("getTodayStep: the 20-hour rule, and a long gap gives the SAME next step", async () => {
  const at19 = await getTodayStep(world({ completed: ["s1-1"], lastNewStepAt: NOW - 19 * H }).client, U, "free", { now: NOW });
  assert.deepEqual(at19, { data: { open: false, opensAt: iso(NOW + H) } });
  assert.doesNotMatch(JSON.stringify(at19), /learn_|prove_|hint|Body/);
  const at20 = await getTodayStep(world({ completed: ["s1-1"], lastNewStepAt: NOW - 20 * H }).client, U, "free", { now: NOW });
  assert.ok("data" in at20 && "open" in at20.data && at20.data.open && at20.data.stepId === "s1-2");
  const after30Days = await getTodayStep(world({ completed: ["s1-1"], lastNewStepAt: NOW - 30 * D }).client, U, "free", { now: NOW });
  assert.ok("data" in after30Days && "stepId" in after30Days.data && after30Days.data.stepId === "s1-2", "no step is skipped");
});

test("getTodayStep: the next step in a locked month returns only { locked, month, teaser } for a free user", async () => {
  const free = world({ completed: [...STEPS_W1, ...STEPS_W2], lastNewStepAt: NOW - 30 * D });
  const r = await getTodayStep(free.client, U, "free", { now: NOW });
  assert.deepEqual(r, { locked: true, month: 2, teaser: "Teaser 2" });
  assert.equal(free.db.selects("skill_sources").length, 0, "no content of the locked month is read");
  assert.equal(free.db.selects("skill_steps").filter((c) => /learn_/.test(c)).length, 0);
  const pro = await getTodayStep(world({ completed: [...STEPS_W1, ...STEPS_W2], lastNewStepAt: NOW - 30 * D }).client, U, "pro", { now: NOW });
  assert.ok("data" in pro && "stepId" in pro.data && pro.data.stepId === "s5-1");
  // a lapsed Pro user is simply free again
  const lapsed = await getTodayStep(world({ completed: [...STEPS_W1, ...STEPS_W2], lastNewStepAt: NOW - 30 * D }).client, U, "free", { now: NOW });
  assert.ok("locked" in lapsed);
});

test("getTodayStep: when every step is complete it says done; another user's progress does not count", async () => {
  const all = [...STEPS_W1, ...[1, 2, 3, 4, 5].map((d) => `s5-${d}`), "s2-1", "s2-2", "s2-3"];
  const done = await getTodayStep(world({ completed: all, lastNewStepAt: NOW - 30 * D }).client, U, "pro", { now: NOW });
  assert.deepEqual(done, { data: { done: true } });
  const w = world({ extra: (t) => { t.skill_step_progress!.push({ user_id: "someone-else", step_id: "s1-1", completed_at: iso(NOW) }); } });
  const r = await getTodayStep(w.client, U, "free", { now: NOW });
  assert.ok("data" in r && "stepId" in r.data && r.data.stepId === "s1-1");
});

test("getTodayStep: a database error, a missing user, and missing content return a code only", async () => {
  const w = world();
  w.db.faults.push({ table: "skill_steps", op: "select", kind: "error" });
  const err = await quiet(() => getTodayStep(w.client, U, "free", { now: NOW }));
  assert.deepEqual(err.result, { error: { code: "42501" } });
  assert.ok(!JSON.stringify(err).includes("PRIVATE"));
  const noUser = await quiet(() => getTodayStep(world().client, "", "free"));
  assert.deepEqual(noUser.result, { error: { code: "no-user" } });
  const noSource = await quiet(() => getTodayStep(world({ extra: (t) => { t.skill_sources = []; } }).client, U, "free", { now: NOW }));
  assert.deepEqual(noSource.result, { error: { code: "no-source" } });
});

// ---------------------------------------------------------------------------
// recordProve
// ---------------------------------------------------------------------------

test("recordProve: a right answer saves the review item, the completed step and the enrollment, in that order", async () => {
  const { db, client } = world();
  const r = await recordProve(client, U, "free", "s1-1", CORRECT[1]!, { now: NOW });
  assert.deepEqual(r, { data: { correct: true, alreadyDone: false, attempts: 1, explanation: "EXPLAIN-1-1" } });
  assert.deepEqual(db.writes().map((w) => w.table), ["skill_review_items", "skill_step_progress", "skill_enrollments"]);
  assert.deepEqual(db.rows("skill_step_progress"), [
    { user_id: U, step_id: "s1-1", do_done: false, prove_correct: true, prove_attempts: 1, completed_at: iso(NOW) },
  ]);
  assert.deepEqual(db.rows("skill_review_items"), [
    { user_id: U, step_id: "s1-1", stage: 0, due_at: iso(NOW + D), last_correct: true, retired: false },
  ]);
  assert.deepEqual(db.rows("skill_enrollments"), [
    { user_id: U, pack_id: "p1", started_at: "DEFAULT-START", last_new_step_at: iso(NOW) },
  ]);
  // and the next step now waits 20 hours
  const next = await getTodayStep(client, U, "free", { now: NOW + 5 * H });
  assert.deepEqual(next, { data: { open: false, opensAt: iso(NOW + 20 * H) } });
});

test("recordProve: an existing enrollment keeps its started_at", async () => {
  const { db, client } = world({ lastNewStepAt: NOW - 21 * H });
  await recordProve(client, U, "free", "s1-1", CORRECT[1]!, { now: NOW });
  assert.equal(db.rows("skill_enrollments").length, 1);
  assert.equal(db.rows("skill_enrollments")[0]!.started_at, "OLD-START");
  assert.equal(db.rows("skill_enrollments")[0]!.last_new_step_at, iso(NOW));
});

test("recordProve: the explanation shows only after a right answer or the 2nd wrong one", async () => {
  const { db, client } = world({ completed: ["s1-1"], lastNewStepAt: NOW - 21 * H });
  const first = await recordProve(client, U, "free", "s1-2", wrongOf(2), { now: NOW });
  assert.deepEqual(first, { data: { correct: false, alreadyDone: false, attempts: 1, explanation: null } });
  assert.doesNotMatch(JSON.stringify(first), /EXPLAIN/);
  const second = await recordProve(client, U, "free", "s1-2", wrongOf(2), { now: NOW });
  assert.deepEqual(second, { data: { correct: false, alreadyDone: false, attempts: 2, explanation: "EXPLAIN-1-2" } });
  const row = db.rows("skill_step_progress").find((p) => p.step_id === "s1-2")!;
  assert.equal(row.prove_attempts, 2);
  assert.equal(row.completed_at, null, "a wrong answer completes nothing");
  assert.equal(db.rows("skill_review_items").length, 0, "no review item for a wrong answer");
  assert.equal(db.rows("skill_enrollments")[0]!.last_new_step_at, iso(NOW - 21 * H), "the wait does not start");
  const right = await recordProve(client, U, "free", "s1-2", CORRECT[2]!, { now: NOW });
  assert.deepEqual(right, { data: { correct: true, alreadyDone: false, attempts: 3, explanation: "EXPLAIN-1-2" } });
});

test("recordProve: a step already completed writes nothing", async () => {
  const { db, client } = world({ completed: ["s1-1"] });
  const r = await recordProve(client, U, "free", "s1-1", wrongOf(1), { now: NOW });
  assert.ok("data" in r && r.data.alreadyDone && r.data.correct);
  assert.equal(db.writes().length, 0);
});

test("recordProve: only the current step, and only once it is open", async () => {
  const ahead = world();
  assert.deepEqual((await quiet(() => recordProve(ahead.client, U, "free", "s1-2", CORRECT[2]!, { now: NOW }))).result, { error: { code: "not-current" } });
  assert.equal(ahead.db.writes().length, 0);
  const waiting = world({ completed: ["s1-1"], lastNewStepAt: NOW - 19 * H });
  assert.deepEqual((await quiet(() => recordProve(waiting.client, U, "free", "s1-2", CORRECT[2]!, { now: NOW }))).result, { error: { code: "not-open" } });
  assert.equal(waiting.db.writes().length, 0);
  const unknown = await quiet(() => recordProve(world().client, U, "free", "nope", 0, { now: NOW }));
  assert.deepEqual(unknown.result, { error: { code: "no-step" } });
});

test("recordProve: a locked month returns { locked, month, teaser } and writes nothing; pro gets past the lock", async () => {
  const free = world();
  const r = await recordProve(free.client, U, "free", "s5-1", CORRECT[1]!, { now: NOW });
  assert.deepEqual(r, { locked: true, month: 2, teaser: "Teaser 2" });
  assert.equal(free.db.writes().length, 0);
  assert.doesNotMatch(JSON.stringify(r), GRADING_WORDS);
  const pro = await quiet(() => recordProve(world().client, U, "pro", "s5-1", CORRECT[1]!, { now: NOW }));
  assert.deepEqual(pro.result, { error: { code: "not-current" } }, "pro is not locked out, it is just not the current step");
});

test("recordProve: an answer that is not a whole number inside the options is no attempt, and is not logged", async () => {
  for (const bad of [-1, 1.5, 3, 99, Number.NaN, "1" as unknown as number, undefined as unknown as number, null as unknown as number]) {
    const { db, client } = world();
    const out = await quiet(() => recordProve(client, U, "free", "s1-1", bad, { now: NOW }));
    assert.deepEqual(out.result, { error: { code: "bad-answer" } });
    assert.equal(db.writes().length, 0);
    assert.deepEqual(out.lines, []);
  }
});

test("recordProve: if the completion write errors, the enrollment is untouched and the same answer can be sent again", async () => {
  const { db, client } = world();
  db.faults.push({ table: "skill_step_progress", op: "upsert", kind: "error" });
  const first = await quiet(() => recordProve(client, U, "free", "s1-1", CORRECT[1]!, { now: NOW }));
  assert.deepEqual(first.result, { error: { code: "42501" } });
  assert.equal(db.rows("skill_enrollments").length, 0, "the 20-hour wait never started");
  assert.equal(db.rows("skill_step_progress").length, 0);
  db.faults.length = 0;
  const retry = await recordProve(client, U, "free", "s1-1", CORRECT[1]!, { now: NOW });
  assert.ok("data" in retry && retry.data.correct && !retry.data.alreadyDone);
  assert.equal(db.rows("skill_review_items").length, 1, "the retry updates the same review item, it does not add one");
  assert.equal(db.rows("skill_enrollments").length, 1);
});

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

test("saveNotebookEntry: clips to 600 characters (code points), sets updated_at, and keeps created_at on update", async () => {
  const { db, client } = world();
  const long = "a".repeat(599) + "😀😀"; // 601 characters; "😀" is one character for Postgres but two UTF-16 units
  const r = await saveNotebookEntry(client, U, "free", "s1-1", long, { now: NOW });
  assert.ok("data" in r);
  assert.deepEqual(Object.keys(r.data).sort(), ["id", "updatedAt"], "the note itself is never returned");
  const row = db.rows("skill_notebook_entries")[0]!;
  assert.equal(Array.from(row.body as string).length, 600);
  assert.equal(row.updated_at, iso(NOW));
  assert.equal(row.user_id, U);
  const again = await saveNotebookEntry(client, U, "free", "s1-1", "second version", { now: NOW + 1000 });
  assert.ok("data" in again && again.data.id === r.data.id, "one note per step: the same row");
  assert.equal(db.rows("skill_notebook_entries").length, 1);
  assert.equal(db.rows("skill_notebook_entries")[0]!.body, "second version");
  assert.equal(db.rows("skill_notebook_entries")[0]!.updated_at, iso(NOW + 1000));
  assert.equal(db.rows("skill_notebook_entries")[0]!.created_at, "DEFAULT-CREATED");
  const payload = db.writes()[0]!.payload as Row;
  assert.ok(!("created_at" in payload), "created_at is never sent");
});

test("saveNotebookEntry: an empty or blank note, or something that is not text, writes nothing", async () => {
  for (const bad of ["", "   \n\t", undefined as unknown as string, 5 as unknown as string, null as unknown as string]) {
    const { db, client } = world();
    const out = await quiet(() => saveNotebookEntry(client, U, "free", "s1-1", bad, { now: NOW }));
    assert.deepEqual(out.result, { error: { code: "empty-body" } });
    assert.equal(db.writes().length, 0);
  }
});

test("saveNotebookEntry: a step in a locked month returns { locked, month, teaser } and writes nothing; an unknown step is an error", async () => {
  const { db, client } = world();
  assert.deepEqual(await saveNotebookEntry(client, U, "free", "s5-1", "hello", { now: NOW }), { locked: true, month: 2, teaser: "Teaser 2" });
  assert.equal(db.writes().length, 0);
  const pro = await saveNotebookEntry(client, U, "pro", "s5-1", "hello", { now: NOW });
  assert.ok("data" in pro);
  const none = await quiet(() => saveNotebookEntry(client, U, "pro", "nope", "hello", { now: NOW }));
  assert.deepEqual(none.result, { error: { code: "no-step" } });
});

test("deleteNotebookEntry: deletes only this user's note and needs exactly one row back", async () => {
  const notes = [
    { id: "n1", user_id: U, step_id: "s1-1", body: "mine" },
    { id: "n2", user_id: "u2", step_id: "s1-1", body: "theirs" },
  ];
  const { db, client } = world({ notes });
  const other = await quiet(() => deleteNotebookEntry(client, U, "n2"));
  assert.deepEqual(other.result, { error: { code: "no-row" } });
  assert.equal(db.rows("skill_notebook_entries").length, 2, "someone else's note is untouched");
  const mine = await deleteNotebookEntry(client, U, "n1");
  assert.deepEqual(mine, { data: { id: "n1" } });
  assert.deepEqual(db.rows("skill_notebook_entries").map((n) => n.id), ["n2"]);
  const del = db.writes().filter((w) => w.op === "delete").at(-1)!;
  assert.deepEqual(del.filters, [["eq", "id", "n1"], ["eq", "user_id", U]]);
  assert.deepEqual((await quiet(() => deleteNotebookEntry(client, U, ""))).result, { error: { code: "no-entry" } });
  assert.deepEqual((await quiet(() => deleteNotebookEntry(client, "", "n1"))).result, { error: { code: "no-user" } });
  // deleting needs no month check: a note is always the user's to remove
  const lapsed = world({ notes: [{ id: "n3", user_id: U, step_id: "s5-1", body: "x" }] });
  assert.deepEqual(await deleteNotebookEntry(lapsed.client, U, "n3"), { data: { id: "n3" } });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

function reviewWorld() {
  return world({
    reviews: [
      review("s1-1", 0, NOW - 2 * D),
      review("s1-2", 1, NOW - 1 * D),
      review("s5-1", 0, NOW - 3 * D),
      review("s1-3", 0, NOW + 1 * D),
      review("s1-4", 2, NOW - 5 * D, { retired: true }),
      { ...review("s1-5", 0, NOW - 4 * D), user_id: "u2" },
    ],
  });
}

test("getDueReviews: due items only, oldest first; a free user does not get locked-month items; pro does", async () => {
  const free = await getDueReviews(reviewWorld().client, U, "free", NOW);
  assert.ok("data" in free);
  assert.deepEqual(free.data.items.map((i) => i.stepId), ["s1-1", "s1-2"]);
  assert.deepEqual(free.data.items[0], {
    stepId: "s1-1", month: 1, stage: 0, dueAt: iso(NOW - 2 * D), learn_title: "Learn 1.1", prove_question: "Question 1.1", prove_options: ["opt-a", "opt-b", "opt-c"],
  });
  const pro = await getDueReviews(reviewWorld().client, U, "pro", NOW);
  assert.ok("data" in pro);
  assert.deepEqual(pro.data.items.map((i) => i.stepId), ["s5-1", "s1-1", "s1-2"]);
});

test("getDueReviews: no answer in the output or in the columns asked for; nothing due is an empty list", async () => {
  const w = reviewWorld();
  const r = await getDueReviews(w.client, U, "pro", NOW);
  assert.doesNotMatch(JSON.stringify(r), GRADING_WORDS);
  for (const cols of w.db.selects("skill_steps")) assert.doesNotMatch(cols, /prove_correct|prove_explanation/);
  const empty = await getDueReviews(world().client, U, "pro", NOW);
  assert.deepEqual(empty, { data: { items: [] } });
  assert.deepEqual((await quiet(() => getDueReviews(world().client, U, "pro", Number.NaN))).result, { error: { code: "bad-time" } });
});

test("answerReview: right moves up a stage, wrong goes back to stage 0, right at the last stage retires", async () => {
  const up = world({ reviews: [review("s1-1", 1, NOW - H)] });
  const r1 = await answerReview(up.client, U, "free", "s1-1", CORRECT[1]!, NOW);
  assert.deepEqual(r1, { data: { correct: true, retired: false, stage: 2, dueAt: iso(NOW + 7 * D), explanation: "EXPLAIN-1-1" } });
  assert.deepEqual(up.db.rows("skill_review_items")[0], review("s1-1", 2, NOW + 7 * D));

  const wrong = world({ reviews: [review("s1-1", 3, NOW - H)] });
  const r2 = await answerReview(wrong.client, U, "free", "s1-1", wrongOf(1), NOW);
  assert.deepEqual(r2, { data: { correct: false, retired: false, stage: 0, dueAt: iso(NOW + D), explanation: "EXPLAIN-1-1" } });
  assert.deepEqual(wrong.db.rows("skill_review_items")[0], review("s1-1", 0, NOW + D, { last_correct: false }));

  const last = world({ reviews: [review("s1-1", 3, NOW - H)] });
  const r3 = await answerReview(last.client, U, "free", "s1-1", CORRECT[1]!, NOW);
  assert.deepEqual(r3, { data: { correct: true, retired: true, stage: 3, dueAt: null, explanation: "EXPLAIN-1-1" } });
  assert.equal(last.db.rows("skill_review_items")[0]!.retired, true);
});

test("answerReview: not due, retired, missing, bad answer, and a locked month write nothing", async () => {
  const w = world({ reviews: [review("s1-1", 1, NOW + H), review("s1-2", 1, NOW - H, { retired: true }), review("s5-1", 0, NOW - H)] });
  const run = async (tier: "free" | "pro", step: string, idx: number) => (await quiet(() => answerReview(w.client, U, tier, step, idx, NOW))).result;
  assert.deepEqual(await run("free", "s1-1", CORRECT[1]!), { error: { code: "not-due" } });
  assert.deepEqual(await run("free", "s1-2", CORRECT[2]!), { error: { code: "retired" } });
  assert.deepEqual(await run("free", "s1-3", CORRECT[3]!), { error: { code: "no-review" } });
  assert.deepEqual(await run("free", "s1-1", 7), { error: { code: "bad-answer" } });
  assert.deepEqual(await run("free", "s5-1", CORRECT[1]!), { locked: true, month: 2, teaser: "Teaser 2" });
  assert.equal(w.db.writes().length, 0);
  assert.ok("data" in (await run("pro", "s5-1", CORRECT[1]!)));
});

// ---------------------------------------------------------------------------
// Weekly test
// ---------------------------------------------------------------------------

const rightAnswers = (): TestAnswer[] => [1, 2, 3, 4, 5].map((d) => ({ itemId: `t1-${d}`, chosenIndex: TEST_CORRECT[d]! }));
const withDayWrong = (days: number[]): TestAnswer[] =>
  rightAnswers().map((a, i) => (days.includes(i + 1) ? { ...a, chosenIndex: (a.chosenIndex + 1) % 3 } : a));

test("getWeeklyTest: until all 5 steps are completed it returns { notReady: true } and nothing else", async () => {
  for (const completed of [[], STEPS_W1.slice(0, 4), ["s1-1", "s1-2", "s1-3", "s1-4", "s5-1"]]) {
    const { db, client } = world({ completed });
    const r = await getWeeklyTest(client, U, "w1", "free");
    assert.deepEqual(r, { notReady: true });
    assert.equal(db.selects("skill_test_items").length, 0, "no question is read before the week is done");
  }
  // a week with fewer than 5 steps can never be ready; another user's completed steps do not count
  assert.deepEqual(await getWeeklyTest(world({ completed: ["s2-1", "s2-2", "s2-3"] }).client, U, "w2", "free"), { notReady: true });
  const theirs = world({ extra: (t) => { for (const id of STEPS_W1) t.skill_step_progress!.push({ user_id: "u2", step_id: id, completed_at: iso(NOW) }); } });
  assert.deepEqual(await getWeeklyTest(theirs.client, U, "w1", "free"), { notReady: true });
  // a step with attempts but no completed_at is not completed
  const started = world({ completed: STEPS_W1.slice(0, 4), extra: (t) => { t.skill_step_progress!.push({ user_id: U, step_id: "s1-5", prove_attempts: 2, completed_at: null }); } });
  assert.deepEqual(await getWeeklyTest(started.client, U, "w1", "free"), { notReady: true });
});

test("getWeeklyTest: when the week is done it returns one question per day, with no answers", async () => {
  const { db, client } = world({ completed: STEPS_W1 });
  const r = await getWeeklyTest(client, U, "w1", "free");
  assert.ok("data" in r);
  assert.deepEqual(r.data.questions.map((q) => [q.itemId, q.day]), [["t1-1", 1], ["t1-2", 2], ["t1-3", 3], ["t1-4", 4], ["t1-5", 5]]);
  assert.deepEqual(Object.keys(r.data.questions[0]!).sort(), ["day", "itemId", "options", "question"]);
  assert.doesNotMatch(JSON.stringify(r), GRADING_WORDS);
  assert.ok(!JSON.stringify(r).includes("TEXPLAIN"));
  for (const cols of db.selects("skill_test_items")) assert.doesNotMatch(cols, /correct|explanation/);
});

test("getWeeklyTest: a locked month is checked first; an unknown week is an error; a week missing a day's question is an error", async () => {
  const locked = world({ completed: ["s5-1", "s5-2", "s5-3", "s5-4", "s5-5"] });
  assert.deepEqual(await getWeeklyTest(locked.client, U, "w5", "free"), { locked: true, month: 2, teaser: "Teaser 2" });
  assert.equal(locked.db.selects("skill_test_items").length, 0);
  assert.equal(locked.db.selects("skill_step_progress").length, 0, "locked comes before anything about the user's progress");
  assert.ok("data" in (await getWeeklyTest(locked.client, U, "w5", "pro")));
  assert.deepEqual((await quiet(() => getWeeklyTest(world().client, U, "nope", "free"))).result, { error: { code: "no-week" } });
  const gap = world({ completed: STEPS_W1, extra: (t) => { t.skill_test_items = t.skill_test_items!.filter((i) => !(i.week_id === "w1" && i.covers_day === 4)); } });
  assert.deepEqual((await quiet(() => getWeeklyTest(gap.client, U, "w1", "free"))).result, { error: { code: "no-test" } });
});

test("saveTestResult: refuses anything but exactly 5 answers, before the database is touched", async () => {
  const { db, client } = world({ completed: STEPS_W1 });
  const four = rightAnswers().slice(0, 4);
  const six = [...rightAnswers(), { itemId: "t1-6", chosenIndex: 0 }];
  for (const bad of [four, six, [], undefined as unknown as TestAnswer[], null as unknown as TestAnswer[], "12345" as unknown as TestAnswer[]]) {
    const out = await quiet(() => saveTestResult(client, U, "free", "w1", bad, { now: NOW }));
    assert.deepEqual(out.result, { error: { code: "answer-count" } });
  }
  assert.equal(db.log.length, 0, "no query of any kind");
});

test("saveTestResult: not ready until all 5 steps are completed; locked month; both write nothing", async () => {
  const early = world({ completed: STEPS_W1.slice(0, 4) });
  assert.deepEqual(await saveTestResult(early.client, U, "free", "w1", rightAnswers(), { now: NOW }), { notReady: true });
  assert.equal(early.db.writes().length, 0);
  assert.equal(early.db.selects("skill_test_items").length, 0);
  const locked = world({ completed: ["s5-1", "s5-2", "s5-3", "s5-4", "s5-5"] });
  const answers5 = [1, 2, 3, 4, 5].map((d) => ({ itemId: `t5-${d}`, chosenIndex: TEST_CORRECT[d]! }));
  assert.deepEqual(await saveTestResult(locked.client, U, "free", "w5", answers5, { now: NOW }), { locked: true, month: 2, teaser: "Teaser 2" });
  assert.equal(locked.db.writes().length, 0);
  assert.ok("data" in (await saveTestResult(locked.client, U, "pro", "w5", answers5, { now: NOW })));
});

test("saveTestResult: duplicates, questions from elsewhere, out-of-range and non-integer answers write nothing", async () => {
  const cases: TestAnswer[][] = [
    [...rightAnswers().slice(0, 4), { itemId: "t1-1", chosenIndex: 0 }], // a duplicate
    [...rightAnswers().slice(0, 4), { itemId: "t1-6", chosenIndex: 0 }], // an extra question that is not in the test
    [...rightAnswers().slice(0, 4), { itemId: "t5-5", chosenIndex: 0 }], // a question from another week
    [...rightAnswers().slice(0, 4), { itemId: "t1-5", chosenIndex: 3 }], // out of range
    [...rightAnswers().slice(0, 4), { itemId: "t1-5", chosenIndex: -1 }],
    [...rightAnswers().slice(0, 4), { itemId: "t1-5", chosenIndex: 1.5 }],
    [...rightAnswers().slice(0, 4), { itemId: "", chosenIndex: 1 }],
    [...rightAnswers().slice(0, 4), null as unknown as TestAnswer],
  ];
  for (const answers of cases) {
    const { db, client } = world({ completed: STEPS_W1 });
    const out = await quiet(() => saveTestResult(client, U, "free", "w1", answers, { now: NOW }));
    assert.deepEqual(out.result, { error: { code: "bad-answer" } });
    assert.equal(db.writes().length, 0);
  }
});

test("saveTestResult: grades with the database's answers and writes ONE row; the caller cannot supply the right answer", async () => {
  const cases: Array<[TestAnswer[], number, boolean, number[]]> = [
    [rightAnswers(), 5, true, []],
    [withDayWrong([3]), 4, true, [3]],
    [withDayWrong([2, 5]), 3, false, [2, 5]],
    [withDayWrong([1, 2, 3, 4, 5]), 0, false, [1, 2, 3, 4, 5]],
  ];
  for (const [answers, score, passed, weakDays] of cases) {
    const { db, client } = world({ completed: STEPS_W1 });
    const r = await saveTestResult(client, U, "free", "w1", answers, { now: NOW });
    assert.ok("data" in r);
    assert.deepEqual({ ...r.data, id: "x" }, { id: "x", score, total: 5, passed, weakDays });
    assert.equal(db.writes().length, 1);
    assert.equal(db.writes()[0]!.op, "insert");
    assert.deepEqual(db.rows("skill_test_results")[0], { id: r.data.id, user_id: U, week_id: "w1", score, total: 5, passed, weak_days: weakDays, taken_at: iso(NOW) });
    assert.doesNotMatch(JSON.stringify(r), GRADING_WORDS);
  }
  // a hostile caller sends its own "correctIndex": it is ignored
  const { client } = world({ completed: STEPS_W1 });
  const cheat = withDayWrong([1, 2, 3, 4, 5]).map((a) => ({ ...a, correctIndex: a.chosenIndex }));
  const r = await saveTestResult(client, U, "free", "w1", cheat, { now: NOW });
  assert.ok("data" in r && r.data.score === 0);
});

test("saveTestResult: a failed insert is never retried", async () => {
  const { db, client } = world({ completed: STEPS_W1 });
  db.faults.push({ table: "skill_test_results", op: "insert", kind: "error" });
  const out = await quiet(() => saveTestResult(client, U, "free", "w1", rightAnswers(), { now: NOW }));
  assert.deepEqual(out.result, { error: { code: "42501" } });
  assert.equal(db.writes().length, 1);
  assert.equal(db.rows("skill_test_results").length, 0);
});

// ---------------------------------------------------------------------------
// Every writer: 0 rows, 2 rows, an error, a read-back that does not match
// ---------------------------------------------------------------------------

type Writer = {
  name: string;
  table: string;
  op: Op;
  mutate: (r: Row) => Row;
  setup: () => { db: FakeDb; run: () => Promise<unknown> };
};

const NOTE_BODY = "PRIVATE-NOTE-BODY about my sleep";

const WRITERS: Writer[] = [
  {
    name: "recordProve (wrong answer: progress)", table: "skill_step_progress", op: "upsert", mutate: (r) => ({ ...r, prove_attempts: 9 }),
    setup: () => { const w = world(); return { db: w.db, run: () => recordProve(w.client, U, "free", "s1-1", wrongOf(1), { now: NOW }) }; },
  },
  {
    name: "recordProve (right answer: review item)", table: "skill_review_items", op: "upsert", mutate: (r) => ({ ...r, stage: 2 }),
    setup: () => { const w = world(); return { db: w.db, run: () => recordProve(w.client, U, "free", "s1-1", CORRECT[1]!, { now: NOW }) }; },
  },
  {
    name: "recordProve (right answer: progress)", table: "skill_step_progress", op: "upsert", mutate: (r) => ({ ...r, prove_attempts: 9 }),
    setup: () => { const w = world(); return { db: w.db, run: () => recordProve(w.client, U, "free", "s1-1", CORRECT[1]!, { now: NOW }) }; },
  },
  {
    name: "recordProve (right answer: enrollment)", table: "skill_enrollments", op: "upsert", mutate: (r) => ({ ...r, pack_id: "other" }),
    setup: () => { const w = world(); return { db: w.db, run: () => recordProve(w.client, U, "free", "s1-1", CORRECT[1]!, { now: NOW }) }; },
  },
  {
    name: "saveNotebookEntry", table: "skill_notebook_entries", op: "upsert", mutate: (r) => ({ ...r, body: String(r.body).slice(0, 3) }),
    setup: () => { const w = world(); return { db: w.db, run: () => saveNotebookEntry(w.client, U, "free", "s1-1", NOTE_BODY, { now: NOW }) }; },
  },
  {
    name: "deleteNotebookEntry", table: "skill_notebook_entries", op: "delete", mutate: (r) => ({ ...r, id: "other" }),
    setup: () => { const w = world({ notes: [{ id: "n1", user_id: U, step_id: "s1-1", body: NOTE_BODY }] }); return { db: w.db, run: () => deleteNotebookEntry(w.client, U, "n1") }; },
  },
  {
    name: "answerReview", table: "skill_review_items", op: "update", mutate: (r) => ({ ...r, stage: 3 }),
    setup: () => { const w = world({ reviews: [review("s1-1", 1, NOW - H)] }); return { db: w.db, run: () => answerReview(w.client, U, "free", "s1-1", CORRECT[1]!, NOW) }; },
  },
  {
    name: "saveTestResult", table: "skill_test_results", op: "insert", mutate: (r) => ({ ...r, score: 5 }),
    setup: () => { const w = world({ completed: STEPS_W1 }); return { db: w.db, run: () => saveTestResult(w.client, U, "free", "w1", withDayWrong([2]), { now: NOW }) }; },
  },
];

const EXPECTED_CODE: Record<Kind, string> = { error: "42501", zero: "no-row", two: "no-row", mismatch: "mismatch" };

for (const writer of WRITERS) {
  for (const kind of ["error", "zero", "two", "mismatch"] as const) {
    test(`writer ${writer.name}: ${kind === "error" ? "a database error" : kind === "zero" ? "0 rows back" : kind === "two" ? "2 rows back" : "a read-back that does not match"} is an error`, async () => {
      const { db, run } = writer.setup();
      // sanity: with no fault the same call succeeds
      assert.ok("data" in ((await run()) as object), "the call works when the database behaves");
      const fresh = writer.setup();
      fresh.db.faults.push({ table: writer.table, op: writer.op, kind, mutate: writer.mutate });
      const out = await quiet(() => fresh.run());
      assert.deepEqual(out.result, { error: { code: EXPECTED_CODE[kind] } });
      assert.equal(out.lines.length, 1);
      assert.ok(db.writes().length >= 1);
    });
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

test("a spy on the console: only the function name and a short code are ever logged, never a note, question or answer", async () => {
  const cap = capture();
  const results: unknown[] = [];
  try {
    for (const writer of WRITERS) {
      for (const kind of ["error", "zero", "two", "mismatch"] as const) {
        const { db, run } = writer.setup();
        db.faults.push({ table: writer.table, op: writer.op, kind, mutate: writer.mutate });
        results.push(await run());
      }
    }
    // read errors, and a client that throws an error whose message holds private text
    for (const table of ["skill_packs", "skill_months", "skill_weeks", "skill_steps", "skill_step_progress", "skill_review_items", "skill_test_items"]) {
      for (const fn of [
        (c: SupabaseClient) => getPackMap(c, "pro"),
        (c: SupabaseClient) => getTodayStep(c, U, "pro", { now: NOW }),
        (c: SupabaseClient) => getDueReviews(c, U, "pro", NOW),
        (c: SupabaseClient) => getWeeklyTest(c, U, "w1", "pro"),
      ]) {
        const w = world({ completed: STEPS_W1, reviews: [review("s1-1", 0, NOW - D)] });
        w.db.faults.push({ table, op: "select", kind: "error" });
        results.push(await fn(w.client));
        const t = world({ completed: STEPS_W1, reviews: [review("s1-1", 0, NOW - D)] });
        t.db.throwOnTable = table;
        results.push(await fn(t.client));
      }
    }
  } finally {
    cap.restore();
  }
  assert.ok(cap.lines.length > 40, "the spy saw the errors");
  for (const line of cap.lines) {
    assert.match(line, /^\[skills-server\] (getPackMap|getTodayStep|recordProve|saveNotebookEntry|deleteNotebookEntry|getDueReviews|answerReview|getWeeklyTest|saveTestResult) error code=[A-Za-z0-9_.:-]{1,20}$/);
  }
  const errorsOnly = results.filter((r) => typeof r === "object" && r !== null && "error" in r);
  assert.ok(errorsOnly.length > 40);
  const everything = cap.lines.join("\n") + JSON.stringify(errorsOnly);
  for (const secret of ["PRIVATE-DB-MESSAGE", "PRIVATE-NOTE-BODY", "my sleep", "Question 1", "Do 1.", "Body 1", "Hint 1", "EXPLAIN", "TQ-", "opt-"]) {
    assert.ok(!everything.includes(secret), `"${secret}" must not be logged or returned in an error`);
  }
});

test("a thrown error becomes the code 'exception', and is logged by code only", async () => {
  const w = world();
  w.db.throwOnTable = "skill_packs";
  const out = await quiet(() => getPackMap(w.client, "free"));
  assert.deepEqual(out.result, { error: { code: "exception" } });
  assert.deepEqual(out.lines, ["[skills-server] getPackMap error code=exception"]);
});

// ---------------------------------------------------------------------------
// Source checks
// ---------------------------------------------------------------------------

const source = readFileSync(fileURLToPath(new URL("./skills-server.ts", import.meta.url)), "utf8");
/** The same file with its comments removed (the file has no URLs in strings, so this is safe). */
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("source: loadable by Node directly, never logs anything but errors, never selects *", () => {
  assert.doesNotMatch(code, /from "@\//, 'no "@/" imports');
  assert.doesNotMatch(code, /server-only/);
  assert.doesNotMatch(code, /createSupabaseServiceClient/, "the client is passed in");
  assert.doesNotMatch(code, /console\.(log|warn|info|debug)\(/);
  assert.equal(code.match(/console\.error\(/g)?.length, 1, "one place logs, and it logs a code");
  assert.doesNotMatch(code, /\.select\(\s*(["']\*["'])?\s*\)/, "every read names its columns");
});

test("source: the grading columns are selected only by the functions that grade", () => {
  const readPaths = ["getTodayStep", "getDueReviews", "getWeeklyTest", "getPackMap"];
  for (const name of readPaths) {
    const start = source.indexOf(`export async function ${name}(`);
    const next = source.indexOf("\nexport ", start + 10);
    const body = source.slice(start, next === -1 ? undefined : next);
    assert.doesNotMatch(body, /prove_correct|prove_explanation|\bcorrect\b,|"[^"]*\bexplanation\b/, `${name} must not select an answer column`);
  }
});

test("source: saveNotebookEntry carries the safety-order comment and does not run the safety checks itself", () => {
  const start = source.indexOf("export async function saveNotebookEntry(");
  const comment = source.slice(source.lastIndexOf("/**", start), start);
  assert.match(comment, /ONLY AFTER the safety check has passed/);
  for (const name of ["gentleGate", "ruleFloorLevel", "runSafetyClassify"]) assert.match(comment, new RegExp(name));
  assert.doesNotMatch(code, /import[^;]*safety/i, "this file imports nothing from the safety code");
  assert.doesNotMatch(code, /(gentleGate|ruleFloorLevel|runSafetyClassify|recordFlag)\(/, "and calls none of it");
});

test("source: the user-facing and logged strings never say 'missed' or 'failed' (the wording test scans this file too)", () => {
  const strings = [...code.matchAll(/"([^"\n]*)"|`([^`\n]*)`/g)].map((m) => m[1] ?? m[2] ?? "");
  assert.ok(strings.length > 50);
  for (const s of strings) assert.doesNotMatch(s, /missed|failed/i, s);
});

// ---------------------------------------------------------------------------
// getHome and getHandout
// ---------------------------------------------------------------------------

const ANSWER_WORDS = /prove_correct|prove_explanation|prove_options|prove_question|\bcorrect\b|explanation|EXPLAIN-|learn_body|do_prompt|hint|Question \d|Body \d/i;

test("getHome: a brand-new user has no progress and the next step is week 1, day 1, open", async () => {
  const { client } = world();
  const r = await getHome(client, U, "free", { now: NOW });
  assert.ok("data" in r);
  assert.equal(r.data.packId, "p1");
  assert.equal(r.data.packTitle, "Pack");
  assert.equal(r.data.hasProgress, false);
  assert.equal(r.data.completedSteps, 0);
  assert.equal(r.data.totalSteps, 13);
  assert.equal(r.data.dueReviews, 0);
  assert.deepEqual(r.data.next, { open: true, month: 1, weekNo: 1, dayNo: 1 });
  // a free user: progress only for the open month (weeks 1 and 2), nothing for locked week 5
  assert.deepEqual(r.data.progress, [{ weekNo: 1, doneDays: [] }, { weekNo: 2, doneDays: [] }]);
});

test("getHome: progress, the 20-hour wait and the due-review count", async () => {
  const done = ["s1-1", "s1-2"];
  const { client } = world({
    completed: done,
    lastNewStepAt: NOW - 2 * H,
    reviews: [review("s1-1", 0, NOW - H), review("s1-2", 0, NOW + D)],
  });
  const r = await getHome(client, U, "free", { now: NOW });
  assert.ok("data" in r);
  assert.equal(r.data.hasProgress, true);
  assert.equal(r.data.completedSteps, 2);
  assert.equal(r.data.dueReviews, 1, "only the one that is due now");
  assert.ok("open" in r.data.next && r.data.next.open === false);
  assert.deepEqual({ ...r.data.next, opensAt: "x" }, { open: false, month: 1, weekNo: 1, dayNo: 3, opensAt: "x" });
  assert.deepEqual(r.data.progress[0], { weekNo: 1, doneDays: [1, 2] });
  const later = await getHome(world({ completed: done, lastNewStepAt: NOW - 30 * H }).client, U, "free", { now: NOW });
  assert.ok("data" in later && "open" in later.data.next && later.data.next.open === true);
});

test("getHome: a free user whose next step is in a locked month gets exactly { locked, month, teaser } for it", async () => {
  const done = [...STEPS_W1, ...STEPS_W2];
  const { client } = world({ completed: done, lastNewStepAt: NOW - 100 * H });
  const r = await getHome(client, U, "free", { now: NOW });
  assert.ok("data" in r);
  assert.deepEqual(r.data.next, { locked: true, month: 2, teaser: "Teaser 2" });
  assert.deepEqual(Object.keys(r.data.next).sort(), ["locked", "month", "teaser"]);
  assert.ok(!r.data.progress.some((p) => p.weekNo === 5), "no progress entry for a locked month");
  const text = JSON.stringify(r);
  for (const secret of ["LOCKED-WEEK-TITLE", "LOCKED-GOAL", "LOCKED-HANDOUT", "Learn 5", "EXPLAIN"]) assert.ok(!text.includes(secret), secret);
  // the same user on Pro is simply open
  const pro = await getHome(world({ completed: done, lastNewStepAt: NOW - 100 * H }).client, U, "pro", { now: NOW });
  assert.ok("data" in pro && "open" in pro.data.next && pro.data.next.open === true && pro.data.next.month === 2);
  assert.ok(pro.data.progress.some((p) => p.weekNo === 5));
});

test("getHome: everything done says done; another user's progress does not count", async () => {
  const all = [...STEPS_W1, ...STEPS_W2, "s5-1", "s5-2", "s5-3", "s5-4", "s5-5"];
  const r = await getHome(world({ completed: all }).client, U, "pro", { now: NOW });
  assert.ok("data" in r && "done" in r.data.next);
  const other = await getHome(world({ completed: all }).client, "someone-else", "pro", { now: NOW });
  assert.ok("data" in other && other.data.hasProgress === false);
});

test("getHome: no answer, explanation, question, body or handout text in the output or in the columns asked for", async () => {
  const { db, client } = world({ completed: ["s1-1"], reviews: [review("s1-1", 0, NOW - H)] });
  const r = await getHome(client, U, "pro", { now: NOW });
  assert.ok("data" in r);
  assert.doesNotMatch(JSON.stringify(r), ANSWER_WORDS);
  assert.doesNotMatch(JSON.stringify(r), /HANDOUT/);
  const asked = db.log.filter((l) => l.op === "select").map((l) => `${l.table}: ${l.cols}`);
  for (const a of asked) assert.doesNotMatch(a, /prove_correct|prove_explanation|handout_md|learn_body|do_prompt|\*/, a);
  assert.equal(db.writes().length, 0, "read only");
});

test("getHome: a bad user, no pack and a database error return a code only", async () => {
  const bad = await quiet(() => getHome(world().client, "", "free", { now: NOW }));
  assert.deepEqual(bad.result, { error: { code: "no-user" } });
  const none = await quiet(() => getHome(world({ extra: (t) => { t.skill_packs = []; } }).client, U, "free", { now: NOW }));
  assert.deepEqual(none.result, { error: { code: "no-pack" } });
  const w = world();
  w.db.faults.push({ table: "skill_step_progress", op: "select", kind: "error" });
  const err = await quiet(() => getHome(w.client, U, "free", { now: NOW }));
  assert.deepEqual(err.result, { error: { code: "42501" } });
  assert.deepEqual(err.lines, ["[skills-server] getHome error code=42501"]);
  assert.ok(!JSON.stringify(err).includes("PRIVATE-DB-MESSAGE"));
});

test("getHandout: an open week returns its handout and sources, with no step, question or answer", async () => {
  const { db, client } = world();
  const r = await getHandout(client, "free", 1);
  assert.ok("data" in r);
  assert.deepEqual(r.data, {
    packId: "p1", weekId: "w1", weekNo: 1, month: 1, title: "Week one", goalLine: "Goal one", handoutMd: "HANDOUT-ONE",
    sources: [{ ref: "S1", title: "Source 1", publisher: null, year: 2020, url: "https://example.test/secret-url" }],
  });
  assert.doesNotMatch(JSON.stringify(r), ANSWER_WORDS);
  assert.equal(db.selects("skill_steps").length, 0);
  assert.equal(db.selects("skill_test_items").length, 0);
  assert.equal(db.writes().length, 0);
  const cols = db.log.filter((l) => l.op === "select").map((l) => l.cols).join(" | ");
  assert.doesNotMatch(cols, /verified|prove_|\*/);
});

test("getHandout: a locked week returns exactly { locked, month, teaser } and its text is never even selected", async () => {
  const { db, client } = world();
  const r = await getHandout(client, "free", 5);
  assert.deepEqual(r, { locked: true, month: 2, teaser: "Teaser 2" });
  assert.deepEqual(Object.keys(r).sort(), ["locked", "month", "teaser"]);
  const cols = db.log.filter((l) => l.op === "select").map((l) => `${l.table}: ${l.cols}`);
  assert.ok(!cols.some((c) => /handout_md|goal_line|title,|skill_sources|skill_steps/.test(c.replace("skill_months: month_no, title, teaser_line, is_free", ""))), cols.join(" | "));
  assert.equal(db.selects("skill_sources").length, 0);
  // the same week for Pro is open
  const pro = await getHandout(world().client, "pro", 5);
  assert.ok("data" in pro && pro.data.handoutMd === "LOCKED-HANDOUT");
  // a database flag that says "not free" keeps even week 1 locked
  const w = world({ extra: (t) => { t.skill_months![0]!.is_free = false; } });
  assert.deepEqual(await getHandout(w.client, "free", 1), { locked: true, month: 1, teaser: "Teaser 1" });
  // a bad tier is free
  assert.deepEqual(await getHandout(world().client, "gold" as never, 5), { locked: true, month: 2, teaser: "Teaser 2" });
});

test("getHandout: only http(s) links come through; a missing week, a bad number and a database error are codes", async () => {
  const w = world({
    extra: (t) => {
      t.skill_sources!.push(
        { id: "x1", week_id: "w1", ref: "S2", title: "Bad", author_or_publisher: "Pub", year: null, url: "javascript:alert(1)" },
        { id: "x2", week_id: "w1", ref: "S3", title: "Data", author_or_publisher: "  ", year: 1999, url: "data:text/html,hi" },
      );
    },
  });
  const r = await getHandout(w.client, "free", 1);
  assert.ok("data" in r);
  assert.deepEqual(r.data.sources.map((s) => [s.ref, s.url, s.publisher, s.year]), [
    ["S1", "https://example.test/secret-url", null, 2020],
    ["S2", null, "Pub", null],
    ["S3", null, null, 1999],
  ]);
  for (const n of [0, 25, 1.5, NaN, -1]) {
    assert.deepEqual((await quiet(() => getHandout(world().client, "free", n))).result, { error: { code: "no-week" } }, String(n));
  }
  assert.deepEqual((await quiet(() => getHandout(world().client, "free", 3))).result, { error: { code: "no-week" } });
  const f = world();
  f.db.faults.push({ table: "skill_sources", op: "select", kind: "error" });
  const err = await quiet(() => getHandout(f.client, "free", 1));
  assert.deepEqual(err.result, { error: { code: "42501" } });
  assert.deepEqual(err.lines, ["[skills-server] getHandout error code=42501"]);
});

test("source: getHome and getHandout never select an answer column and never write", () => {
  for (const name of ["getHome", "getHandout"]) {
    const start = source.indexOf(`export async function ${name}(`);
    const next = source.indexOf("\nexport ", start + 10);
    const body = source.slice(start, next === -1 ? undefined : next);
    assert.doesNotMatch(body, /prove_correct|prove_explanation|prove_options|prove_question|learn_body|do_prompt|\bhint\b/, `${name} must not select step content`);
    assert.doesNotMatch(body, /\.(insert|upsert|update|delete)\(/, `${name} is read only`);
  }
  const handout = source.slice(source.indexOf("export async function getHandout("));
  assert.ok(handout.indexOf("lockedResult(month)") < handout.indexOf("handout_md"), "the month is checked before the handout text is selected");
});
