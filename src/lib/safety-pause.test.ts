// Run with: node --test src/lib/safety.test.ts src/lib/safety-pause.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Tests for the safety pause: the pure calculator (src/lib/safety-pause.ts), then everything that reads or
// writes flags around it. No test here touches a real database or calls any AI.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEVEL1_PAUSE_HOURS,
  LEVEL2_PAUSE_HOURS,
  PAUSE_LOOKBACK_HOURS,
  REPEAT_MIN_GAP_MINUTES,
  REPEAT_PAUSE_HOURS,
  REPEAT_WINDOW_HOURS,
  SOFT_NUDGE_HOURS,
  computePause,
  minutesLeft,
  type PauseFlag,
} from "./safety-pause.ts";
import { describePauseWait, gentleNoticeText, level1PauseLine } from "./safety.ts";
import { SOFT_NUDGE_LINES, buildPushNudge } from "./roast-nudge.ts";
import { getGentleState, getGentleUserIds, getPauseSummaries, recordFlag, recordFlagAndReadPause } from "./safety-server.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const H = 3_600_000;
const M = 60_000;
/** An ISO timestamp this many hours before NOW. */
const hoursAgo = (h: number) => new Date(NOW - h * H).toISOString();
/** An ISO timestamp this many minutes before NOW. */
const minutesAgo = (m: number) => new Date(NOW - m * M).toISOString();
const flag = (level: number, createdAt: string, fromContact?: boolean): PauseFlag => ({ level, createdAt, fromContact });
// recordFlagAndReadPause reads the REAL clock (like the routes do), so tests that go through it seed rows relative to the real now.
const realHoursAgo = (h: number) => new Date(Date.now() - h * H).toISOString();
const realMinutesAgo = (m: number) => new Date(Date.now() - m * M).toISOString();

// ---------------------------------------------------------------------------
// The constants
// ---------------------------------------------------------------------------

test("pause constants are the agreed numbers, and the database look-back covers the longest possible chain", () => {
  assert.equal(LEVEL1_PAUSE_HOURS, 24);
  assert.equal(LEVEL2_PAUSE_HOURS, 72);
  assert.equal(REPEAT_PAUSE_HOURS, 72);
  assert.equal(REPEAT_WINDOW_HOURS, 72);
  assert.equal(REPEAT_MIN_GAP_MINUTES, 60);
  assert.equal(SOFT_NUDGE_HOURS, 72);
  // the longest a flag can matter is its 72 h pause + the 72 h soft window = 144 h, and that flag may need an
  // earlier Level 1 flag up to 72 h before it: 216 hours (9 days)
  assert.equal(PAUSE_LOOKBACK_HOURS, 216);
});

// ---------------------------------------------------------------------------
// No flags
// ---------------------------------------------------------------------------

test("no flags / an empty list / unreadable rows = not paused", () => {
  const open = { paused: false, endsAt: null, level: null, repeat: false, flaggedAt: null };
  for (const flags of [[], undefined as unknown as PauseFlag[], null as unknown as PauseFlag[]]) {
    const r = computePause(flags, NOW);
    assert.deepEqual({ paused: r.paused, endsAt: r.endsAt, level: r.level, repeat: r.repeat, flaggedAt: r.flaggedAt }, open);
    assert.equal(r.lastFlagAt, null);
    assert.equal(r.softNudge, false);
  }
  // level 0 / 3 / a string level / a bad date are not flags
  const junk = computePause(
    [flag(0, hoursAgo(1)), flag(3, hoursAgo(1)), { level: "1" as unknown as number, createdAt: hoursAgo(1) }, flag(1, "not a date"), null as unknown as PauseFlag],
    NOW,
  );
  assert.equal(junk.paused, false);
  assert.equal(junk.lastFlagAt, null);
  assert.equal(computePause([flag(1, hoursAgo(1))], Number.NaN).paused, false);
});

// ---------------------------------------------------------------------------
// A single Level 1 flag: 24 hours
// ---------------------------------------------------------------------------

test("Level 1 at 23 hours = still paused (1 hour left); at 25 hours = open again", () => {
  const at23 = computePause([flag(1, hoursAgo(23))], NOW);
  assert.equal(at23.paused, true);
  assert.equal(at23.level, 1);
  assert.equal(at23.repeat, false);
  assert.equal(at23.flaggedAt, hoursAgo(23));
  assert.equal(at23.endsAt, new Date(NOW + 1 * H).toISOString());
  assert.equal(minutesLeft(at23, NOW), 60);

  const at25 = computePause([flag(1, hoursAgo(25))], NOW);
  assert.equal(at25.paused, false);
  assert.equal(at25.endsAt, null);
  assert.equal(minutesLeft(at25, NOW), null);
  // ... but the nudge copy is still soft (it is inside the 3 days)
  assert.equal(at25.softNudge, true);
  assert.equal(at25.lastFlagAt, hoursAgo(25));
});

test("Level 1: the pause ends exactly 24 hours after the flag (open at the boundary)", () => {
  assert.equal(computePause([flag(1, hoursAgo(24))], NOW).paused, false);
  assert.equal(computePause([flag(1, new Date(NOW - 24 * H + 1).toISOString())], NOW).paused, true);
  // a brand-new flag = the full 24 hours
  const fresh = computePause([flag(1, new Date(NOW).toISOString())], NOW);
  assert.equal(minutesLeft(fresh, NOW), 24 * 60);
});

// ---------------------------------------------------------------------------
// Level 2: 72 hours
// ---------------------------------------------------------------------------

test("Level 2 at 71 hours = still paused; at 73 hours = open again", () => {
  const at71 = computePause([flag(2, hoursAgo(71))], NOW);
  assert.equal(at71.paused, true);
  assert.equal(at71.level, 2);
  assert.equal(at71.repeat, false);
  assert.equal(at71.endsAt, new Date(NOW + 1 * H).toISOString());

  const at73 = computePause([flag(2, hoursAgo(73))], NOW);
  assert.equal(at73.paused, false);
  assert.equal(at73.level, null);
  assert.equal(at73.softNudge, true); // the soft 3 days run AFTER the 72 h pause: until 144 h after the flag
});

// ---------------------------------------------------------------------------
// Two Level 1 flags: the repeat rule
// ---------------------------------------------------------------------------

test("repeat Level 1: a second flag 71 hours after the first is a repeat; 73 hours after is not", () => {
  // first flag at T0, second flag at T0 + 71 h; NOW is 1 hour after the second
  const second71 = hoursAgo(1);
  const first71 = new Date(NOW - 1 * H - 71 * H).toISOString();
  const r71 = computePause([flag(1, first71), flag(1, second71)], NOW);
  assert.equal(r71.paused, true);
  assert.equal(r71.repeat, true);
  assert.equal(r71.level, 1);
  assert.equal(r71.flaggedAt, second71);
  assert.equal(r71.endsAt, new Date(NOW - 1 * H + 72 * H).toISOString()); // second flag + 72 h

  // second flag at T0 + 73 h: the first one is too old to count
  const first73 = new Date(NOW - 1 * H - 73 * H).toISOString();
  const r73 = computePause([flag(1, first73), flag(1, second71)], NOW);
  assert.equal(r73.paused, true);
  assert.equal(r73.repeat, false);
  assert.equal(r73.endsAt, new Date(NOW - 1 * H + 24 * H).toISOString()); // second flag + 24 h
});

