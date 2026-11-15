import { NextResponse } from "next/server";
import { parseAchievements } from "@/lib/achievements";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import { buildPushNudge } from "@/lib/roast-nudge";
import { addDaysToKey, dayKeyInZone, getUserTimezone } from "@/lib/day-key";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getUserStreak } from "@/lib/user-streak";
import { getPauseSummaries } from "@/lib/safety-server";
import { sendPushNotification } from "@/lib/webpush";

export const dynamic = "force-dynamic";

// Whole-day difference between "now" and a past timestamp, ignoring time of
// day (so a roast done at 11pm yesterday and a check today 1 hour later both
// read as "1 day since"), not a rolling 24h window. Days are the user's own local days.
function daysSince(dateIso: string, timeZone: string): number {
  const thenKey = dayKeyInZone(dateIso, timeZone);
  const nowKey = dayKeyInZone(new Date(), timeZone);
  let days = 0;
  for (let key = thenKey; key < nowKey && days < 3650; key = addDaysToKey(key, 1)) days++;
  return days;
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
  // Users who are paused (24 hours after a safety flag, see lib/safety-pause.ts) get no nudges at all.
  // For 3 days after a pause ends the nudge is a soft, plain line instead of the usual roast / streak copy.
  const pauseSummaries = await getPauseSummaries(supabase);
  let notified = 0;
  let skipped = 0;
  let cleaned = 0;

  for (const userId of userIds) {
    const userSubs = subs.filter((s) => s.user_id === userId);

    const pause = pauseSummaries.get(userId);
    if (pause?.paused) {
      skipped++;
      continue;
    }

    const [{ data: userRow }, { data: roastRows }] = await Promise.all([
      supabase.from("users").select("achievements, timezone").eq("id", userId).maybeSingle(),
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

    const timeZone = getUserTimezone(userRow?.timezone);
    const daysSinceLastActivity = daysSince(roastRows[0]!.created_at as string, timeZone);
    if (daysSinceLastActivity === 0) {
      // Already checked in today — no nudge needed.
      skipped++;
      continue;
    }

    // Same streak as the dashboard and result page (all roast dates, the user's local days).
    const streak = (await getUserStreak(supabase, userId, timeZone)).current;
    const latestScores = parseCategoryScores(roastRows[0]!.category_scores);
    const achievements = parseAchievements(userRow?.achievements);
    const hasRunningJoke = Boolean(
      achievements.first_running_joke_created?.unlocked_at && !achievements.running_joke_retired?.unlocked_at,
    );

    const nudge = buildPushNudge({ streak, daysSinceLastActivity, latestScores, hasRunningJoke, soft: pause?.softNudge === true });

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
