import { NextResponse } from "next/server";
import { PENDING_ACHIEVEMENT_COOKIE } from "@/lib/pending-achievement-cookie";

// Called once by the dashboard after it reads the pending-achievement cookie for this
// render, so a later /dashboard refresh doesn't replay the celebration. Deleting the
// cookie directly in middleware doesn't work here — Next.js strips a cookie deleted on
// the middleware's NextResponse from the *current* request's cookie jar too, not just
// future ones, so the page would never see it in the first place.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PENDING_ACHIEVEMENT_COOKIE);
  return response;
}
