import { NextResponse } from "next/server";
import { computePercentile, MIN_SAMPLE_SIZE } from "@/lib/percentile";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { todayKey } from "@/lib/arc-trend";

// Runs DAILY (vercel.json) despite the route name — kept at this path so the
// existing Vercel cron wiring doesn't change. One row per Pro user per
// category per UTC day (snapshot_date), upserted so re-runs are idempotent.
export const dynamic = "force-dynamic";

const CATEGORIES = ["sleep", "fitness", "discipline", "focus", "spending"] as const;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== cronSecret) {
    console.error("[daily-arc-snapshot] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createSupabaseServiceClient();
  const snapshotDate = todayKey();

  const { data: distributionData, error: distributionError } = await service.rpc("get_category_averages");
  if (distributionError) {
    console.error("[daily-arc-snapshot] get_category_averages failed:", distributionError.message);
    return NextResponse.json({ error: "Failed to fetch category averages" }, { status: 500 });
  }

  const distributionByCategory = new Map<string, { avg_score: number; sample_size: number; scores: number[] }>();
  for (const row of (distributionData ?? []) as { category: string; avg_score: number; sample_size: number; scores: number[] }[]) {
    distributionByCategory.set(row.category, row);
  }

  const { data: proUsers, error: proUsersError } = await service
    .from("users")
    .select("id")
    .eq("subscription_tier", "pro");

  if (proUsersError) {
    console.error("[daily-arc-snapshot] Failed to fetch pro users:", proUsersError.message);
    return NextResponse.json({ error: "Failed to fetch pro users" }, { status: 500 });
  }

  let usersProcessed = 0;
  let rowsWritten = 0;
  const rows: {
    user_id: string;
    category: string;
    snapshot_date: string;
    user_score: number;
    avg_score: number | null;
    percentile: number | null;
    sample_size: number;
  }[] = [];

  for (const proUser of proUsers ?? []) {
    const userId = proUser.id as string;
    const { data: latestRoast } = await service
      .from("roasts")
      .select("category_scores")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = parseCategoryScores(latestRoast?.category_scores);
    if (!latest) continue;
    usersProcessed++;

    for (const category of CATEGORIES) {
      const userScore = latest[category].score;
      const distribution = distributionByCategory.get(category);
      const peerScores = Array.isArray(distribution?.scores) ? distribution.scores : null;
      const sampleSize = distribution?.sample_size ?? 0;

      const hasEnoughSample = Boolean(distribution && peerScores && peerScores.length > 0 && sampleSize >= MIN_SAMPLE_SIZE);

      rows.push({
        user_id: userId,
        category,
        snapshot_date: snapshotDate,
        user_score: userScore,
        avg_score: hasEnoughSample ? Number(distribution!.avg_score) : null,
        percentile: hasEnoughSample ? computePercentile(userScore, peerScores!) : null,
        sample_size: sampleSize,
      });
    }
  }

  if (rows.length > 0) {
    const { error: upsertError } = await service
      .from("arc_percentile_snapshots")
      .upsert(rows, { onConflict: "user_id,category,snapshot_date" });

    if (upsertError) {
      console.error("[daily-arc-snapshot] Upsert failed:", upsertError.message);
      return NextResponse.json({ error: "Failed to write snapshots" }, { status: 500 });
    }
    rowsWritten = rows.length;
  }

  console.log("[daily-arc-snapshot] Run complete:", { snapshotDate, usersProcessed, rowsWritten });
  return NextResponse.json({ success: true, snapshotDate, usersProcessed, rowsWritten });
}
