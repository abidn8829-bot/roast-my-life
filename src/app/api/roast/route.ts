import { generateCardPunchline, insertRoastRow } from "@/lib/card-punchline";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { sendAchievementPush } from "@/lib/achievement-push";
import { unlockAchievements, type AchievementId } from "@/lib/achievements";
import { cleanRoastText } from "@/lib/clean-roast-text";
import { checkDailyLimit } from "@/lib/daily-limit";
import { buildReportCard, calculateCategoryScores, calculateLifeScore, getFunnyTitle } from "@/lib/grades";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import { PENDING_ACHIEVEMENT_COOKIE, encodePendingAchievements } from "@/lib/pending-achievement-cookie";
import type { OnboardingAnswers, RoastTone, RoastMode, RoastPersona } from "@/lib/roast-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareSlug } from "@/lib/share-slug";
import { getWeekStartDate } from "@/lib/week-start";
import { combineSignals, outputLooksUnsafe, ruleFloorLevel, type SafetyLevel } from "@/lib/safety";
import { OUTPUT_GUARDRAIL, SAFETY_CALL_OPTIONS, runSafetyClassify } from "@/lib/safety-server";
import {
  DEFAULT_PERSONA_PROMPT,
  FOLLOWUP_CALL_PARAMS,
  ROAST_CALL_PARAMS,
  buildFollowUpMessages,
  buildFollowUpUserMessage,
  buildRoastMessages,
  formatUserMessage,
  parseFollowUpResponse,
  parseRoastResponse,
} from "@/lib/safety-prompts";
import { gentleGate, respondFlagged, respondOutputBlocked, respondUnavailable } from "@/lib/safety-response";

const MODEL = "openai/gpt-oss-120b";

// Seconds this route may run on Vercel. The pipeline is a safety classify call, then the roast, then
// the punchline and memory calls (each with a timeout of its own), and a slow Groq day can add up.
// 60 is within the Hobby plan's documented maximum whether or not Fluid Compute is on.
export const maxDuration = 60;

const CONTINUITY_MEMORY_SYSTEM_PROMPT = `You are building lightweight current-arc memory for a roast AI. Remember only the current habit storyline, not a transcript. Return a JSON object with these fields:
- activeTheme: the current theme/issue (e.g., "procrastination", "phone addiction")
- followUpQuestion: a specific short question for tomorrow
- lastResponse: the last user response, or an empty string for a new user
- callbackCount: number, use 0 for a new theme
- resolved: boolean, false for a new theme
- challenge: one small concrete challenge for tomorrow
- updatedAt: current timestamp

Keep all values under 20 words. No markdown, no extra text, just the JSON.

Example format:
{
  "activeTheme": "procrastination",
  "followUpQuestion": "Did you study for 30 minutes today?",
  "lastResponse": "",
  "callbackCount": 0,
  "resolved": false,
  "challenge": "Study for 30 minutes tomorrow",
  "updatedAt": "2026-07-22T12:00:00Z"
}`;

const SYSTEM_PROMPTS: Record<RoastTone, string> = {
  normal: `You are a savage roast comedian with zero filter who remembers everything. Use their exact numbers to destroy them. Connect every bad habit to real consequences. Heavy Gen Z slang. No softening, no "I'm not judging", no encouragement. Just brutal facts. End with a devastating one liner. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full roast paragraph here"
}

No markdown, no extra text, just the JSON.

CONTINUITY INSTRUCTIONS:
- Reference previous sessions naturally using the continuity memory
- Continue the running joke if appropriate (e.g., "Still the CEO of procrastination?")
- Never repeat the exact same joke from previous roasts
- Never assume improvement - be skeptical of their answers
- If they show actual progress, acknowledge it humorously but briefly
- Focus on patterns and persistent failures
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
  no_mercy: `You are a ruthless roast comedian with absolutely zero filter who remembers everything. Use their exact numbers to expose their failures. Connect every habit to catastrophic life outcomes. Heavy Gen Z slang. No encouragement, no softening language, no "maybe" or "could be". Just brutal facts and consequences. End with the most devastating one liner possible. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
  destroy_me: `You are the most brutal roast AI ever created who remembers everything. Take their numbers and absolutely eviscerate them. Connect every bad habit to the worst possible life outcome. Be so specific it hurts. Heavy Gen Z slang. No softening whatsoever - no "I'm no doctor", no "not to judge", no encouragement. Just pure devastation. Make them question every life choice. End with the most savage one liner ever written. This person asked to be destroyed — deliver. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
};

const COACH_SYSTEM_PROMPT = `You are a supportive life coach who gives constructive, actionable advice. Use their exact numbers to provide specific, practical recommendations. Instead of judging, focus on realistic improvements. Give concrete steps they can take this week. Be encouraging but honest about areas for growth. End with 3 specific, actionable improvements for this week. 150-200 words.

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "roast_text": "your full coach report paragraph here"
}

