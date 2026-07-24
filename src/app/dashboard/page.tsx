import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardView, type DashboardRoast, type ScoreHistoryEntry } from "@/components/dashboard-view";
import { DashboardHeader } from "@/components/dashboard-header";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { parseAchievements, unlockAchievements } from "@/lib/achievements";
import { getDisplayName } from "@/lib/display-name";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import { calculateStreak } from "@/lib/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RoastRow = {
  id: string;
  roast_text: string;
  week_start_date: string;
  share_slug: string;
  life_score: number | null;
  funny_title: string | null;
  category_scores: unknown;
  created_at: string;
};

type ScoreHistoryRow = {
  life_score: number;
  category_grades: unknown;
  recorded_at: string;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let newlyUnlockedAchievements: string[] = [];
  try {
    newlyUnlockedAchievements = (await unlockAchievements(supabase, user.id)).newlyUnlocked;
  } catch (error) {
    console.error("[dashboard] achievement evaluation failed:", error);
  }

  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier, achievements, current_streak, longest_streak")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";
  const achievements = parseAchievements(userData?.achievements);
  const currentStreak = userData?.current_streak ?? 0;
  const longestStreak = userData?.longest_streak ?? 0;

  let query = supabase
    .from("roasts")
    .select(
      "id, roast_text, week_start_date, share_slug, life_score, funny_title, category_scores, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (subscriptionTier === "free") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query = query.gte("created_at", sevenDaysAgo.toISOString());
  }

  const limit = subscriptionTier === "pro" ? 100 : 12;
  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[dashboard] fetch error:", error.message);
  }

  const rows = (data ?? []) as RoastRow[];

  const { data: historyData, error: historyError } = await supabase
    .from("score_history")
    .select("life_score, category_grades, recorded_at")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false })
    .limit(subscriptionTier === "pro" ? 100 : 12);
  if (historyError) {
    console.error("[dashboard] score history fetch error:", historyError.message);
  }
  const scoreHistory: ScoreHistoryEntry[] = ((historyData ?? []) as ScoreHistoryRow[])
    .map((row) => {
      const category_grades = parseCategoryScores(row.category_grades);
      return category_grades ? { life_score: row.life_score, category_grades, recorded_at: row.recorded_at } : null;
    })
    .filter((entry): entry is ScoreHistoryEntry => entry !== null);

  const roasts: DashboardRoast[] = [];
  for (const row of rows) {
    roasts.push({
      id: row.id,
      roast_text: row.roast_text,
      week_start_date: row.week_start_date,
      share_slug: row.share_slug,
      life_score: row.life_score,
      funny_title: row.funny_title,
      category_scores: parseCategoryScores(row.category_scores),
      created_at: row.created_at,
    });
  }

  const streak = calculateStreak(rows.map((r) => r.created_at));
  const name = getDisplayName(user);

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <DashboardHeader isPro={subscriptionTier === "pro"} name={name} />
        {subscriptionTier === "free" && <UpgradeBanner />}
        <DashboardView
          name={name}
          roasts={roasts}
          scoreHistory={scoreHistory}
          streak={streak}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          achievements={achievements}
          newlyUnlockedAchievements={newlyUnlockedAchievements}
          isPro={subscriptionTier === "pro"}
        />
      </div>
    </main>
  );
}
