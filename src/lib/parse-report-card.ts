import type { Grade, ReportCard } from "@/lib/roast-types";

const GRADES = new Set<Grade>(["A", "B", "C", "D", "F"]);

function isGrade(v: unknown): v is Grade {
  return typeof v === "string" && GRADES.has(v as Grade);
}

export function parseReportCard(raw: unknown): ReportCard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (
    !isGrade(o.screenTime) ||
    !isGrade(o.sleep) ||
    !isGrade(o.spending) ||
    !isGrade(o.productivity)
  ) {
    return null;
  }
  return {
    screenTime: o.screenTime,
    sleep: o.sleep,
    spending: o.spending,
    productivity: o.productivity,
  };
}
