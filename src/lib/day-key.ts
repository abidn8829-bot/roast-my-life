// Pure calendar-day helpers for time-zone-aware streaks. No "@/" imports so node --test can load it directly.
// A "day key" is a "YYYY-MM-DD" string naming one calendar day.

/** True when tz is an IANA time zone this runtime understands (e.g. "Asia/Karachi"). */
export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || tz.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
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
