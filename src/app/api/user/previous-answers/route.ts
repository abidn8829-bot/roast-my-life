import { NextResponse } from "next/server";
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
  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";

  // If free tier, check if they already have a roast today
  let hasUsedTodayRoast = false;
  if (subscriptionTier === "free") {
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRoast } = await supabase
      .from("roasts")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`)
      .maybeSingle();

    hasUsedTodayRoast = !!existingRoast;
  }

  // Get the most recent roast
  const { data: previousRoast } = await supabase
    .from("roasts")
    .select("answers, continuity_memory, roast_text, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!previousRoast) {
    return NextResponse.json({ isReturning: false, hasUsedTodayRoast });
  }

  return NextResponse.json({
    isReturning: true,
    hasUsedTodayRoast,
    answers: previousRoast.answers,
    continuityMemory: previousRoast.continuity_memory,
    previousRoastText: previousRoast.roast_text,
    lastRoastDate: previousRoast.created_at,
  });
}
