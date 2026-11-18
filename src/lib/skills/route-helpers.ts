// Shared pieces for the "learn a skill" API routes (src/app/api/skills/**). No pages, no UI.
// (No "@/" imports on purpose: src/lib/skills/*.test.ts load this file directly with Node. Responses are plain
// Web `Response` objects, which a Next.js route handler can return as they are.)
//
// Rules this file keeps:
//   * Only a short code is ever logged or returned. Never a request body, a note, a question, an answer, a stack
//     trace or database text.
//   * It never builds a correct-answer or explanation field. Whatever a skills-server function returns is passed
//     on unchanged (mapResult); nothing is added to it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "../is-uuid.ts";
import { canOpenMonth, isFreeMonth } from "./access.ts";
import { getTodayStep, type LockedResult, type SkillResult, type WeeklyResult } from "./skills-server.ts";
import type { Tier } from "./types.ts";

const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status: number) => Response.json(body, { status, headers: NO_STORE });

// ---------------------------------------------------------------------------
// Plain responses
// ---------------------------------------------------------------------------

/** The switch is off: a plain 404 with no body, as if the route did not exist. */
export const notFound = () => new Response(null, { status: 404, headers: NO_STORE });
/** Not allowed, and nothing is said about why or about what exists: a plain 403 with no body. */
export const plainForbidden = () => new Response(null, { status: 403, headers: NO_STORE });
export const unauthorized = () => json({ error: "unauthorized" }, 401);
export const badRequest = (code: string) => json({ error: shortCode(code) }, 400);
export const serverError = (code: string) => json({ error: shortCode(code) }, 500);

/** Codes that mean "that thing does not exist" (a note or a step id nobody has): a 404, not a server error. */
const NOT_FOUND_CODES: ReadonlySet<string> = new Set(["no-entry", "no-step"]);

/** The response for an { error: { code } } result: 404 { error: code } for no-entry and no-step, otherwise 500. */
export const errorResponse = (code: string) =>
  NOT_FOUND_CODES.has(code) ? json({ error: shortCode(code) }, 404) : serverError(code);

/** A short code only: letters, digits and a few separators, at most 20 characters. Anything else becomes "unknown". */
export function shortCode(code: unknown): string {
  return typeof code === "string" && /^[A-Za-z0-9_.:-]{1,20}$/.test(code) ? code : "unknown";
}

/** A locked month: 403 with the locked body only (the month and its teaser line, nothing else). */
export const lockedResponse = (locked: LockedResult) =>
  json({ locked: true, month: locked.month, teaser: locked.teaser }, 403);

/**
 * Turns a skills-server result into a response:
 *   { locked }    -> 403, the locked body only
 *   { notReady }  -> 200, { notReady: true }
 *   { error }     -> 404 for no-entry and no-step, 500 for every other code; { error: "<short code>" } and nothing else
 *   { data }      -> 200, the data exactly as the server function returned it
 */
export function mapResult<T>(result: SkillResult<T> | WeeklyResult<T>): Response {
  if ("locked" in result) return lockedResponse(result);
  if ("notReady" in result) return json({ notReady: true }, 200);
  if ("error" in result) return errorResponse(result.error.code);
  return json(result.data, 200);
}

// ---------------------------------------------------------------------------
// The caller: plan and service client
// ---------------------------------------------------------------------------

/**
 * The plan the user has right now, read fresh from users.subscription_tier on the server (the browser cannot send or
 * change it). Only the exact value "pro" is Pro. A missing row, a failed read or any other value is "free", so a
 * bad read can only close a month, never open one.
 */
export async function readTier(supabase: SupabaseClient, userId: string): Promise<Tier> {
  const { data, error } = await supabase.from("users").select("subscription_tier").eq("id", userId).single();
  if (error) {
    const code = (error as { code?: unknown }).code;
    console.error(`[skills-route] tier read error code=${shortCode(code)}`);
  }
  return data?.subscription_tier === "pro" ? "pro" : "free";
}