test("repeat Level 1: a second flag 59 minutes after the first is NOT a repeat; 61 minutes after is", () => {
  const second = minutesAgo(10);
  const first59 = new Date(NOW - 10 * M - 59 * M).toISOString();
  const r59 = computePause([flag(1, first59), flag(1, second)], NOW);
  assert.equal(r59.repeat, false);
  assert.equal(r59.endsAt, new Date(NOW - 10 * M + 24 * H).toISOString());

  const first61 = new Date(NOW - 10 * M - 61 * M).toISOString();
  const r61 = computePause([flag(1, first61), flag(1, second)], NOW);
  assert.equal(r61.repeat, true);
  assert.equal(r61.endsAt, new Date(NOW - 10 * M + 72 * H).toISOString());
});

test("repeat Level 1: both edges are inclusive (exactly 60 minutes and exactly 72 hours apart are repeats; a millisecond outside is not)", () => {
  const second = hoursAgo(2);
  const secondMs = NOW - 2 * H;
  const gap = (ms: number) => new Date(secondMs - ms).toISOString();
  assert.equal(computePause([flag(1, gap(60 * M)), flag(1, second)], NOW).repeat, true);
  assert.equal(computePause([flag(1, gap(60 * M - 1)), flag(1, second)], NOW).repeat, false);
  assert.equal(computePause([flag(1, gap(72 * H)), flag(1, second)], NOW).repeat, true);
  assert.equal(computePause([flag(1, gap(72 * H + 1)), flag(1, second)], NOW).repeat, false);
});

test("repeat Level 1: the longer pause is measured from the SECOND flag, not the first", () => {
  // first 100 h ago, second 50 h ago (50 h apart). Second + 72 h = 22 h from now. First + 72 h would already be over.
  const r = computePause([flag(1, hoursAgo(100)), flag(1, hoursAgo(50))], NOW);
  assert.equal(r.paused, true);
  assert.equal(r.repeat, true);
  assert.equal(r.flaggedAt, hoursAgo(50));
  assert.equal(r.endsAt, new Date(NOW + 22 * H).toISOString());
  assert.equal(minutesLeft(r, NOW), 22 * 60);
  // once that is over the user is open again
  assert.equal(computePause([flag(1, hoursAgo(100)), flag(1, hoursAgo(73))], NOW).paused, false);
});

test("repeat Level 1: two flags 2 hours apart = 72 hours from the second; three quick flags: only the one 60+ minutes after the first is a repeat", () => {
  const r = computePause([flag(1, hoursAgo(3)), flag(1, hoursAgo(1))], NOW);
  assert.equal(r.repeat, true);
  assert.equal(r.endsAt, new Date(NOW - 1 * H + 72 * H).toISOString());

  // t0, t0 + 30 min, t0 + 90 min (all within the last 2 hours; NOW is 5 minutes after the last)
  const t3 = NOW - 5 * M;
  const t2 = t3 - 60 * M; // 60 min before the third
  const t1 = t2 - 30 * M; // 30 min before the second (90 before the third)
  const flags = [flag(1, new Date(t1).toISOString()), flag(1, new Date(t2).toISOString()), flag(1, new Date(t3).toISOString())];
  // the second is only 30 min after the first = not a repeat; the third is 90 min after the first = a repeat
  assert.equal(computePause(flags.slice(0, 2), NOW).repeat, false);
  const all = computePause(flags, NOW);
  assert.equal(all.repeat, true);
  assert.equal(all.flaggedAt, new Date(t3).toISOString());
});

test("the answer does not depend on the order the flags arrive in, and the input list is not changed", () => {
  const flags = [flag(1, hoursAgo(30)), flag(2, hoursAgo(12)), flag(1, hoursAgo(5)), flag(1, hoursAgo(60), true)];
  const copy = flags.map((f) => ({ ...f }));
  const a = computePause(flags, NOW);
  const b = computePause([...flags].reverse(), NOW);
  const c = computePause([flags[2]!, flags[0]!, flags[3]!, flags[1]!], NOW);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.deepEqual(flags, copy);
});

// ---------------------------------------------------------------------------
// Level 1 and Level 2 together: the LATEST end wins
// ---------------------------------------------------------------------------

test("Level 1 then Level 2: the Level 2 pause (72 h from the Level 2 flag) wins", () => {
  const r = computePause([flag(1, hoursAgo(10)), flag(2, hoursAgo(5))], NOW);
  assert.equal(r.paused, true);
  assert.equal(r.level, 2);
  assert.equal(r.repeat, false);
  assert.equal(r.flaggedAt, hoursAgo(5));
  assert.equal(r.endsAt, new Date(NOW - 5 * H + 72 * H).toISOString());
});

test("Level 2 then a later Level 1: the Level 2 pause is still the one that ends last", () => {
  const r = computePause([flag(2, hoursAgo(30)), flag(1, hoursAgo(1))], NOW);
  assert.equal(r.level, 2);
  assert.equal(r.endsAt, new Date(NOW - 30 * H + 72 * H).toISOString()); // 42 h left, not the Level 1 flag's 23 h
  // when the Level 2 pause is over but the later Level 1 flag is still inside its 24 h, the Level 1 pause takes over
  const later = computePause([flag(2, hoursAgo(73)), flag(1, hoursAgo(2))], NOW);
  assert.equal(later.level, 1);
  assert.equal(later.endsAt, new Date(NOW - 2 * H + 24 * H).toISOString());
});

test("a Level 2 flag never counts as the first Level 1 of a repeat", () => {
  const r = computePause([flag(2, hoursAgo(80)), flag(1, hoursAgo(3))], NOW);
  assert.equal(r.paused, true);
  assert.equal(r.repeat, false);
  assert.equal(r.endsAt, new Date(NOW - 3 * H + 24 * H).toISOString());
});

// ---------------------------------------------------------------------------
// Contact-form flags: they pause, but they never count toward the repeat rule
// ---------------------------------------------------------------------------

test("a contact-form Level 1 flag starts a normal 24 h pause on its own", () => {
  const r = computePause([flag(1, hoursAgo(23), true)], NOW);
  assert.equal(r.paused, true);
  assert.equal(r.repeat, false);
  assert.equal(r.endsAt, new Date(NOW + 1 * H).toISOString());
  assert.equal(computePause([flag(1, hoursAgo(25), true)], NOW).paused, false);
});

test("a contact-form Level 2 flag is a normal Level 2 pause (72 h)", () => {
  const r = computePause([flag(2, hoursAgo(71), true)], NOW);
  assert.equal(r.paused, true);
  assert.equal(r.level, 2);
});

