// Local calendar-day boundaries as UTC instants, for daily-limit queries.
// No "@/" imports so node --test can load it directly.

import { addDaysToKey, dayKeyInZone, getUserTimezone } from "./day-key.ts";

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(tz, f);
  }
  return f;
}

/** How far the zone's wall clock is ahead of UTC at instant `ms`, in milliseconds (DST-aware). */
function zoneOffsetMs(ms: number, tz: string): number {
  const parts = offsetFormatter(tz).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

function isStartOf(ms: number, dayKey: string, tz: string): boolean {
  return dayKeyInZone(new Date(ms), tz) === dayKey && dayKeyInZone(new Date(ms - 1), tz) !== dayKey;
}

/**
 * The UTC instant when local day `dayKey` ("YYYY-MM-DD") begins in zone `tz` (normally local 00:00).
 * Daylight saving safe. If local midnight is skipped (a zone that changes clocks at 00:00), returns the
 * first instant that belongs to that day. An invalid zone means "UTC".
 */
export function startOfLocalDayUtc(dayKey: string, tz: string): Date {
  const zone = getUserTimezone(tz);
  const [y, m, d] = dayKey.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!);

  const first = guess - zoneOffsetMs(guess, zone);
  const second = guess - zoneOffsetMs(first, zone);
  for (const candidate of [second, first]) {
    if (isStartOf(candidate, dayKey, zone)) return new Date(candidate);
  }

  // Local midnight does not exist on this day: find the first minute of the day, then the exact instant.
  const MINUTE = 60_000;
  let lo = Math.min(first, second) - 3 * 60 * MINUTE;
  while (dayKeyInZone(new Date(lo), zone) === dayKey) lo -= 60 * MINUTE;
  let hi = lo;
  while (dayKeyInZone(new Date(hi), zone) !== dayKey) hi += MINUTE;
  // The answer is in (hi - MINUTE, hi]: binary search to the millisecond.
  lo = hi - MINUTE;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayKeyInZone(new Date(mid), zone) === dayKey) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

/**
 * Today's local day in `tz` as a half-open UTC range [start, end): start of today, start of tomorrow.
 * A 23-hour or 25-hour daylight-saving day is handled exactly. Invalid or missing zone means "UTC".
 */
export function localDayRangeUtc(now: Date, tz: unknown): { dayKey: string; start: Date; end: Date } {
  const zone = getUserTimezone(tz);
  const dayKey = dayKeyInZone(now, zone);
  return {
    dayKey,
    start: startOfLocalDayUtc(dayKey, zone),
    end: startOfLocalDayUtc(addDaysToKey(dayKey, 1), zone),
  };
}
