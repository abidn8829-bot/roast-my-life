// The small rules behind the shared quiz component (src/components/skill-quiz.tsx). Pure: no React, no database.
// (No "@/" imports on purpose: the tests in this folder load this file directly with Node.)

export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 5;

/** What the parent knows after an answer was sent: nothing yet, right, or not right. */
export type QuizOutcome = "right" | "wrong" | null;

/** How one option is drawn. "dim" = another option after the answer was right (the question is closed). */
export type OptionState = "idle" | "right" | "wrong" | "dim";

/** The options a quiz may show: 2 to 5 pieces of text. Anything else shows nothing (an empty list). */
export function usableOptions(options: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(options)) return [];
  if (options.length < QUIZ_MIN_OPTIONS || options.length > QUIZ_MAX_OPTIONS) return [];
  return options.every((o) => typeof o === "string" && o.trim() !== "") ? (options as string[]) : [];
}

/** A, B, C, D, E for an option index (a letter is drawn next to the option; the saved answer is the index). */
export function optionLetter(index: number): string {
  return Number.isInteger(index) && index >= 0 && index < QUIZ_MAX_OPTIONS ? "ABCDE"[index]! : "";
}

/** Only the option the user picked gets "right" or "wrong". After a right answer the others are "dim". */
export function optionState(index: number, selectedIndex: number | null, outcome: QuizOutcome): OptionState {
  if (outcome === null || selectedIndex === null) return "idle";
  if (index === selectedIndex) return outcome;
  return outcome === "right" ? "dim" : "idle";
}

/** The word shown with a picked option. Words, not colour alone. Never "wrong" or "failed". */
export function outcomeLabel(outcome: QuizOutcome): string {
  if (outcome === "right") return "Right";
  if (outcome === "wrong") return "Not quite";
  return "";
}
