import type { CategoryScore, CategoryScores, Grade, OnboardingAnswers, ReportCard } from "@/lib/roast-types";

function gradeScreenTime(hours: number): Grade {
  if (hours <= 2) return "A";
  if (hours <= 4) return "B";
  if (hours <= 6) return "C";
  if (hours <= 8) return "D";
  return "F";
}

function gradeSleep(hours: number): Grade {
  if (hours >= 7 && hours <= 9) return "A";
  if (hours === 6 || hours === 10) return "B";
  if (hours === 5 || hours === 11) return "C";
  if (hours === 4 || hours === 12) return "D";
  return "F";
}

function gradeSpending(dollars: number): Grade {
  if (dollars <= 30) return "A";
  if (dollars <= 60) return "B";
  if (dollars <= 100) return "C";
  if (dollars <= 150) return "D";
  return "F";
}

function gradeProductivity(answers: OnboardingAnswers): Grade {
  let score = 0;
  if (answers.phoneHours >= 8) score += 2;
  else if (answers.phoneHours >= 6) score += 1;
  if (answers.sleepHours < 6) score += 2;
  else if (answers.sleepHours < 7) score += 1;
  if (answers.foodDeliverySpend > 100) score += 1;
  const excuse = answers.neverDoThing.trim();
  if (excuse.length > 80) score += 1;

  if (score <= 0) return "A";
  if (score === 1) return "B";
  if (score === 2) return "C";
  if (score === 3) return "D";
  return "F";
}

export function buildReportCard(answers: OnboardingAnswers): ReportCard {
  return {
    screenTime: gradeScreenTime(answers.phoneHours),
    sleep: gradeSleep(answers.sleepHours),
    spending: gradeSpending(answers.foodDeliverySpend),
    productivity: gradeProductivity(answers),
  };
}

export function gradeColor(grade: Grade): string {
  switch (grade) {
    case "A":
    case "B":
      return "border-emerald-600/70 bg-emerald-950/60 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
    case "C":
      return "border-amber-600/70 bg-amber-950/60 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.12)]";
    case "D":
      return "border-orange-600/70 bg-orange-950/60 text-orange-300 shadow-[0_0_20px_rgba(249,115,22,0.12)]";
    case "F":
      return "border-red-600/70 bg-red-950/60 text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.2)]";
  }
}

export function gradeOgColor(grade: Grade | undefined): string {
  switch (grade) {
    case "A":
    case "B":
      return "#34d399";
    case "C":
      return "#fbbf24";
    case "D":
      return "#fb923c";
    case "F":
      return "#f87171";
    default:
      return "#f87171";
  }
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function calculateLifeScore(answers: OnboardingAnswers): number;
export function calculateLifeScore(categoryScores: CategoryScores): number;
export function calculateLifeScore(input: OnboardingAnswers | CategoryScores): number {
  if ("sleep" in input && "fitness" in input && "discipline" in input) {
    const scores = Object.values(input).map((category) => category.score);
    return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
  }

  const answers = input;
  let score = 100;

  // Screen time penalty
  if (answers.phoneHours > 10) score -= 25;
  else if (answers.phoneHours > 8) score -= 20;
  else if (answers.phoneHours > 6) score -= 15;
  else if (answers.phoneHours > 4) score -= 10;
  else if (answers.phoneHours > 2) score -= 5;

  // Sleep penalty
  if (answers.sleepHours < 4) score -= 25;
  else if (answers.sleepHours < 5) score -= 20;
  else if (answers.sleepHours < 6) score -= 15;
  else if (answers.sleepHours < 7) score -= 10;
  else if (answers.sleepHours > 10) score -= 10;

  // Spending penalty
  if (answers.foodDeliverySpend > 300) score -= 20;
  else if (answers.foodDeliverySpend > 200) score -= 15;
  else if (answers.foodDeliverySpend > 100) score -= 10;
  else if (answers.foodDeliverySpend > 50) score -= 5;

  // Social media penalty
  if (answers.socialMediaHours && answers.socialMediaHours > 6) score -= 15;
  else if (answers.socialMediaHours && answers.socialMediaHours > 4) score -= 10;
  else if (answers.socialMediaHours && answers.socialMediaHours > 2) score -= 5;

  // Workout bonus
  if (answers.workoutFrequency === undefined) score -= 10;
  else if (answers.workoutFrequency === 0) score -= 15;
  else if (answers.workoutFrequency < 3) score -= 5;
  else if (answers.workoutFrequency >= 5) score += 5;

  return Math.max(0, Math.min(100, score));
}

export function getFunnyTitle(lifeScore: number): string {
  if (lifeScore <= 20) return "CEO of Wasted Potential";
  if (lifeScore <= 35) return "Professional Excuse Manufacturer";
  if (lifeScore <= 50) return "Olympic Level Procrastinator";
  if (lifeScore <= 65) return "Chairman of Bad Decisions";
  if (lifeScore <= 80) return "Certified Sleep Avoider";
  return "Surprisingly Functional Disaster";
}

export function calculateCategoryScores(answers: OnboardingAnswers): CategoryScores {
  // Sleep score (0-100)
  const sleepScore = Math.min(100, Math.max(0, 
    (answers.sleepHours >= 7 && answers.sleepHours <= 9) ? 100 :
    (answers.sleepHours >= 6 && answers.sleepHours <= 10) ? 75 :
    (answers.sleepHours >= 5 && answers.sleepHours <= 11) ? 50 :
    (answers.sleepHours >= 4 && answers.sleepHours <= 12) ? 25 : 0
  ));

  // Fitness score (0-100)
  const fitnessScore = Math.min(100, Math.max(0,
    answers.workoutFrequency === undefined ? 40 :
    answers.workoutFrequency >= 5 ? 100 :
    answers.workoutFrequency >= 3 ? 75 :
    answers.workoutFrequency >= 1 ? 50 : 0
  ));

  // Discipline score (0-100) - based on consistency and excuses
  const disciplineScore = Math.min(100, Math.max(0,
    (answers.neverDoThing.length < 30) ? 100 :
    (answers.neverDoThing.length < 60) ? 75 :
    (answers.neverDoThing.length < 100) ? 50 : 25
  ));

  // Focus score (0-100) - based on screen time and social media
  const focusScore = Math.min(100, Math.max(0,
    (answers.phoneHours <= 2 && (!answers.socialMediaHours || answers.socialMediaHours <= 1)) ? 100 :
    (answers.phoneHours <= 4 && (!answers.socialMediaHours || answers.socialMediaHours <= 2)) ? 75 :
    (answers.phoneHours <= 6 && (!answers.socialMediaHours || answers.socialMediaHours <= 3)) ? 50 :
    (answers.phoneHours <= 8) ? 25 : 0
  ));

  // Spending score (0-100)
  const spendingScore = Math.min(100, Math.max(0,
    answers.foodDeliverySpend <= 30 ? 100 :
    answers.foodDeliverySpend <= 60 ? 75 :
    answers.foodDeliverySpend <= 100 ? 50 :
    answers.foodDeliverySpend <= 150 ? 25 : 0
  ));

  return {
    sleep: { score: sleepScore, grade: scoreToGrade(sleepScore) },
    fitness: { score: fitnessScore, grade: scoreToGrade(fitnessScore) },
    discipline: { score: disciplineScore, grade: scoreToGrade(disciplineScore) },
    focus: { score: focusScore, grade: scoreToGrade(focusScore) },
    spending: { score: spendingScore, grade: scoreToGrade(spendingScore) },
  };
}
