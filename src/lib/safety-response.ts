import type Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  isPakistan,
  safetyLog,
  supportLinesOrFallback,
  type FlagLevel,
  type GentlePayload,
  type SafetyPayload,
} from "@/lib/safety";
import {
  generateSupportLines,
  getGentleState,
  recordFlag,
  recordFlagAndReadPause,
  SAFETY_MODEL,
  type GentleState,
} from "@/lib/safety-server";

// Route-level helpers: build the safety responses. None of them logs or stores text.
// The body never carries the user's own words, and nothing is cached.

const NO_STORE = { "Cache-Control": "no-store" };

export function safetyJson(safety: SafetyPayload, status = 200) {
  return NextResponse.json({ safety }, { status, headers: NO_STORE });
}

/** The safety check could not run and no rule matched: nothing saved, no flag, no roast. */
export function respondUnavailable(route: string) {
  safetyLog("unavailable", route);
  return safetyJson({ kind: "unavailable" }, 503);
}

/** A generated roast / plan / title / punchline mocked sadness or pain: Level 1 page, no flag. */
export function respondOutputBlocked(request: Request, route: string) {
  safetyLog("output-blocked", route);
  return safetyJson({ kind: "page", level: 1, lines: supportLinesOrFallback(null), inPakistan: isPakistan(request.headers) });
}

/**
 * A pause is on: no roasts and no check-ins. The client shows a short kind message that says how long is left
 * (`minutesLeft`, worked out here on the server so it never depends on the browser's clock). Still HTTP 200,
 * as before: the browser looks at the body, not the status.
 */
export function respondGentle(state: Pick<GentleState, "minutesLeft">) {
  const payload: GentlePayload = { gentle: true, minutesLeft: state.minutesLeft };
  return NextResponse.json(payload, { headers: NO_STORE });
}

/** Returns the pause response if this user is paused right now (24 or 72 hours, see safety-pause.ts), else null. READ ONLY. */
export async function gentleGate(supabase: SupabaseClient, userId: string) {
  const state = await getGentleState(supabase, userId);
  return state.active ? respondGentle(state) : null;
}

/**
 * A level above 0 was decided. Writes ONLY the flag (user id + level) when `userId` is given,
 * then returns the support page payload (Level 1: with the confirmed pause length in minutes, or none). Level 2 uses no AI text at all. Level 1 gets two
 * AI-written lines from one call (`groq` + `texts`), or the fixed fallback when no Groq client
 * is given or the call fails. A failed flag insert never stops the page from showing.
 */
export async function respondFlagged(opts: {
  request: Request;
  route: string;
  level: FlagLevel;
  userId?: string | null;
  groq?: Groq | null;
  texts?: string[];
}) {
  const { request, route, level, userId, groq, texts } = opts;
  safetyLog(level, route);

  // Level 1 reads the pause back after saving the flag, so its page can say how long Ember is away. The Level 2
  // page is unchanged and says nothing about time.
  let pauseMinutes: number | null = null;
  if (userId) {
    try {
      const service = createSupabaseServiceClient();
      if (level === 1) pauseMinutes = (await recordFlagAndReadPause(service, userId, level)).minutesLeft;
      else await recordFlag(service, userId, level);
    } catch {
      console.error("[safety] flag write failed code=no-service-client");
    }
  }

  let lines: string[] = [];
  if (level === 1) {
    lines = groq && texts?.length ? await generateSupportLines(groq, SAFETY_MODEL, texts) : supportLinesOrFallback(null);
  }
  return safetyJson({
    kind: "page",
    level,
    lines,
    inPakistan: isPakistan(request.headers),
    ...(level === 1 ? { pauseMinutes } : {}),
  });
}
