// Server-side writes to public.roasts. Only the server writes roast rows: a logged-in browser session may
// READ its own roasts and change its own "reaction", nothing else (see the database lock-down).
//
// No "@/" imports on purpose: src/lib/roast-insert.test.ts imports this file directly with Node.
// The service-role client is passed in as a factory, so tests can hand in a fake one.
//
// Nothing here may log or return message text (Postgres "details" can echo a roast or an answer).
// Only a short error code is ever logged or returned.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceClientFactory = () => SupabaseClient;

/** What every writer here returns: the saved id, or a short code. Never message text. */
export type RoastInsertResult = { data: { id: string } | null; error: { code: string } | null };

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_.:-]{1,20}$/.test(code) ? code : "unknown";
}

function isMissingPunchlineColumn(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return (
    e?.code === "42703" ||
    e?.code === "PGRST204" ||
    (typeof e?.message === "string" && /card_punchline/.test(e.message))
  );
}

/**
 * Inserts ONE roast row with the service-role client.
 *
 * `userId` MUST be the id from the verified session (auth.getUser()). It is written over whatever
 * `row.user_id` says, so a value from a request body can never decide who owns the row.
 *
 * The inserted row is read back (`.select("id")`): an error, no row, or more than one row is a failure.
 * If the card_punchline column does not exist yet (code deployed before migration 019), it retries once
 * without it, as the old helper did.
 */
export async function insertRoastRowWith(
  makeService: ServiceClientFactory,
  userId: string,
  row: Record<string, unknown> & { card_punchline?: string | null },
): Promise<RoastInsertResult> {
  if (typeof userId !== "string" || !userId) return { data: null, error: { code: "no-user" } };

  let service: SupabaseClient;
  try {
    service = makeService();
  } catch {
    console.error("[roast-insert] insert failed code=no-service-client");
    return { data: null, error: { code: "no-service-client" } };
  }

  const attempt = async (payload: Record<string, unknown>): Promise<RoastInsertResult & { raw: unknown }> => {
    try {
      const { data, error } = await service.from("roasts").insert({ ...payload, user_id: userId }).select("id");
      if (error) return { data: null, error: { code: errorCode(error) }, raw: error };
      const id = Array.isArray(data) && data.length === 1 ? (data[0] as { id?: unknown })?.id : undefined;
      if (typeof id !== "string" || !id) return { data: null, error: { code: "no-row" }, raw: null };
      return { data: { id }, error: null, raw: null };
    } catch {
      return { data: null, error: { code: "exception" }, raw: null };
    }
  };

  let result = await attempt(row);
  if (result.error && isMissingPunchlineColumn(result.raw)) {
    console.warn("[roast-insert] card_punchline column missing: run migration 019. Retrying without it.");
    const withoutPunchline = { ...row };
    delete withoutPunchline.card_punchline;
    result = await attempt(withoutPunchline);
  }
  if (result.error) console.error(`[roast-insert] insert failed code=${result.error.code}`);
  return { data: result.data, error: result.error };
}

/**
 * Saves a backfilled card punchline with the service-role client.
 *
 * Ownership is explicit: the roast id AND the viewing user's id (from the verified session) must both
 * match, and the update only happens while the punchline is still empty. Returns true when exactly one
 * row was written. A failure is logged by code only, never swallowed silently.
 */
export async function saveBackfilledPunchlineWith(
  makeService: ServiceClientFactory,
  roastId: string,
  userId: string,
  punchline: string,
): Promise<boolean> {
  if (!roastId || !userId || !punchline) return false;
  try {
    const service = makeService();
    const { data, error } = await service
      .from("roasts")
      .update({ card_punchline: punchline })
      .eq("id", roastId)
      .eq("user_id", userId)
      .is("card_punchline", null)
      .select("id");
    if (error) {
      console.error(`[card-punchline] backfill save failed code=${errorCode(error)}`);
      return false;
    }
    if (!Array.isArray(data) || data.length !== 1) {
      console.error("[card-punchline] backfill save failed code=no-row");
      return false;
    }
    return true;
  } catch {
    console.error("[card-punchline] backfill save failed code=exception");
    return false;
  }
}
