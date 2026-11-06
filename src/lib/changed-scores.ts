// Which category scores the check-in ROAST PROMPT may be shown as a "was to now" change.
//
// The grading call returns a grade for every category the answer touches, including one that stays where it
// was (spending A, 100 to 100). Showing that to the roast model as "graded this check-in" made it quote an
// unchanged number as if it had moved. This helper keeps only the categories whose number really differs.
//
// It decides ONLY what text the roast prompt shows. It is not used for saving anything: the saved category
// scores, the life score, achievements and history all come from the route's own updatedCategoryScores.
//
// No "@/" imports on purpose: src/lib/*.test.ts import this file with Node.

export type ScorePair = { was: number; now: number };

export type ScoreCandidate<K extends string> = {
  key: K;
  /** The score before this check-in. null / undefined when there was none. */
  was: number | null | undefined;
  /** The score after it. */
  now: number | null | undefined;
};

/**
 * Keeps a category only when both numbers exist and they differ. A missing "was" or "now" has no exact
 * was-to-now change to quote, so that category is dropped too.
 */
export function changedScoresForPrompt<K extends string>(candidates: ReadonlyArray<ScoreCandidate<K>>): Partial<Record<K, ScorePair>> {
  const out: Partial<Record<K, ScorePair>> = {};
  for (const { key, was, now } of candidates) {
    if (typeof was !== "number" || typeof now !== "number" || !Number.isFinite(was) || !Number.isFinite(now)) continue;
    if (was !== now) out[key] = { was, now };
  }
  return out;
}

/** The value after the colon on the "Categories graded this check-in" line: the JSON, or a plain "none" when nothing changed. */
export function formatChangedScores(changed: Partial<Record<string, ScorePair>>): string {
  return Object.keys(changed).length === 0 ? "none (no category score changed this check-in)" : JSON.stringify(changed);
}
