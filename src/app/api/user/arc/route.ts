import { NextResponse } from "next/server";
import { getProComparisons } from "@/lib/arc-comparisons";
import {
  addDays,
  buildCategoryTrends,
  buildDailySeries,
  sparklineWindow,
  todayKey,
  type TrendSample,
} from "@/lib/arc-trend";
import { calculateLifeScore } from "@/lib/grades";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FREE_WINDOW_DAYS = 7;
const PRO_WINDOW_DAYS = 30;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await supabase
    .from("roasts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count || count < 2) {
    return NextResponse.json({ hasEnoughHistory: false });
  }

  const today = todayKey();
  // One extra day before the window so "vs 7 days ago" / "vs yesterday" have a
  // value to carry forward from, plus the newest row before that.
  const windowStart = `${addDays(today, -PRO_WINDOW_DAYS)}T00:00:00Z`;

  const [{ data: userData }, { data: firstRows }, { data: latestRows }, historyRes, { data: priorRows }] = await Promise.all([
    supabase.from("users").select("subscription_tier").eq("id", user.id).single(),
    supabase
      .from("roasts")
      .select("category_scores, life_score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("roasts")
      .select("category_scores, life_score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("score_history")
      .select("life_score, category_grades, recorded_at")
      .eq("user_id", user.id)
      .gte("recorded_at", windowStart)
      .order("recorded_at", { ascending: true })
      .limit(500),
    supabase
      .from("score_history")
      .select("life_score, category_grades, recorded_at")
      .eq("user_id", user.id)
      .lt("recorded_at", windowStart)
      .order("recorded_at", { ascending: false })
      .limit(1),
  ]);
  if (historyRes.error) console.error("[api/user/arc] score_history read failed:", historyRes.error.message);

  const first = parseCategoryScores(firstRows?.[0]?.category_scores);
  const latest = parseCategoryScores(latestRows?.[0]?.category_scores);
  if (!first || !latest) {
    return NextResponse.json({ hasEnoughHistory: false });
  }

  const isPro = userData?.subscription_tier === "pro";

  // The first roast never writes score_history (only /api/check-in does), so
  // it's added as the day-1 point; the latest roast keeps "now" live.
  const toSample = (row: { category_scores: unknown; life_score: unknown; created_at: unknown }, categories: typeof latest): TrendSample => ({
    recordedAt: row.created_at as string,
    lifeScore: Number(row.life_score ?? calculateLifeScore(categories)),
    categories,
  });
  const samples: TrendSample[] = [toSample(firstRows![0]!, first), toSample(latestRows![0]!, latest)];
  for (const row of [...(priorRows ?? []), ...(historyRes.data ?? [])]) {
    const categories = parseCategoryScores(row.category_grades);
    if (categories) samples.push({ recordedAt: row.recorded_at as string, lifeScore: Number(row.life_score), categories });
  }
  const series = buildDailySeries(samples);

  const windowDays = isPro ? PRO_WINDOW_DAYS : FREE_WINDOW_DAYS;
  const trends = buildCategoryTrends(series, latest, today).map((t) => (isPro ? t : { ...t, dayOne: null }));
  const lifeScoreNow = Number(latestRows![0]!.life_score ?? calculateLifeScore(latest));

  const trend = {
    windowDays,
    lifeScoreNow,
    sparkline: sparklineWindow(series, today, windowDays),
    categories: trends,
  };

  if (!isPro) {
    return NextResponse.json({ hasEnoughHistory: true, today, locked: true, trend });
  }

  const pro = await getProComparisons(supabase, user.id, latest, today);
  return NextResponse.json({ hasEnoughHistory: true, today, locked: false, trend, pro });
}
