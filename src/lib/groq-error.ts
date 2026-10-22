import Groq from "groq-sdk";

/**
 * Logs a Groq / parsing failure WITHOUT any text that could come from a user.
 *
 * It used to print the whole error object. Groq's error body can include the model's
 * failed output ("failed_generation"), and a JSON.parse SyntaxError quotes the start of the
 * text it choked on. Both can contain what a user typed, so only the error class, the HTTP
 * status and Groq's short error code are logged now.
 */
export function logGroqError(err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err;
  if (err instanceof Groq.APIError) {
    const code = (err.error as { code?: unknown } | undefined)?.code;
    console.error("Groq APIError:", { name, status: err.status, code: typeof code === "string" ? code.slice(0, 40) : undefined });
    return;
  }
  console.error("Groq call failed:", { name });
}

export function getGroqApiKey(): string | undefined {
  const raw = process.env.GROQ_API_KEY;
  if (!raw) return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}
