// Run with: node --test src/lib/skills/route-helpers.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Tests for the shared route pieces: result mapping, the plan read, input checks and the notebook step-access
// check. No database, no network: a small in-memory fake stands in for the client.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asId,
  asIndex,
  badRequest,
  checkStepAccess,
  errorResponse,
  lockedResponse,
  mapResult,
  notFound,
  openService,
  plainForbidden,
  readBody,
  readTier,
  serverError,
  shortCode,
  stepAccessProblem,
} from "./route-helpers.ts";

const text = async (r: Response) => (await r.text());
const jsonOf = async (r: Response) => JSON.parse(await r.text()) as unknown;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

test("the switch-off answer is a plain 404 with no body", async () => {
  const r = notFound();
  assert.equal(r.status, 404);
  assert.equal(await text(r), "");
});

test("the not-opened answer is a plain 403 with no body", async () => {
  const r = plainForbidden();
  assert.equal(r.status, 403);
  assert.equal(await text(r), "");
});

test("mapResult: locked -> 403 with the locked body only", async () => {
  const r = mapResult({ locked: true, month: 2, teaser: "Month 2 teaser", extra: "secret" } as never);
  assert.equal(r.status, 403);
  assert.deepEqual(await jsonOf(r), { locked: true, month: 2, teaser: "Month 2 teaser" });
});

test("mapResult: notReady -> 200 with notReady only", async () => {
  const r = mapResult({ notReady: true });
  assert.equal(r.status, 200);
  assert.deepEqual(await jsonOf(r), { notReady: true });
});

test("mapResult: an error -> 500 with only a short code, never database text", async () => {
  const r = mapResult({ error: { code: "no-row" } });
  assert.equal(r.status, 500);
  assert.deepEqual(await jsonOf(r), { error: "no-row" });
  const bad = mapResult({ error: { code: "PRIVATE-DB-MESSAGE: relation x does not exist, note text" } });
  assert.equal(bad.status, 500);
  assert.deepEqual(await jsonOf(bad), { error: "unknown" });
  assert.deepEqual(await jsonOf(serverError("x".repeat(50))), { error: "unknown" });
  assert.deepEqual(await jsonOf(badRequest("empty")), { error: "empty" });
});

test("mapResult: no-entry and no-step are a 404 with { error: code }; every other code stays a 500", async () => {
  for (const code of ["no-entry", "no-step"]) {
    for (const r of [mapResult({ error: { code } }), errorResponse(code)]) {
      assert.equal(r.status, 404, code);
      assert.deepEqual(await jsonOf(r), { error: code });
      assert.equal(r.headers.get("Cache-Control"), "no-store");
    }
  }
  for (const code of ["no-row", "no-week", "no-pack", "no-month", "mismatch", "exception", "23505"]) {
    const r = mapResult({ error: { code } });
    assert.equal(r.status, 500, code);
    assert.deepEqual(await jsonOf(r), { error: code });
  }
  // a look-alike is not a not-found
  assert.equal(mapResult({ error: { code: "no-step " } }).status, 500);
});

test("mapResult: success -> 200 with the data exactly as the server function returned it", async () => {
  const data = { correct: true, alreadyDone: false, attempts: 1, explanation: "Because." };
  const r = mapResult({ data });
  assert.equal(r.status, 200);
  assert.deepEqual(await jsonOf(r), data);
});

test("every response is marked no-store", () => {
  for (const r of [notFound(), plainForbidden(), mapResult({ notReady: true }), serverError("x"), lockedResponse({ locked: true, month: 2, teaser: null })]) {
    assert.equal(r.headers.get("Cache-Control"), "no-store");
  }
});

