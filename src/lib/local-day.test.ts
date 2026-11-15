// Run with: node --test src/lib/local-day.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Local-day streaks and the local-day daily limit. Fixed clocks and fake database clients only:
// nothing here touches a real database.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserTimezone } from "./day-key.ts";
import { checkDailyLimit } from "./daily-limit.ts";
import { localDayRangeUtc, startOfLocalDayUtc } from "./local-day.ts";
import { calculateStreak } from "./streak.ts";
import { STREAK_ROW_CAP, getUserStreak, streakFromDates } from "./user-streak.ts";

const HOUR = 3_600_000;

// ---- startOfLocalDayUtc ----

test("start of local day: Karachi, Kolkata (+05:30), Kiritimati (+14), UTC", () => {
  assert.equal(startOfLocalDayUtc("2026-06-11", "Asia/Karachi").toISOString(), "2026-06-10T19:00:00.000Z");
  assert.equal(startOfLocalDayUtc("2026-06-11", "Asia/Kolkata").toISOString(), "2026-06-10T18:30:00.000Z");
  assert.equal(startOfLocalDayUtc("2026-06-11", "Pacific/Kiritimati").toISOString(), "2026-06-10T10:00:00.000Z");
  assert.equal(startOfLocalDayUtc("2026-06-11", "UTC").toISOString(), "2026-06-11T00:00:00.000Z");
});

test("start of local day: New York across both daylight-saving changes (23h and 25h days)", () => {
  assert.equal(startOfLocalDayUtc("2026-03-08", "America/New_York").toISOString(), "2026-03-08T05:00:00.000Z"); // EST
  assert.equal(startOfLocalDayUtc("2026-03-09", "America/New_York").toISOString(), "2026-03-09T04:00:00.000Z"); // EDT
  assert.equal(startOfLocalDayUtc("2026-11-01", "America/New_York").toISOString(), "2026-11-01T04:00:00.000Z"); // EDT
  assert.equal(startOfLocalDayUtc("2026-11-02", "America/New_York").toISOString(), "2026-11-02T05:00:00.000Z"); // EST
  const spring = localDayRangeUtc(new Date("2026-03-08T12:00:00Z"), "America/New_York");
  const fall = localDayRangeUtc(new Date("2026-11-01T12:00:00Z"), "America/New_York");
  assert.equal(spring.end.getTime() - spring.start.getTime(), 23 * HOUR);
  assert.equal(fall.end.getTime() - fall.start.getTime(), 25 * HOUR);
});

test("start of local day: zones whose clocks jump at midnight start at the first real instant", () => {
  // Beirut springs forward at 00:00 -> 01:00 (+03) on 29 Mar 2026; Santiago at 00:00 -> 01:00 (-03) on 6 Sep 2026.
  assert.equal(startOfLocalDayUtc("2026-03-29", "Asia/Beirut").toISOString(), "2026-03-28T22:00:00.000Z");
  assert.equal(startOfLocalDayUtc("2026-09-06", "America/Santiago").toISOString(), "2026-09-06T04:00:00.000Z");
});

test("invalid or missing zone means UTC, the exact old window", () => {
  for (const tz of [null, undefined, "", "Mars/Base", 42]) {
    const r = localDayRangeUtc(new Date("2026-06-11T15:00:00Z"), tz);
    assert.equal(r.start.toISOString(), "2026-06-11T00:00:00.000Z", String(tz));
    assert.equal(r.end.toISOString(), "2026-06-12T00:00:00.000Z", String(tz));
  }
});

// ---- streaks in the user's zone ----

test("Karachi: a roast at 01:00 local (previous UTC day) counts for the local day", () => {
  const dates = ["2026-06-09T12:00:00Z" /* Jun 9 17:00 PKT */, "2026-06-09T20:00:00Z" /* Jun 10 01:00 PKT */];
  const now = new Date("2026-06-10T10:00:00Z");
  assert.deepEqual(streakFromDates(dates, "Asia/Karachi", now), { current: 2, longest: 2 });
  assert.deepEqual(streakFromDates(dates, "UTC", now), { current: 1, longest: 1 });
});

