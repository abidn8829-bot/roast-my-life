// Prompt builders and response parsers for the two roast-route AI calls that carry the safety
// level (the first-time / follow-up-answer roast, and the returning-user follow-up question).
//
// PURE MOVE out of src/app/api/roast/route.ts so that scripts/safety-eval.mjs can run the REAL
// prompts and the REAL parsing instead of copies. The text and logic below are unchanged; the
// route imports them. No "@/" imports on purpose (the script imports this file with Node).

import type { OnboardingAnswers } from "./roast-types.ts";
import { parseLevel, type SafetyLevel } from "./safety.ts";
import { FOLLOWUP_FORMAT_OVERRIDE, ROAST_FORMAT_OVERRIDE, withSafety } from "./safety-server.ts";

export const FOLLOW_UP_SYSTEM_PROMPT = `You are a savage roast comedian who remembers everything. Based on the user's previous roast and their current habits, ask ONE intelligent follow-up question to dig deeper into their failures. The question should be specific, brutal, and expose a pattern of bad behavior. Keep it under 20 words. No markdown, no extra text, just the question.`;

// The roast prompt for the default persona (what free users always get). The other personas
// and coach mode stay in the route.
export const DEFAULT_PERSONA_PROMPT = `You are a savage roast comedian with zero filter who remembers everything. Use their exact numbers to destroy them. Connect every bad habit to real consequences. Heavy Gen Z slang. No softening, no "I'm not judging", no encouragement. Just brutal facts. End with a devastating one liner. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here"
}

No markdown, no extra text, just the JSON.

CONTINUITY INSTRUCTIONS:
- Reference previous sessions naturally using the continuity memory
- Continue the running joke if appropriate
- Never repeat the exact same joke from previous roasts
- Never assume improvement - be skeptical of their answers
- Focus on patterns and persistent failures
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`;

export function formatUserMessage(answers: OnboardingAnswers, continuityMemory: unknown, followUpAnswer?: string, previousRoastText?: string): string {
  let message = `Roast this person based on their habits:

- Phone screen time: ${answers.phoneHours} hours per day
- Biggest time-waster app: ${answers.worstApp}
- Average sleep: ${answers.sleepHours} hours per night
- Weekly food delivery spending: $${answers.foodDeliverySpend}
- Keeps saying they'll do but never does: "${answers.neverDoThing}"`;

  if (answers.socialMediaHours !== undefined) {
    message += `\n- Social media hours per day: ${answers.socialMediaHours}`;
  }
  if (answers.workoutFrequency !== undefined) {
    message += `\n- Workouts this week: ${answers.workoutFrequency}`;
  }

  if (continuityMemory) {
    message += `\n\nPrevious context (what I remember about them): ${JSON.stringify(continuityMemory)}`;
  }

  if (previousRoastText) {
    message += `\n\nPrevious roast: "${previousRoastText}"`;
  }

  if (followUpAnswer) {
    message += `\n\nTheir answer to my follow-up question: "${followUpAnswer}"`;
  }

  return message;
}

export function buildFollowUpUserMessage(answers: OnboardingAnswers, previousRoastText: string | undefined, continuityMemory: unknown): string {
  return `Previous roast: "${previousRoastText}"
Current habits:
- Phone screen time: ${answers.phoneHours} hours per day
- Biggest time-waster app: ${answers.worstApp}
- Average sleep: ${answers.sleepHours} hours per night
- Weekly food delivery spending: $${answers.foodDeliverySpend}
- Keeps saying they'll do but never does: "${answers.neverDoThing}"
${answers.socialMediaHours ? `- Social media hours per day: ${answers.socialMediaHours}` : ''}
${answers.workoutFrequency ? `- Workouts this week: ${answers.workoutFrequency}` : ''}

Continuity memory: ${JSON.stringify(continuityMemory)}`;
}

// Request settings shared by the route and the eval script.
export const ROAST_CALL_PARAMS = { max_tokens: 1200, reasoning_effort: "low", response_format: { type: "json_object" } } as const;
export const FOLLOWUP_CALL_PARAMS = { max_tokens: 400, reasoning_effort: "low", response_format: { type: "json_object" } } as const;

export function buildRoastMessages(systemPrompt: string, userMessage: string) {
  return [
    { role: "system" as const, content: withSafety(systemPrompt, ROAST_FORMAT_OVERRIDE) },
    { role: "user" as const, content: userMessage },
  ];
}

export function buildFollowUpMessages(userMessage: string) {
  return [
    { role: "system" as const, content: withSafety(FOLLOW_UP_SYSTEM_PROMPT, FOLLOWUP_FORMAT_OVERRIDE) },
    { role: "user" as const, content: userMessage },
  ];
}

/** Roast reply -> safety level + roast text. Unusable JSON gives a null level (check failed). */
export function parseRoastResponse(content: string): { aiLevel: SafetyLevel | null; roastText: string } {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return { aiLevel: parseLevel(parsed.safety_level), roastText: typeof parsed.roast_text === "string" ? parsed.roast_text : "" };
  } catch {
    return { aiLevel: null, roastText: "" };
  }
}

/** Follow-up reply -> safety level + question. Throws on unusable JSON, as the route's try/catch expects. */
export function parseFollowUpResponse(content: string): { aiLevel: SafetyLevel | null; question: string } {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  return { aiLevel: parseLevel(parsed.safety_level), question: typeof parsed.question === "string" ? parsed.question.trim() : "" };
}
