import { NextResponse } from "next/server";
import { todayKey } from "@/lib/arc-trend";
import { templateOutcomeSummary, toMissionView } from "@/lib/missions";
import { getLatestScores, getSubscriptionTier, loadActiveMission, updateMission } from "@/lib/missions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getSubscriptionTier(supabase, user.id)) !== "pro") {
    return NextResponse.json({ error: "Missions are a Pro feature" }, { status: 403 });
  }

  try {
    const mission = await loadActiveMission(supabase, user.id);
    if (!mission) return NextResponse.json({ error: "No active mission" }, { status: 404 });
    const latest = await getLatestScores(supabase, user.id);
    const currentScore = latest?.[mission.category].score ?? mission.baseline_score;
    const updated = await updateMission(supabase, mission, {
      status: "abandoned",
      outcome_summary: templateOutcomeSummary(mission, currentScore, "abandoned"),
    });
    console.log("[api/missions/abandon] abandoned", mission.id);
    return NextResponse.json({ mission: toMissionView(updated, currentScore, todayKey()), canStart: true });
  } catch (error) {
    console.error("[api/missions/abandon] failed:", error);
    return NextResponse.json({ error: "Failed to abandon mission" }, { status: 500 });
  }
}
