import type { SupabaseClient } from "@supabase/supabase-js";

// The ONLY place the daily limits live. Change these two numbers (and the site copy
// that reads them follows). One unit = one row in `roasts`, and both a roast and a
// daily check-in write one, so roasts and check-ins share the same daily budget.
export const FREE_DAILY_LIMIT = 1;
export const PRO_DAILY_LIMIT = 2;

export const DAILY_LIMIT_CODE = "daily_limit";

// How long an in-progress generation keeps holding its slot if its request never
// finishes cleanly (a crash/timeout can skip the release below).
const IN_FLIGHT_TTL_MS = 120_000;

// Requests that passed the check but haven't written their roasts row yet. Without
// this, N parallel requests would all see "0 used" and all run their AI calls.
// Per server instance only (no migration, no shared store), so it narrows the
// parallel-request gap rather than closing it for good.
const inFlight = new Map<string, number[]>();

export function dailyLimitFor(tier: string | null | undefined): number {
  return tier === "pro" ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
}

function limitReachedMessage(isPro: boolean, limit: number): string {
  if (isPro) return "You've used today's check-ins. Come back tomorrow.";
  const what = limit === 1 ? "free roast" : `${limit} free roasts`;
  return `You've used your ${what} today. Come back tomorrow or upgrade to Pro 🔥`;
}

export type DailyLimitResult =
  | { allowed: true; used: number; limit: number; release: () => void }
  | {
      allowed: false;
      status: 429 | 500;
      body: { error: string; code?: typeof DAILY_LIMIT_CODE; tier?: "free" | "pro" };
    };

/**
 * Whether this user may start another roast / check-in today. Call it before any AI
 * call. Counts the user's `roasts` rows from today (same UTC day, same range as the
 * original free-user check in /api/roast).
 *
 * On allowed: the returned `release()` MUST be called when the request ends, whether
 * it succeeded or failed (the row is only written at the very end, so a failed
 * request never counts as used). On a database error it refuses (500) instead of
 * letting the request through.
 */
export async function checkDailyLimit(
  supabase: SupabaseClient,
  userId: string,
  tier: string | null | undefined,
): Promise<DailyLimitResult> {
  const isPro = tier === "pro";
  const limit = dailyLimitFor(tier);

  const today = new Date().toISOString().split("T")[0];
  const { count, error } = await supabase
    .from("roasts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`);

  if (error || count === null) {
    console.error("[daily-limit] usage count failed:", error?.message ?? "count was null");
    return { allowed: false, status: 500, body: { error: "Couldn't check your daily limit. Try again." } };
  }

  const now = Date.now();
  const active = (inFlight.get(userId) ?? []).filter((startedAt) => now - startedAt < IN_FLIGHT_TTL_MS);
  if (count + active.length >= limit) {
    if (active.length === 0) inFlight.delete(userId);
    else inFlight.set(userId, active);
    return {
      allowed: false,
      status: 429,
      body: { error: limitReachedMessage(isPro, limit), code: DAILY_LIMIT_CODE, tier: isPro ? "pro" : "free" },
    };
  }

  active.push(now);
  inFlight.set(userId, active);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const list = inFlight.get(userId) ?? [];
    const at = list.indexOf(now); // remove ONE entry; another request may share this millisecond
    if (at !== -1) list.splice(at, 1);
    if (list.length === 0) inFlight.delete(userId);
    else inFlight.set(userId, list);
  };
  return { allowed: true, used: count, limit, release };
}
