import { NextResponse } from "next/server";
import { addDays, daysBetween, todayKey } from "@/lib/arc-trend";
import { MISSION_LENGTH } from "@/lib/missions";
import { loadActiveMission } from "@/lib/missions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Dev-only testing aid: shifts the logged-in user's active mission back in
// time so that today becomes day N (?day=7 to test the finish; ?day=8 to test
// the "window passed" path). Every stored day date shifts by the same amount,
// so the next GET /api/missions settles it exactly like real elapsed days.
// 404s outside development, like /api/dev/reset-achievement.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const day = Number(new URL(request.url).searchParams.get("day"));
  if (!Number.isInteger(day) || day < 1 || day > MISSION_LENGTH + 1) {
    return NextResponse.json({ usage: `GET /api/dev/mission-fast-forward?day=1..${MISSION_LENGTH + 1}` }, { status: 400 });
  }

  const mission = await loadActiveMission(supabase, user.id);
  if (!mission) return NextResponse.json({ error: "No active mission" }, { status: 404 });

  const newStart = addDays(todayKey(), -(day - 1));
  const shift = daysBetween(mission.start_date, newStart);
  const { data, error } = await supabase
    .from("arc_missions")
    .update({
      start_date: newStart,
      end_date: addDays(newStart, MISSION_LENGTH - 1),
      days: mission.days.map((d) => ({ ...d, date: addDays(d.date, shift) })),
    })
    .eq("id", mission.id)
    .select("id, start_date")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Update wrote 0 rows — check arc_missions update RLS policy" }, { status: 500 });
  return NextResponse.json({ ok: true, startDate: data.start_date, todayIsDay: day, next: "Reload /arc to settle the mission" });
}
