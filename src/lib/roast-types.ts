export type Grade = "A" | "B" | "C" | "D" | "F";

export type ReportCard = {
  screenTime: Grade;
  sleep: Grade;
  spending: Grade;
  productivity: Grade;
  socialMedia?: Grade;
  fitness?: Grade;
};

export type CategoryScore = {
  score: number;
  grade: Grade;
  reaction_line?: string;
};

export type CategoryScores = {
  sleep: CategoryScore;
  fitness: CategoryScore;
  discipline: CategoryScore;
  focus: CategoryScore;
  spending: CategoryScore;
};

export type OnboardingAnswers = {
  phoneHours: number;
  worstApp: string;
  sleepHours: number;
  foodDeliverySpend: number;
  neverDoThing: string;
  socialMediaHours?: number;
  workoutFrequency?: number;
};

// Legacy: roasts.tone is no longer chosen by users or written by the server (the column default applies).
// The type stays so old rows ("no_mercy" exists in production) still type-check when read.
export type RoastTone = "normal" | "no_mercy" | "destroy_me";

export type RoastMode = "roast" | "coach";

// The stored ids. Public labels live in the UI; never rename an id (old roasts rows keep them).
export const ROAST_PERSONA_IDS = ["default", "gordon_ramsay", "drill_sergeant", "toxic_friend", "corporate_manager", "savage_grandma"] as const;

export type RoastPersona = (typeof ROAST_PERSONA_IDS)[number];

export function isRoastPersona(value: unknown): value is RoastPersona {
  return typeof value === "string" && (ROAST_PERSONA_IDS as readonly string[]).includes(value);
}

export type RoastRow = {
  id: string;
  user_id: string;
  roast_text: string;
  report_card: ReportCard;
  week_start_date: string;
  model_used: string;
  share_slug: string;
  tone?: RoastTone;
  mode?: RoastMode;
  persona?: RoastPersona;
  created_at?: string;
  life_score?: number;
  funny_title?: string;
  top_5_roasts?: string[];
  category_scores?: CategoryScores;
};
