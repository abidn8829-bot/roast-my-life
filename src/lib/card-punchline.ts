import Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroqApiKey } from "@/lib/groq-error";
import type { CategoryScores, OnboardingAnswers, RoastMode } from "@/lib/roast-types";

export const PUNCHLINE_MODEL = "openai/gpt-oss-120b";

const MAX_WORDS = 14;
const MAX_CHARS = 110;

const SYSTEM_PROMPT = `You write the ONE line printed on a shareable roast card. Voice: Gen Z, deadpan call-out — the kind of line people screenshot and post.

Rules:
- One line, max 12 words.
- Call them out with ONE specific detail from their data: a number, the app they named, or the thing they keep promising themselves. Never generic ("you need to do better").
- Aim at their worst category.
- Match the intensity to their life score: under 40 = savage; 40-70 = playful jab; over 70 = backhanded compliment ("suspiciously fine") that still calls out their single worst category.
- Say something new — do not restate a line from the long roast.
- No hashtags, no emojis, no quotation marks, no slurs, no mention of "roast" or "AI".

Return strict JSON only: {"punchline":"..."}`;

const COACH_ADDENDUM = `\nThis is a coaching report: keep the Gen Z voice and the specific call-out, but make it a playful push to do better rather than an insult.`;

type Input = {
  answers: OnboardingAnswers;
  categoryScores: CategoryScores;
  lifeScore: number;
  roastText: string;
  mode?: RoastMode;
  /** Set for daily check-ins so the line reflects what just happened. */
  checkIn?: { category: string; answer: string; direction: string };
};

/** Model output -> a safe single line, or null if it isn't usable. */
export function cleanPunchline(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const line = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (line.length < 8 || line.length > MAX_CHARS) return null;
  if (line.split(" ").length > MAX_WORDS) return null;
  return line;
}

/**
 * Generates the card's punchline. Never throws — returns null on any failure so
 * the caller can still save the roast (the card then falls back gracefully).
 */
export async function generateCardPunchline(
  groq: Groq,
  model: string,
  { answers, categoryScores, lifeScore, roastText, mode, checkIn }: Input,
): Promise<string | null> {
  const worst = Object.entries(categoryScores)
    .sort(([, a], [, b]) => a.score - b.score)
    .slice(0, 2)
    .map(([key, v]) => `${key} (${v.grade}, ${v.score}/100)`);

  const facts = [
    `Phone screen time: ${answers.phoneHours}h/day`,
    `App winning their day: ${answers.worstApp}`,
    `Sleep: ${answers.sleepHours}h/night`,
    `Food delivery: $${answers.foodDeliverySpend}/week`,
    `Broken promise to themselves: "${answers.neverDoThing}"`,
    answers.socialMediaHours ? `Social media: ${answers.socialMediaHours}h/day` : null,
    answers.workoutFrequency !== undefined ? `Workouts this week: ${answers.workoutFrequency}` : null,
    `Life score: ${lifeScore}/100`,
    `Worst categories: ${worst.join(", ")}`,
    checkIn
      ? `Today's check-in (${checkIn.category}, ${checkIn.direction}): "${checkIn.answer}"`
      : null,
  ].filter(Boolean);

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT + (mode === "coach" ? COACH_ADDENDUM : "") },
    {
      role: "user" as const,
      content: [
        facts.join("\n"),
        "",
        `The long roast already says (don't repeat it): "${roastText.slice(0, 600)}"`,
      ].join("\n"),
    },
  ];

  // Two attempts: the model occasionally overshoots the word limit or returns junk.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        max_tokens: 300, // reasoning tokens count against this, so leave headroom
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "") as { punchline?: unknown };
      const line = cleanPunchline(parsed.punchline);
      if (line) return line;
    } catch (error) {
      console.error(`[card-punchline] attempt ${attempt} failed:`, error);
    }
  }
  return null;
}

/**
 * Gives an existing roast a punchline if it doesn't have one yet (generation failed
 * at creation, or the roast predates the card_punchline column). Safe to call on
 * every view: it's a no-op once one is stored, and silently does nothing if the
 * column doesn't exist yet or anything else goes wrong.
 */
export async function backfillCardPunchline(
  supabase: SupabaseClient,
  roast: {
    id: string;
    roast_text: string;
    life_score?: number;
    answers?: OnboardingAnswers;
    category_scores?: CategoryScores;
    mode?: RoastMode;
  },
): Promise<void> {
  const { answers, category_scores, life_score } = roast;
  if (!answers || !category_scores || life_score === undefined) return;

  const { data, error } = await supabase
    .from("roasts")
    .select("card_punchline")
    .eq("id", roast.id)
    .maybeSingle();
  if (error || !data || data.card_punchline) return; // column missing, no row, or already set

  const apiKey = getGroqApiKey();
  if (!apiKey) return;

  const punchline = await generateCardPunchline(new Groq({ apiKey }), PUNCHLINE_MODEL, {
    answers,
    categoryScores: category_scores,
    lifeScore: life_score,
    roastText: roast.roast_text,
    mode: roast.mode,
  });
  if (!punchline) return;

  const { error: updateError } = await supabase
    .from("roasts")
    .update({ card_punchline: punchline })
    .eq("id", roast.id);
  if (updateError) console.error("[card-punchline] backfill save failed:", updateError.message);
}

/**
 * Inserts a roast row. If the card_punchline column doesn't exist yet (code
 * deployed before migration 019 ran), retries without it instead of failing the
 * user's whole roast.
 */
export async function insertRoastRow(
  supabase: SupabaseClient,
  row: Record<string, unknown> & { card_punchline?: string | null },
) {
  const first = await supabase.from("roasts").insert(row).select("id").single();
  const missingColumn =
    first.error &&
    (first.error.code === "42703" || first.error.code === "PGRST204" || /card_punchline/.test(first.error.message));
  if (!missingColumn) return first;

  console.warn("[insertRoastRow] card_punchline column missing — run migration 019. Retrying without it.");
  const withoutPunchline = { ...row };
  delete withoutPunchline.card_punchline;
  return supabase.from("roasts").insert(withoutPunchline).select("id").single();
}
