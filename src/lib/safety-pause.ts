// Ember safety layer: how long Ember stays quiet after a flag. A PURE function: it gets the user's
// recent flags and "now", and returns the answer. No database, no clock of its own, no I/O, no text.
// (No "@/" imports on purpose: src/lib/*.test.ts and scripts/safety-eval.mjs import this with Node.)
//
// The rule (decision: EVERY pause is 24 hours; a longer pause would hurt retention):
//   Level 1 flag               closed for 24 hours from that flag
//   Level 2 flag               closed for 24 hours from that flag
//   a "repeat" Level 1 flag    closed for 24 hours from that (second) flag. A Level 1 flag is a repeat when
//                              an EARLIER Level 1 flag exists that is at least 60 minutes before it and no
//                              more than 72 hours before it. Flags from the contact form never count as
//                              either of the two Level 1 flags (they still start a normal pause on their own).
//   The pause ends at the LATEST of all of those ends. Not paused once that moment has passed.
//   Nudges stay SOFT for 3 days AFTER that end (24 h pause + 3 days = 96 h from the flag).
//
// The three lengths are separate numbers on purpose. Today they are all 24, so a repeat does not lengthen the
// pause, but the repeat detection stays in place: raising LEVEL2_PAUSE_HOURS or REPEAT_PAUSE_HOURS brings back
// a longer pause with no other change. computePause takes the lengths as an optional last argument (default =
// the numbers below) so the tests can keep proving that the longer-pause logic still works.

import type { FlagLevel } from "./safety.ts";

export const LEVEL1_PAUSE_HOURS = 24;
/** Was 72 in the first version of stage 2. All pauses are 24 hours now (retention). */
export const LEVEL2_PAUSE_HOURS = 24;
/** The pause a repeat Level 1 flag earns, counted from the second flag. Was 72; now the same 24 as a first flag. */
export const REPEAT_PAUSE_HOURS = 24;
/** A second Level 1 flag only counts as a repeat if the first one is at most this far before it. */
export const REPEAT_WINDOW_HOURS = 72;
/** ... and at least this far before it (a quick retype in the same sitting is not a repeat). */
export const REPEAT_MIN_GAP_MINUTES = 60;
/** Nudges stay soft for this long AFTER the pause ends (any flag counts: level 1, level 2, contact form). */
export const SOFT_NUDGE_HOURS = 72;

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** The three pause lengths (hours). The live values are the constants above. */
export type PauseRules = { level1Hours: number; level2Hours: number; repeatHours: number };
export const DEFAULT_PAUSE_RULES: PauseRules = {
  level1Hours: LEVEL1_PAUSE_HOURS,
  level2Hours: LEVEL2_PAUSE_HOURS,
  repeatHours: REPEAT_PAUSE_HOURS,
};

/**
 * How far back the database must be read so the answer is right. The latest a flag can still matter is the end of
 * its longest pause plus the soft window (3 days) after the flag, and a repeat flag needs its earlier Level 1
 * flag up to 72 h before it. (24 + 72 + 72 = 168 hours = 7 days today. Derived from the constants above, so
 * changing one changes this.)
 */
export const PAUSE_LOOKBACK_HOURS =
  Math.max(LEVEL1_PAUSE_HOURS, LEVEL2_PAUSE_HOURS, REPEAT_PAUSE_HOURS) + SOFT_NUDGE_HOURS + REPEAT_WINDOW_HOURS;
export const PAUSE_LOOKBACK_MS = PAUSE_LOOKBACK_HOURS * HOUR_MS;

/** One stored flag. `createdAt` is the database timestamp (ISO string), or a Date / epoch ms. */
export type PauseFlag = {
  level: number;
  createdAt: string | number | Date;
  /** True for a flag written by the contact form (migration 030). Missing / false = roast or check-in. */
  fromContact?: boolean | null;
};

export type PauseResult = {
  paused: boolean;
  /** When the pause ends (ISO), or null when not paused. */
  endsAt: string | null;
  /** The level of the flag that sets the end of the pause, or null when not paused. */
  level: FlagLevel | null;
  /** True when the pause is the longer one earned by a repeat Level 1 flag. */
  repeat: boolean;
  /** The time (ISO) of the flag that sets the end of the pause, or null when not paused. */
  flaggedAt: string | null;
  /** The newest flag of any kind in the input (ISO), or null when there is none. */
  lastFlagAt: string | null;
  /** True from the first flag until SOFT_NUDGE_HOURS (3 days) AFTER the pause ends (nudge copy must be soft). */
  softNudge: boolean;
  /** When the soft window ends (ISO: the pause end + 3 days), or null when it is not running. */
  softUntil: string | null;
};