test("contact-form Level 1 flags never make a repeat: not as the first flag, not as the second, not two of them", () => {
  // roast / check-in flag 3 h ago + contact flag 1 h ago
  assert.equal(computePause([flag(1, hoursAgo(3)), flag(1, hoursAgo(1), true)], NOW).repeat, false);
  // contact flag 3 h ago + roast / check-in flag 1 h ago
  const second = computePause([flag(1, hoursAgo(3), true), flag(1, hoursAgo(1))], NOW);
  assert.equal(second.repeat, false);
  assert.equal(second.endsAt, new Date(NOW - 1 * H + 24 * H).toISOString());
  // two contact flags
  assert.equal(computePause([flag(1, hoursAgo(5), true), flag(1, hoursAgo(1), true)], NOW).repeat, false);
  // a contact flag in the middle does not hide a real repeat around it
  assert.equal(computePause([flag(1, hoursAgo(6)), flag(1, hoursAgo(4), true), flag(1, hoursAgo(1))], NOW).repeat, true);
  // fromContact missing / null / false all mean "roast or check-in"
  assert.equal(computePause([{ level: 1, createdAt: hoursAgo(3) }, { level: 1, createdAt: hoursAgo(1), fromContact: null }], NOW).repeat, true);
});

// ---------------------------------------------------------------------------
// Input shapes and the 3 soft days
// ---------------------------------------------------------------------------

test("flag times can be ISO strings, Date objects or epoch milliseconds", () => {
  const ms = NOW - 5 * H;
  const iso = computePause([flag(1, new Date(ms).toISOString())], NOW);
  assert.deepEqual(computePause([{ level: 1, createdAt: new Date(ms) }], NOW), iso);
  assert.deepEqual(computePause([{ level: 1, createdAt: ms }], NOW), iso);
  // Postgres-style timestamps with an offset
  assert.equal(computePause([{ level: 1, createdAt: "2026-03-10T05:00:00+00:00" }], NOW).paused, true);
});

test("softNudge: starts at the flag, lasts through the pause, and ends 3 days AFTER the pause ends (Level 1: 24 h + 3 days = 96 h)", () => {
  assert.equal(computePause([flag(1, hoursAgo(95))], NOW).softNudge, true);
  assert.equal(computePause([flag(1, hoursAgo(97))], NOW).softNudge, false);
  // the edge is exclusive: exactly 96 hours after the flag the soft window is over
  assert.equal(computePause([flag(1, hoursAgo(96))], NOW).softNudge, false);
  assert.equal(computePause([flag(1, new Date(NOW - 96 * H + 1).toISOString())], NOW).softNudge, true);
  // while the pause is still running it is soft too (the cron skips paused users anyway)
  const during = computePause([flag(1, hoursAgo(5))], NOW);
  assert.equal(during.paused, true);
  assert.equal(during.softNudge, true);
  assert.equal(during.softUntil, new Date(NOW - 5 * H + 96 * H).toISOString());
  // 30 hours after the flag the pause is over, and the window runs to flag + 24 h + 72 h, NOT flag + 72 h
  const after = computePause([flag(1, hoursAgo(30))], NOW);
  assert.equal(after.paused, false);
  assert.equal(after.softNudge, true);
  assert.equal(after.softUntil, new Date(NOW - 30 * H + 96 * H).toISOString());
  assert.notEqual(after.softUntil, new Date(NOW - 30 * H + 72 * H).toISOString());
  // 80 hours after the flag: under the old "3 days from the flag" rule this was already over; now it is still soft
  assert.equal(computePause([flag(1, hoursAgo(80))], NOW).softNudge, true);
});

test("softNudge: a Level 2 or a repeat Level 1 (72 h pause) is soft for 72 h + 3 days = 144 h from the flag", () => {
  assert.equal(computePause([flag(2, hoursAgo(143))], NOW).softNudge, true);
  assert.equal(computePause([flag(2, hoursAgo(145))], NOW).softNudge, false);
  assert.equal(computePause([flag(2, hoursAgo(144))], NOW).softNudge, false);
  assert.equal(computePause([flag(2, hoursAgo(100))], NOW).softUntil, new Date(NOW - 100 * H + 144 * H).toISOString());

  // repeat: the second flag is 100 h old, the first was 70 h before it (170 h old). The repeat pause (72 h) ended
  // 28 h ago and the soft window runs to second flag + 144 h = 44 h from now ...
  const repeat = computePause([flag(1, hoursAgo(170)), flag(1, hoursAgo(100))], NOW);
  assert.equal(repeat.paused, false);
  assert.equal(repeat.softNudge, true);
  assert.equal(repeat.softUntil, new Date(NOW - 100 * H + 144 * H).toISOString());
  // ... while the same second flag on its own (a plain 24 h pause) is already past its 96 h
  assert.equal(computePause([flag(1, hoursAgo(100))], NOW).softNudge, false);
});

test("softNudge: contact-form flags count (they start a pause); several flags use the LATEST pause end; no flags = never soft", () => {
  assert.equal(computePause([flag(1, hoursAgo(90), true)], NOW).softNudge, true);
  assert.equal(computePause([flag(1, hoursAgo(97), true)], NOW).softNudge, false);
  // an old Level 2 (soft long over) followed by a recent Level 1: the Level 1's window is the one that counts
  const mixed = computePause([flag(2, hoursAgo(200)), flag(1, hoursAgo(10))], NOW);
  assert.equal(mixed.softUntil, new Date(NOW - 10 * H + 96 * H).toISOString());
  // a recent Level 2 followed by an older-ending Level 1: the later end wins
  const l2 = computePause([flag(2, hoursAgo(60)), flag(1, hoursAgo(50))], NOW);
  assert.equal(l2.softUntil, new Date(NOW - 60 * H + 144 * H).toISOString());
  const none = computePause([], NOW);
  assert.equal(none.softNudge, false);
  assert.equal(none.softUntil, null);
  assert.equal(computePause([flag(1, hoursAgo(200))], NOW).softUntil, null);
});

test("minutesLeft rounds UP to a whole minute and never goes negative", () => {
  const p = { paused: true, endsAt: new Date(NOW + 61_000).toISOString() };
  assert.equal(minutesLeft(p, NOW), 2);
  assert.equal(minutesLeft({ paused: true, endsAt: new Date(NOW - 5000).toISOString() }, NOW), 0);
  assert.equal(minutesLeft({ paused: false, endsAt: null }, NOW), null);
  assert.equal(minutesLeft({ paused: true, endsAt: "garbage" }, NOW), null);
});


// ===========================================================================
// Everything below: the code that reads and writes flags around the calculator.
// A fake database stands in for Supabase: it really filters, orders and pages rows, and it records every call,
// so the tests can prove that a pause check only ever READS.
// ===========================================================================

type Row = { id: string; user_id: string; level: number; created_at: string; from_contact?: boolean };

type FakeConfig = {
  rows?: Row[];
  /** every read fails with this error */
  readError?: { code?: string; message?: string };
  /** the from_contact column does not exist (migration 030 not applied): any select/insert naming it fails */
  noFromContactColumn?: boolean;
  /** the Nth read (0 = first) fails with readError, the others work */
  failReadNumber?: number;
  /** the insert returns this many rows (default 1) */
  insertReturnsRows?: number;
  insertError?: { code?: string; message?: string };
  throwOnFrom?: boolean;
};

