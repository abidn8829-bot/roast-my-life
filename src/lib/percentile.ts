export const MIN_SAMPLE_SIZE = 2;

// Percentile of userScore within peerScores (every user's latest score for that
// category, including the requesting user). Ties split the difference so a
// mid-pack score doesn't read as strictly above or below itself.
export function computePercentile(userScore: number, peerScores: number[]): number {
  const below = peerScores.filter((s) => s < userScore).length;
  const equal = peerScores.filter((s) => s === userScore).length;
  return Math.round((100 * (below + 0.5 * equal)) / peerScores.length);
}
