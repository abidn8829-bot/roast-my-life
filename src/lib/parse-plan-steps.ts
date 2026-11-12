// Reads roasts.plan_steps (jsonb) on the server for the roast result page.
// Shape (what the check-in route and the first-roast route save, and what roast-view.tsx draws):
//   { challenge: string, steps: [{ step: string, why: string }] }
// A plan is valid when the challenge is a non-empty string and there are 2 or 3 steps with a non-empty step and why.
// Anything else gives null, and the page then falls back to its browser fetch (so nothing changes for those roasts).
//
// No "@/" imports on purpose (src/lib/roast-plan-loading.test.ts imports this file directly with Node).
// PRIVATE: only the owner's result page reads the plan. The public share page and the share image never do.

export type PlanStep = { step: string; why: string };
export type ChallengePlan = { challenge: string; steps: PlanStep[] };

const filled = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function parsePlanSteps(raw: unknown): ChallengePlan | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!filled(o.challenge)) return null;
  if (!Array.isArray(o.steps) || o.steps.length < 2 || o.steps.length > 3) return null;
  const steps: PlanStep[] = [];
  for (const s of o.steps) {
    if (typeof s !== "object" || s === null || Array.isArray(s)) return null;
    const { step, why } = s as Record<string, unknown>;
    if (!filled(step) || !filled(why)) return null;
    steps.push({ step, why });
  }
  return { challenge: o.challenge, steps };
}