function fakeDb(config: FakeConfig = {}) {
  const rows: Row[] = [...(config.rows ?? [])];
  const calls: string[] = [];
  const inserted: Array<Record<string, unknown>> = [];
  let reads = 0;
  let nextId = 1;
  const columnMissing = { code: "42703", message: "column safety_flags.from_contact does not exist" };

  const client = {
    from(table: string) {
      assert.equal(table, "safety_flags");
      if (config.throwOnFrom) throw new Error("boom: I want to end it all");
      return {
        insert(row: Record<string, unknown>) {
          calls.push("insert");
          inserted.push(row);
          return {
            select: async (columns: string) => {
              assert.equal(columns, "id"); // only the id is read back
              if (config.noFromContactColumn && "from_contact" in row) return { data: null, error: columnMissing };
              if (config.insertError) return { data: null, error: config.insertError };
              const count = config.insertReturnsRows ?? 1;
              const made: Row[] = [];
              for (let i = 0; i < count; i++) {
                const made1: Row = { id: `new-${nextId++}`, user_id: String(row.user_id), level: Number(row.level), created_at: new Date().toISOString(), from_contact: row.from_contact === true };
                made.push(made1);
              }
              rows.push(...made);
              return { data: made.map((m) => ({ id: m.id })), error: null };
            },
          };
        },
        update() {
          calls.push("update");
          throw new Error("a pause check must never update");
        },
        delete() {
          calls.push("delete");
          throw new Error("a pause check must never delete");
        },
        upsert() {
          calls.push("upsert");
          throw new Error("a pause check must never upsert");
        },
        select(columns: string) {
          const readNumber = reads++;
          calls.push(`select ${columns}`);
          const filters: Array<(r: Row) => boolean> = [];
          const ordering: { column: string; ascending: boolean }[] = [];
          let slice: [number, number] | null = null;
          const builder: Record<string, unknown> = {
            eq(column: string, value: unknown) {
              calls.push(`eq ${column}`);
              filters.push((r) => (r as unknown as Record<string, unknown>)[column] === value);
              return builder;
            },
            gte(column: string, value: string) {
              calls.push(`gte ${column}`);
              filters.push((r) => Date.parse((r as unknown as Record<string, string>)[column]!) >= Date.parse(value));
              return builder;
            },
            order(column: string, options?: { ascending?: boolean }) {
              calls.push(`order ${column}`);
              ordering.push({ column, ascending: options?.ascending !== false });
              return builder;
            },
            limit(n: number) {
              calls.push(`limit ${n}`);
              slice = [0, n - 1];
              return builder;
            },
            range(from: number, to: number) {
              calls.push(`range ${from}-${to}`);
              slice = [from, to];
              return builder;
            },
            then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
              let result: { data: unknown; error: unknown };
              if (config.noFromContactColumn && columns.includes("from_contact")) {
                result = { data: null, error: columnMissing };
              } else if (config.readError && (config.failReadNumber === undefined || config.failReadNumber === readNumber)) {
                result = { data: null, error: config.readError };
              } else {
                let out = rows.filter((r) => filters.every((f) => f(r)));
                for (const o of [...ordering].reverse()) {
                  out = [...out].sort((a, b) => {
                    const av = String((a as unknown as Record<string, unknown>)[o.column]);
                    const bv = String((b as unknown as Record<string, unknown>)[o.column]);
                    return (av < bv ? -1 : av > bv ? 1 : 0) * (o.ascending ? 1 : -1);
                  });
                }
                if (slice) out = out.slice(slice[0], slice[1] + 1);
                const wanted = columns.split(",").map((c) => c.trim());
                result = { data: out.map((r) => Object.fromEntries(wanted.map((c) => [c, (r as unknown as Record<string, unknown>)[c]]))), error: null };
              }
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, rows, calls, inserted };
}

/** Captures console.error / console.warn lines while `fn` runs. */
async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; errors: string[]; warns: string[] }> {
  const errors: string[] = [];
  const warns: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...a: unknown[]) => errors.push(a.join(" "));
  console.warn = (...a: unknown[]) => warns.push(a.join(" "));
  try {
    return { result: await fn(), errors, warns };
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

let idCounter = 0;
const row = (userId: string, level: number, createdAt: string, fromContact = false): Row => ({ id: `r${String(++idCounter).padStart(6, "0")}`, user_id: userId, level, created_at: createdAt, from_contact: fromContact });
const WRITES = ["insert", "update", "delete", "upsert"];

// ---------------------------------------------------------------------------
// getGentleState: the user states from the task
// ---------------------------------------------------------------------------

test("getGentleState: no flag = not paused", async () => {
  const db = fakeDb({ rows: [row("someone-else", 2, hoursAgo(1))] });
  const s = await getGentleState(db.client, "u1", NOW);
  assert.equal(s.active, false);
  assert.equal(s.minutesLeft, null);
  assert.equal(s.until, null);
  assert.equal(s.softNudge, false);
});

test("getGentleState: Level 1 at 23 hours = paused (60 minutes left); at 25 hours = open (but nudges stay soft)", async () => {
  const at23 = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(23))] }).client, "u1", NOW);
  assert.equal(at23.active, true);
  assert.equal(at23.level, 1);
  assert.equal(at23.repeat, false);
  assert.equal(at23.minutesLeft, 60);

  const at25 = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(25))] }).client, "u1", NOW);
  assert.equal(at25.active, false);
  assert.equal(at25.softNudge, true);
});

test("getGentleState: two Level 1 flags 2 hours apart = the 72 hour pause, counted from the second", async () => {
  const s = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(3)), row("u1", 1, hoursAgo(1))] }).client, "u1", NOW);
  assert.equal(s.active, true);
  assert.equal(s.repeat, true);
  assert.equal(s.level, 1);
  assert.equal(s.minutesLeft, 71 * 60);
  assert.equal(s.until, new Date(NOW - 1 * H + 72 * H).toISOString());
});

test("getGentleState: a repeat flag finds its earlier flag even when that one is 170 hours old (look-back is 216 hours), and the soft window follows", async () => {
  // second flag 70 h ago, first flag 140 h ago (70 h earlier): a repeat, paused, 2 hours left
  const s = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(140)), row("u1", 1, hoursAgo(70))] }).client, "u1", NOW);
  assert.equal(s.active, true);
  assert.equal(s.repeat, true);
  assert.equal(s.minutesLeft, 2 * 60);
  // second flag 100 h ago, first flag 170 h ago: the 72 h pause is over, but the soft window (to 144 h) still runs.
  // That needs the 170-hour-old flag to be read: a 144-hour look-back would have missed it and said "not soft".
  const soft = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(170)), row("u1", 1, hoursAgo(100))] }).client, "u1", NOW);
  assert.equal(soft.active, false);
  assert.equal(soft.softNudge, true);
  // the same second flag alone: soft is over (96 h)
  const alone = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(100))] }).client, "u1", NOW);
  assert.equal(alone.softNudge, false);
});

