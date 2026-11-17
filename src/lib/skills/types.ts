// Shared types for the "learn a skill" rules. Types only: no logic, no database, no clock.
// (No "@/" imports on purpose: the files in this folder and their tests are loaded directly by Node.)

/** Which plan the user is on RIGHT NOW. A lapsed Pro user is simply "free" again. */
export type Tier = "free" | "pro";

/** Whether a month of a skill can be opened. */
export type MonthAccess = "open" | "locked";

/** A review stage: 0 = due after 1 day, 1 = 3 days, 2 = 7 days, 3 = 14 days. */
export type ReviewStage = 0 | 1 | 2 | 3;

/** One item waiting to be reviewed. Times are epoch milliseconds (pass Date.now() or a fixed number in tests). */
export type ReviewItem = {
  id: string;
  /** The month of the skill this item came from (1 to 6). */
  month: number;
  stage: ReviewStage;
  /** When the item is due for review. */
  dueAt: number;
};

/** What happens to an item after one review: it is retired, or it moves to a stage and a new due time. */
export type ReviewOutcome = { retired: true } | { retired: false; stage: ReviewStage; dueAt: number };

/** One answered question from the weekly test. */
export type WeeklyAnswer = {
  /** The day (1 to 5) the question belongs to. */
  day: number;
  /** The option the user picked (an index into the answer list). */
  chosenIndex: number;
  /** The index of the right option. */
  correctIndex: number;
};

export type WeeklyResult = {
  /** How many answers were right. */
  score: number;
  /** How many questions were answered in all. */
  total: number;
  /** True when the score reaches the pass mark. */
  passed: boolean;
  /** The days whose question was answered wrongly, in day order, no duplicates. */
  weakDays: number[];
};
