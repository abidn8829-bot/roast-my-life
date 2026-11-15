// The ONE place the streak shown to a user is worked out: from the dates of their roast rows (roasts and
// check-ins both write one), counted in calendar days of the user's own time zone.
// The stored users.current_streak / users.longest_streak columns are no longer read or written.
//
// No "@/" imports so node --test can load it directly. Never logs emails or time zones.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserTimezone } from "./day-key.ts";
import { calculateStreak, longestStreak } from "./streak.ts";

/** Hard cap on rows read for a streak (newest first). Far more than any streak shown in practice. */
export const STREAK_ROW_CAP = 400;

export type UserStreak = { current: number; longest: number };

/** Current and longest streak from roast timestamps, in the user's zone (invalid or null zone = "UTC"). */
export function streakFromDates(createdAtDates: string[], timeZone: unknown, now: Date = new Date()): UserStreak {
  const tz = getUserTimezone(timeZone);
  return { current: calculateStreak(createdAtDates, tz, now), longest: longestStreak(createdAtDates, tz) };
}

/**
 * Reads ONLY created_at of the user's roast rows (all of them up to STREAK_ROW_CAP, newest first, not the
 * 12-row display limit) and returns { current, longest } in the user's zone. A read error is logged by
 * code only and gives { current: 0, longest: 0 }.
 */
export async function getUserStreak(
  supabase: SupabaseClient,
  userId: string,
  timeZone: unknown,
  now: Date = new Date(),
): Promise<UserStreak> {
  if (!userId) return { current: 0, longest: 0 };
  try {
    const { data, error } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(STREAK_ROW_CAP);
    if (error) {
      console.error(`[user-streak] read failed code=${(error as { code?: string }).code ?? "unknown"}`);
      return { current: 0, longest: 0 };
    }
    const dates = (data ?? [])
      .map((row) => (row as { created_at?: unknown }).created_at)
      .filter((d): d is string => typeof d === "string");
    return streakFromDates(dates, timeZone, now);
  } catch {
    console.error("[user-streak] read failed code=exception");
    return { current: 0, longest: 0 };
  }
}
