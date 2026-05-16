import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReportCard } from "@/lib/parse-report-card";
import type { ReportCard } from "@/lib/roast-types";

export type OwnRoast = {
  id: string;
  roast_text: string;
  report_card: ReportCard;
  share_slug: string;
  reaction: string | null;
};

export async function fetchOwnRoastById(
  supabase: SupabaseClient,
  roastId: string,
  userId: string,
): Promise<OwnRoast | null> {
  const { data, error } = await supabase
    .from("roasts")
    .select("id, roast_text, report_card, share_slug")
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
  };
}
