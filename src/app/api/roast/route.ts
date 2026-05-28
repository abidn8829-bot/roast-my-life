import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { buildReportCard } from "@/lib/grades";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import type { OnboardingAnswers } from "@/lib/roast-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareSlug } from "@/lib/share-slug";
import { getWeekStartDate } from "@/lib/week-start";

const MODEL = "llama-3.3-70b-versatile";
const SYSTEM_PROMPT = `You are a brutally funny roast comedian. You roast people based on their real habits. Be specific, use their exact numbers and app names. Be savage but not mean-spirited. Keep it to 150-200 words. End with one brutal one-liner that summarizes their life. Don't hold back.`;

function parseAnswers(body: unknown): OnboardingAnswers | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const phoneHours = Number(b.phoneHours);
  const sleepHours = Number(b.sleepHours);
  const foodDeliverySpend = Number(b.foodDeliverySpend);
  const worstApp = typeof b.worstApp === "string" ? b.worstApp.trim() : "";
  const neverDoThing =
    typeof b.neverDoThing === "string" ? b.neverDoThing.trim() : "";

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
    phoneHours,
    worstApp,
    sleepHours,
    foodDeliverySpend,
    neverDoThing,
  };
}

function formatUserMessage(answers: OnboardingAnswers): string {
  return `Roast this person based on their habits:

- Phone screen time: ${answers.phoneHours} hours per day
- Biggest time-waster app: ${answers.worstApp}
- Average sleep: ${answers.sleepHours} hours per night
- Weekly food delivery spending: $${answers.foodDeliverySpend}
- Keeps saying they'll do but never does: "${answers.neverDoThing}"`;
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user's subscription tier
  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";

  // If free tier, check if they already have a roast today
  if (subscriptionTier === "free") {
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRoast } = await supabase
      .from("roasts")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", today)
      .single();

    if (existingRoast) {
      return NextResponse.json(
        { error: "You've used your free roast today. Upgrade to Pro for unlimited roasts 🔥" },
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

  const answers = parseAnswers(body);
  if (!answers) {
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  const groq = new Groq({ apiKey });

  let roastText: string;
  try {
    console.log("[api/roast] Calling Groq", {
      model: MODEL,
      max_tokens: 1000,
    });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
  };

  let { data, error } = await supabase
    .from("roasts")
    .insert({ ...baseRow, answers })
    .select("id")
    .single();

  if (
    error &&
    (error.code === "42703" || error.message?.includes("answers"))
  ) {
    ({ data, error } = await supabase
      .from("roasts")
      .insert(baseRow)
      .select("id")
      .single());
  }

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json(
      { error: "Failed to save roast" },
      { status: 500 },
    );
  }

  const roastId = data?.id ? String(data.id) : "";
  if (!roastId) {
    console.error("[api/roast] insert ok but missing id in response:", data);
    return NextResponse.json(
      { error: "Failed to save roast" },
      { status: 500 },
    );
  }

  console.log("[api/roast] saved roast id:", roastId);

  return NextResponse.json({ id: roastId, shareSlug: share_slug });
}
