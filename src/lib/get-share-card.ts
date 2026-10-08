import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { isUuid } from "@/lib/is-uuid";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import type { CategoryScores } from "@/lib/roast-types";

/**
 * The only fields a public visitor (or the OG image) is ever allowed to see.
 * Deliberately excludes user_id, answers, streaks, reactions, plan steps and
 * the roast id itself. Add fields here only if they're safe to publish.
 */
export type ShareCardData = {
  lifeScore: number;
  funnyTitle: string;
  /** Per-roast Gen Z line for the card. Falls back to a legacy top-5 line for roasts made before card_punchline existed. */
  punchline: string;
  categoryScores: CategoryScores | null;
  /** Full roast text. Only populated for share_slug lookups (the share-code RPC, migration 027, exposes it publicly). */
  roastText: string | null;
};

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

const FALLBACK_ROAST = "You need to do better.";

type ShareCardResult =
  | { card: ShareCardData }
  | { error: "not_found" }
  | { error: "db"; message: string };

type CardRow = {
  life_score: number | null;
  funny_title: string | null;
  top_5_roasts: unknown;
  // Absent until migration 019 has run.
  card_punchline?: string | null;
  category_scores: unknown;
};

function toShareCard(row: CardRow, roastText: string | null): ShareCardData {
  const roasts = Array.isArray(row.top_5_roasts)
    ? row.top_5_roasts.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  return {
    lifeScore: Math.max(0, Math.min(100, Math.round(Number(row.life_score ?? 50)))),
    funnyTitle: row.funny_title?.trim() || "Your Life",
    punchline: row.card_punchline?.trim() || roasts[0] || FALLBACK_ROAST,
    categoryScores: parseCategoryScores(row.category_scores),
    roastText: roastText?.trim() || null,
  };
}

// cache(): generateMetadata and the page render share one lookup per request.
export const getShareCardData = cache(async (identifier: string): Promise<ShareCardResult> => {
  const supabase = createAnonClient();

  // Private roast UUID (in-app share sheet): card fields only, no roast text.
  if (isUuid(identifier)) {
    const { data, error } = await supabase.rpc("get_roast_for_og", { p_id: identifier });
    if (error) return { error: "db", message: error.message };
    if (!data?.length) return { error: "not_found" };
    return { card: toShareCard(data[0] as CardRow, null) };
  }

  // Public share code: one RPC that returns public fields only (migration 027).
  const { data, error } = await supabase.rpc("get_roast_by_share_slug", { p_slug: identifier });
  if (error) {
    console.error("[get-share-card] get_roast_by_share_slug failed:", error.message);
    return { error: "db", message: error.message };
  }
  if (!data?.length) return { error: "not_found" };

  const row = data[0] as CardRow & { roast_text: string | null };
  return { card: toShareCard(row, row.roast_text) };
});
