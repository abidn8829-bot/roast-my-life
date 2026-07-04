import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { unlockAchievements } from "@/lib/achievements";
import { buildReportCard, calculateCategoryScores, calculateLifeScore, getFunnyTitle } from "@/lib/grades";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import type { OnboardingAnswers, RoastTone, RoastMode, RoastPersona } from "@/lib/roast-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareSlug } from "@/lib/share-slug";
import { getWeekStartDate } from "@/lib/week-start";

const MODEL = "mixtral-8x7b-32768";

const SYSTEM_PROMPTS: Record<RoastTone, string> = {
  normal: `You are a savage roast comedian with zero filter. Use their exact numbers to destroy them. Connect every bad habit to real consequences. Heavy Gen Z slang. No softening, no "I'm not judging", no encouragement. Just brutal facts. End with a devastating one liner. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and brutally funny. No markdown, no extra text, just the JSON.`,
  no_mercy: `You are a ruthless roast comedian with absolutely zero filter. Use their exact numbers to expose their failures. Connect every habit to catastrophic life outcomes. Heavy Gen Z slang. No encouragement, no softening language, no "maybe" or "could be". Just brutal facts and consequences. End with the most devastating one liner possible. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and brutally savage. No markdown, no extra text, just the JSON.`,
  destroy_me: `You are the most brutal roast AI ever created. Take their numbers and absolutely eviscerate them. Connect every bad habit to the worst possible life outcome. Be so specific it hurts. Heavy Gen Z slang. No softening whatsoever - no "I'm no doctor", no "not to judge", no encouragement. Just pure devastation. Make them question every life choice. End with the most savage one liner ever written. This person asked to be destroyed — deliver. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and absolutely devastating. No markdown, no extra text, just the JSON.`,
};

const COACH_SYSTEM_PROMPT = `You are a supportive life coach who gives constructive, actionable advice. Use their exact numbers to provide specific, practical recommendations. Instead of judging, focus on realistic improvements. Give concrete steps they can take this week. Be encouraging but honest about areas for growth. End with 3 specific, actionable improvements for this week. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full coach report paragraph here",
  "top_5_roasts": ["actionable tip 1", "actionable tip 2", "actionable tip 3", "actionable tip 4", "actionable tip 5"]
}

Each tip must be under 15 words and practical. No markdown, no extra text, just the JSON.`;

const PERSONA_PROMPTS: Record<RoastPersona, string> = {
  default: `You are a savage roast comedian with zero filter. Use their exact numbers to destroy them. Connect every bad habit to real consequences. Heavy Gen Z slang. No softening, no "I'm not judging", no encouragement. Just brutal facts. End with a devastating one liner. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and brutally funny. No markdown, no extra text, just the JSON.`,
  gordon_ramsay: `You are Gordon Ramsay, the screaming chef. Use their exact numbers to destroy them with food metaphors and kitchen rage. Compare their habits to raw chicken, burnt dishes, and kitchen disasters. Use your signature shouting style, "WAKE UP!", "IT'S RAW!", "DISASTER!" No softening, just pure chef fury. End with a devastating food-related insult. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and food-themed. No markdown, no extra text, just the JSON.`,
  drill_sergeant: `You are a Military Drill Sergeant. Use their exact numbers to destroy them with brutal discipline and military language. Compare their habits to boot camp failures and weak recruits. Use shouting, "DROP AND GIVE ME 20!", "MAGGOT!", "WEAKNESS!" No excuses, no softening, just pure military discipline. End with a devastating military insult. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and military-themed. No markdown, no extra text, just the JSON.`,
  toxic_friend: `You are their toxic best friend. Use their exact numbers to destroy them but with that "I say this because I love you" energy. Heavy Gen Z slang, "bestie", "slay", "cringe", "embarrassing". Be savage but act like you're doing them a favor. "I can't with you right now", "this is giving failure". End with a devastating but loving insult. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and Gen Z slang. No markdown, no extra text, just the JSON.`,
  corporate_manager: `You are a passive-aggressive corporate manager conducting a performance review. Use their exact numbers to destroy them with corporate speak and HR language. "We need to discuss your performance metrics", "areas for improvement", "not meeting expectations". Use phrases like "let's circle back", "touch base", "low-hanging fruit". End with a devastating corporate insult. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and corporate-themed. No markdown, no extra text, just the JSON.`,
  savage_grandma: `You are their disappointed but funny grandma. Use their exact numbers to destroy them with old school wisdom and grandmotherly disappointment. "In my day we didn't have these problems", "back in my time", "I raised you better". Use gentle but devastating grandmotherly language. End with a devastating grandmotherly insult about how disappointed you are. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here",
  "top_5_roasts": ["short one-liner 1", "short one-liner 2", "short one-liner 3", "short one-liner 4", "short one-liner 5"]
}

Each one-liner must be under 15 words and grandmother-themed. No markdown, no extra text, just the JSON.`,
};

