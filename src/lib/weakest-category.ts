// The category the desktop result page circles in clay: the one with the LOWEST score, and the first one in the
// order the page lists them when two tie. Pure. No "@/" imports (src/lib/roast-desktop-layout.test.ts imports it).
export function weakestCategory(scores: Record<string, { score: number }> | null | undefined): string | null {
  if (!scores) return null;
  let weakest: string | null = null;
  let lowest = Infinity;
  for (const [key, data] of Object.entries(scores)) {
    if (data.score < lowest) {
      lowest = data.score;
      weakest = key;
    }
  }
  return weakest;
}
