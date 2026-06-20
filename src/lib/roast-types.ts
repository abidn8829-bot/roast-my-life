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

export type RoastTone = "normal" | "no_mercy" | "destroy_me";

export type RoastMode = "roast" | "coach";

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
  created_at?: string;
  life_score?: number;
  funny_title?: string;
  top_5_roasts?: string[];
  category_scores?: CategoryScores;
};
