import { focusRing } from "@/components/journal-auth-ui";

/**
 * Pieces for the journal look of the onboarding QUESTION screens (see onboarding-wizard.tsx).
 * Presentation only: no logic, no analytics.
 */

// Handwritten line under the input. Only these two questions have one; add a key here to give another question a note.
export const QUESTION_NOTES: Record<string, string> = {
  phoneHours: "be honest. we already know.",
  sleepHours: "no wrong answers. some wrong answers.",
};

export const questionTitle =
  "font-display text-[38px] font-medium leading-[1.08] tracking-[-0.005em]";

const fieldBase =
  "jl-input w-full rounded-xl border border-border-strong-legacy bg-surface px-4 text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";

// Number fields: 56 px high, 20 px text, no spinner arrows (the field type and Enter behaviour are unchanged).
export const numberInput = `${fieldBase} h-14 text-xl [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

// Text answers (the wizard adds ph-no-capture next to this).
export const textareaInput = `${fieldBase} min-h-[4.5rem] resize-y py-3 text-lg leading-snug`;

// "← Back" as a quiet text link.
export const backLink = `inline-flex min-h-11 items-center justify-center px-3 text-sm text-text-muted underline underline-offset-4 ${focusRing}`;

/** "n of N" at the top right, then N thin segments: the current and finished ones sage, the rest pale. */
export function QuestionProgress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <div className="flex justify-end text-[13px] text-text-muted">{`${current + 1} of ${total}`}</div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-sm ${i <= current ? "bg-sage" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
