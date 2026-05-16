import type { Grade, OnboardingAnswers, ReportCard } from "@/lib/roast-types";

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

export function gradeOgColor(grade: Grade): string {
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
  }
}
