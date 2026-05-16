/** Pull a short punchy line for OG / share cards (prefers final one-liner). */
export function extractRoastQuote(roastText: string, maxLen = 140): string {
  const trimmed = roastText.trim();
  if (!trimmed) return "Your life choices spoke for themselves.";

  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const candidate = lines[lines.length - 1] ?? trimmed;
  const quote = candidate.replace(/^["']|["']$/g, "").trim();

  if (quote.length <= maxLen) return quote;
  return `${quote.slice(0, maxLen - 1).trim()}…`;
}
