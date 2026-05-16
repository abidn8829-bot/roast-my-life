import type { Grade, ReportCard } from "@/lib/roast-types";

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

export function parseReportCard(raw: unknown): ReportCard | null {
  const o = asObject(raw);
  if (!o) return null;

  const screenTime = o.screenTime ?? o.screen_time;
  const sleep = o.sleep;
  const spending = o.spending;
  const productivity = o.productivity;

  if (
    !isGrade(screenTime) ||
    !isGrade(sleep) ||
    !isGrade(spending) ||
    !isGrade(productivity)
  ) {
    return null;
  }

  return {
    screenTime,
    sleep,
    spending,
    productivity,
  };
}
