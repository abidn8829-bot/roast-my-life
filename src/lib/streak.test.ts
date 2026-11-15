// Run with: node --test src/lib/streak.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
import assert from "node:assert/strict";
import { test } from "node:test";
import { addDaysToKey, dayKeyInZone, isValidTimeZone } from "./day-key.ts";
import { calculateStreak, longestStreak, previousDay, toDateKey } from "./streak.ts";

// A copy of calculateStreak exactly as it was before time-zone support, with the clock injected.
function oldCalculateStreak(createdAtDates: string[], now: Date): number {
  if (createdAtDates.length === 0) return 0;
  const dateSet = new Set(createdAtDates.map(toDateKey));
  const today = toDateKey(now.toISOString());
  const yesterday = previousDay(today);
  let cursor: string;
  if (dateSet.has(today)) cursor = today;
  else if (dateSet.has(yesterday)) cursor = yesterday;
  else return 0;
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

const KARACHI = "Asia/Karachi"; // UTC+5, no DST
const LA = "America/Los_Angeles";
const LONDON = "Europe/London";

// ---- day-key helpers ----

test("isValidTimeZone accepts IANA zones and rejects junk", () => {
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone(KARACHI), true);
  assert.equal(isValidTimeZone(LA), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("dayKeyInZone returns the local calendar day", () => {
  const instant = "2026-06-10T20:00:00Z";
  assert.equal(dayKeyInZone(instant, "UTC"), "2026-06-10");
  assert.equal(dayKeyInZone(instant, KARACHI), "2026-06-11"); // 01:00 next day
  assert.equal(dayKeyInZone(instant, LA), "2026-06-10"); // 13:00
  assert.equal(dayKeyInZone(new Date(instant), KARACHI), "2026-06-11");
});

test("dayKeyInZone falls back to UTC for an invalid zone", () => {
  assert.equal(dayKeyInZone("2026-06-10T22:00:00Z", "Not/AZone"), "2026-06-10");
  assert.equal(dayKeyInZone("2026-06-10T22:00:00Z", ""), "2026-06-10");
});

test("addDaysToKey crosses month, year and leap-day boundaries", () => {
  assert.equal(addDaysToKey("2026-03-01", -1), "2026-02-28");
  assert.equal(addDaysToKey("2028-03-01", -1), "2028-02-29");
  assert.equal(addDaysToKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToKey("2026-01-01", -1), "2025-12-31");
  assert.equal(addDaysToKey("2026-03-08", 1), "2026-03-09"); // US clock-change day
  assert.equal(addDaysToKey("2026-06-10", 0), "2026-06-10");
});

// ---- calculateStreak with a fixed clock ----

test("Karachi: an after-midnight check-in counts for the next local day", () => {
  const dates = ["2026-06-10T04:00:00Z" /* Jun 10 09:00 PKT */, "2026-06-10T20:00:00Z" /* Jun 11 01:00 PKT */];
  const now = new Date("2026-06-11T06:00:00Z"); // Jun 11 11:00 PKT
  assert.equal(calculateStreak(dates, KARACHI, now), 2);
  assert.equal(calculateStreak(dates, "UTC", now), 1); // both are Jun 10 in UTC
});

test("Los Angeles: 11:30pm local check-in that is already the next UTC day", () => {
  const dates = ["2026-06-09T18:00:00Z" /* Jun 9 11:00 PDT */, "2026-06-11T06:30:00Z" /* Jun 10 23:30 PDT */];
  const now = new Date("2026-06-11T08:00:00Z"); // Jun 11 01:00 PDT
  assert.equal(dayKeyInZone(dates[1]!, LA), "2026-06-10");
  assert.equal(calculateStreak(dates, LA, now), 2);
  assert.equal(calculateStreak(dates, "UTC", now), 1); // UTC sees Jun 9 and Jun 11: a gap
});

test("London: a 00:30 BST check-in belongs to the new local day", () => {
  const dates = ["2026-06-10T12:00:00Z" /* Jun 10 13:00 BST */, "2026-06-10T23:30:00Z" /* Jun 11 00:30 BST */];
  const now = new Date("2026-06-11T12:00:00Z");
  assert.equal(calculateStreak(dates, LONDON, now), 2);
  assert.equal(calculateStreak(dates, "UTC", now), 1);
});

test("first day: one check-in today gives a streak of 1", () => {
  const now = new Date("2026-06-11T12:00:00Z");
  assert.equal(calculateStreak(["2026-06-11T09:00:00Z"], KARACHI, now), 1);
  assert.equal(calculateStreak(["2026-06-11T09:00:00Z"], LA, now), 1);
  assert.equal(calculateStreak(["2026-06-11T09:00:00Z"], "UTC", now), 1);
});

test("yesterday still counts until the local day ends", () => {
  const now = new Date("2026-06-11T12:00:00Z");
  assert.equal(calculateStreak(["2026-06-10T09:00:00Z"], "UTC", now), 1);
});

test("missed day: streak resets", () => {
  const dates = ["2026-06-07T12:00:00Z", "2026-06-08T12:00:00Z" /* Jun 9 missed */];
  assert.equal(calculateStreak(dates, LONDON, new Date("2026-06-10T12:00:00Z")), 0);
  assert.equal(calculateStreak([...dates, "2026-06-10T08:00:00Z"], LONDON, new Date("2026-06-10T12:00:00Z")), 1);
});

test("two check-ins on the same local day count once", () => {
  // Both on Jun 10 in Karachi (06:00 and 23:00 PKT), even though the second is a different hour.
  const dates = ["2026-06-10T01:00:00Z", "2026-06-10T18:00:00Z", "2026-06-09T12:00:00Z"];
  const now = new Date("2026-06-10T19:00:00Z"); // Jun 11 00:00 PKT, so Jun 10 is yesterday
  assert.equal(calculateStreak(dates, KARACHI, now), 2);
  assert.equal(longestStreak(dates, KARACHI), 2);
});

test("US clock change days (spring forward and fall back) do not break the streak", () => {
  // Spring forward: Sun 8 Mar 2026, 02:00 -> 03:00 in LA.
  const spring = [
    "2026-03-07T20:00:00Z", // Mar 7 12:00 PST
    "2026-03-08T19:00:00Z", // Mar 8 12:00 PDT
    "2026-03-09T06:30:00Z", // Mar 8 23:30 PDT (same local day again)
    "2026-03-09T19:00:00Z", // Mar 9 12:00 PDT
  ];
  assert.equal(calculateStreak(spring, LA, new Date("2026-03-09T20:00:00Z")), 3);

  // Fall back: Sun 1 Nov 2026, 02:00 -> 01:00 in LA.
  const fall = [
    "2026-10-31T19:00:00Z", // Oct 31 12:00 PDT
    "2026-11-01T09:30:00Z", // Nov 1 01:30 PST (the second 01:30)
    "2026-11-02T20:00:00Z", // Nov 2 12:00 PST
  ];
  assert.equal(calculateStreak(fall, LA, new Date("2026-11-02T21:00:00Z")), 3);
});

test("UK clock change days do not break the streak", () => {
  // Spring forward: Sun 29 Mar 2026, 01:00 GMT -> 02:00 BST.
  const spring = [
    "2026-03-28T23:30:00Z", // Mar 28 23:30 GMT
    "2026-03-29T22:30:00Z", // Mar 29 23:30 BST
    "2026-03-29T23:30:00Z", // Mar 30 00:30 BST
  ];
  const now = new Date("2026-03-30T10:00:00Z");
  assert.equal(calculateStreak(spring, LONDON, now), 3);
  assert.equal(calculateStreak(spring, "UTC", now), 2); // UTC puts two of them on Mar 29

  // Fall back: Sun 25 Oct 2026, 02:00 BST -> 01:00 GMT.
  const fall = [
    "2026-10-24T22:30:00Z", // Oct 24 23:30 BST
    "2026-10-25T00:30:00Z", // Oct 25 01:30 BST (first 01:30)
    "2026-10-25T01:30:00Z", // Oct 25 01:30 GMT (second 01:30, same day)
    "2026-10-26T12:00:00Z", // Oct 26 12:00 GMT
  ];
  assert.equal(calculateStreak(fall, LONDON, new Date("2026-10-26T13:00:00Z")), 3);
});

test("a user whose zone changed: all check-ins are read in the zone passed now", () => {
  // Checked in from Karachi, then moved to Los Angeles.
  const dates = [
    "2026-06-09T16:00:00Z", // Jun 9 21:00 PKT / Jun 9 09:00 PDT
    "2026-06-10T22:00:00Z", // Jun 11 03:00 PKT / Jun 10 15:00 PDT
  ];
  const now = new Date("2026-06-11T00:00:00Z"); // Jun 10 17:00 PDT / Jun 11 05:00 PKT
  assert.equal(calculateStreak(dates, LA, now), 2);
  assert.equal(calculateStreak(dates, KARACHI, now), 1);
});

test("empty list gives 0", () => {
  assert.equal(calculateStreak([]), 0);
  assert.equal(calculateStreak([], LA, new Date("2026-06-11T00:00:00Z")), 0);
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak([], KARACHI), 0);
});

test("invalid time zone falls back to UTC", () => {
  const dates = ["2026-06-09T23:30:00Z", "2026-06-10T23:30:00Z", "2026-06-11T01:00:00Z"];
  const now = new Date("2026-06-11T12:00:00Z");
  const utc = calculateStreak(dates, "UTC", now);
  assert.equal(calculateStreak(dates, "Not/AZone", now), utc);
  assert.equal(calculateStreak(dates, "", now), utc);
  assert.equal(longestStreak(dates, "Not/AZone"), longestStreak(dates, "UTC"));
});

// ---- default (UTC) behaviour is identical to the old code ----

test("default UTC result matches the old calculateStreak on sample inputs (fixed clock)", () => {
  const now = new Date("2026-06-11T12:00:00Z");
  const samples: string[][] = [
    [],
    ["2026-06-11T00:00:00Z"],
    ["2026-06-10T23:59:59Z", "2026-06-09T00:00:01Z", "2026-06-08T12:00:00Z"],
    ["2026-06-11T09:00:00Z", "2026-06-11T10:00:00Z", "2026-06-10T09:00:00Z", "2026-06-08T09:00:00Z"],
    ["2026-06-09T12:00:00Z", "2026-06-08T12:00:00Z"],
    ["2026-03-01T05:00:00Z", "2026-02-28T05:00:00Z", "2026-02-27T05:00:00Z"],
    ["2026-06-11T06:30:00Z", "2026-06-10T06:30:00Z", "2026-06-09T06:30:00Z", "2026-06-08T06:30:00Z"],
  ];
  for (const dates of samples) {
    const nowForSample = dates[0]?.startsWith("2026-03") ? new Date("2026-03-01T12:00:00Z") : now;
    assert.equal(calculateStreak(dates, "UTC", nowForSample), oldCalculateStreak(dates, nowForSample), JSON.stringify(dates));
  }
});

test("one-argument calculateStreak matches the old behaviour against the real clock", () => {
  const day = 86_400_000;
  const t = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const samples: string[][] = [
    [iso(t), iso(t - day), iso(t - 2 * day)],
    [iso(t - day), iso(t - 2 * day)],
    [iso(t - 3 * day), iso(t - 4 * day)],
    [iso(t), iso(t), iso(t - 2 * day)],
  ];
  for (const dates of samples) {
    assert.equal(calculateStreak(dates), oldCalculateStreak(dates, new Date()), JSON.stringify(dates));
  }
});

// ---- longestStreak ----

test("longestStreak finds the best run, in the given zone", () => {
  const dates = [
    "2026-06-01T12:00:00Z",
    "2026-06-02T12:00:00Z",
    "2026-06-03T12:00:00Z",
    "2026-06-05T12:00:00Z",
    "2026-06-06T12:00:00Z",
  ];
  assert.equal(longestStreak(dates), 3);
  assert.equal(longestStreak(["2026-06-01T12:00:00Z"]), 1);
  // Across a month boundary.
  assert.equal(longestStreak(["2026-05-31T12:00:00Z", "2026-06-01T12:00:00Z"]), 2);
  // LA 11:30pm check-in joins the previous local day's run.
  const la = ["2026-06-09T18:00:00Z", "2026-06-11T06:30:00Z"];
  assert.equal(longestStreak(la, LA), 2);
  assert.equal(longestStreak(la, "UTC"), 1);
});