test("shortCode keeps short codes and replaces anything else", () => {
  assert.equal(shortCode("no-step"), "no-step");
  assert.equal(shortCode("23505"), "23505");
  assert.equal(shortCode("has spaces"), "unknown");
  assert.equal(shortCode(undefined), "unknown");
  assert.equal(shortCode(""), "unknown");
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

test("asId accepts only a UUID; asIndex accepts only a whole number from 0 to 99", () => {
  assert.equal(asId("0b3b3a3a-5c3c-4d1d-8e2e-1f1f1f1f1f1f"), "0b3b3a3a-5c3c-4d1d-8e2e-1f1f1f1f1f1f");
  for (const v of [undefined, null, 5, "", "abc", "0b3b3a3a-5c3c-4d1d-8e2e-1f1f1f1f1f1fX", { a: 1 }]) assert.equal(asId(v), null);
  assert.equal(asIndex(0), 0);
  assert.equal(asIndex(3), 3);
  for (const v of [-1, 1.5, NaN, Infinity, "1", null, undefined, 100, 1e9, [1]]) assert.equal(asIndex(v), null);
});

test("readBody returns a plain object or null (bad JSON, arrays, numbers, null)", async () => {
  const req = (b: string) => new Request("http://x.test/", { method: "POST", body: b });
  assert.deepEqual(await readBody(req('{"a":1}')), { a: 1 });
  for (const b of ["", "not json", "[1]", "5", "null", '"s"']) assert.equal(await readBody(req(b)), null);
});

test("openService returns the client, or a 500 with a short code when it cannot be made", async () => {
  const client = {} as SupabaseClient;
  assert.equal(openService(() => client), client);
  const before = console.error;
  console.error = () => {};
  try {
    const r = openService(() => {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY secret-ish text");
    });
    assert.ok(r instanceof Response);
    assert.equal((r as Response).status, 500);
    assert.deepEqual(await jsonOf(r as Response), { error: "no-service-client" });
  } finally {
    console.error = before;
  }
});

// ---------------------------------------------------------------------------
// A tiny in-memory fake client
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Filter = [string, string, unknown];

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  filters: Filter[] = [];
  db: Fake;
  table: string;
  constructor(db: Fake, table: string) {
    this.db = db;
    this.table = table;
  }
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push(["eq", c, v]); return this; }
  in(c: string, v: unknown[]) { this.filters.push(["in", c, v]); return this; }
  not(c: string) { this.filters.push(["notnull", c, null]); return this; }
  order() { return this; }
  single() { return this.then((r) => ({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : null, error: r.error })) as never; }
  then<A, B>(ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null, no?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, no);
  }
  private run() {
    this.db.reads.push(this.table);
    if (this.db.failTable === this.table) return { data: null, error: { code: "XX000", message: "PRIVATE-DB-MESSAGE" } };
    const rows = (this.db.tables[this.table] ?? []).filter((r) =>
      this.filters.every(([k, c, v]) => (k === "eq" ? r[c] === v : k === "in" ? (v as unknown[]).includes(r[c]) : r[c] !== null && r[c] !== undefined)),
    );
    return { data: structuredClone(rows), error: null };
  }
}
class Fake {
  reads: string[] = [];
  failTable: string | null = null;
  tables: Record<string, Row[]>;
  constructor(tables: Record<string, Row[]>) {
    this.tables = tables;
  }
  from(table: string) { return new FakeQuery(this, table); }
}
const asClient = (f: Fake) => f as unknown as SupabaseClient;

test("readTier: only the exact value pro is Pro; a missing row, a failed read or anything else is free", async () => {
  const mk = (rows: Row[]) => new Fake({ users: rows });
  assert.equal(await readTier(asClient(mk([{ id: "u1", subscription_tier: "pro" }])), "u1"), "pro");
  assert.equal(await readTier(asClient(mk([{ id: "u1", subscription_tier: "free" }])), "u1"), "free");
  assert.equal(await readTier(asClient(mk([{ id: "u1", subscription_tier: "PRO" }])), "u1"), "free");
  assert.equal(await readTier(asClient(mk([{ id: "u1", subscription_tier: null }])), "u1"), "free");
  assert.equal(await readTier(asClient(mk([])), "u1"), "free");
  const broken = mk([{ id: "u1", subscription_tier: "pro" }]);
  broken.failTable = "users";
  const logged: string[] = [];
  const before = console.error;
  console.error = (...a: unknown[]) => void logged.push(a.join(" "));
  try {
    assert.equal(await readTier(asClient(broken), "u1"), "free", "a failed read can only close a month");
  } finally {
    console.error = before;
  }
  assert.ok(logged.every((l) => !l.includes("PRIVATE-DB-MESSAGE")), "no database text in the log");
});

// ---------------------------------------------------------------------------
// checkStepAccess
// ---------------------------------------------------------------------------

const PACK = "pack-1";
const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);

/** Month 1 (free) has weeks 1 and 2 with 2 steps each (ids m1w1d1, m1w1d2, ...); month 2 (not free) has week 3. */
function world(extra: { completed?: string[]; lastNewStepAt?: string | null; month1IsFree?: boolean } = {}) {
  const steps = [
    { id: "s1", week_id: "w1", day_no: 1 },
    { id: "s2", week_id: "w1", day_no: 2 },
    { id: "s3", week_id: "w2", day_no: 1 },
    { id: "s4", week_id: "w2", day_no: 2 },
    { id: "s5", week_id: "w3", day_no: 1 },
  ];
  return new Fake({
    skill_packs: [{ id: PACK, is_published: true }],
    skill_months: [
      { pack_id: PACK, month_no: 1, title: "One", teaser_line: "t1", is_free: extra.month1IsFree ?? true },
      { pack_id: PACK, month_no: 2, title: "Two", teaser_line: "Month two teaser", is_free: false },
    ],
    skill_weeks: [
      { id: "w1", pack_id: PACK, month_no: 1, week_no: 1 },
      { id: "w2", pack_id: PACK, month_no: 1, week_no: 2 },
      { id: "w3", pack_id: PACK, month_no: 2, week_no: 3 },
    ],
    skill_steps: steps.map((s) => ({ ...s, learn_title: "L", learn_body: "B", fact_line: "F", source_id: "src", do_prompt: "D", prove_question: "Q", prove_options: ["a", "b"], hint: "H" })),
    skill_sources: [{ id: "src", title: "A source", year: 2020 }],
    skill_step_progress: (extra.completed ?? []).map((id) => ({ user_id: "u1", step_id: id, completed_at: "2026-05-30T00:00:00.000Z" })),
    skill_enrollments: extra.lastNewStepAt === undefined ? [] : [{ user_id: "u1", pack_id: PACK, last_new_step_at: extra.lastNewStepAt }],
  });
}
const access = (f: Fake, tier: "free" | "pro", stepId: string) => checkStepAccess(asClient(f), "u1", tier, stepId, { now: NOW });