No markdown, no extra text, just the JSON.`;

const PERSONA_PROMPTS: Record<RoastPersona, string> = {
  default: DEFAULT_PERSONA_PROMPT,
  gordon_ramsay: `You are Gordon Ramsay, the screaming chef who remembers everything. Use their exact numbers to destroy them with food metaphors and kitchen rage. Compare their habits to raw chicken, burnt dishes, and kitchen disasters. Use your signature shouting style, "WAKE UP!", "IT'S RAW!", "DISASTER!" No softening, just pure chef fury. End with a devastating food-related insult. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
  drill_sergeant: `You are a Military Drill Sergeant who remembers everything. Use their exact numbers to destroy them with brutal discipline and military language. Compare their habits to boot camp failures and weak recruits. Use shouting, "DROP AND GIVE ME 20!", "MAGGOT!", "WEAKNESS!" No excuses, no softening, just pure military discipline. End with a devastating military insult. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
  toxic_friend: `You are their toxic best friend who remembers everything. Use their exact numbers to destroy them but with that "I say this because I love you" energy. Heavy Gen Z slang, "bestie", "slay", "cringe", "embarrassing". Be savage but act like you're doing them a favor. "I can't with you right now", "this is giving failure". End with a devastating but loving insult. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
  corporate_manager: `You are a passive-aggressive corporate manager who remembers everything conducting a performance review. Use their exact numbers to destroy them with corporate speak and HR language. "We need to discuss your performance metrics", "areas for improvement", "not meeting expectations". Use phrases like "let's circle back", "touch base", "low-hanging fruit". End with a devastating corporate insult. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
  savage_grandma: `You are their disappointed but funny grandma who remembers everything. Use their exact numbers to destroy them with old school wisdom and grandmotherly disappointment. "In my day we didn't have these problems", "back in my time", "I raised you better". Use gentle but devastating grandmotherly language. End with a devastating grandmotherly insult about how disappointed you are. 150-200 words.

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
- Use the activeTopic and runningJoke from continuity memory to build on previous sessions`,
};

function parseAnswers(body: unknown): { answers: OnboardingAnswers; tone: RoastTone; mode: RoastMode; persona: RoastPersona; followUpAnswer?: string } | null {
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
  const followUpAnswer = typeof b.followUpAnswer === "string" ? b.followUpAnswer.trim() : undefined;
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
    followUpAnswer,
  };
}

export async function POST(request: Request) {
  // handlePost claims a daily slot; whatever happens, give it back when the request ends.
  const slot = { release: () => {} };
  try {
    return await handlePost(request, slot);
  } finally {
    slot.release();
  }
}

async function handlePost(request: Request, slot: { release: () => void }) {
  // Logging rule for this route: never print anything a user typed or anything the AI wrote
  // (answers, follow-up answers, prompts, roast text, memory, insert payloads, emails).
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
    console.error("[api/roast] No authenticated user found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Gentle mode (72 hours after a safety flag): no roasts. Enforced here, before any AI call.
  const gentle = await gentleGate(supabase, user.id);
  if (gentle) return gentle;

  // Check user's subscription tier
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.error("[api/roast] Error fetching user subscription tier:", userError.code);
  }

  const subscriptionTier = userData?.subscription_tier || "free";

  // Daily limit (free/Pro numbers live in lib/daily-limit.ts), checked before any AI call.
  const dailyLimit = await checkDailyLimit(supabase, user.id, subscriptionTier);
  if (!dailyLimit.allowed) {
    return NextResponse.json(dailyLimit.body, { status: dailyLimit.status });
  }
  slot.release = dailyLimit.release;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAnswers(body);
  if (!parsed) {
    console.error("[api/roast] Invalid answers");
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  const { answers, tone, mode, persona, followUpAnswer } = parsed;

  // Safety rule filter: needs no AI. A Level 2 match is final (fixed page, no AI call at all).
  // neverDoThing is only READ here; its question, validation and storage are unchanged.
  const ruleLevel = ruleFloorLevel(answers.worstApp, answers.neverDoThing, followUpAnswer);
  const userTexts = [answers.worstApp, answers.neverDoThing, followUpAnswer ?? ""];
  if (ruleLevel === 2) return respondFlagged({ request, route: "roast", level: 2, userId: user.id });

  // Free tier only gets the default persona and normal tone — everything else is Pro-gated.
  // (Client UI already disables these for free users; this is the server-side enforcement.)
  if (subscriptionTier === "free" && (tone !== "normal" || persona !== "default")) {
    return NextResponse.json(
      { error: "Custom personas and roast tones are Pro features. Upgrade to Pro to unlock them 🔥" },
      { status: 403 },
    );
  }

  const groq = new Groq({ apiKey });

  // The dedicated safety classification runs BEFORE anything is generated, alongside the database
  // read below (so it hides behind that read's latency). It has no roast task and no persona.
  const [classifyLevel, { data: previousRoasts }] = await Promise.all([
    runSafetyClassify(groq, MODEL, userTexts),
    // Check if this is a returning user (has previous roasts)
    supabase
      .from("roasts")
      .select("id, roast_text, continuity_memory, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // Final level = the highest of the rule filter and the classifier. Fail closed: if the classifier
  // could not answer and no phrase matched, nothing is generated, saved or flagged, and no daily
  // slot is used (the roasts row is only written at the very end; the slot is released in POST).
  const preDecision = combineSignals({ rule: ruleLevel, classify: classifyLevel });
  if (preDecision.kind === "unavailable") return respondUnavailable("roast");
  if (preDecision.level !== 0) {
    return respondFlagged({ request, route: "roast", level: preDecision.level, userId: user.id, groq, texts: userTexts });
  }

  const isReturningUser = previousRoasts && previousRoasts.length > 0;
  const previousRoast = isReturningUser ? previousRoasts[0] : null;
  const continuityMemory = previousRoast?.continuity_memory || null;

  // If returning user and no follow-up answer, generate follow-up question.
  // The safety level rides inside this existing call (it now returns JSON).
  if (isReturningUser && !followUpAnswer) {
    let aiLevel: SafetyLevel | null = null;
    let followUpQuestion = "";
    let followUpCallFailed = false;
    try {
      const completion = await groq.chat.completions.create(
        {
          model: MODEL,
          ...FOLLOWUP_CALL_PARAMS,
          messages: buildFollowUpMessages(buildFollowUpUserMessage(answers, previousRoast?.roast_text, continuityMemory)),
        },
        SAFETY_CALL_OPTIONS,
      );
      const parsedFollowUp = parseFollowUpResponse(completion.choices[0]?.message?.content ?? "");
      aiLevel = parsedFollowUp.aiLevel;
      followUpQuestion = parsedFollowUp.question;
    } catch (error) {
      logGroqError(error);
      // Unchanged behaviour: if the follow-up call fails, fall through to the roast call below.
      followUpCallFailed = true;
    }

    // The safety_level key the follow-up call returns is an extra signal that can only raise the level.
    const followUpDecision = combineSignals({ rule: ruleLevel, classify: classifyLevel, inCall: aiLevel });
    if (!followUpCallFailed && followUpDecision.kind === "level") {
      if (followUpDecision.level !== 0) {
        return respondFlagged({ request, route: "roast", level: followUpDecision.level, userId: user.id, groq, texts: userTexts });
      }
      const question = followUpQuestion || "Still making the same mistakes?";
      if (outputLooksUnsafe(question)) return respondOutputBlocked(request, "roast");
      return NextResponse.json({
        followUpQuestion: question,
        requiresFollowUp: true,
      });
    }
  }

  // The roast call. The safety level is the first key of its JSON; if it is 1 or 2 the roast
  // text is empty and nothing is saved.
  let aiLevel: SafetyLevel | null = null;
  let generatedRoast = "";
  try {
    let systemPrompt: string;
    if (mode === "coach") {
      systemPrompt = COACH_SYSTEM_PROMPT;
    } else {
      systemPrompt = PERSONA_PROMPTS[persona];
    }

    const completion = await groq.chat.completions.create(
      {
        model: MODEL,
        ...ROAST_CALL_PARAMS,
        messages: buildRoastMessages(systemPrompt, formatUserMessage(answers, continuityMemory, followUpAnswer, previousRoast?.roast_text)),
      },
      SAFETY_CALL_OPTIONS,
    );

    console.log("[api/roast] Groq response:", {
      finish_reason: completion.choices[0]?.finish_reason,
      has_content: !!completion.choices[0]?.message?.content,
    });

    const parsedRoast = parseRoastResponse(completion.choices[0]?.message?.content?.trim() ?? "");
    aiLevel = parsedRoast.aiLevel;
    generatedRoast = parsedRoast.roastText;
  } catch (err) {
    logGroqError(err);
  }

  // The roast call's own safety_level can only raise the level; a missing one is not a failure
  // because the classifier already answered.
  const decision = combineSignals({ rule: ruleLevel, classify: classifyLevel, inCall: aiLevel });
  if (decision.kind === "unavailable") return respondUnavailable("roast"); // cannot happen after the pre-check; fail closed anyway
  if (decision.level !== 0) {
    return respondFlagged({ request, route: "roast", level: decision.level, userId: user.id, groq, texts: userTexts });
  }
  if (!generatedRoast.trim()) {
    return NextResponse.json(
      { error: "Failed to generate roast" },
      { status: 502 },
    );
  }

  // Roasts are rendered as plain text, so drop any markdown the model slipped in before it is saved or reused.
  let roastText = cleanRoastText(generatedRoast) || generatedRoast;

  // Output check (rule-based, no AI call): a roast that mocks sadness / self-harm / pain is thrown away.
  if (process.env.NODE_ENV !== "production" && process.env.EMBER_SAFETY_TEST_ROAST) roastText = process.env.EMBER_SAFETY_TEST_ROAST; // test-only override, ignored in production
  if (outputLooksUnsafe(roastText)) return respondOutputBlocked(request, "roast");

  const report_card = buildReportCard(answers);
  const week_start_date = getWeekStartDate();
  const share_slug = generateShareSlug();
  const life_score = calculateLifeScore(answers);
  const funny_title = getFunnyTitle(life_score);
  const category_scores = calculateCategoryScores(answers);

  // Card punchline runs alongside the continuity-memory call (both only need roastText).
  const punchlinePromise = generateCardPunchline(groq, MODEL, {
    answers,
    categoryScores: category_scores,
    lifeScore: life_score,
    roastText,
    mode,
  });

  // Generate continuity memory
  let newContinuityMemory = continuityMemory || { activeTheme: "", followUpQuestion: "", lastResponse: "", callbackCount: 0, resolved: false, challenge: "", updatedAt: "" };
  try {
    const memoryPrompt = `Roast: "${roastText}"