test("getGentleState: Level 2 at 71 hours = paused; at 73 hours = open", async () => {
  const at71 = await getGentleState(fakeDb({ rows: [row("u1", 2, hoursAgo(71))] }).client, "u1", NOW);
  assert.equal(at71.active, true);
  assert.equal(at71.level, 2);
  assert.equal(at71.minutesLeft, 60);
  const at73 = await getGentleState(fakeDb({ rows: [row("u1", 2, hoursAgo(73))] }).client, "u1", NOW);
  assert.equal(at73.active, false);
});

test("getGentleState: a contact-form flag pauses, but two of them (or one plus a check-in flag) are not a repeat", async () => {
  const one = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(3), true)] }).client, "u1", NOW);
  assert.equal(one.active, true);
  assert.equal(one.repeat, false);
  const mixed = await getGentleState(fakeDb({ rows: [row("u1", 1, hoursAgo(3), true), row("u1", 1, hoursAgo(1))] }).client, "u1", NOW);
  assert.equal(mixed.repeat, false);
  assert.equal(mixed.minutesLeft, 23 * 60);
});

test("getGentleState: another user's flags never count", async () => {
  const db = fakeDb({ rows: [row("u2", 2, hoursAgo(1)), row("u3", 1, hoursAgo(2)), row("u3", 1, hoursAgo(1))] });
  assert.equal((await getGentleState(db.client, "u1", NOW)).active, false);
  assert.equal((await getGentleState(db.client, "u2", NOW)).level, 2);
});

// ---------------------------------------------------------------------------
// getGentleState: fails OPEN, reads only
// ---------------------------------------------------------------------------

test("getGentleState: a database error = not paused (fails open), and only the error code is logged", async () => {
  const db = fakeDb({ rows: [row("u1", 2, hoursAgo(1))], readError: { code: "42P01", message: "relation safety_flags does not exist: I want to end it all" } });
  const { result, errors } = await captureLogs(() => getGentleState(db.client, "u1", NOW));
  assert.equal(result.active, false);
  assert.deepEqual(errors, ["[safety] gentle read failed code=42P01"]);
});

test("getGentleState: a thrown error = not paused, and nothing from the error text is logged", async () => {
  const { result, errors } = await captureLogs(() => getGentleState(fakeDb({ throwOnFrom: true }).client, "u1", NOW));
  assert.equal(result.active, false);
  assert.deepEqual(errors, ["[safety] gentle read failed code=exception"]);
});

test("getGentleState only READS: one select for this user since the 144 h look-back, no write of any kind", async () => {
  const db = fakeDb({ rows: [row("u1", 1, hoursAgo(1)), row("u1", 1, hoursAgo(5))] });
  await getGentleState(db.client, "u1", NOW);
  for (const w of WRITES) assert.ok(!db.calls.includes(w), `a pause check must not ${w}`);
  assert.deepEqual(db.calls, ["select level, created_at, from_contact", "eq user_id", "gte created_at", "order created_at", "limit 200"]);
  assert.equal(db.rows.length, 2); // nothing was added or removed
});

test("getGentleState: before migration 030 (no from_contact column) it reads without it, warns, and does NOT fail open", async () => {
  const db = fakeDb({ rows: [row("u1", 1, hoursAgo(2))], noFromContactColumn: true });
  const { result, errors, warns } = await captureLogs(() => getGentleState(db.client, "u1", NOW));
  assert.equal(result.active, true);
  assert.equal(result.minutesLeft, 22 * 60);
  assert.deepEqual(errors, []);
  assert.equal(warns.length, 1);
  assert.match(warns[0]!, /from_contact column missing/);
  assert.deepEqual(db.calls.filter((c) => c.startsWith("select")), ["select level, created_at, from_contact", "select level, created_at"]);
});

// ---------------------------------------------------------------------------
// recordFlag with the contact form marker
// ---------------------------------------------------------------------------

test("recordFlag: roast / check-in flags are written exactly as before (user_id + level, no from_contact)", async () => {
  const db = fakeDb();
  assert.equal(await recordFlag(db.client, "u1", 1), true);
  assert.equal(await recordFlag(db.client, "u1", 2), true);
  assert.deepEqual(db.inserted, [{ user_id: "u1", level: 1 }, { user_id: "u1", level: 2 }]);
});

test("recordFlag: the contact form marks its flag from_contact = true, and the write is verified", async () => {
  const db = fakeDb();
  assert.equal(await recordFlag(db.client, "u1", 1, { fromContact: true }), true);
  assert.deepEqual(db.inserted, [{ user_id: "u1", level: 1, from_contact: true }]);
  assert.equal(db.rows[0]!.from_contact, true);

  const none = fakeDb({ insertReturnsRows: 0 });
  const { result, errors } = await captureLogs(() => recordFlag(none.client, "u1", 1, { fromContact: true }));
  assert.equal(result, false);
  assert.deepEqual(errors, ["[safety] flag write failed code=no-row"]);
});

test("recordFlag: before migration 030 a contact flag is still saved (without the marker), with a warning, and still verified", async () => {
  const db = fakeDb({ noFromContactColumn: true });
  const { result, errors, warns } = await captureLogs(() => recordFlag(db.client, "u1", 2, { fromContact: true }));
  assert.equal(result, true);
  assert.deepEqual(errors, []);
  assert.equal(warns.length, 1);
  assert.deepEqual(db.inserted, [{ user_id: "u1", level: 2, from_contact: true }, { user_id: "u1", level: 2 }]);
  assert.equal(db.rows.length, 1);
  // a different error is NOT retried
  const broken = fakeDb({ insertError: { code: "23503", message: "x" } });
  const again = await captureLogs(() => recordFlag(broken.client, "u1", 1, { fromContact: true }));
  assert.equal(again.result, false);
  assert.equal(broken.inserted.length, 1);
  assert.deepEqual(again.errors, ["[safety] flag write failed code=23503"]);
});

// ---------------------------------------------------------------------------
// recordFlagAndReadPause: what the Level 1 page is told
// ---------------------------------------------------------------------------

test("recordFlagAndReadPause: a first Level 1 flag = 24 hours (1440 minutes); a second one 2 hours later = 3 days (4320 minutes)", async () => {
  const first = fakeDb();
  const a = await recordFlagAndReadPause(first.client, "u1", 1);
  assert.equal(a.saved, true);
  assert.equal(a.minutesLeft, 24 * 60);

  const second = fakeDb({ rows: [row("u1", 1, realHoursAgo(2))] });
  const b = await recordFlagAndReadPause(second.client, "u1", 1);
  assert.equal(b.saved, true);
  assert.equal(b.minutesLeft, 72 * 60);
});

test("recordFlagAndReadPause: a quick retype (second Level 1 under 60 minutes later) is still 24 hours", async () => {
  const db = fakeDb({ rows: [row("u1", 1, realMinutesAgo(30))] });
  assert.equal((await recordFlagAndReadPause(db.client, "u1", 1)).minutesLeft, 24 * 60);
  // ... while the same flag 61 minutes earlier IS a repeat (proves the seed is inside the look-back and the rule is live)
  const later = fakeDb({ rows: [row("u1", 1, realMinutesAgo(61))] });
  assert.equal((await recordFlagAndReadPause(later.client, "u1", 1)).minutesLeft, 72 * 60);
});

