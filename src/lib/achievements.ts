import { calculateStreak } from "@/lib/streak";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AchievementId =
  | "first_roast"
  | "second_roast"
  | "three_day_streak"
  | "seven_day_streak"
  | "first_follow_up_completed"
  | "first_running_joke_created"
  | "running_joke_retired"
  | "ten_roasts_completed";

export type AchievementState = { unlocked_at?: string; progress?: number };
export type UserAchievements = Partial<Record<AchievementId, AchievementState>>;

export type AchievementDef = {
  id: AchievementId;
  title: string;
  description: string;
  emoji: string;
  target?: number;
  hint: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_roast", title: "First Roast", description: "Survived your first reality check", emoji: "🎯", hint: "Complete your first roast" },
  { id: "second_roast", title: "Returned for Second Roast", description: "Came back for another serving of honesty", emoji: "🔁", target: 2, hint: "Complete 2 roasts total" },
  { id: "three_day_streak", title: "3-Day Streak", description: "3 days of self-inflicted emotional damage", emoji: "🔥", target: 3, hint: "Check in 3 days in a row" },
  { id: "seven_day_streak", title: "7-Day Streak", description: "A full week of facing the allegations", emoji: "⚡", target: 7, hint: "Check in 7 days in a row" },
  { id: "first_follow_up_completed", title: "First Follow-up Completed", description: "Answered for your habits instead of disappearing", emoji: "💬", hint: "Answer one check-in question" },
  { id: "first_running_joke_created", title: "First Running Joke Created", description: "Congratulations, your bad habit has lore", emoji: "📺", target: 2, hint: "Have the same theme come up in 2 check-ins" },
  { id: "running_joke_retired", title: "Running Joke Retired", description: "Improved enough to cancel your own bit", emoji: "🏁", hint: "Improve enough that a running joke gets marked resolved" },
  { id: "ten_roasts_completed", title: "10 Roasts Completed", description: "Ten documented episodes of personal chaos", emoji: "🔟", target: 10, hint: "Complete 10 roasts total" },
];

export function parseAchievements(raw: unknown): UserAchievements {
  if (!raw || typeof raw !== "object") return {};
  const result: UserAchievements = {};
  for (const { id } of ACHIEVEMENTS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === "string") result[id] = { unlocked_at: value };
    if (value && typeof value === "object") {
      const state = value as Record<string, unknown>;
      result[id] = {
        unlocked_at: typeof state.unlocked_at === "string" ? state.unlocked_at : undefined,
        progress: typeof state.progress === "number" ? state.progress : undefined,
      };
    }
  }
  return result;
}

type RoastHistoryRow = { created_at: string; continuity_memory: unknown };
type Progress = Record<AchievementId, number>;

function memoryFlag(memory: unknown, key: string): boolean {
  return !!memory && typeof memory === "object" && Boolean((memory as Record<string, unknown>)[key]);
}

function getProgress(rows: RoastHistoryRow[]): Progress {
  const roastCount = rows.length;
  const streak = calculateStreak(rows.map((row) => row.created_at));
  const followUpCompleted = rows.some((row) => memoryFlag(row.continuity_memory, "lastResponse") || memoryFlag(row.continuity_memory, "lastAnswer"));
  const maxCallbackCount = rows.reduce((max, row) => {
    const memory = row.continuity_memory as Record<string, unknown> | null;
    const count = typeof memory?.callbackCount === "number" ? memory.callbackCount : 0;
    return Math.max(max, count);
  }, 0);
  const runningJokeRetired = rows.some((row) => {
    const memory = row.continuity_memory as Record<string, unknown> | null;
    return memory?.resolved === true;
  });
  return {
    first_roast: Math.min(roastCount, 1),
    second_roast: Math.min(roastCount, 2),
    three_day_streak: Math.min(streak, 3),
    seven_day_streak: Math.min(streak, 7),
    first_follow_up_completed: followUpCompleted ? 1 : 0,
    first_running_joke_created: Math.min(maxCallbackCount, 2),
    running_joke_retired: runningJokeRetired ? 1 : 0,
    ten_roasts_completed: Math.min(roastCount, 10),
  };
}

function isComplete(id: AchievementId, progress: Progress): boolean {
  const target = ACHIEVEMENTS.find((achievement) => achievement.id === id)?.target ?? 1;
  return progress[id] >= target;
}

export async function unlockAchievements(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ achievements: UserAchievements; newlyUnlocked: AchievementId[] }> {
  const [{ data: userRow }, { data: roasts }] = await Promise.all([
    supabase.from("users").select("achievements").eq("id", userId).single(),
    supabase.from("roasts").select("created_at, continuity_memory").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  const current = parseAchievements(userRow?.achievements);
  const progress = getProgress((roasts ?? []) as RoastHistoryRow[]);
  const updated: UserAchievements = { ...current };
  const newlyUnlocked: AchievementId[] = [];
  const now = new Date().toISOString();

  for (const achievement of ACHIEVEMENTS) {
    const currentState = updated[achievement.id] ?? {};
    const state: AchievementState = { ...currentState, progress: progress[achievement.id] };
    if (!state.unlocked_at && isComplete(achievement.id, progress)) {
      state.unlocked_at = now;
      newlyUnlocked.push(achievement.id);
    }
    updated[achievement.id] = state;
  }

  console.log("[achievements][diagnostic] about to write:", JSON.stringify(updated));
  const { error } = await supabase.from("users").update({ achievements: updated }).eq("id", userId).select();
  if (error) console.error("[achievements] failed to update:", error.message);
  return { achievements: updated, newlyUnlocked };
}
