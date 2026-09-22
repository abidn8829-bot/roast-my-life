import { notFound, redirect } from "next/navigation";
import { RoastView } from "@/components/roast-view";
import { backfillCardPunchline } from "@/lib/card-punchline";
import { fetchOwnRoastById } from "@/lib/fetch-own-roast";
import { isUuid } from "@/lib/is-uuid";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RoastDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id: param } = await params;
  const { share } = await searchParams;
  const roastId = decodeURIComponent(param).trim();

  if (!roastId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isUuid(roastId)) {
    if (!user) {
      redirect(`/login?next=/roast/${roastId}`);
    }

    const roast = await fetchOwnRoastById(supabase, roastId, user.id);
    if (!roast) {
      notFound();
    }

    // Make sure the share card has a real punchline before the share sheet asks for the image.
    await backfillCardPunchline(supabase, roast);

    // Fetch week count
    const { data: weekData } = await supabase
      .from("roasts")
      .select("week_start_date")
      .eq("user_id", user.id);
    
    const uniqueWeeks = new Set(weekData?.map(r => r.week_start_date) || []);
    const weekCount = uniqueWeeks.size;

    // Fetch user streak data
    const { data: userData } = await supabase
      .from("users")
      .select("current_streak, longest_streak, subscription_tier")
      .eq("id", user.id)
      .single();

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text">
        <RoastView
          roastId={roast.id}
          roastText={roast.roast_text}
          reportCard={roast.report_card}
          shareSlug={roast.share_slug}
          initialReaction={roast.reaction}
          canReact
          answers={roast.answers}
          weekCount={weekCount}
          lifeScore={roast.life_score}
          funnyTitle={roast.funny_title}
          subscriptionTier={userData?.subscription_tier ?? "free"}
          categoryScores={roast.category_scores}
          currentStreak={userData?.current_streak}
          longestStreak={userData?.longest_streak}
          mode={roast.mode}
          persona={roast.persona}
          suggestionLine={roast.suggestion_line}
          showShareSheet={share === "1"}
        />
      </main>
    );
  }

  // Public links live at /share/[slug]; keep old /roast/[slug] links working.
  redirect(`/share/${encodeURIComponent(roastId)}`);
}