/** The service client, or a 500 response when it cannot be made (missing server settings). */
export function openService(make: () => SupabaseClient): SupabaseClient | Response {
  try {
    return make();
  } catch {
    console.error("[skills-route] service client error code=no-service-client");
    return serverError("no-service-client");
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** The JSON body as a plain object, or null if it is missing, not JSON, or not an object. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** An id the database uses (a UUID), or null. */
export const asId = (value: unknown): string | null => (typeof value === "string" && isUuid(value) ? value : null);

/** A whole number from 0 to 99 (an option index), or null. Decimals, strings, NaN and negatives are not accepted. */
export const asIndex = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99 ? value : null;

// ---------------------------------------------------------------------------
// Step access for the notebook
// ---------------------------------------------------------------------------

export type StepAccess =
  | { ok: true }
  /** The step's month is locked for this plan. */
  | { locked: LockedResult }
  /** The step is unknown, or the user has not opened it yet (it is after their current step). */
  | { notOpened: true }
  | { error: { code: string } };

type Row = Record<string, unknown>;

async function readRows(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[] | { code: string }> {
  const { data, error } = await query;
  if (error) return { code: shortCode((error as { code?: unknown }).code) };
  return Array.isArray(data) ? (data.filter((r) => typeof r === "object" && r !== null) as Row[]) : [];
}

const isFailure = (v: Row[] | { code: string }): v is { code: string } => !Array.isArray(v);

/**
 * May this user write a note on this step? READ ONLY: it writes nothing.
 *   1. The month must be open for the plan (the same rule as skills-server: canOpenMonth, and a month counts as
 *      free only when BOTH isFreeMonth and the is_free column say so). A locked month returns { locked }.
 *   2. The step must be one the user has already opened: one they have completed, or their current open step
 *      (the first step they have not completed, once its 20-hour wait is over). A later step, or a step that does
 *      not exist, returns { notOpened } and nothing else.
 * saveNotebookEntry checks the month again when it saves.
 */
export async function checkStepAccess(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  stepId: string,
  opts: { now?: number } = {},
): Promise<StepAccess> {
  const steps = await readRows(client.from("skill_steps").select("id, week_id").eq("id", stepId));
  if (isFailure(steps)) return { error: steps };
  if (steps.length !== 1) return { notOpened: true };
  const weekId = steps[0]!.week_id;
  if (typeof weekId !== "string") return { error: { code: "bad-content" } };

  const weeks = await readRows(client.from("skill_weeks").select("id, pack_id, month_no").eq("id", weekId));
  if (isFailure(weeks)) return { error: weeks };
  const week = weeks[0];
  if (weeks.length !== 1 || !week || typeof week.pack_id !== "string" || typeof week.month_no !== "number") {
    return { error: { code: "no-week" } };
  }
  const packId = week.pack_id;
  const monthNo = week.month_no;

  const months = await readRows(
    client.from("skill_months").select("month_no, teaser_line, is_free").eq("pack_id", packId).eq("month_no", monthNo),
  );
  if (isFailure(months)) return { error: months };
  const month = months[0];
  if (months.length !== 1 || !month) return { error: { code: "no-month" } };
  const monthIsFree = month.is_free === true && isFreeMonth(monthNo);
  if (canOpenMonth({ monthIsFree, tier }) !== "open") {
    return { locked: { locked: true, month: monthNo, teaser: typeof month.teaser_line === "string" ? month.teaser_line : null } };
  }

  const done = await readRows(
    client
      .from("skill_step_progress")
      .select("step_id")
      .eq("user_id", userId)
      .eq("step_id", stepId)
      .not("completed_at", "is", null),
  );
  if (isFailure(done)) return { error: done };
  if (done.length > 0) return { ok: true };

  const today = await getTodayStep(client, userId, tier, { packId, now: opts.now });
  if ("error" in today) return { error: { code: shortCode(today.error.code) } };
  if ("data" in today && "open" in today.data && today.data.open === true && today.data.stepId === stepId) {
    return { ok: true };
  }
  return { notOpened: true };
}

/** The response for a step the user may not write on, or null when access is fine. */
export function stepAccessProblem(access: StepAccess): Response | null {
  if ("ok" in access) return null;
  if ("locked" in access) return lockedResponse(access.locked);
  if ("notOpened" in access) return plainForbidden();
  return serverError(access.error.code);
}