Habits:
- Phone screen time: ${answers.phoneHours} hours per day
- Biggest time-waster app: ${answers.worstApp}
- Average sleep: ${answers.sleepHours} hours per night
- Weekly food delivery spending: $${answers.foodDeliverySpend}
- Keeps saying they'll do but never does: "${answers.neverDoThing}"
${answers.socialMediaHours ? `- Social media hours per day: ${answers.socialMediaHours}` : ''}
${answers.workoutFrequency ? `- Workouts this week: ${answers.workoutFrequency}` : ''}
${followUpAnswer ? `Their answer to follow-up question: "${followUpAnswer}"` : ''}
${previousRoast?.roast_text ? `Previous roast: "${previousRoast.roast_text}"` : ''}
${continuityMemory ? `Previous continuity memory: ${JSON.stringify(continuityMemory)}` : ''}`;

    const memoryCompletion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 400,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: `${OUTPUT_GUARDRAIL}\n\n${CONTINUITY_MEMORY_SYSTEM_PROMPT}` },
        { role: "user", content: memoryPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const memoryContent = memoryCompletion.choices[0]?.message?.content?.trim() || "";
    if (memoryContent) {
      const parsedMemory = JSON.parse(memoryContent);
      // Update timestamp
      parsedMemory.updatedAt = new Date().toISOString();
      newContinuityMemory = parsedMemory;
    }
  } catch (memoryError) {
    // Never print the error object: a JSON.parse error quotes the text it choked on.
    console.error("[api/roast] Error generating continuity memory:", memoryError instanceof Error ? memoryError.name : "unknown");
    // Use previous memory or empty if generation fails
    newContinuityMemory.updatedAt = new Date().toISOString();
  }

  const cardPunchline = await punchlinePromise;

  // Final output check over everything the AI wrote, before anything is saved.
  const memoryChallenge = (newContinuityMemory as Record<string, unknown>).challenge;
  if (outputLooksUnsafe(cardPunchline, typeof memoryChallenge === "string" ? memoryChallenge : null)) {
    return respondOutputBlocked(request, "roast");
  }

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
    top_5_roasts: [],
    card_punchline: cardPunchline,
    category_scores,
    tone,
    mode,
    persona,
    continuity_memory: newContinuityMemory,
  };

  const { data, error } = await insertRoastRow(supabase, baseRow);

  if (error) {
    // Code only: Postgres "details" can echo the failing row, which holds the user's text.
    console.error("[api/roast] Supabase insert error:", { code: error.code });
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

    // Get the last roast date, excluding the one just inserted above.
    const { data: lastRoast } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("user_id", user.id)
      .neq("id", data?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let newStreak = 1;
    let streakReset = false;

    if (lastRoast && lastRoast.created_at) {
      // Calendar-date-key comparison, matching lib/streak.ts's calculateStreak() exactly
      // (toDateKey/previousDay), so the write path here and the display path agree —
      // a raw hours-elapsed diff would disagree with it across a midnight boundary.
      const toDateKey = (iso: string) => new Date(iso).toISOString().split("T")[0]!;
      const lastDateKey = toDateKey(lastRoast.created_at);
      const todayKey = toDateKey(new Date().toISOString());
      const yesterday = new Date(`${todayKey}T12:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().split("T")[0]!;

      if (lastDateKey === todayKey) {
        // Same calendar day, don't increment
        newStreak = currentStreak;
      } else if (lastDateKey === yesterdayKey) {
        // Consecutive calendar day
        newStreak = currentStreak + 1;
      } else {
        // Gap of 2+ calendar days
        newStreak = 1;
        streakReset = true;
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

  let newlyUnlockedAchievements: AchievementId[] = [];
  try {
    const achievementResult = await unlockAchievements(supabase, user.id);
    newlyUnlockedAchievements = achievementResult.newlyUnlocked;
  } catch (err) {
    console.error("[api/roast] Failed to unlock achievements:", err);
  }
  try {
    await sendAchievementPush(supabase, user.id, newlyUnlockedAchievements);
  } catch (err) {
    console.error("[api/roast] Failed to send achievement push:", err);
  }

  const roastId = data?.id ? String(data.id) : "";
  if (!roastId) {
    console.error("[api/roast] insert ok but missing id in response");
    return NextResponse.json(
      { error: "Failed to save roast" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ id: roastId, shareSlug: share_slug, newlyUnlockedAchievements });
  if (newlyUnlockedAchievements.length > 0) {
    response.cookies.set(PENDING_ACHIEVEMENT_COOKIE, encodePendingAchievements(newlyUnlockedAchievements), {
      path: "/",
      maxAge: 60 * 10,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return response;
}