test("recordFlagAndReadPause: a contact-form Level 1 after a check-in Level 1 is 24 hours, not 72", async () => {
  const db = fakeDb({ rows: [row("u1", 1, realHoursAgo(2))] });
  assert.equal((await recordFlagAndReadPause(db.client, "u1", 1, { fromContact: true })).minutesLeft, 24 * 60);
  // ... and the same two flags WITHOUT the contact marker are a repeat
  const plain = fakeDb({ rows: [row("u1", 1, realHoursAgo(2))] });
  assert.equal((await recordFlagAndReadPause(plain.client, "u1", 1)).minutesLeft, 72 * 60);
});

test("recordFlagAndReadPause: if the flag was NOT saved the page is told nothing about time, and no read is made", async () => {
  const db = fakeDb({ insertReturnsRows: 0 });
  const { result } = await captureLogs(() => recordFlagAndReadPause(db.client, "u1", 1));
  assert.deepEqual(result, { saved: false, minutesLeft: null });
  assert.deepEqual(db.calls, ["insert"]);
});

test("recordFlagAndReadPause: if the flag was saved but the read fails, the page is told nothing about time", async () => {
  const db = fakeDb({ readError: { code: "57014" } });
  const { result } = await captureLogs(() => recordFlagAndReadPause(db.client, "u1", 1));
  assert.deepEqual(result, { saved: true, minutesLeft: null });
});

// ---------------------------------------------------------------------------
// The crons: getPauseSummaries / getGentleUserIds
// ---------------------------------------------------------------------------

test("getPauseSummaries: paused users and users inside the 3 soft days are listed; everyone else is not", async () => {
  const db = fakeDb({
    rows: [
      row("paused-l1", 1, hoursAgo(5)),
      row("open-but-soft", 1, hoursAgo(30)),
      row("paused-l2", 2, hoursAgo(70)),
      row("repeat", 1, hoursAgo(100)),
      row("repeat", 1, hoursAgo(50)),
      row("soft-after-l2", 2, hoursAgo(100)),
      row("soft-after-l1", 1, hoursAgo(80)),
      row("old", 1, hoursAgo(100)),
      row("old-l2", 2, hoursAgo(150)),
    ],
  });
  const summaries = await getPauseSummaries(db.client, NOW);
  // "old" (Level 1, 100 h ago) is past 24 h + 3 days; "old-l2" (Level 2, 150 h ago) is past 72 h + 3 days
  assert.deepEqual([...summaries.keys()].sort(), ["open-but-soft", "paused-l1", "paused-l2", "repeat", "soft-after-l1", "soft-after-l2"]);
  assert.deepEqual(summaries.get("soft-after-l2"), { paused: false, until: null, softNudge: true });
  assert.equal(summaries.get("soft-after-l1")!.softNudge, true);
  assert.equal(summaries.get("paused-l1")!.paused, true);
  assert.equal(summaries.get("open-but-soft")!.paused, false);
  assert.equal(summaries.get("open-but-soft")!.softNudge, true);
  assert.equal(summaries.get("paused-l2")!.paused, true);
  assert.equal(summaries.get("repeat")!.paused, true);
  assert.equal(summaries.has("old"), false);

  const ids = await getGentleUserIds(db.client, NOW);
  assert.deepEqual([...ids].sort(), ["paused-l1", "paused-l2", "repeat"]);
  for (const w of WRITES) assert.ok(!db.calls.includes(w), `the cron list must not ${w}`);
});

test("getPauseSummaries: more than 1000 flag rows are read in pages (a single call would silently cut the list)", async () => {
  const rows: Row[] = [];
  // 1100 older users first (100 h ago: not paused, soft window over), then the one user who matters, flagged most recently
  for (let i = 0; i < 1100; i++) rows.push(row(`filler-${i}`, 1, new Date(NOW - 100 * H + i * 1000).toISOString()));
  rows.push(row("late-user", 2, hoursAgo(1)));
  const db = fakeDb({ rows });
  const summaries = await getPauseSummaries(db.client, NOW);
  assert.equal(summaries.get("late-user")?.paused, true);
  const ranges = db.calls.filter((c) => c.startsWith("range"));
  assert.deepEqual(ranges, ["range 0-999", "range 1000-1999"]);
});

test("getPauseSummaries: a failed read gives an empty list (fails open) and logs only the code; a page that fails keeps the pages before it", async () => {
  const failing = fakeDb({ rows: [row("u1", 2, hoursAgo(1))], readError: { code: "42501", message: "permission denied" } });
  const first = await captureLogs(() => getPauseSummaries(failing.client, NOW));
  assert.equal(first.result.size, 0);
  assert.deepEqual(first.errors, ["[safety] gentle list failed code=42501"]);

  const rows: Row[] = [];
  for (let i = 0; i < 1000; i++) rows.push(row("early-user", 1, new Date(NOW - 5 * H + i).toISOString()));
  rows.push(row("late-user", 2, hoursAgo(1)));
  const half = fakeDb({ rows, readError: { code: "57014" }, failReadNumber: 1 });
  const second = await captureLogs(() => getPauseSummaries(half.client, NOW));
  assert.equal(second.result.get("early-user")?.paused, true); // page 1 was kept
  assert.equal(second.result.has("late-user"), false); // page 2 failed: that user is lost (fails open, logged)
  assert.deepEqual(second.errors, ["[safety] gentle list failed code=57014"]);
});

