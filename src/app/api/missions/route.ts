import { NextResponse } from "next/server";
import { getProComparisons } from "@/lib/arc-comparisons";
import { addDays, todayKey } from "@/lib/arc-trend";
import { computeTarget, MISSION_LENGTH, pickMissionCategory, toMissionView } from "@/lib/missions";
import {
  advanceMission,
  buildMissionContext,
  generateMissionStart,
  getLatestScores,
  getSubscriptionTier,
  insertMission,
  loadActiveMission,
  loadLatestFinishedMission,
} from "@/lib/missions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function authorize() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if ((await getSubscriptionTier(supabase, user.id)) !== "pro") {
    return { error: NextResponse.json({ error: "Missions are a Pro feature" }, { status: 403 }) } as const;
  }
  return { supabase, userId: user.id } as const;
}

export async function GET() {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;
  const today = todayKey();

  const latest = await getLatestScores(supabase, userId);
  if (!latest) return NextResponse.json({ mission: null, canStart: false, reason: "Get roasted first to start a mission." });

  try {
    const active = await loadActiveMission(supabase, userId);
    if (active) {
      const advanced = await advanceMission(supabase, active, latest[active.category].score, today);
      return NextResponse.json({
        mission: toMissionView(advanced, latest[advanced.category].score, today),
        canStart: advanced.status !== "active",
      });
    }
    const finished = await loadLatestFinishedMission(supabase, userId);
    return NextResponse.json({
      mission: finished ? toMissionView(finished, latest[finished.category].score, today) : null,
      canStart: true,
    });
  } catch (error) {
    console.error("[api/missions] GET failed:", error);
    return NextResponse.json({ error: "Failed to load mission" }, { status: 500 });
  }
}

export async function POST() {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;
  const today = todayKey();

  const latest = await getLatestScores(supabase, userId);
  if (!latest) return NextResponse.json({ error: "Get roasted first to start a mission." }, { status: 409 });

  try {
    if (await loadActiveMission(supabase, userId)) {
      return NextResponse.json({ error: "You already have an active mission." }, { status: 409 });
    }

    const { comparisons } = await getProComparisons(supabase, userId, latest, today);
    const pick = pickMissionCategory(comparisons, latest);
    if (!pick) return NextResponse.json({ error: "Every category is already an A. Nothing to fix — for now." }, { status: 409 });

    const currentScore = latest[pick.category].score;
    const target = computeTarget(currentScore, pick.emberAvg);
    if (!target) return NextResponse.json({ error: "No reachable target for this category." }, { status: 409 });

    const context = await buildMissionContext(supabase, userId, today);
    const start = await generateMissionStart({ category: pick.category, currentScore, target: target.target, targetLabel: target.label, ...context });
    if (!start) {
      return NextResponse.json({ error: "Couldn't build your mission right now. Try again in a minute." }, { status: 502 });
    }

    const mission = await insertMission(supabase, {
      user_id: userId,
      category: pick.category,
      status: "active",
      start_date: today,
      end_date: addDays(today, MISSION_LENGTH - 1),
      baseline_score: currentScore,
      target_score: target.target,
      target_label: target.label,
      root_cause: start.rootCause,
      days: [{ day: 1, date: today, step: start.step, why: start.why, status: "pending" }],
    });
    console.log("[api/missions] started", mission.id, mission.category, `${currentScore} → ${target.target}`);
    return NextResponse.json({ mission: toMissionView(mission, currentScore, today), canStart: false });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "You already have an active mission." }, { status: 409 });
    }
    console.error("[api/missions] POST failed:", error);
    return NextResponse.json({ error: "Failed to start mission" }, { status: 500 });
  }
}
