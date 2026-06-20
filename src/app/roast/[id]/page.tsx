import { notFound, redirect } from "next/navigation";
import { RoastView } from "@/components/roast-view";
import { fetchOwnRoastById } from "@/lib/fetch-own-roast";
import { isUuid } from "@/lib/is-uuid";
import { parseReportCard } from "@/lib/parse-report-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingAnswers } from "@/lib/roast-types";

export const dynamic = "force-dynamic";

export default async function RoastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
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
      .select("current_streak, longest_streak")
      .eq("id", user.id)
      .single();

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
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
          top5Roasts={roast.top_5_roasts}
          categoryScores={roast.category_scores}
          currentStreak={userData?.current_streak}
          longestStreak={userData?.longest_streak}
          mode={roast.mode}
        />
      </main>
    );
  }

  const { data, error } = await supabase.rpc("get_roast_by_share_slug", {
    p_slug: roastId,
  });

  if (error || !data?.length) {
    console.error("[roast page] share slug lookup failed:", error?.message);
    notFound();
  }

  const row = data[0] as {
    id: string;
    roast_text: string;
    report_card: unknown;
    share_slug: string;
  };

  const reportCard = parseReportCard(row.report_card);
  if (!reportCard) {
    notFound();
  }

  let initialReaction: string | null = null;
  let canReact = false;
  let answers: OnboardingAnswers | undefined = undefined;
  let weekCount = 1;
  let lifeScore: number | undefined = undefined;
  let funnyTitle: string | undefined = undefined;
  let top5Roasts: string[] | undefined = undefined;
  let categoryScores: import("@/lib/roast-types").CategoryScores | undefined = undefined;
  let currentStreak: number | undefined = undefined;
  let longestStreak: number | undefined = undefined;
  let mode: import("@/lib/roast-types").RoastMode | undefined = undefined;

  if (user) {
    const owned = await fetchOwnRoastById(supabase, row.id, user.id);
    if (owned) {
      canReact = true;
      initialReaction = owned.reaction;
      answers = owned.answers;
      lifeScore = owned.life_score;
      funnyTitle = owned.funny_title;
      top5Roasts = owned.top_5_roasts;
      categoryScores = owned.category_scores;
      mode = owned.mode;
    }

    // Fetch week count
    const { data: weekData } = await supabase
      .from("roasts")
      .select("week_start_date")
      .eq("user_id", user.id);

    const uniqueWeeks = new Set(weekData?.map(r => r.week_start_date) || []);
    weekCount = uniqueWeeks.size;

    // Fetch user streak data
    const { data: userData } = await supabase
      .from("users")
      .select("current_streak, longest_streak")
      .eq("id", user.id)
      .single();

    currentStreak = userData?.current_streak;
    longestStreak = userData?.longest_streak;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
      <RoastView
        roastId={row.id}
        roastText={row.roast_text}
        reportCard={reportCard}
        shareSlug={row.share_slug}
        initialReaction={initialReaction}
        canReact={canReact}
        answers={answers}
        weekCount={weekCount}
        lifeScore={lifeScore}
        funnyTitle={funnyTitle}
        top5Roasts={top5Roasts}
        categoryScores={categoryScores}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        mode={mode}
      />
    </main>
  );
}
