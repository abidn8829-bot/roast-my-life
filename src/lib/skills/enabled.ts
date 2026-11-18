// The on/off switch for "learn a skill". Server only: it reads a plain environment variable (never a NEXT_PUBLIC_
// one), so the value is never put into browser code.
// (No "@/" imports on purpose: src/lib/skills/*.test.ts load this file directly with Node.)
//
// The feature is ON only when SKILLS_ENABLED is exactly the text "1". Anything else (not set, empty, "0", "true",
// " 1", "01") is OFF, and every skills route then answers as if it does not exist.

export function skillsEnabled(): boolean {
  return process.env.SKILLS_ENABLED === "1";
}
