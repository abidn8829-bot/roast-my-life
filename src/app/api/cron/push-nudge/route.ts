import { NextResponse } from "next/server";
import { parseAchievements } from "@/lib/achievements";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import { buildPushNudge } from "@/lib/roast-nudge";
import { calculateStreak } from "@/lib/streak";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendPushNotification } from "@/lib/webpush";

export const dynamic = "force-dynamic";

// Whole-day difference between "now" and a past timestamp, ignoring time of
// day (so a roast done at 11pm yesterday and a check today 1 hour later both
// read as "1 day since"), not a rolling 24h window.
function daysSince(dateIso: string): number {
  const thenKey = new Date(dateIso).toISOString().split("T")[0]!;
  const nowKey = new Date().toISOString().split("T")[0]!;
  const diffMs = new Date(nowKey).getTime() - new Date(thenKey).getTime();
  return Math.round(diffMs / 86_400_000);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== cronSecret) {
    console.error("[push-nudge] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roast-my-life.vercel.app";

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  if (subsError) {
    console.error("[push-nudge] Failed to fetch subscriptions:", subsError);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ success: true, notified: 0, skipped: 0, cleaned: 0 });
  }

  const userIds = Array.from(new Set(subs.map((s) => s.user_id as string)));
  let notified = 0;
  let skipped = 0;
  let cleaned = 0;

  for (const userId of userIds) {
    const userSubs = subs.filter((s) => s.user_id === userId);

    const [{ data: userRow }, { data: roastRows }] = await Promise.all([
      supabase.from("users").select("achievements").eq("id", userId).maybeSingle(),
      supabase
        .from("roasts")
        .select("created_at, category_scores")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (!roastRows || roastRows.length === 0) {
      skipped++;
      continue;
    }

    const daysSinceLastActivity = daysSince(roastRows[0]!.created_at as string);
    if (daysSinceLastActivity === 0) {
      // Already checked in today — no nudge needed.
      skipped++;
      continue;
    }

    const streak = calculateStreak(roastRows.map((r) => r.created_at as string));
    const latestScores = parseCategoryScores(roastRows[0]!.category_scores);
    const achievements = parseAchievements(userRow?.achievements);
    const hasRunningJoke = Boolean(
      achievements.first_running_joke_created?.unlocked_at && !achievements.running_joke_retired?.unlocked_at,
    );

    const nudge = buildPushNudge({ streak, daysSinceLastActivity, latestScores, hasRunningJoke });

    for (const sub of userSubs) {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint as string, p256dh: sub.p256dh as string, auth: sub.auth as string },
        { title: nudge.title, body: nudge.body, url: `${appUrl}/dashboard` },
      );
      if (result === "sent") notified++;
      if (result === "gone") {
        cleaned++;
        await supabase.from("push_subscriptions").delete().eq("id", sub.id as string);
      }
    }
  }

  console.log("[push-nudge] Run complete:", { notified, skipped, cleaned, totalUsers: userIds.length });
  return NextResponse.json({ success: true, notified, skipped, cleaned });
}
