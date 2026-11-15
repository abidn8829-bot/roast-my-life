// Run with: node --test src/lib/timezone.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Tests for time zone capture: the validator, the UTC fallback helper and the server-side save.
// No test here touches a real database.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserTimezone, isValidTimeZone } from "./day-key.ts";
import { saveUserTimezoneWith } from "./timezone-save.ts";

// ---- validator ----

test("isValidTimeZone accepts real IANA zone names", () => {
  for (const tz of ["Asia/Karachi", "America/New_York", "UTC", "Europe/London", "America/Los_Angeles"]) {
    assert.equal(isValidTimeZone(tz), true, tz);
  }
});

test("isValidTimeZone rejects empty, unknown, overlong, offsets and non-strings", () => {
  const bad: unknown[] = ["", "Mars/Base", "A".repeat(200), "Asia/" + "x".repeat(60), "+05:00", " Asia/Karachi", "Asia/Karachi;drop", null, undefined, 123, {}, ["UTC"]];
  for (const tz of bad) assert.equal(isValidTimeZone(tz), false, JSON.stringify(tz));
});

test("getUserTimezone returns a valid stored value, otherwise UTC", () => {
  assert.equal(getUserTimezone("Asia/Karachi"), "Asia/Karachi");
  assert.equal(getUserTimezone(null), "UTC");
  assert.equal(getUserTimezone(undefined), "UTC");
  assert.equal(getUserTimezone(""), "UTC");
  assert.equal(getUserTimezone("Mars/Base"), "UTC");
  assert.equal(getUserTimezone(42), "UTC");
});

// ---- server-side save with a fake service client ----

type Call = { table: string; op: "select" | "update"; payload?: Record<string, unknown>; columns?: string; filters: Array<[string, unknown]> };

function fakeService(results: Array<{ data?: unknown; error?: unknown }>) {
  const calls: Call[] = [];
  let next = 0;
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        select(columns: string) { if (call.op === "select") call.columns = columns; return chain; },
        update(payload: Record<string, unknown>) { call.op = "update"; call.payload = payload; return chain; },
        eq(col: string, val: unknown) { call.filters.push([col, val]); return chain; },
        then(resolve: (v: unknown) => unknown) {
          const r = results[Math.min(next++, results.length - 1)] ?? { data: null, error: null };
          return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { make: () => client as unknown as SupabaseClient, calls };
}

const USER = "11111111-1111-1111-1111-111111111111";

test("same value already stored: no update is made", async () => {
  const svc = fakeService([{ data: [{ timezone: "Asia/Karachi" }] }]);
  const r = await saveUserTimezoneWith(svc.make, USER, "Asia/Karachi");
  assert.deepEqual(r, { ok: true, status: "unchanged" });
  assert.equal(svc.calls.length, 1);
  assert.equal(svc.calls[0]!.op, "select");
  assert.deepEqual(svc.calls[0]!.filters, [["id", USER]]);
});

test("new value: updates only the timezone column on the session user's row, and checks the result", async () => {
  const svc = fakeService([{ data: [{ timezone: null }] }, { data: [{ id: USER, timezone: "Asia/Karachi" }] }]);
  const r = await saveUserTimezoneWith(svc.make, USER, "Asia/Karachi");
  assert.deepEqual(r, { ok: true, status: "saved" });
  assert.equal(svc.calls.length, 2);
  const upd = svc.calls[1]!;
  assert.equal(upd.table, "users");
  assert.equal(upd.op, "update");
  assert.deepEqual(upd.payload, { timezone: "Asia/Karachi" });
  assert.deepEqual(upd.filters, [["id", USER]]);
});

test("update that changes no row is reported as a failure, not success", async () => {
  const svc = fakeService([{ data: [{ timezone: null }] }, { data: [] }]);
  assert.deepEqual(await saveUserTimezoneWith(svc.make, USER, "Asia/Karachi"), { ok: false, code: "not-updated" });
});

test("update that returns a different value is reported as a failure", async () => {
  const svc = fakeService([{ data: [{ timezone: null }] }, { data: [{ id: USER, timezone: null }] }]);
  assert.deepEqual(await saveUserTimezoneWith(svc.make, USER, "Asia/Karachi"), { ok: false, code: "not-updated" });
});

test("missing users row is reported and nothing is written", async () => {
  const svc = fakeService([{ data: [] }]);
  assert.deepEqual(await saveUserTimezoneWith(svc.make, USER, "Asia/Karachi"), { ok: false, code: "no-row" });
  assert.equal(svc.calls.length, 1);
});

test("database errors are reported by code", async () => {
  const readErr = fakeService([{ error: { code: "42501", message: "permission denied" } }]);
  assert.deepEqual(await saveUserTimezoneWith(readErr.make, USER, "UTC"), { ok: false, code: "42501" });
  const writeErr = fakeService([{ data: [{ timezone: null }] }, { error: { code: "PGRST116" } }]);
  assert.deepEqual(await saveUserTimezoneWith(writeErr.make, USER, "UTC"), { ok: false, code: "PGRST116" });
});

test("invalid time zone or missing user: no database call at all", async () => {
  const svc = fakeService([{ data: [] }]);
  assert.deepEqual(await saveUserTimezoneWith(svc.make, USER, "Mars/Base"), { ok: false, code: "invalid-timezone" });
  assert.deepEqual(await saveUserTimezoneWith(svc.make, "", "UTC"), { ok: false, code: "no-user" });
  assert.equal(svc.calls.length, 0);
});

test("service client that cannot be created is reported", async () => {
  const r = await saveUserTimezoneWith(() => { throw new Error("no key"); }, USER, "UTC");
  assert.deepEqual(r, { ok: false, code: "no-service-client" });
});

// ---- the route and the mount (read as text) ----

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("route requires a signed-in user, validates, and uses the session user id only", () => {
  const src = read("../app/api/user/timezone/route.ts");
  assert.match(src, /auth\.getUser\(\)/);
  assert.match(src, /if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(src, /isValidTimeZone\(timezone\)/);
  assert.match(src, /status: 400/);
  assert.match(src, /saveUserTimezoneWith\(createSupabaseServiceClient, user\.id, timezone\)/);
  assert.doesNotMatch(src, /console\./);
  assert.doesNotMatch(src, /email/);
});

test("TimezoneSync is mounted in the dashboard layout, not the root layout", () => {
  assert.match(read("../app/dashboard/layout.tsx"), /<TimezoneSync \/>/);
  assert.doesNotMatch(read("../app/layout.tsx"), /TimezoneSync/);
  const sync = read("../components/timezone-sync.tsx");
  assert.match(sync, /sessionStorage/);
  assert.match(sync, /\/api\/user\/timezone/);
});
