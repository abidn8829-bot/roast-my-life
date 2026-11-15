import { NextResponse } from "next/server";
import { isValidTimeZone } from "@/lib/day-key";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { saveUserTimezoneWith } from "@/lib/timezone-save";

// Saves the signed-in user's browser time zone (e.g. "Asia/Karachi") into users.timezone.
// Called in the background by <TimezoneSync /> on the dashboard. The row is always the one for the
// verified session's user id; nothing in the request body can pick a different row.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const timezone = (body as { timezone?: unknown } | null)?.timezone;
  if (!isValidTimeZone(timezone)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });

  const result = await saveUserTimezoneWith(createSupabaseServiceClient, user.id, timezone);
  if (!result.ok) return NextResponse.json({ error: result.code }, { status: 500 });
  return NextResponse.json({ ok: true, status: result.status });
}
