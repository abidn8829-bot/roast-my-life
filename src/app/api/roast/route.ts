import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { buildReportCard } from "@/lib/grades";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import type { OnboardingAnswers, RoastTone } from "@/lib/roast-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareSlug } from "@/lib/share-slug";
import { getWeekStartDate } from "@/lib/week-start";

const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPTS: Record<RoastTone, string> = {
  normal: `You are a savage roast comedian with zero filter. Use their exact numbers to destroy them. Connect every bad habit to real consequences. Heavy Gen Z slang. No softening, no "I'm not judging", no encouragement. Just brutal facts. End with a devastating one liner. 150-200 words.`,
  no_mercy: `You are a ruthless roast comedian with absolutely zero filter. Use their exact numbers to expose their failures. Connect every habit to catastrophic life outcomes. Heavy Gen Z slang. No encouragement, no softening language, no "maybe" or "could be". Just brutal facts and consequences. End with the most devastating one liner possible. 150-200 words.`,
  destroy_me: `You are the most brutal roast AI ever created. Take their numbers and absolutely eviscerate them. Connect every bad habit to the worst possible life outcome. Be so specific it hurts. Heavy Gen Z slang. No softening whatsoever - no "I'm no doctor", no "not to judge", no encouragement. Just pure devastation. Make them question every life choice. End with the most savage one liner ever written. This person asked to be destroyed — deliver. 150-200 words.`,
};

function parseAnswers(body: unknown): { answers: OnboardingAnswers; tone: RoastTone } | null {
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

  const { answers, tone } = parsed;
  console.log("[api/roast] Parsed answers:", { answers, tone });

  const groq = new Groq({ apiKey });

  let roastText: string;
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[tone] },
        { role: "user", content: formatUserMessage(answers) },
      ],
    });

    roastText = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!roastText) {
      console.error(
        "[api/roast] Empty content in response:",
        completion.choices,
      );
      return NextResponse.json(
        { error: "Empty response from model" },
        { status: 502 },
      );
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

  const baseRow = {
    user_id: user.id,
    roast_text: roastText,
    report_card,
    week_start_date,
    model_used: MODEL,
    share_slug,
    answers,
  };

  console.log("[api/roast] Preparing to insert roast with data:", {
    user_id: baseRow.user_id,
    roast_text_length: baseRow.roast_text.length,
    report_card_keys: Object.keys(baseRow.report_card),
    week_start_date: baseRow.week_start_date,
    model_used: baseRow.model_used,
    share_slug: baseRow.share_slug,
  });

  let { data, error } = await supabase
    .from("roasts")
    .insert(baseRow)
    .select("id")
    .single();

  if (error) {
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
