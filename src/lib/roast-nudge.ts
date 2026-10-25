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
  /**
   * True for 3 days AFTER a safety pause ends (24 h pause + 3 days = 96 h after the flag). Gives a warm, plain
   * line with no roast voice, no streak, no grades and no question about habits. (Users who are paused get no
   * nudge at all: the cron skips them before this.)
   */
  soft?: boolean;
};

export type PushNudge = { title: string; body: string };

/** For 3 days after a safety pause ends. Kind and plain: no roast, no streak, no pressure. */
export const SOFT_NUDGE_LINES = [
  "Ember is here whenever you want to check in. No rush.",
  "No pressure. Ember will be here when you're ready.",
  "Take your time. Ember is here when you want it.",
] as const;

/**
 * Hand-written copy bank — deliberately NOT another Groq call. A cron sweep
 * over every subscribed user is the wrong place for an LLM round-trip per
 * user (cost, latency, and one flaky generation shouldn't silently skip
 * someone's notification). Voice matches the app's existing roast and
 * achievement copy (see src/lib/achievements.ts) — never a generic "come
 * back!" reminder; always specific and a little mean.
 */
export function buildPushNudge(input: PushNudgeInput): PushNudge {
  const { streak, daysSinceLastActivity, latestScores, hasRunningJoke, soft } = input;
  const worst = worstCategory(latestScores);
  const worstLabel = worst ? CATEGORY_LABEL[worst.key] : null;
  const seed = streak + daysSinceLastActivity;

  // Inside the 3 days after a safety pause: nothing but a warm, plain line.
  if (soft) {
    return { title: "Ember", body: pick([...SOFT_NUDGE_LINES], seed) };
  }

  // Lapsed 3+ days: short and slightly warm. Never joke about the person being away, quiet, gone, missing, giving
  // up or dying: this app is used by people who may be having a hard time (src/lib/safety-pause.test.ts checks this).
  if (daysSinceLastActivity >= 3) {
    const lines = [
      "It's been a few days. Ember is here whenever you're ready.",
      "Your next check-in is ready whenever you are.",
      "It's been a minute. Your habits would love an update.",
      hasRunningJoke
        ? "Your running joke could use a new chapter."
        : "Whenever you want to pick things back up, Ember is here.",
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
