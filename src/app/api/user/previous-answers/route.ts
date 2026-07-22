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

  // Get the most recent roast
  const { data: previousRoast } = await supabase
    .from("roasts")
    .select("answers, continuity_memory, roast_text, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!previousRoast) {
    return NextResponse.json({ isReturning: false });
  }

  return NextResponse.json({
    isReturning: true,
    answers: previousRoast.answers,
    continuityMemory: previousRoast.continuity_memory,
    previousRoastText: previousRoast.roast_text,
    lastRoastDate: previousRoast.created_at,
  });
}
