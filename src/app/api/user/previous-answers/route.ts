import { NextResponse } from "next/server";
import { checkDailyLimit } from "@/lib/daily-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user's subscription tier
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();
  if (userError) console.error("[api/user/previous-answers] subscription tier read failed (treating as free):", userError.message);

  const subscriptionTier = userData?.subscription_tier || "free";

  // Has today's limit (lib/daily-limit.ts) already been used up? Looks only, takes no slot. If the
  // count itself fails we let the screen continue; /api/check-in and /api/roast still refuse server-side.
  const limit = await checkDailyLimit(supabase, user.id, subscriptionTier, { claim: false });
  const dailyLimitReached = !limit.allowed && limit.status === 429;
  const dailyLimitMessage = !limit.allowed && limit.status === 429 ? limit.body.error : undefined;
  // Old field, kept as it was (free tier only) so a cached older screen behaves the same.
  const hasUsedTodayRoast = subscriptionTier === "free" && dailyLimitReached;

  // Get the most recent roast
  const { data: previousRoast, error: previousRoastError } = await supabase
    .from("roasts")
    .select("answers, continuity_memory, roast_text, created_at, tone, persona")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousRoastError) console.error("[api/user/previous-answers] latest roast read failed:", previousRoastError.message);

  if (!previousRoast) {
    return NextResponse.json({ isReturning: false, hasUsedTodayRoast, dailyLimitReached, dailyLimitMessage });
  }

  return NextResponse.json({
    isReturning: true,
    hasUsedTodayRoast,
    dailyLimitReached,
    dailyLimitMessage,
    answers: previousRoast.answers,
    continuityMemory: previousRoast.continuity_memory,
    previousRoastText: previousRoast.roast_text,
    lastRoastDate: previousRoast.created_at,
    tone: previousRoast.tone ?? "normal",
    persona: previousRoast.persona ?? "default",
  });
}
