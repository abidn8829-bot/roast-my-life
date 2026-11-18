"use client";

import { focusRing } from "@/components/journal-auth-ui";
import { SkillTickArt } from "@/components/journal-skill-art";
import { optionLetter, optionState, outcomeLabel, usableOptions, type QuizOutcome } from "@/lib/skills/quiz-state";

/**
 * One multiple-choice question. PURE presentation (a client component only so its buttons can take onClick): it holds no state, calls no route and knows no answer. The page
 * that uses it (today's session, a review, the weekly test) decides what was picked, whether it was right, and when
 * to show the hint and the explanation, and hands those in as props.
 *
 * - 2 to 5 options (anything else draws nothing), each a button with a letter. onSelect gets the option's INDEX.
 * - After an answer the picked option is marked with a word as well as a colour: "Right" or "Not quite".
 * - A wrong answer leaves the other options open; a right answer closes them.
 * - The hint is a quiet text button; the explanation sits in a note under the options.
 */
export function SkillQuiz({
  question,
  options,
  selectedIndex = null,
  outcome = null,
  disabled = false,
  hint = null,
  hintOpen = false,
  explanation = null,
  onSelect,
  onToggleHint,
}: {
  question: string;
  options: readonly string[];
  selectedIndex?: number | null;
  outcome?: QuizOutcome;
  /** True while an answer is being sent, or when the question is closed. */
  disabled?: boolean;
  hint?: string | null;
  hintOpen?: boolean;
  explanation?: string | null;
  onSelect?: (index: number) => void;
  onToggleHint?: () => void;
}) {
  const shown = usableOptions(options);
  if (shown.length === 0) return null;
  const closed = disabled || outcome === "right";
  const label = outcomeLabel(outcome);

  return (
    <div>
      <h3 className="break-words font-display text-[22px] font-medium leading-snug text-text">{question}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {shown.map((text, index) => {
          const state = optionState(index, selectedIndex, outcome);
          const tone =
            state === "right"
              ? "border-text bg-sage"
              : state === "wrong"
                ? "border-text border-dashed bg-clay"
                : state === "dim"
                  ? "border-border bg-surface opacity-60"
                  : "border-border-strong-legacy bg-surface hover:bg-surface-2";
          return (
            <li key={index}>
              <button
                type="button"
                disabled={closed}
                aria-pressed={selectedIndex === index}
                onClick={() => onSelect?.(index)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] text-text transition disabled:cursor-default ${tone} ${focusRing}`}
              >
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-text text-[13px] font-medium">
                  {optionLetter(index)}
                </span>
                <span className="min-w-0 flex-1 break-words">{text}</span>
                {state === "right" || state === "wrong" ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-text">
                    {state === "right" ? <SkillTickArt className="h-5 w-5" /> : null}
                    {label}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="sr-only" role="status" aria-live="polite">
        {label}
      </p>

      {hint ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onToggleHint?.()}
            aria-expanded={hintOpen}
            className={`inline-flex min-h-11 items-center text-sm text-text-muted underline underline-offset-4 hover:text-text ${focusRing}`}
          >
            {hintOpen ? "Hide the hint" : "Show a hint"}
          </button>
          {hintOpen ? <p className="mt-1 break-words text-[15px] text-text">{hint}</p> : null}
        </div>
      ) : null}

      {explanation ? (
        <div className="mt-4 rounded-xl border border-border-strong-legacy bg-surface px-4 py-3 text-[15px] text-text">
          <p className="mb-1 text-[13px] font-medium text-text-muted">Why</p>
          <p className="break-words">{explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
