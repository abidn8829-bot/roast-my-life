import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardView, type DashboardRoast } from "@/components/dashboard-view";
import { DashboardHeader } from "@/components/dashboard-header";
import { parseAchievements } from "@/lib/achievements";
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

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier, achievements")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";
  const achievements = parseAchievements(userData?.achievements);

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
        {subscriptionTier === "free" && (
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4">
            <p className="text-sm text-neutral-300">
              You&apos;re on the free plan — 1 roast per day
            </p>
            {process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL && (
              <a
                href={process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-lg bg-[#FF3D00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Upgrade to Pro for unlimited roasts 🔥
              </a>
            )}
          </div>
        )}
        <DashboardView
          name={name}
          roasts={roasts}
          streak={streak}
          achievements={achievements}
        />
      </div>
    </main>
  );
}
