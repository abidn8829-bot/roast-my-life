import { focusRing } from "@/components/journal-auth-ui";

/**
 * Pieces for the journal look of the roast RESULT page body (see roast-view.tsx and app/roast/[id]/page.tsx).
 * Presentation only: no logic, no analytics. Nothing here works out a grade: the letter and the score are the
 * values the page has always been given, this file only draws them.
 */

// "← Back to dashboard" as a quiet text link (the page still has exactly one <Link>, with its pinned shape).
export const roastBackLink = `inline-flex min-h-11 items-center gap-2 text-sm text-text-muted underline underline-offset-4 hover:text-text ${focusRing}`;

// Small muted label above a block of the page. It is rendered as a real <h2>.
export const sectionLabel = "text-[13px] font-medium text-text-muted";

/** The bar length in whole percent: the score is 0 to 100, anything else is clamped (and a missing number is 0). */
export function barPercent(score: number): number {
  return Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 0;
}

/**
 * One category: its label on the left, the grade letter in ink (this is what carries the meaning), a bar, and the
 * score out of 10. The bar is a powder track with a 1 px ink outline and a deeper-sage fill whose length is the
 * score. No tint, no hover effect, no animation. Render inside a <ul>.
 */
export function GradeRow({ label, grade, score }: { label: string; grade: string; score: number }) {
  return (
    <li className="flex items-center gap-4 py-4">
      <span className="w-24 shrink-0 text-[15px] capitalize text-text-muted">{label}</span>
      <span className="w-7 shrink-0 font-display text-[28px] font-medium leading-none text-text">{grade}</span>
      <span aria-hidden="true" className="relative block h-3 min-w-0 flex-1 overflow-hidden rounded-[3px] border border-text bg-powder">
        <span className="absolute inset-y-0 left-0 block bg-progress" style={{ width: `${barPercent(score)}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-text-muted">{Math.round(score / 10)}/10</span>
    </li>
  );
}

/** The dashed square in front of a plan step: the same dashed-ink square as "today" in the landing page graph. */
export function StepMarker() {
  return <span aria-hidden="true" className="mt-[5px] block h-4 w-4 shrink-0 rounded-[3px] border border-dashed border-text" />;
}
