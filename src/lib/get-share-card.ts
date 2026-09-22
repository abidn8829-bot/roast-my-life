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
  /** Full roast text. Only populated for share_slug lookups (the slug RPC already exposes it publicly). */
  roastText: string | null;
};

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

const FALLBACK_ROAST = "You need to do better.";

/** Resolves a roast UUID or a public share_slug to its internal UUID (server-side only). */
async function resolveRoast(
  supabase: ReturnType<typeof createAnonClient>,
  identifier: string,
): Promise<{ id: string; roastText: string | null } | null> {
  if (isUuid(identifier)) return { id: identifier, roastText: null };
  const { data, error } = await supabase.rpc("get_roast_by_share_slug", { p_slug: identifier });
  if (error || !data?.length) return null;
  const row = data[0] as { id: string; roast_text: string | null };
  return { id: row.id, roastText: row.roast_text };
}

type ShareCardResult =
  | { card: ShareCardData }
  | { error: "not_found" }
  | { error: "db"; message: string };

// cache(): generateMetadata and the page render share one lookup per request.
export const getShareCardData = cache(async (identifier: string): Promise<ShareCardResult> => {
  const supabase = createAnonClient();

  const resolved = await resolveRoast(supabase, identifier);
  if (!resolved) return { error: "not_found" };

  const { data, error } = await supabase.rpc("get_roast_for_og", { p_id: resolved.id });
  if (error) return { error: "db", message: error.message };
  if (!data?.length) return { error: "not_found" };

  const row = data[0] as {
    life_score: number | null;
    funny_title: string | null;
    top_5_roasts: unknown;
    // Absent until migration 019 has run.
    card_punchline?: string | null;
    category_scores: unknown;
  };

  const roasts = Array.isArray(row.top_5_roasts)
    ? row.top_5_roasts.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  return {
    card: {
      lifeScore: Math.max(0, Math.min(100, Math.round(Number(row.life_score ?? 50)))),
      funnyTitle: row.funny_title?.trim() || "Your Life",
      punchline: row.card_punchline?.trim() || roasts[0] || FALLBACK_ROAST,
      categoryScores: parseCategoryScores(row.category_scores),
      roastText: resolved.roastText?.trim() || null,
    },
  };
});