const NOT_PAUSED: PauseResult = { paused: false, endsAt: null, level: null, repeat: false, flaggedAt: null, lastFlagAt: null, softNudge: false, softUntil: null };

type Parsed = { level: FlagLevel; ms: number; contact: boolean };

function toMs(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

function parseFlags(flags: readonly PauseFlag[]): Parsed[] {
  const out: Parsed[] = [];
  for (const f of flags ?? []) {
    if (!f || (f.level !== 1 && f.level !== 2)) continue; // anything but level 1 / 2 is not a flag
    const ms = toMs(f.createdAt);
    if (!Number.isFinite(ms)) continue; // an unreadable time cannot start a pause
    out.push({ level: f.level, ms, contact: f.fromContact === true });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/** True when `flag` (a non-contact Level 1 flag) has an earlier non-contact Level 1 flag 60 min .. 72 h before it. */
function isRepeat(flag: Parsed, all: readonly Parsed[]): boolean {
  if (flag.level !== 1 || flag.contact) return false;
  const minGap = REPEAT_MIN_GAP_MINUTES * MINUTE_MS;
  const maxGap = REPEAT_WINDOW_HOURS * HOUR_MS;
  return all.some((earlier) => {
    if (earlier.level !== 1 || earlier.contact) return false;
    const gap = flag.ms - earlier.ms;
    return gap >= minGap && gap <= maxGap;
  });
}

/**
 * The pause for one user. `now` is epoch ms (pass Date.now() or a fixed number in tests).
 * Never throws; flags it cannot read are ignored; the input is not changed.
 */
export function computePause(flags: readonly PauseFlag[], now: number, rules: PauseRules = DEFAULT_PAUSE_RULES): PauseResult {
  if (!Number.isFinite(now)) return NOT_PAUSED;
  const parsed = parseFlags(flags);
  if (parsed.length === 0) return NOT_PAUSED;

  type Candidate = { end: number; level: FlagLevel; repeat: boolean; at: number };
  // `latestEnd` is the end of the last pause any flag ever started, even one that is already over: the soft window
  // for nudges starts from it.
  const found: { best: Candidate | null; latestEnd: number } = { best: null, latestEnd: Number.NEGATIVE_INFINITY };
  const consider = (end: number, level: FlagLevel, repeat: boolean, at: number) => {
    if (end > found.latestEnd) found.latestEnd = end;
    if (end <= now) return; // that pause is already over
    // Later end wins. On an exact tie prefer the higher level, then the repeat explanation.
    const cur = found.best;
    if (!cur || end > cur.end || (end === cur.end && (level > cur.level || (level === cur.level && repeat && !cur.repeat)))) {
      found.best = { end, level, repeat, at };
    }
  };

  for (const flag of parsed) {
    if (flag.level === 2) {
      consider(flag.ms + rules.level2Hours * HOUR_MS, 2, false, flag.ms);
      continue;
    }
    consider(flag.ms + rules.level1Hours * HOUR_MS, 1, false, flag.ms);
    // The repeat pause is measured from THIS (second) flag, never from the first.
    if (isRepeat(flag, parsed)) consider(flag.ms + rules.repeatHours * HOUR_MS, 1, true, flag.ms);
  }

  const newest = parsed[parsed.length - 1]!.ms;
  const lastFlagAt = new Date(newest).toISOString();
  // Every flag started a pause (so `latestEnd` is a real time). Soft = until 3 days after the last pause ended.
  const softUntilMs = found.latestEnd + SOFT_NUDGE_HOURS * HOUR_MS;
  const softNudge = now < softUntilMs;
  const softUntil = softNudge ? new Date(softUntilMs).toISOString() : null;
  const best = found.best;
  if (!best) return { ...NOT_PAUSED, lastFlagAt, softNudge, softUntil };
  return {
    paused: true,
    endsAt: new Date(best.end).toISOString(),
    level: best.level,
    repeat: best.repeat,
    flaggedAt: new Date(best.at).toISOString(),
    lastFlagAt,
    softNudge,
    softUntil,
  };
}

/** Whole minutes left in a pause (rounded UP, never negative), or null when it has no usable end. */
export function minutesLeft(pause: Pick<PauseResult, "paused" | "endsAt">, now: number): number | null {
  if (!pause.paused || !pause.endsAt) return null;
  const end = Date.parse(pause.endsAt);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.ceil((end - now) / MINUTE_MS));
}
