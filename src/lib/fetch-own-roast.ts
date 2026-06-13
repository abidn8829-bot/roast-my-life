import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReportCard } from "@/lib/parse-report-card";
import type { CategoryScores, OnboardingAnswers, ReportCard } from "@/lib/roast-types";

export type OwnRoast = {
  id: string;
  roast_text: string;
  report_card: ReportCard;
  share_slug: string;
  reaction: string | null;
  answers?: OnboardingAnswers;
  life_score?: number;
  funny_title?: string;
  top_5_roasts?: string[];
  category_scores?: CategoryScores;
};

export async function fetchOwnRoastById(
  supabase: SupabaseClient,
  roastId: string,
  userId: string,
): Promise<OwnRoast | null> {
  const { data, error } = await supabase
    .from("roasts")
    .select("id, roast_text, report_card, share_slug, answers, life_score, funny_title, top_5_roasts, category_scores")
    .eq("id", roastId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[fetchOwnRoastById] query error:", error.message, error.code);
    return null;
  }

  if (!data) {
    console.error("[fetchOwnRoastById] no row for id:", roastId);
    return null;
  }

  const report_card = parseReportCard(data.report_card);
  if (!report_card) {
    console.error("[fetchOwnRoastById] invalid report_card:", data.report_card);
    return null;
  }

  let reaction: string | null = null;
  const { data: reactionRow, error: reactionError } = await supabase
    .from("roasts")
    .select("reaction")
    .eq("id", roastId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!reactionError && reactionRow) {
    reaction = reactionRow.reaction ?? null;
  }

  return {
    id: data.id,
    roast_text: data.roast_text,
    report_card,
    share_slug: data.share_slug,
    reaction,
    answers: data.answers as OnboardingAnswers | undefined,
    life_score: data.life_score,
    funny_title: data.funny_title,
    top_5_roasts: data.top_5_roasts,
    category_scores: data.category_scores as CategoryScores | undefined,
  };
}
