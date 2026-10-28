// Run with: node --test src/lib/roast-insert.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Tests for the server-side roast writes (src/lib/roast-insert.ts) and for the rule behind them:
// only the server writes roast rows, and the owner id always comes from the verified session.
// No test here touches a real database or calls any AI.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertRoastRowWith, saveBackfilledPunchlineWith } from "./roast-insert.ts";

// ---------------------------------------------------------------------------
// A fake service client that records what it is asked to do
// ---------------------------------------------------------------------------

type Call = { table: string; op: "insert" | "update"; payload: Record<string, unknown>; filters: Array<[string, string, unknown]> };

function fakeService(results: Array<{ data?: unknown; error?: unknown }>) {
  const calls: Call[] = [];
  let next = 0;
  const client = {
    from(table: string) {
      const call: Call = { table, op: "insert", payload: {}, filters: [] };
      const chain: Record<string, unknown> = {
        insert(payload: Record<string, unknown>) { call.op = "insert"; call.payload = payload; calls.push(call); return chain; },
        update(payload: Record<string, unknown>) { call.op = "update"; call.payload = payload; calls.push(call); return chain; },
        eq(col: string, val: unknown) { call.filters.push(["eq", col, val]); return chain; },
        is(col: string, val: unknown) { call.filters.push(["is", col, val]); return chain; },
        select() { return chain; },
        then(resolve: (v: unknown) => unknown) {
          const r = results[Math.min(next++, results.length - 1)] ?? { data: null, error: null };
          return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function captureConsole() {
  const lines: string[] = [];
  const orig = { error: console.error, warn: console.warn, log: console.log };
  const grab = (...args: unknown[]) => { lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")); };
  console.error = grab; console.warn = grab; console.log = grab;
  return { lines, restore() { console.error = orig.error; console.warn = orig.warn; console.log = orig.log; } };
}

const ROW = { roast_text: "a roast", life_score: 50, card_punchline: "a line" };

// ---------------------------------------------------------------------------
// insertRoastRowWith
// ---------------------------------------------------------------------------

test("insert: the owner id is the verified user id, even if the row says someone else", async () => {
  const { client, calls } = fakeService([{ data: [{ id: "roast-1" }] }]);
  const result = await insertRoastRowWith(() => client, "verified-user", { ...ROW, user_id: "someone-else" });
  assert.deepEqual(result, { data: { id: "roast-1" }, error: null });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.table, "roasts");
  assert.equal(calls[0]!.payload.user_id, "verified-user");
  assert.equal(calls[0]!.payload.roast_text, "a roast");
});

test("insert: a missing user id writes nothing", async () => {
  const { client, calls } = fakeService([{ data: [{ id: "x" }] }]);
  for (const bad of ["", undefined as unknown as string, null as unknown as string]) {
    const result = await insertRoastRowWith(() => client, bad, ROW);
    assert.deepEqual(result, { data: null, error: { code: "no-user" } });
  }
  assert.equal(calls.length, 0);
});

test("insert: the saved row is read back; an error, no row or two rows is a failure", async () => {
  const cap = captureConsole();
  try {
    const denied = await insertRoastRowWith(() => fakeService([{ error: { code: "42501", message: "permission denied for table roasts" } }]).client, "u", ROW);
    assert.deepEqual(denied, { data: null, error: { code: "42501" } });
    const none = await insertRoastRowWith(() => fakeService([{ data: [] }]).client, "u", ROW);
    assert.deepEqual(none, { data: null, error: { code: "no-row" } });
    const nothing = await insertRoastRowWith(() => fakeService([{ data: null }]).client, "u", ROW);
    assert.deepEqual(nothing, { data: null, error: { code: "no-row" } });
    const two = await insertRoastRowWith(() => fakeService([{ data: [{ id: "a" }, { id: "b" }] }]).client, "u", ROW);
    assert.deepEqual(two, { data: null, error: { code: "no-row" } });
    const noId = await insertRoastRowWith(() => fakeService([{ data: [{}] }]).client, "u", ROW);
    assert.deepEqual(noId, { data: null, error: { code: "no-row" } });
  } finally {
    cap.restore();
  }
});

test("insert: a thrown error or a missing service key is a failure with a code, and nothing is inserted", async () => {
  const cap = captureConsole();
  try {
    const { calls } = fakeService([]);
    const noKey = await insertRoastRowWith(() => { throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY"); }, "u", ROW);
    assert.deepEqual(noKey, { data: null, error: { code: "no-service-client" } });
    assert.equal(calls.length, 0);
    const boom = { from() { throw new Error("secret answer text"); } } as unknown as SupabaseClient;
    const thrown = await insertRoastRowWith(() => boom, "u", ROW);
    assert.deepEqual(thrown, { data: null, error: { code: "exception" } });
  } finally {
    cap.restore();
  }
});

test("insert: logs and returns only an error code, never message text", async () => {
  const cap = captureConsole();
  try {
    const secret = "PRIVATE ANSWER about my sleep";
    const result = await insertRoastRowWith(
      () => fakeService([{ error: { code: "23505", message: secret, details: secret, hint: secret } }]).client,
      "u",
      ROW,
    );
    assert.deepEqual(result.error, { code: "23505" });
    assert.ok(cap.lines.some((l) => l.includes("code=23505")), "the code is logged");
    assert.ok(!cap.lines.join("\n").includes(secret), "message text must never be logged");
    assert.ok(!JSON.stringify(result).includes(secret), "message text must never be returned");
    // a hostile "code" is not echoed either
    const weird = await insertRoastRowWith(() => fakeService([{ error: { code: "x".repeat(200) + secret } }]).client, "u", ROW);
    assert.deepEqual(weird.error, { code: "unknown" });
  } finally {
    cap.restore();
  }
});

test("insert: if the card_punchline column is missing it retries once without it, and only once", async () => {
  const cap = captureConsole();
  try {
    const first = fakeService([{ error: { code: "42703", message: "column card_punchline does not exist" } }, { data: [{ id: "r2" }] }]);
    const ok = await insertRoastRowWith(() => first.client, "u", ROW);
    assert.deepEqual(ok, { data: { id: "r2" }, error: null });
    assert.equal(first.calls.length, 2);
    assert.ok("card_punchline" in first.calls[0]!.payload);
    assert.ok(!("card_punchline" in first.calls[1]!.payload), "the retry leaves the column out");
    assert.equal(first.calls[1]!.payload.user_id, "u", "the retry still uses the verified id");

    const twice = fakeService([{ error: { code: "PGRST204", message: "card_punchline" } }, { error: { code: "42501", message: "denied" } }]);
    const failed = await insertRoastRowWith(() => twice.client, "u", ROW);
    assert.deepEqual(failed, { data: null, error: { code: "42501" } });
    assert.equal(twice.calls.length, 2, "never more than one retry");

    const other = fakeService([{ error: { code: "42501", message: "permission denied" } }]);
    await insertRoastRowWith(() => other.client, "u", ROW);
    assert.equal(other.calls.length, 1, "other errors are not retried");
  } finally {
    cap.restore();
  }
});

// ---------------------------------------------------------------------------
// saveBackfilledPunchlineWith
// ---------------------------------------------------------------------------

test("punchline backfill: writes only for this roast id AND this user id, and only while the punchline is empty", async () => {
  const { client, calls } = fakeService([{ data: [{ id: "roast-1" }] }]);
  const saved = await saveBackfilledPunchlineWith(() => client, "roast-1", "verified-user", "a new line");
  assert.equal(saved, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.payload, { card_punchline: "a new line" });
  assert.deepEqual(calls[0]!.filters, [["eq", "id", "roast-1"], ["eq", "user_id", "verified-user"], ["is", "card_punchline", null]]);
});

test("punchline backfill: refuses empty ids or text, and logs failures by code only", async () => {
  const cap = captureConsole();
  try {
    const { client, calls } = fakeService([{ data: [{ id: "x" }] }]);
    assert.equal(await saveBackfilledPunchlineWith(() => client, "", "u", "line"), false);
    assert.equal(await saveBackfilledPunchlineWith(() => client, "r", "", "line"), false);
    assert.equal(await saveBackfilledPunchlineWith(() => client, "r", "u", ""), false);
    assert.equal(calls.length, 0);

    const secret = "PRIVATE ROAST TEXT";
    assert.equal(await saveBackfilledPunchlineWith(() => fakeService([{ error: { code: "42501", message: secret } }]).client, "r", "u", "line"), false);
    assert.equal(await saveBackfilledPunchlineWith(() => fakeService([{ data: [] }]).client, "r", "u", "line"), false);
    assert.equal(await saveBackfilledPunchlineWith(() => { throw new Error(secret); }, "r", "u", "line"), false);
    const out = cap.lines.join("\n");
    assert.ok(out.includes("code=42501") && out.includes("code=no-row") && out.includes("code=exception"), "each failure is logged with a code");
    assert.ok(!out.includes(secret), "no message text in the logs");
  } finally {
    cap.restore();
  }
});

// ---------------------------------------------------------------------------
// Source checks: who may write roasts, and where the safety gates sit
// ---------------------------------------------------------------------------

const SRC = fileURLToPath(new URL("../", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}
const rel = (p: string) => relative(SRC, p).split("\\").join("/");
const read = (relPath: string) => readFileSync(join(SRC, relPath), "utf8");
const appFiles = walk(SRC).filter((p) => !/\.test\.(ts|tsx)$/.test(p));

test("(a) no route or page writes the roasts table with a user-session client", () => {
  const writes = /from\(\s*["']roasts["']\s*\)\s*\.\s*(insert|upsert|delete|update)\b/g;
  const found: string[] = [];
  for (const file of appFiles) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(writes)) found.push(`${rel(file)}: ${m[1]}`);
  }
  // Allowed: the server helper (service role) and the reaction route (one column, own row).
  const unexpected = found.filter((f) => !f.startsWith("lib/roast-insert.ts:") && !f.startsWith("app/api/roast/[id]/reaction/route.ts:"));
  assert.deepEqual(unexpected, [], "unexpected writes to roasts");
  assert.deepEqual(found.filter((f) => f.startsWith("app/api/roast/[id]/reaction/")), ["app/api/roast/[id]/reaction/route.ts: update"]);
});

test("the reaction route writes only the reaction column, for the signed-in user's own row", () => {
  const route = read("app/api/roast/[id]/reaction/route.ts");
  assert.match(route, /\.update\(\{ reaction: emoji \}\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /isReactionEmoji\(emoji\)/);
  assert.equal(route.match(/\.update\(/g)?.length, 1);
  assert.doesNotMatch(route, /createSupabaseServiceClient/, "the reaction route stays on the user session");
});

test("the service-role writes live only in the server helper, and it really uses the service client", () => {
  const helper = read("lib/roast-insert.ts");
  assert.match(helper, /service\s*\.from\("roasts"\)|service\.from\("roasts"\)/);
  assert.match(helper, /user_id: userId/);
  const wrapper = read("lib/card-punchline.ts");
  assert.match(wrapper, /insertRoastRowWith\(createSupabaseServiceClient, userId, row\)/);
  assert.match(wrapper, /saveBackfilledPunchlineWith\(createSupabaseServiceClient, roast\.id, userId, punchline\)/);
  assert.doesNotMatch(wrapper, /\.insert\(|\.update\(/, "card-punchline.ts itself must not write; the helper does");
});

test("the service client is server-only and no browser file imports it", () => {
  assert.match(read("lib/supabase/service.ts"), /^import "server-only";/m);
  for (const file of appFiles) {
    const text = readFileSync(file, "utf8");
    if (/^["']use client["']/m.test(text)) {
      assert.doesNotMatch(text, /supabase\/service/, `${rel(file)} is a browser file and must not import the service client`);
    }
  }
});

test("(b) the roast and check-in routes save with the verified user id, never an id from the request", () => {
  for (const file of ["app/api/roast/route.ts", "app/api/check-in/route.ts"]) {
    const route = read(file);
    assert.match(route, /insertRoastRow\(user\.id,/, `${file} must pass the verified user id`);
    assert.match(route, /const \{\s*data: \{ user \},?\s*\} = await supabase\.auth\.getUser\(\)|const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\)/, `${file} gets user from auth.getUser()`);
    assert.doesNotMatch(route, /user_id:\s*(body|b|parsed)\b/, `${file} must not take user_id from the request`);
    assert.doesNotMatch(route, /insertRoastRow\((supabase|body|parsed)/, `${file} must not pass a client or request data as the owner`);
  }
});

test("(c) /api/roast: every flagged, paused, unavailable, limit and output-block exit comes before the insert", () => {
  const route = read("app/api/roast/route.ts");
  const insert = route.indexOf("insertRoastRow(user.id");
  assert.ok(insert !== -1);
  for (const needle of ["gentleGate(", "checkDailyLimit(", "runSafetyClassify(", "respondFlagged(", "respondUnavailable(", "respondOutputBlocked(", "outputLooksUnsafe(", "status: 401", "status: 403"]) {
    assert.ok(route.indexOf(needle) !== -1, `route no longer contains: ${needle}`);
    assert.ok(route.lastIndexOf(needle) < insert, `every ${needle} must come before the insert`);
  }
  assert.equal(route.match(/insertRoastRow\(/g)?.length, 1, "exactly one insert in the roast route");
});

test("(c) /api/check-in: every flagged, paused, unavailable, limit and output-block exit comes before the insert", () => {
  const route = read("app/api/check-in/route.ts");
  const insert = route.indexOf("insertRoastRow(user.id");
  assert.ok(insert !== -1);
  for (const needle of ["gentleGate(", "checkDailyLimit(", "runCheckInSafety(", "respondFlagged(", "respondUnavailable(", "respondOutputBlocked(", "outputLooksUnsafe("]) {
    assert.ok(route.indexOf(needle) !== -1, `route no longer contains: ${needle}`);
    assert.ok(route.lastIndexOf(needle) < insert, `every ${needle} must come before the insert`);
  }
  assert.equal(route.match(/insertRoastRow\(/g)?.length, 1, "exactly one insert in the check-in route");
});

test("a failed save keeps the same user-facing message as before", () => {
  assert.match(read("app/api/roast/route.ts"), /error: "Failed to save roast"/);
  assert.match(read("app/api/check-in/route.ts"), /error: "Failed to save check-in roast"/);
});

test("the punchline backfill is called with the verified user id from the page", () => {
  assert.match(read("app/roast/[id]/page.tsx"), /backfillCardPunchline\(supabase, roast, user\.id\)/);
});