test("Kolkata (+05:30): a roast at 00:15 local counts for the new local day", () => {
  const dates = ["2026-06-09T10:00:00Z" /* Jun 9 15:30 IST */, "2026-06-09T18:45:00Z" /* Jun 10 00:15 IST */];
  const now = new Date("2026-06-10T06:00:00Z");
  assert.equal(streakFromDates(dates, "Asia/Kolkata", now).current, 2);
  assert.equal(streakFromDates(dates, "UTC", now).current, 1);
});

test("Kiritimati (+14): a roast at 02:00 local is two UTC days behind and still counts", () => {
  const dates = ["2026-06-09T20:00:00Z" /* Jun 10 10:00 LINT */, "2026-06-10T12:00:00Z" /* Jun 11 02:00 LINT */];
  const now = new Date("2026-06-10T20:00:00Z"); // Jun 11 10:00 LINT
  assert.equal(streakFromDates(dates, "Pacific/Kiritimati", now).current, 2);
  assert.equal(streakFromDates(dates, "UTC", now).current, 2); // happens to be 2 in UTC too (Jun 9, Jun 10)
  assert.equal(streakFromDates(["2026-06-10T12:00:00Z"], "Pacific/Kiritimati", new Date("2026-06-11T09:00:00Z")).current, 1); // still "today" locally (Jun 11 23:00)
});

test("New York near the daylight-saving change: streak is unbroken", () => {
  const dates = ["2026-03-07T23:30:00Z" /* Mar 7 18:30 EST */, "2026-03-09T03:30:00Z" /* Mar 8 23:30 EDT */, "2026-03-09T13:00:00Z" /* Mar 9 09:00 EDT */];
  assert.equal(streakFromDates(dates, "America/New_York", new Date("2026-03-09T14:00:00Z")).current, 3);
  const fall = ["2026-10-31T16:00:00Z", "2026-11-01T05:30:00Z" /* Nov 1 01:30 EDT */, "2026-11-02T04:30:00Z" /* Nov 1 23:30 EST */, "2026-11-02T15:00:00Z"];
  assert.equal(streakFromDates(fall, "America/New_York", new Date("2026-11-02T16:00:00Z")).current, 3);
});

test("null zone behaves exactly like UTC", () => {
  const dates = ["2026-06-09T23:30:00Z", "2026-06-10T00:30:00Z", "2026-06-11T09:00:00Z"];
  const now = new Date("2026-06-11T12:00:00Z");
  assert.deepEqual(streakFromDates(dates, null, now), streakFromDates(dates, "UTC", now));
  assert.equal(streakFromDates(dates, null, now).current, calculateStreak(dates, "UTC", now));
  assert.equal(getUserTimezone(null), "UTC");
  assert.equal(getUserTimezone("Mars/Base"), "UTC");
  assert.equal(getUserTimezone("Asia/Karachi"), "Asia/Karachi");
});

test("a 30-day run is 30, not capped at 12", () => {
  const now = new Date("2026-06-30T12:00:00Z");
  const dates = Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - i * 24 * HOUR).toISOString());
  assert.deepEqual(streakFromDates(dates, "UTC", now), { current: 30, longest: 30 });
});

test("longest streak survives a gap", () => {
  const now = new Date("2026-06-30T12:00:00Z");
  const run = (startDay: number, n: number) => Array.from({ length: n }, (_, i) => `2026-06-${String(startDay + i).padStart(2, "0")}T12:00:00Z`);
  const dates = [...run(1, 10), ...run(20, 3), "2026-06-30T08:00:00Z"]; // 10-day run, gap, 3-day run, gap, today
  assert.deepEqual(streakFromDates(dates, "UTC", now), { current: 1, longest: 10 });
});

// ---- getUserStreak query ----

type Recorded = { table: string; columns?: string; filters: Array<[string, string, unknown]>; order?: [string, unknown]; limit?: number };

