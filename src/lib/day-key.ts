// Pure calendar-day helpers for time-zone-aware streaks. No "@/" imports so node --test can load it directly.
// A "day key" is a "YYYY-MM-DD" string naming one calendar day.

/** Longest time zone name we accept. Real IANA names are far shorter (about 30 characters at most). */
export const MAX_TIME_ZONE_LENGTH = 64;

// A zone NAME: starts with a letter, then letters, digits, "_", "+", "-" or "/". This rejects raw
// offsets such as "+05:00", which Intl also accepts but which are not IANA zone names.
const TIME_ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+\-/]*$/;

/**
 * True only for a real IANA time zone name this runtime understands (e.g. "Asia/Karachi", "UTC").
 * Rejects non-strings, empty strings, names over 64 characters, raw offsets and unknown zones.
 */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > MAX_TIME_ZONE_LENGTH) return false;
  if (!TIME_ZONE_NAME.test(tz)) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The stored time zone when it is valid, otherwise "UTC". Not used by streaks or the daily limit yet. */
export function getUserTimezone(value: unknown): string {
  return isValidTimeZone(value) ? value : "UTC";
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    formatterCache.set(tz, f);
  }
  return f;
}

/** "YYYY-MM-DD" for this instant as seen in the given IANA zone. An invalid zone falls back to "UTC". */
export function dayKeyInZone(iso: string | Date, tz: string): string {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  const date = iso instanceof Date ? iso : new Date(iso);
  const parts = formatterFor(zone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Move a day key by n calendar days using pure UTC date maths (no local-time or DST effects). */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().split("T")[0]!;
}
