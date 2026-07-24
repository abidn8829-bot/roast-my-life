import type { CategoryScore, CategoryScores, Grade } from "@/lib/roast-types";

const GRADES = new Set<Grade>(["A", "B", "C", "D", "F"]);

function isGrade(v: unknown): v is Grade {
  return typeof v === "string" && GRADES.has(v as Grade);
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function parseCategoryScore(raw: unknown): CategoryScore | null {
  const o = asObject(raw);
  if (!o) return null;
  const score = Number(o.score);
  const grade = o.grade;
  if (!Number.isFinite(score) || !isGrade(grade)) return null;
  const reaction_line = typeof o.reaction_line === "string" ? o.reaction_line : undefined;
  return { score, grade, reaction_line };
}

export function parseCategoryScores(raw: unknown): CategoryScores | null {
  const o = asObject(raw);
  if (!o) return null;

  const sleep = parseCategoryScore(o.sleep);
  const fitness = parseCategoryScore(o.fitness);
  const discipline = parseCategoryScore(o.discipline);
  const focus = parseCategoryScore(o.focus);
  const spending = parseCategoryScore(o.spending);

  if (!sleep || !fitness || !discipline || !focus || !spending) return null;

  return { sleep, fitness, discipline, focus, spending };
}
