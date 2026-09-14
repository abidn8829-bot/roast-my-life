import { NextResponse } from "next/server";
import { ACHIEVEMENTS, parseAchievements, type AchievementId } from "@/lib/achievements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Dev-only testing aid: clears unlocked_at for one (or all) achievements on the currently
// logged-in account, so a real check-in/roast afterward can unlock it again without a new
// signup. 404s outside development — never touches achievements.ts's unlock logic itself,
// just resets state so that logic runs fresh.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const validIds = ACHIEVEMENTS.map((a) => a.id);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({
      usage: "GET /api/dev/reset-achievement?id=<achievement_id> or ?id=all",
      validIds,
    });
  }

  const idsToReset: AchievementId[] =
    id === "all" ? validIds : validIds.includes(id as AchievementId) ? [id as AchievementId] : [];

  if (idsToReset.length === 0) {
    return NextResponse.json(
      { error: `Unknown achievement id "${id}". Valid ids: ${validIds.join(", ")}, or "all".` },
      { status: 400 },
    );
  }

  const { data: userRow, error: fetchError } = await supabase
    .from("users")
    .select("achievements")
    .eq("id", user.id)
    .single();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const current = parseAchievements(userRow?.achievements);
  const updated = { ...current };
  for (const achievementId of idsToReset) {
    delete updated[achievementId];
  }

  const { error: updateError } = await supabase.from("users").update({ achievements: updated }).eq("id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reset: idsToReset });
}
