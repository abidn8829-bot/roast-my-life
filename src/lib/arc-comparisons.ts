import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, ARC_CATEGORIES, ARC_CATEGORY_LABELS, type ArcCategory } from "@/lib/arc-trend";
import { computePercentile, MIN_SAMPLE_SIZE } from "@/lib/percentile";
import type { CategoryScores, Grade } from "@/lib/roast-types";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ProComparison = {
  category: ArcCategory;
  label: string;
  userScore: number;
  userGrade: Grade;
  avgScore: number | null;
  percentile: number | null;
  sampleSize: number;
  insufficientSample: boolean;
};

export type ComparisonsResult = {
  comparisons: ProComparison[];
  /** UTC date (YYYY-MM-DD) the peer distribution was taken. */
  asOf: string;
  source: "snapshot" | "live";
};

type DistributionRow = { avg_score: number; sample_size: number; scores: number[] };
type SnapshotRow = { avg_score: number | null; percentile: number | null; sample_size: number; snapshot_date: string };

async function fetchLiveDistribution(): Promise<Map<string, DistributionRow> | null> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc("get_category_averages");
  if (error) {
    console.error("[arc-comparisons] get_category_averages failed:", error.message);
    return null;
  }
  const byCategory = new Map<string, DistributionRow>();
  for (const row of (data ?? []) as ({ category: string } & DistributionRow)[]) {
    byCategory.set(row.category, row);
  }
  return byCategory;
}

/**
 * "You vs Ember users". Peer average/percentile come from the daily snapshot
 * cron; the user's own score/grade is always live (`latest`). If there's no
 * snapshot from today or yesterday (new Pro upgrade, cron missed), compute live.
 */
export async function getProComparisons(
  supabase: SupabaseClient,
  userId: string,
  latest: CategoryScores,
  today: string,
): Promise<ComparisonsResult> {
  const { data: snapshotRows, error: snapshotError } = await supabase
    .from("arc_percentile_snapshots")
    .select("category, avg_score, percentile, sample_size, snapshot_date")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(ARC_CATEGORIES.length * 2);
  if (snapshotError) console.error("[arc-comparisons] snapshot read failed:", snapshotError.message);

  const newestDate = (snapshotRows?.[0]?.snapshot_date as string | undefined) ?? null;
  const snapshotByCategory = new Map<string, SnapshotRow>();
  if (newestDate && newestDate >= addDays(today, -1)) {
    for (const row of snapshotRows ?? []) {
      if (row.snapshot_date === newestDate && !snapshotByCategory.has(row.category as string)) {
        snapshotByCategory.set(row.category as string, row as SnapshotRow);
      }
    }
  }

  const live = snapshotByCategory.size === 0 ? await fetchLiveDistribution() : null;

  const comparisons = ARC_CATEGORIES.map((category): ProComparison => {
    const userScore = latest[category].score;
    const userGrade = latest[category].grade;
    const base = { category, label: ARC_CATEGORY_LABELS[category], userScore, userGrade };

    const snapshot = snapshotByCategory.get(category);
    if (snapshot) {
      const ok = snapshot.percentile !== null && snapshot.avg_score !== null && snapshot.sample_size >= MIN_SAMPLE_SIZE;
      return {
        ...base,
        avgScore: ok ? Number(snapshot.avg_score) : null,
        percentile: ok ? Number(snapshot.percentile) : null,
        sampleSize: snapshot.sample_size,
        insufficientSample: !ok,
      };
    }

    const distribution = live?.get(category);
    const sampleSize = Number(distribution?.sample_size ?? 0);
    const peerScores = Array.isArray(distribution?.scores) ? distribution.scores.map(Number) : null;
    const ok = Boolean(peerScores && peerScores.length > 0 && sampleSize >= MIN_SAMPLE_SIZE);
    return {
      ...base,
      avgScore: ok ? Number(distribution!.avg_score) : null,
      percentile: ok ? computePercentile(userScore, peerScores!) : null,
      sampleSize,
      insufficientSample: !ok,
    };
  });

  return snapshotByCategory.size > 0
    ? { comparisons, asOf: newestDate!, source: "snapshot" }
    : { comparisons, asOf: today, source: "live" };
}
