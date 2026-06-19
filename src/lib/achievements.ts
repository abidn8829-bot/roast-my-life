import { calculateStreak } from "@/lib/streak";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AchievementId =
  | "first_roast"
  | "three_day_streak"
  | "rock_bottom"
  | "surprisingly_decent"
  | "serial_procrastinator";

export type UserAchievements = Partial<Record<AchievementId, string>>;

export type AchievementDef = {
  id: AchievementId;
  title: string;
  description: string;
  emoji: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_roast",
    title: "First Roast",
    description: "Survived your first reality check",
    emoji: "🎯",
  },
  {
    id: "three_day_streak",
    title: "3 Day Streak",
    description: "3 days of self-inflicted emotional damage",
    emoji: "🔥",
  },
  {
    id: "rock_bottom",
    title: "Rock Bottom",
    description: "Life score below 20 — impressive in the worst way",
    emoji: "💀",
  },
  {
    id: "surprisingly_decent",
    title: "Surprisingly Decent",
    description: "Life score above 70 — who are you?",
    emoji: "✨",
  },
  {
    id: "serial_procrastinator",
    title: "Serial Procrastinator",
    description: 'Said "study" or "gym" 3 times and still never did it',
    emoji: "📚",
  },
];

export function parseAchievements(raw: unknown): UserAchievements {
  if (!raw || typeof raw !== "object") return {};
  const result: UserAchievements = {};
  for (const { id } of ACHIEVEMENTS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === "string") result[id] = value;
  }
  return result;
}

export function isProcrastinatorAnswer(neverDoThing: string): boolean {
  const lower = neverDoThing.toLowerCase();
  return lower.includes("study") || lower.includes("gym");
}

type RoastHistoryRow = {
  created_at: string;
  answers: unknown;
};

function evaluateUnlocks(
  roastCount: number,
  streak: number,
  lifeScore: number,
  procrastinatorCount: number,
): AchievementId[] {
  const unlocked: AchievementId[] = [];
  if (roastCount >= 1) unlocked.push("first_roast");
  if (streak >= 3) unlocked.push("three_day_streak");
  if (lifeScore < 20) unlocked.push("rock_bottom");
  if (lifeScore > 70) unlocked.push("surprisingly_decent");
  if (procrastinatorCount >= 3) unlocked.push("serial_procrastinator");
  return unlocked;
}

export async function unlockAchievements(
  supabase: SupabaseClient,
  userId: string,
  lifeScore: number,
): Promise<UserAchievements> {
  const [{ data: userRow }, { data: roasts }] = await Promise.all([
    supabase.from("users").select("achievements").eq("id", userId).single(),
    supabase
      .from("roasts")
      .select("created_at, answers")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const current = parseAchievements(userRow?.achievements);
  const rows = (roasts ?? []) as RoastHistoryRow[];

  const streak = calculateStreak(rows.map((r) => r.created_at));
  let procrastinatorCount = 0;
  for (const row of rows) {
    const answers = row.answers as { neverDoThing?: string } | null;
    if (answers?.neverDoThing && isProcrastinatorAnswer(answers.neverDoThing)) {
      procrastinatorCount++;
    }
  }

  const toUnlock = evaluateUnlocks(
    rows.length,
    streak,
    lifeScore,
    procrastinatorCount,
  );

  const now = new Date().toISOString();
  const updated: UserAchievements = { ...current };
  let changed = false;

  for (const id of toUnlock) {
    if (!updated[id]) {
      updated[id] = now;
      changed = true;
    }
  }

  if (changed) {
    await supabase
      .from("users")
      .update({ achievements: updated })
      .eq("id", userId);
  }

  return updated;
}
