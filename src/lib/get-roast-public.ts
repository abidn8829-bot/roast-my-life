import { createClient } from "@supabase/supabase-js";
import { parseReportCard } from "@/lib/parse-report-card";
import type { ReportCard } from "@/lib/roast-types";

export type PublicRoast = {
  id: string;
  user_id: string;
  roast_text: string;
  report_card: ReportCard;
  share_slug: string;
  reaction: string | null;
};

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(url, key);
}

export async function getRoastByIdentifier(
  identifier: string,
): Promise<PublicRoast | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("get_roast_for_og", {
    p_identifier: identifier,
  });

  if (error || !data?.length) return null;

  const row = data[0] as {
    id: string;
    user_id: string;
    roast_text: string;
    report_card: unknown;
    share_slug: string;
  };

  const report_card = parseReportCard(row.report_card);
  if (!report_card) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    roast_text: row.roast_text,
    report_card,
    share_slug: row.share_slug,
    reaction: null,
  };
}
