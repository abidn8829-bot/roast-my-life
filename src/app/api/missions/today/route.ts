import { NextResponse } from "next/server";
import { todayKey } from "@/lib/arc-trend";
import { missionDayNumber, MISSION_LENGTH, settleMission, toMissionView, type MissionDay, type MissionDayStatus } from "@/lib/missions";
import { advanceMission, getLatestScores, getSubscriptionTier, loadActiveMission } from "@/lib/missions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Marks today's mission step done/missed (the buttons are the source of
// truth), then generates the next day's step or finishes the mission.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getSubscriptionTier(supabase, user.id)) !== "pro") {
    return NextResponse.json({ error: "Missions are a Pro feature" }, { status: 403 });
  }

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.status !== "done" && body.status !== "missed") {
    return NextResponse.json({ error: 'status must be "done" or "missed"' }, { status: 400 });
  }
  const mark: MissionDayStatus = body.status;

  const latest = await getLatestScores(supabase, user.id);
  if (!latest) return NextResponse.json({ error: "No scores yet" }, { status: 409 });

  const today = todayKey();
  try {
    const mission = await loadActiveMission(supabase, user.id);
    if (!mission) return NextResponse.json({ error: "No active mission" }, { status: 404 });
    const currentScore = latest[mission.category].score;

    const dayNo = missionDayNumber(mission.start_date, today);
    if (dayNo > MISSION_LENGTH) {
      const finished = await advanceMission(supabase, mission, currentScore, today);
      return NextResponse.json({ mission: toMissionView(finished, currentScore, today), canStart: true });
    }

    const { days } = settleMission(mission, currentScore, today);
    const entry = days.find((d) => d.day === dayNo);
    if (entry && entry.status !== "pending") {
      return NextResponse.json({ error: "Today is already marked." }, { status: 409 });
    }
    const markedDays: MissionDay[] = entry
      ? days.map((d) => (d.day === dayNo ? { ...d, status: mark } : d))
      : [...days, { day: dayNo, date: today, step: null, why: null, status: mark }].sort((a, b) => a.day - b.day);

    const updated = await advanceMission(supabase, { ...mission, days: markedDays }, currentScore, today, { dirty: true });
    return NextResponse.json({ mission: toMissionView(updated, currentScore, today), canStart: updated.status !== "active" });
  } catch (error) {
    console.error("[api/missions/today] failed:", error);
    return NextResponse.json({ error: "Failed to save your mark" }, { status: 500 });
  }
}