function parseAnswers(body: unknown): { answers: OnboardingAnswers; tone: RoastTone; mode: RoastMode; persona: RoastPersona } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const phoneHours = Number(b.phoneHours);
  const sleepHours = Number(b.sleepHours);
  const foodDeliverySpend = Number(b.foodDeliverySpend);
  const worstApp = typeof b.worstApp === "string" ? b.worstApp.trim() : "";
  const neverDoThing =
    typeof b.neverDoThing === "string" ? b.neverDoThing.trim() : "";
  const socialMediaHours = b.socialMediaHours ? Number(b.socialMediaHours) : undefined;
  const workoutFrequency = b.workoutFrequency ? Number(b.workoutFrequency) : undefined;
  const tone = (typeof b.tone === "string" && ["normal", "no_mercy", "destroy_me"].includes(b.tone))
    ? b.tone as RoastTone
    : "normal";
  const mode = (typeof b.mode === "string" && ["roast", "coach"].includes(b.mode))
    ? b.mode as RoastMode
    : "roast";
  const persona = (typeof b.persona === "string" && ["default", "gordon_ramsay", "drill_sergeant", "toxic_friend", "corporate_manager", "savage_grandma"].includes(b.persona))
    ? b.persona as RoastPersona
    : "default";

  if (
    !Number.isFinite(phoneHours) ||
    phoneHours < 1 ||
    phoneHours > 20 ||
    !Number.isFinite(sleepHours) ||
    sleepHours < 1 ||
    sleepHours > 12 ||
    !Number.isFinite(foodDeliverySpend) ||
    foodDeliverySpend < 0 ||
    !worstApp ||
    !neverDoThing
  ) {
    return null;
  }

  return {
    answers: {
      phoneHours,
      worstApp,
      sleepHours,
      foodDeliverySpend,
      neverDoThing,
      socialMediaHours,
      workoutFrequency,
    },
    tone,
    mode,
    persona,
  };
}

function formatUserMessage(answers: OnboardingAnswers): string {
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

  return message;
}

