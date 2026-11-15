// Server-side write of public.users.timezone. A logged-in browser session cannot update this column
// (migration 023 only lets it update achievements and streaks), so the server writes it with the
// service-role client, always for the user id from the verified session.
//
// No "@/" imports on purpose: src/lib/timezone.test.ts imports this file directly with Node.
// The service-role client is passed in as a factory, so tests can hand in a fake one.
//
// Nothing here logs the user's email, id or time zone. Only a short error code is ever logged or returned.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTimeZone } from "./day-key.ts";

export type ServiceClientFactory = () => SupabaseClient;

export type TimezoneSaveResult =
  | { ok: true; status: "saved" | "unchanged" }
  | { ok: false; code: string };

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_.:-]{1,20}$/.test(code) ? code : "unknown";
}

function fail(code: string): TimezoneSaveResult {
  console.error(`[timezone-save] failed code=${code}`);
  return { ok: false, code };
}

/**
 * Saves `timezone` on the users row whose id is `userId`.
 *
 * `userId` MUST be the id from the verified session (auth.getUser()), never from a request body.
 * Reads the current value first and skips the write when it is already the same. The update is read
 * back (`.select()`): it counts as saved only when exactly one row comes back holding the new value.
 */
export async function saveUserTimezoneWith(
  makeService: ServiceClientFactory,
  userId: string,
  timezone: unknown,
): Promise<TimezoneSaveResult> {
  if (typeof userId !== "string" || !userId) return fail("no-user");
  if (!isValidTimeZone(timezone)) return fail("invalid-timezone");

  let service: SupabaseClient;
  try {
    service = makeService();
  } catch {
    return fail("no-service-client");
  }

  try {
    const { data: current, error: readError } = await service.from("users").select("timezone").eq("id", userId);
    if (readError) return fail(errorCode(readError));
    if (!Array.isArray(current) || current.length !== 1) return fail("no-row");
    if ((current[0] as { timezone?: unknown })?.timezone === timezone) return { ok: true, status: "unchanged" };

    const { data: updated, error: updateError } = await service
      .from("users")
      .update({ timezone })
      .eq("id", userId)
      .select("id, timezone");
    if (updateError) return fail(errorCode(updateError));
    if (!Array.isArray(updated) || updated.length !== 1) return fail("not-updated");
    if ((updated[0] as { timezone?: unknown })?.timezone !== timezone) return fail("not-updated");
    return { ok: true, status: "saved" };
  } catch {
    return fail("exception");
  }
}