test("access: the user's current open step is allowed (nothing completed yet)", async () => {
  assert.deepEqual(await access(world(), "free", "s1"), { ok: true });
});

test("access: a step later than the current one gets notOpened, for free and for Pro", async () => {
  assert.deepEqual(await access(world(), "free", "s2"), { notOpened: true });
  assert.deepEqual(await access(world(), "free", "s4"), { notOpened: true });
  assert.deepEqual(await access(world(), "pro", "s2"), { notOpened: true });
  assert.deepEqual(await access(world(), "pro", "s5"), { notOpened: true }, "Pro opens every month, but not steps ahead of their place");
});

test("access: completed steps stay allowed, and so does the next one once its 20-hour wait is over", async () => {
  const f = world({ completed: ["s1"], lastNewStepAt: new Date(NOW - 21 * HOUR).toISOString() });
  assert.deepEqual(await access(f, "free", "s1"), { ok: true });
  assert.deepEqual(await access(f, "free", "s2"), { ok: true });
  assert.deepEqual(await access(f, "free", "s3"), { notOpened: true });
});

test("access: the next step is NOT opened yet while the 20-hour wait is still running", async () => {
  const f = world({ completed: ["s1"], lastNewStepAt: new Date(NOW - 2 * HOUR).toISOString() });
  assert.deepEqual(await access(f, "free", "s1"), { ok: true });
  assert.deepEqual(await access(f, "free", "s2"), { notOpened: true });
});

test("access: a locked month gives the locked body (month and teaser) for free, even for a step never opened", async () => {
  const done = world({ completed: ["s1", "s2", "s3", "s4"], lastNewStepAt: new Date(NOW - 30 * HOUR).toISOString() });
  assert.deepEqual(await access(done, "free", "s5"), { locked: { locked: true, month: 2, teaser: "Month two teaser" } });
  assert.deepEqual(await access(done, "pro", "s5"), { ok: true }, "Pro, and it is their current step");
});

test("access: a lapsed Pro user (now free) cannot write in a month they finished while Pro", async () => {
  const f = world({ completed: ["s1", "s2", "s3", "s4", "s5"] });
  assert.deepEqual(await access(f, "free", "s5"), { locked: { locked: true, month: 2, teaser: "Month two teaser" } });
});

test("access: a month is free only when the database column AND the code rule agree", async () => {
  const f = world({ month1IsFree: false });
  assert.deepEqual(await access(f, "free", "s1"), { locked: { locked: true, month: 1, teaser: "t1" } });
  assert.deepEqual(await access(f, "pro", "s1"), { ok: true });
});

test("access: an unknown step is notOpened (nothing said about what exists)", async () => {
  assert.deepEqual(await access(world(), "pro", "nope"), { notOpened: true });
});

test("access: a read problem is an error with a short code only, and nothing is written", async () => {
  const f = world();
  f.failTable = "skill_weeks";
  const r = await access(f, "free", "s1");
  assert.deepEqual(r, { error: { code: "XX000" } });
  assert.ok(!JSON.stringify(r).includes("PRIVATE-DB-MESSAGE"));
  assert.ok(f.reads.every((t) => t.startsWith("skill_")), "only reads were made (the fake has no write methods at all)");
});

test("stepAccessProblem: ok -> null; locked -> 403 locked body; notOpened -> plain 403; error -> 500 with a code", async () => {
  assert.equal(stepAccessProblem({ ok: true }), null);
  const l = stepAccessProblem({ locked: { locked: true, month: 2, teaser: "x" } })!;
  assert.equal(l.status, 403);
  assert.deepEqual(await jsonOf(l), { locked: true, month: 2, teaser: "x" });
  const n = stepAccessProblem({ notOpened: true })!;
  assert.equal(n.status, 403);
  assert.equal(await text(n), "");
  const e = stepAccessProblem({ error: { code: "no-week" } })!;
  assert.equal(e.status, 500);
  assert.deepEqual(await jsonOf(e), { error: "no-week" });
});
