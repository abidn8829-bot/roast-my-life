import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/achievements";
import { sendPushNotification } from "@/lib/webpush";

export function buildAchievementPush(unlocked: AchievementId[]): { title: string; body: string } {
  const defs = unlocked.map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id)!);

  if (defs.length === 1) {
    const achievement = defs[0]!;
    return { title: "Ember", body: `${achievement.emoji} ${achievement.title} — ${achievement.description.toLowerCase()}.` };
  }

  const names = defs.map((achievement) => `${achievement.emoji} ${achievement.title}`).join(", ");
  return { title: "Ember", body: `${defs.length} unlocked while you weren't looking: ${names}.` };
}

export async function sendAchievementPush(
  supabase: SupabaseClient,
  userId: string,
  newlyUnlocked: AchievementId[],
): Promise<void> {
  if (newlyUnlocked.length === 0) return;

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) return;

  const payload = buildAchievementPush(newlyUnlocked);

  for (const sub of subs) {
    const result = await sendPushNotification(
      { endpoint: sub.endpoint as string, p256dh: sub.p256dh as string, auth: sub.auth as string },
      payload,
    );
    if (result === "gone") {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id as string);
    }
  }
}