test("getPauseSummaries: before migration 030 it reads without from_contact and still works", async () => {
  const db = fakeDb({ rows: [row("u1", 1, hoursAgo(2))], noFromContactColumn: true });
  const { result, errors } = await captureLogs(() => getPauseSummaries(db.client, NOW));
  assert.equal(result.get("u1")?.paused, true);
  assert.deepEqual(errors, []);
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test("pause wording: 24 hours, 3 days, and always rounded UP (never a shorter wait than the real one)", () => {
  assert.equal(describePauseWait(24 * 60), "in 24 hours");
  assert.equal(describePauseWait(72 * 60), "in 3 days");
  assert.equal(describePauseWait(60), "in 1 hour");
  assert.equal(describePauseWait(61), "in 2 hours");
  assert.equal(describePauseWait(23 * 60 + 1), "in 24 hours");
  assert.equal(describePauseWait(46 * 60 + 30), "in 47 hours");
  assert.equal(describePauseWait(47 * 60 + 30), "in 2 days"); // 47.5 h rounds up to 48 h = 2 days
  assert.equal(describePauseWait(48 * 60), "in 2 days");
  assert.equal(describePauseWait(49 * 60), "in 3 days");
  assert.equal(describePauseWait(71 * 60 + 1), "in 3 days");
  assert.equal(describePauseWait(59), "in less than an hour");
  assert.equal(describePauseWait(1), "in less than an hour");
  assert.equal(describePauseWait(0), "very soon");
  assert.equal(describePauseWait(Number.NaN), "very soon");
});

test("Level 1 page sentence: 'Ember will be back in 24 hours.' / 'in 3 days.', and nothing at all when no pause is known", () => {
  assert.equal(level1PauseLine(1440), "Ember will be back in 24 hours.");
  assert.equal(level1PauseLine(4320), "Ember will be back in 3 days.");
  for (const none of [null, undefined, 0, -5, Number.NaN]) assert.equal(level1PauseLine(none as number | null | undefined), null);
});

test("break notice: says how long, covers roasts AND check-ins, no 'few days', kind, no jokes", () => {
  assert.equal(
    gentleNoticeText(4320),
    "Ember is taking a break from roasts and check-ins. It will be back in 3 days. Be gentle with yourself.",
  );
  assert.equal(
    gentleNoticeText(1440),
    "Ember is taking a break from roasts and check-ins. It will be back in 24 hours. Be gentle with yourself.",
  );
  assert.equal(gentleNoticeText(null), "Ember is taking a break from roasts and check-ins for now. Be gentle with yourself.");
  assert.equal(gentleNoticeText(undefined), gentleNoticeText(null));
});

test("no 'a few days' wording is left in the safety pages, text or wizard", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  for (const file of ["./safety.ts", "../components/safety-page.tsx", "../components/onboarding-wizard.tsx", "./safety-server.ts", "./safety-response.ts"]) {
    assert.doesNotMatch(read(file), /few days/i, file);
  }
});

test("Level 1 page: the pause sentence is on the Level 1 page only; the Level 2 page is untouched; no phone number on Level 1", () => {
  const source = readFileSync(fileURLToPath(new URL("../components/safety-page.tsx", import.meta.url)), "utf8");
  const level2 = source.slice(source.indexOf("function Level2Page("), source.indexOf("function Level1Page("));
  const level1 = source.slice(source.indexOf("function Level1Page("), source.indexOf("export function SafetyPage("));
  assert.ok(level2.length > 200 && level1.length > 200, "page functions not found");
  assert.doesNotMatch(level2, /pause/i, "the Level 2 page must not mention the pause");
  assert.match(level1, /level1PauseLine\(pauseMinutes\)/);
  assert.doesNotMatch(level1, /tel:|\d{3}[ -]?\d{3}/, "no phone numbers on the Level 1 page");
});

// ---------------------------------------------------------------------------
// The nudge copy
// ---------------------------------------------------------------------------

const SCORES = {
  sleep: { score: 40, grade: "D" },
  fitness: { score: 60, grade: "C" },
  discipline: { score: 75, grade: "B" },
  focus: { score: 20, grade: "F" },
  spending: { score: 90, grade: "A" },
} as const;

function everyNudge(soft: boolean) {
  const out: Array<{ title: string; body: string }> = [];
  for (let streak = 0; streak <= 40; streak++) {
    for (let days = 0; days <= 30; days++) {
      for (const hasRunningJoke of [false, true]) {
        for (const latestScores of [null, SCORES as never]) {
          out.push(buildPushNudge({ streak, daysSinceLastActivity: days, latestScores, hasRunningJoke, soft }));
        }
      }
    }
  }
  return out;
}

test("nudge copy: 'We assumed you died...' can never be produced, for any streak, gap, running joke, scores or soft setting", () => {
  for (const soft of [false, true]) {
    for (const n of everyNudge(soft)) {
      assert.doesNotMatch(n.body, /assumed you died|you died|\bdied\b|\bdead\b|just lazy/i, n.body);
      assert.doesNotMatch(n.title, /died|dead/i);
    }
  }
});

test("nudge copy: the lapsed line is now a warm one-liner, still reachable for people who are not in the soft window", () => {
  const lapsed = buildPushNudge({ streak: 0, daysSinceLastActivity: 4, latestScores: null, hasRunningJoke: false });
  assert.equal(lapsed.body, "It's been a few days. Ember is here whenever you're ready.");
  assert.equal(lapsed.title, "🔥 Ember"); // the normal title is unchanged
});

test("nudge copy: the lapsed pool is exactly these lines, short and warm, with no talk of silence, disappearing, dying, giving up or being gone", () => {
  const lapsed = new Set<string>();
  for (let streak = 0; streak <= 40; streak++) {
    for (let days = 3; days <= 60; days++) {
      for (const hasRunningJoke of [false, true]) {
        for (const latestScores of [null, SCORES as never]) lapsed.add(buildPushNudge({ streak, daysSinceLastActivity: days, latestScores, hasRunningJoke }).body);
      }
    }
  }
  assert.deepEqual([...lapsed].sort(), [
    "It's been a few days. Ember is here whenever you're ready.",
    "It's been a minute. Your habits would love an update.",
    "Whenever you want to pick things back up, Ember is here.",
    "Your next check-in is ready whenever you are.",
    "Your running joke could use a new chapter.",
  ].sort());
  const unwelcome = /silen|quiet|disappear|vanish|ghost|gone|missing|\blost\b|\bdead\b|\bdie[ds]?\b|\bdying\b|death|kill|giv(?:e|ing) up|\bquit|abandon|forgot|lazy|failed|file is|close it/i;
  for (const line of lapsed) {
    assert.doesNotMatch(line, unwelcome, line);
    assert.ok(line.length <= 60, `short: ${line}`);
  }
});

test("nudge copy: the soft variant is one of three plain lines with no roast, streak, grade or habit question", () => {
  assert.equal(SOFT_NUDGE_LINES.length, 3);
  const bodies = new Set(everyNudge(true).map((n) => n.body));
  assert.deepEqual([...bodies].sort(), [...SOFT_NUDGE_LINES].sort());
  for (const n of everyNudge(true)) assert.equal(n.title, "Ember");
  for (const line of SOFT_NUDGE_LINES) {
    assert.doesNotMatch(line, /streak|roast|grade|sleep|focus|spending|fitness|discipline|joke|lazy|disappoint|\?|!|🔥|\d/i, line);
  }
});

test("nudge copy: without the soft flag the usual copy is unchanged (spot checks)", () => {
  assert.match(buildPushNudge({ streak: 5, daysSinceLastActivity: 1, latestScores: null, hasRunningJoke: false }).body, /^5-day streak\./);
  assert.match(buildPushNudge({ streak: 1, daysSinceLastActivity: 1, latestScores: null, hasRunningJoke: false }).body, /^Day 1 was easy\./);
  assert.match(buildPushNudge({ streak: 0, daysSinceLastActivity: 2, latestScores: SCORES as never, hasRunningJoke: false }).body, /focus/);
  assert.equal(buildPushNudge({ streak: 0, daysSinceLastActivity: 2, latestScores: null, hasRunningJoke: false }).body, "One roast a day keeps the delusion away. Your turn.");
});

// ---------------------------------------------------------------------------
// Every route uses the same rule, before it does anything else
// ---------------------------------------------------------------------------

function source(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}
function indexOfOrFail(text: string, needle: string): number {
  const i = text.indexOf(needle);
  assert.ok(i !== -1, `not found: ${needle}`);
  return i;
}

test("/api/roast: the pause gate runs before the daily limit, the classifier and every AI call", () => {
  const route = source("../app/api/roast/route.ts");
  const gate = indexOfOrFail(route, "await gentleGate(supabase, user.id)");
  for (const later of ["checkDailyLimit(", "new Groq(", "runSafetyClassify(", "groq.chat.completions"]) {
    assert.ok(gate < indexOfOrFail(route, later), `the gate must come before: ${later}`);
  }
  assert.match(route, /if \(gentle\) return gentle;/);
});

test("/api/check-in: the pause gate runs before BOTH actions (question and submit) and before any AI call or write", () => {
  const route = source("../app/api/check-in/route.ts");
  const gate = indexOfOrFail(route, "await gentleGate(supabase, user.id)");
  for (const later of ['body.action === "question"', "checkDailyLimit(", "runCheckInSafety(", "groq.chat.completions", "insertRoastRow(", 'from("score_history").insert']) {
    assert.ok(gate < indexOfOrFail(route, later), `the gate must come before: ${later}`);
  }
  assert.match(route, /if \(gentle\) return gentle;/);
});

test("the pause gate and the support pages only read, except respondFlagged which writes the flag through the verified helpers", () => {
  const response = source("./safety-response.ts");
  const gate = response.slice(indexOfOrFail(response, "export async function gentleGate("), indexOfOrFail(response, "export async function respondFlagged("));
  assert.doesNotMatch(gate, /recordFlag|\.insert\(|\.update\(|\.delete\(|\.upsert\(/, "the gate must not write");
  const server = source("./safety-server.ts");
  const reads = server.slice(indexOfOrFail(server, "async function readUserFlags("), indexOfOrFail(server, "export async function recordFlagAndReadPause("));
  assert.doesNotMatch(reads, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/, "getGentleState must not write");
  const cron = server.slice(indexOfOrFail(server, "export async function getPauseSummaries("));
  assert.doesNotMatch(cron, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/, "the cron list must not write");
});

test("the contact form marks its flags from_contact, and the roast / check-in paths never do", () => {
  const contact = source("../app/api/contact/route.ts");
  assert.match(contact, /recordFlagAndReadPause\(service, user\.id, ruleLevel, \{ fromContact: true \}\)/);
  assert.match(contact, /recordFlag\(service, user\.id, ruleLevel, \{ fromContact: true \}\)/);
  const response = source("./safety-response.ts");
  assert.doesNotMatch(response, /fromContact/);
});

test("push-nudge cron: paused users are skipped before anything is sent, soft copy is passed on, the pause list is read only", () => {
  const cron = source("../app/api/cron/push-nudge/route.ts");
  const summaries = indexOfOrFail(cron, "await getPauseSummaries(supabase)");
  const skip = indexOfOrFail(cron, "if (pause?.paused)");
  const send = indexOfOrFail(cron, "sendPushNotification(");
  assert.ok(summaries < skip && skip < send, "read the pause list, skip paused users, then send");
  assert.match(cron, /soft: pause\?\.softNudge === true/);
  assert.doesNotMatch(cron, /safety_flags/, "the cron goes through the shared helper, not its own query");
});

test("weekly email: still skips every paused user through the shared helper", () => {
  const email = source("../app/api/send-weekly-email/route.ts");
  assert.match(email, /getGentleUserIds\(createSupabaseServiceClient\(\)\)/);
  assert.match(email, /if \(gentleUserIds\.has\(user\.id\)\) return;/);
});

test("missions: nothing is settled, failed, started or written while paused (the pause check comes before every mission step)", () => {
  const list = source("../app/api/missions/route.ts");
  const getHandler = list.slice(indexOfOrFail(list, "export async function GET()"), indexOfOrFail(list, "export async function POST()"));
  assert.ok(indexOfOrFail(getHandler, "getGentleState(") < indexOfOrFail(getHandler, "advanceMission("), "GET: pause check before advanceMission");
  assert.ok(indexOfOrFail(getHandler, "getGentleState(") < indexOfOrFail(getHandler, "loadActiveMission("), "GET: pause check before reading the mission");
  assert.match(getHandler, /paused: true/);
  const postHandler = list.slice(indexOfOrFail(list, "export async function POST()"));
  assert.ok(indexOfOrFail(postHandler, "getGentleState(") < indexOfOrFail(postHandler, "generateMissionStart("), "POST: pause check before the AI call");
  assert.ok(indexOfOrFail(postHandler, "getGentleState(") < indexOfOrFail(postHandler, "insertMission("), "POST: pause check before the insert");

  const today = source("../app/api/missions/today/route.ts");
  const pauseAt = indexOfOrFail(today, "getGentleState(");
  for (const later of ["settleMission(", "advanceMission("]) assert.ok(pauseAt < indexOfOrFail(today, later), `today: pause check before ${later}`);
});

test("dashboard: while paused no achievement is evaluated or celebrated, and the page tells the view it is paused", () => {
  const page = source("../app/dashboard/page.tsx");
  const pausedAt = indexOfOrFail(page, "getGentleState(supabase, user.id)");
  const guard = indexOfOrFail(page, "if (!paused) {");
  const unlock = indexOfOrFail(page, "await unlockAchievements(");
  const cookie = indexOfOrFail(page, "decodePendingAchievements(");
  assert.ok(pausedAt < guard && guard < unlock && guard < cookie, "unlock and the handoff cookie sit inside the not-paused branch");
  assert.match(page, /paused=\{paused\}/);
  const view = source("../components/dashboard-view.tsx");
  assert.match(view, /!hasActivityToday && !paused/);
});

test("onboarding header: hidden only while the break notice is on screen (no other safety page, and no other part of the page, is affected)", () => {
  const page = source("../app/onboarding/page.tsx");
  assert.match(page, /\[&:has\(\[data-break-notice\]\)_\[data-onboarding-header\]\]:hidden/);
  assert.equal((page.match(/data-onboarding-header/g) ?? []).length, 2, "one marker on the header block, one in the rule");
  assert.match(page, /<div data-onboarding-header className="mb-8 w-full max-w-md text-center">/);
  const pages = source("../components/safety-page.tsx");
  assert.equal((pages.match(/data-break-notice/g) ?? []).length, 1, "only the break notice carries the marker");
  const notice = pages.slice(pages.indexOf("export function GentleNotice("));
  assert.match(notice, /<div data-break-notice className=\{shell\}>/);
  // the wizard itself is untouched by this
  assert.doesNotMatch(source("../components/onboarding-wizard.tsx"), /data-break-notice|data-onboarding-header/);
});

test("mission card: a paused answer shows only the calm note (no 'failed' / 'target missed' wording, no buttons)", () => {
  const card = source("../components/mission-card.tsx");
  const pausedAt = indexOfOrFail(card, "if (data.paused)");
  const missionAt = indexOfOrFail(card, "const mission = data.mission;");
  assert.ok(pausedAt < missionAt, "the paused branch comes before any mission wording");
  assert.match(card.slice(pausedAt, missionAt), /MISSIONS_PAUSED_MESSAGE/);
});