function fakeStreakClient(rows: Array<{ created_at: string }>, error: unknown = null) {
  const calls: Recorded[] = [];
  const client = {
    from(table: string) {
      const call: Recorded = { table, filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        select(columns: string) { call.columns = columns; return chain; },
        eq(col: string, val: unknown) { call.filters.push(["eq", col, val]); return chain; },
        order(col: string, opts: unknown) { call.order = [col, opts]; return chain; },
        limit(n: number) { call.limit = n; return chain; },
        then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: error ? null : rows, error }).then(resolve); },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("getUserStreak reads only created_at of the user's own rows, newest first, capped at 400", async () => {
  const now = new Date("2026-06-30T12:00:00Z");
  const rows = Array.from({ length: 30 }, (_, i) => ({ created_at: new Date(now.getTime() - i * 24 * HOUR).toISOString() }));
  const fake = fakeStreakClient(rows);
  assert.deepEqual(await getUserStreak(fake.client, "user-1", "Asia/Karachi", now), { current: 30, longest: 30 });
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(fake.calls[0], {
    table: "roasts",
    columns: "created_at",
    filters: [["eq", "user_id", "user-1"]],
    order: ["created_at", { ascending: false }],
    limit: STREAK_ROW_CAP,
  });
  assert.equal(STREAK_ROW_CAP, 400);
});

test("getUserStreak returns zeros on a read error or without a user", async () => {
  assert.deepEqual(await getUserStreak(fakeStreakClient([], { code: "500" }).client, "user-1", "UTC"), { current: 0, longest: 0 });
  const fake = fakeStreakClient([{ created_at: "2026-06-30T12:00:00Z" }]);
  assert.deepEqual(await getUserStreak(fake.client, "", "UTC"), { current: 0, longest: 0 });
  assert.equal(fake.calls.length, 0);
});

// ---- checkDailyLimit with a fake data source ----

type LimitCall = { table: string; filters: Array<[string, string, unknown]> };

function fakeLimitClient(opts: { count?: number; zone?: unknown; zoneError?: boolean; countError?: boolean }) {
  const calls: LimitCall[] = [];
  const client = {
    from(table: string) {
      const call: LimitCall = { table, filters: [] };
      calls.push(call);
      const result = () =>
        table === "users"
          ? { data: opts.zoneError ? null : { timezone: opts.zone ?? null }, error: opts.zoneError ? { code: "x" } : null }
          : { count: opts.countError ? null : opts.count ?? 0, error: opts.countError ? { message: "boom" } : null };
      const chain: Record<string, unknown> = {
        select() { return chain; },
        eq(col: string, val: unknown) { call.filters.push(["eq", col, val]); return chain; },
        gte(col: string, val: unknown) { call.filters.push(["gte", col, val]); return chain; },
        lt(col: string, val: unknown) { call.filters.push(["lt", col, val]); return chain; },
        lte(col: string, val: unknown) { call.filters.push(["lte", col, val]); return chain; },
        maybeSingle() { return Promise.resolve(result()); },
        then(resolve: (v: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const bounds = (calls: LimitCall[]) => {
  const roasts = calls.find((c) => c.table === "roasts")!;
  return {
    gte: roasts.filters.find((f) => f[0] === "gte")?.[2],
    lt: roasts.filters.find((f) => f[0] === "lt")?.[2],
    lte: roasts.filters.find((f) => f[0] === "lte"),
  };
};

let uid = 0;
const freshUser = () => `limit-user-${++uid}`; // the in-flight guard is per user, so each test uses its own id

test("daily limit, Karachi: just before local midnight counts the old day, just after starts a new one", async () => {
  const before = fakeLimitClient({ count: 1 });
  const r1 = await checkDailyLimit(before.client, freshUser(), "free", { claim: false, timeZone: "Asia/Karachi", now: new Date("2026-06-10T18:59:59Z") });
  assert.deepEqual(bounds(before.calls), { gte: "2026-06-09T19:00:00.000Z", lt: "2026-06-10T19:00:00.000Z", lte: undefined });
  assert.equal(r1.allowed, false);
  assert.equal(r1.allowed === false && r1.status, 429);

  const after = fakeLimitClient({ count: 0 });
  const r2 = await checkDailyLimit(after.client, freshUser(), "free", { claim: false, timeZone: "Asia/Karachi", now: new Date("2026-06-10T19:00:01Z") });
  assert.deepEqual(bounds(after.calls), { gte: "2026-06-10T19:00:00.000Z", lt: "2026-06-11T19:00:00.000Z", lte: undefined });
  assert.equal(r2.allowed, true);
});

test("daily limit, Los Angeles: boundary just before and after local midnight (PDT = UTC-7)", async () => {
  const before = fakeLimitClient({ count: 0 });
  await checkDailyLimit(before.client, freshUser(), "pro", { claim: false, timeZone: "America/Los_Angeles", now: new Date("2026-06-11T06:59:59Z") });
  assert.deepEqual(bounds(before.calls), { gte: "2026-06-10T07:00:00.000Z", lt: "2026-06-11T07:00:00.000Z", lte: undefined });

  const after = fakeLimitClient({ count: 0 });
  await checkDailyLimit(after.client, freshUser(), "pro", { claim: false, timeZone: "America/Los_Angeles", now: new Date("2026-06-11T07:00:01Z") });
  assert.deepEqual(bounds(after.calls), { gte: "2026-06-11T07:00:00.000Z", lt: "2026-06-12T07:00:00.000Z", lte: undefined });
});

test("daily limit reads the zone from the user's own row when not passed", async () => {
  const user = freshUser();
  const fake = fakeLimitClient({ count: 0, zone: "Asia/Kolkata" });
  await checkDailyLimit(fake.client, user, "free", { claim: false, now: new Date("2026-06-11T12:00:00Z") });
  const usersCall = fake.calls.find((c) => c.table === "users")!;
  assert.deepEqual(usersCall.filters, [["eq", "id", user]]);
  assert.deepEqual(bounds(fake.calls), { gte: "2026-06-10T18:30:00.000Z", lt: "2026-06-11T18:30:00.000Z", lte: undefined });
});

test("daily limit: null zone, invalid zone or a failed zone read all count the UTC day (old behaviour)", async () => {
  const now = new Date("2026-06-11T12:00:00Z");
  for (const fake of [fakeLimitClient({ zone: null }), fakeLimitClient({ zone: "Mars/Base" }), fakeLimitClient({ zoneError: true })]) {
    await checkDailyLimit(fake.client, freshUser(), "free", { claim: false, now });
    assert.deepEqual(bounds(fake.calls), { gte: "2026-06-11T00:00:00.000Z", lt: "2026-06-12T00:00:00.000Z", lte: undefined });
  }
});

test("daily limit numbers and error handling are unchanged", async () => {
  const now = new Date("2026-06-11T12:00:00Z");
  const free = await checkDailyLimit(fakeLimitClient({ count: 1 }).client, freshUser(), "free", { claim: false, timeZone: "UTC", now });
  assert.equal(free.allowed, false);
  const pro = await checkDailyLimit(fakeLimitClient({ count: 1 }).client, freshUser(), "pro", { claim: false, timeZone: "UTC", now });
  assert.equal(pro.allowed, true);
  const proFull = await checkDailyLimit(fakeLimitClient({ count: 2 }).client, freshUser(), "pro", { claim: false, timeZone: "UTC", now });
  assert.equal(proFull.allowed, false);
  const broken = await checkDailyLimit(fakeLimitClient({ countError: true }).client, freshUser(), "free", { timeZone: "UTC", now });
  assert.equal(broken.allowed === false && broken.status, 500);
  const claimed = await checkDailyLimit(fakeLimitClient({ count: 0 }).client, freshUser(), "free", { timeZone: "UTC", now });
  assert.equal(claimed.allowed, true);
  if (claimed.allowed) claimed.release();
});

// ---- wiring (read as text) ----

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("dashboard and result page both use getUserStreak; nothing reads or writes the stored streak columns", () => {
  const dashboard = read("../app/dashboard/page.tsx");
  const result = read("../app/roast/[id]/page.tsx");
  assert.match(dashboard, /getUserStreak\(supabase, user\.id, timeZone\)/);
  assert.match(result, /getUserStreak\(supabase, user\.id, timeZone\)/);
  for (const file of ["../app/dashboard/page.tsx", "../app/roast/[id]/page.tsx", "../app/api/roast/route.ts", "../app/api/check-in/route.ts", "../app/api/cron/push-nudge/route.ts"]) {
    assert.doesNotMatch(read(file), /current_streak|longest_streak/, file);
  }
  // The 12 / 100 saved-results display limit is unchanged.
  assert.match(dashboard, /const limit = subscriptionTier === "pro" \? 100 : 12;/);
});

test("achievements use the shared streak rule with the user's zone", () => {
  const src = read("./achievements.ts");
  assert.match(src, /streakFromDates\(rows\.map\(\(row\) => row\.created_at\), timeZone\)\.current/);
  assert.match(src, /select\("achievements, timezone"\)/);
});
