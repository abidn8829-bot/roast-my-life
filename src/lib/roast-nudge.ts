import type { CategoryScores, Grade } from "@/lib/roast-types";

const CATEGORY_LABEL: Record<keyof CategoryScores, string> = {
  sleep: "sleep",
  fitness: "fitness",
  discipline: "discipline",
  focus: "focus",
  spending: "spending",
};

const GRADE_RANK: Grade[] = ["F", "D", "C", "B", "A"];

function worstCategory(scores: CategoryScores | null): { key: keyof CategoryScores; grade: Grade } | null {
  if (!scores) return null;
  let worst: { key: keyof CategoryScores; grade: Grade } | null = null;
  for (const key of Object.keys(scores) as (keyof CategoryScores)[]) {
    const grade = scores[key]?.grade;
    if (!grade) continue;
    if (!worst || GRADE_RANK.indexOf(grade) < GRADE_RANK.indexOf(worst.grade)) {
      worst = { key, grade };
    }
  }
  return worst;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

export type PushNudgeInput = {
  /** Consecutive-day streak as of yesterday (calculateStreak() over roast history). */
  streak: number;
  /** 0 = already checked in today (caller should skip sending), 1 = missed today so far, 2+ = lapsed. */
  daysSinceLastActivity: number;
  latestScores: CategoryScores | null;
  hasRunningJoke: boolean;
};

export type PushNudge = { title: string; body: string };

/**
 * Hand-written copy bank — deliberately NOT another Groq call. A cron sweep
 * over every subscribed user is the wrong place for an LLM round-trip per
 * user (cost, latency, and one flaky generation shouldn't silently skip
 * someone's notification). Voice matches the app's existing roast and
 * achievement copy (see src/lib/achievements.ts) — never a generic "come
 * back!" reminder; always specific and a little mean.
 */
export function buildPushNudge(input: PushNudgeInput): PushNudge {
  const { streak, daysSinceLastActivity, latestScores, hasRunningJoke } = input;
  const worst = worstCategory(latestScores);
  const worstLabel = worst ? CATEGORY_LABEL[worst.key] : null;
  const seed = streak + daysSinceLastActivity;

  // Lapsed 3+ days: dark "missing person" energy. The streak is already
  // dead, so don't rub it in — go straight for the silence itself.
  if (daysSinceLastActivity >= 3) {
    const lines = [
      "We assumed you died. Please confirm you're just lazy.",
      "Your file is still open. Come close it yourself.",
      "It's been a minute. Your habits missed the attention.",
      hasRunningJoke
        ? "Your running joke is still waiting for a punchline. That's you."
        : "Silence isn't a personality trait. Check in.",
    ];
    return { title: "🔥 Ember", body: pick(lines, seed) };
  }

  // Missed today with a real streak on the line — loss aversion, specific numbers.
  if (daysSinceLastActivity === 1 && streak >= 3) {
    return {
      title: "🔥 Ember",
      body: `${streak}-day streak. About to become a ${streak}-day memory. Check in before midnight.`,
    };
  }
  if (daysSinceLastActivity === 1 && streak >= 1) {
    return {
      title: "🔥 Ember",
      body: `Day ${streak} was easy. Day ${streak + 1} is right there — don't go soft on me now.`,
    };
  }

  // No streak to protect — call out their weakest category instead.
  if (worstLabel) {
    const lines = [
      `Your ${worstLabel} grade called. It filed a complaint.`,
      `Still curious how your ${worstLabel} looks today, or scared to check?`,
      `One check-in. That's it. Your ${worstLabel} isn't going to grade itself.`,
    ];
    return { title: "🔥 Ember", body: pick(lines, seed) };
  }

  return { title: "🔥 Ember", body: "One roast a day keeps the delusion away. Your turn." };
}
