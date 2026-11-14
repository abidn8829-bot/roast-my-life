import { addDaysToKey, dayKeyInZone } from "./day-key.ts";

export function toDateKey(iso: string): string {
  return new Date(iso).toISOString().split("T")[0]!;
}

export function previousDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0]!;
}

/**
 * Count consecutive days with at least one roast, ending today or yesterday.
 * Days are calendar days in `tz` (default "UTC", which matches the original behaviour).
 */
export function calculateStreak(createdAtDates: string[], tz: string = "UTC", now: Date = new Date()): number {
  if (createdAtDates.length === 0) return 0;

  const dateSet = new Set(createdAtDates.map((iso) => dayKeyInZone(iso, tz)));
  const today = dayKeyInZone(now, tz);
  const yesterday = addDaysToKey(today, -1);

  let cursor: string;
  if (dateSet.has(today)) {
    cursor = today;
  } else if (dateSet.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = addDaysToKey(cursor, -1);
  }

  return streak;
}

/** Longest run of consecutive calendar days (in `tz`, default "UTC") with at least one roast. */
export function longestStreak(createdAtDates: string[], tz: string = "UTC"): number {
  if (createdAtDates.length === 0) return 0;

  const keys = [...new Set(createdAtDates.map((iso) => dayKeyInZone(iso, tz)))].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    run = addDaysToKey(keys[i - 1]!, 1) === keys[i] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}
