import Groq from "groq-sdk";

export function logGroqError(err: unknown): void {
  console.error("Groq error (full):", err);

  if (err instanceof Groq.APIError) {
    console.error("Groq APIError details:", {
      status: err.status,
      name: err.name,
      message: err.message,
      headers: Object.fromEntries(err.headers?.entries() ?? []),
      error: err.error,
    });
    return;
  }

  if (err instanceof Error) {
    console.error("Groq Error message:", err.message);
    console.error("Groq Error stack:", err.stack);
    return;
  }

  try {
    console.error(
      "Groq error (serialized):",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2),
    );
  } catch {
    console.error("Groq error (could not serialize)");
  }
}

export function getGroqApiKey(): string | undefined {
  const raw = process.env.GROQ_API_KEY;
  if (!raw) return undefined;
  return raw.trim().replace(/^["']|["']$/g, "");
}