export async function POST(request: Request) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Groq API key not configured" },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[api/roast] Auth user retrieved:", user ? { id: user.id, email: user.email } : null);

  if (!user) {
    console.error("[api/roast] No authenticated user found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user's subscription tier
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.error("[api/roast] Error fetching user subscription tier:", userError);
  }

  const subscriptionTier = userData?.subscription_tier || "free";
  console.log("[api/roast] User subscription tier:", subscriptionTier);

  // If free tier, check if they already have a roast today
  if (subscriptionTier === "free") {
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRoast } = await supabase
      .from("roasts")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`)
      .maybeSingle();

    if (existingRoast) {
      return NextResponse.json(
        { error: "You've used your free roast today. Come back tomorrow or upgrade to Pro 🔥" },
        { status: 429 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAnswers(body);
  if (!parsed) {
    console.error("[api/roast] Failed to parse answers:", body);
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  const { answers, tone, mode, persona } = parsed;
  console.log("[api/roast] Parsed answers:", { answers, tone, mode, persona });

  const groq = new Groq({ apiKey });

  let roastText: string;
  let top5Roasts: string[] = [];
  try {
    let systemPrompt: string;
    if (mode === "coach") {
      systemPrompt = COACH_SYSTEM_PROMPT;
    } else {
      systemPrompt = PERSONA_PROMPTS[persona];
    }

    console.log("[api/roast] Calling Groq API with model:", MODEL);
    console.log("[api/roast] System prompt length:", systemPrompt.length);
    console.log("[api/roast] User message:", formatUserMessage(answers));

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: formatUserMessage(answers) },
      ],
      response_format: { type: "json_object" },
    });

    console.log("[api/roast] Groq API response received successfully");
    console.log("[api/roast] Completion choices:", completion.choices.length);
    console.log("[api/roast] First choice:", {
      finish_reason: completion.choices[0]?.finish_reason,
      has_content: !!completion.choices[0]?.message?.content,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      console.error(
        "[api/roast] Empty content in response:",
        completion.choices,
      );
      return NextResponse.json(
        { error: "Empty response from model" },
        { status: 502 },
      );
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(content);
      roastText = parsed.roast_text || content;
      top5Roasts = parsed.top_5_roasts || [];
      console.log("[api/roast] Parsed AI response:", { roastText: roastText.substring(0, 100), top5Roasts });
    } catch (parseError) {
      console.error("[api/roast] Failed to parse JSON response, using raw content:", parseError);
      roastText = content;
      top5Roasts = [];
    }
  } catch (err) {
    logGroqError(err);
    return NextResponse.json(
      { error: "Failed to generate roast" },
      { status: 502 },
    );
  }

  const report_card = buildReportCard(answers);
  const week_start_date = getWeekStartDate();
  const share_slug = generateShareSlug();
  const life_score = calculateLifeScore(answers);
  const funny_title = getFunnyTitle(life_score);
  const category_scores = calculateCategoryScores(answers);

  const baseRow = {
    user_id: user.id,
    roast_text: roastText,
    report_card,
    week_start_date,
    model_used: MODEL,
    share_slug,
    answers,
    life_score,
    funny_title,
    top_5_roasts: top5Roasts,
    category_scores,
    tone,
    mode,
    persona,
  };

  console.log("[api/roast] Preparing to insert roast with data:", {
    user_id: baseRow.user_id,
    roast_text_length: baseRow.roast_text.length,
    report_card_keys: Object.keys(baseRow.report_card),
    week_start_date: baseRow.week_start_date,
    model_used: baseRow.model_used,
    share_slug: baseRow.share_slug,
    life_score: baseRow.life_score,
    life_score_type: typeof baseRow.life_score,
    funny_title: baseRow.funny_title,
    funny_title_type: typeof baseRow.funny_title,
    top_5_roasts: baseRow.top_5_roasts,
    top_5_roasts_type: typeof baseRow.top_5_roasts,
    top_5_roasts_length: baseRow.top_5_roasts?.length,
    category_scores: baseRow.category_scores,
    category_scores_type: typeof baseRow.category_scores,
    tone: baseRow.tone,
    tone_type: typeof baseRow.tone,
    mode: baseRow.mode,
    mode_type: typeof baseRow.mode,
    persona: baseRow.persona,
    persona_type: typeof baseRow.persona,
  });

  console.log("[api/roast] Full insert object keys:", Object.keys(baseRow));
  console.log("[api/roast] Full insert object:", JSON.stringify(baseRow, null, 2));

  let { data, error } = await supabase
    .from("roasts")
    .insert(baseRow)
    .select("id")
    .single();

  if (error) {
    console.error("[api/roast] Full Supabase error object:", JSON.stringify(error, null, 2));
    console.error("[api/roast] Supabase insert error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      user_id: baseRow.user_id,
    });
    return NextResponse.json(
      { error: "Failed to save roast" },
      { status: 500 },
    );
  }

  console.log("[api/roast] Successfully inserted roast with ID:", data?.id);

  // Update streak
  try {
    const { data: userData } = await supabase
      .from("users")
      .select("current_streak, longest_streak")
      .eq("id", user.id)
      .single();

    const currentStreak = userData?.current_streak ?? 0;
    const longestStreak = userData?.longest_streak ?? 0;

    // Get the last roast date
    const { data: lastRoast } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2)
      .maybeSingle();

    let newStreak = 1;
    let streakReset = false;

    if (lastRoast && lastRoast.created_at) {
      const lastDate = new Date(lastRoast.created_at);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        newStreak = currentStreak + 1;
      } else if (diffDays > 1) {
        // Streak reset
        newStreak = 1;
        streakReset = true;
      } else {
        // Same day, don't increment
        newStreak = currentStreak;
      }
    }

    const newLongestStreak = Math.max(longestStreak, newStreak);

    await supabase
      .from("users")
      .update({
        current_streak: newStreak,
        longest_streak: newLongestStreak,
      })
      .eq("id", user.id);

    console.log("[api/roast] Updated streak:", { newStreak, newLongestStreak, streakReset });
  } catch (err) {
    console.error("[api/roast] Failed to update streak:", err);
  }

  try {
    await unlockAchievements(supabase, user.id, life_score);
  } catch (err) {
    console.error("[api/roast] Failed to unlock achievements:", err);
  }

  const roastId = data?.id ? String(data.id) : "";
  if (!roastId) {
    console.error("[api/roast] insert ok but missing id in response:", data);
    return NextResponse.json(
      { error: "Failed to save roast" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: roastId, shareSlug: share_slug });
}
