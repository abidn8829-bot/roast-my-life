import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { unlockAchievements } from "@/lib/achievements";
import { calculateLifeScore, getFunnyTitle } from "@/lib/grades";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import type { CategoryScores, Grade, OnboardingAnswers, RoastMode, RoastPersona, RoastTone } from "@/lib/roast-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateShareSlug } from "@/lib/share-slug";
import { getWeekStartDate } from "@/lib/week-start";

const MODEL = "llama-3.3-70b-versatile";
const CATEGORIES = ["sleep", "fitness", "discipline", "focus", "spending"] as const;
type Category = typeof CATEGORIES[number];
const GRADES = ["A", "B", "C", "D", "F"] as const;
const GRADE_SCORES: Record<Grade, number> = { A: 100, B: 75, C: 60, D: 40, F: 0 };

function isCategory(value: unknown): value is Category { return typeof value === "string" && CATEGORIES.includes(value as Category); }
function isGrade(value: unknown): value is Grade { return typeof value === "string" && GRADES.includes(value as Grade); }

function getAvailableCategories(coveredCategories: Category[], lastAskedCategory: unknown): { available: Category[]; resetCovered: Category[] } {
  let available = CATEGORIES.filter((c) => !coveredCategories.includes(c) && c !== lastAskedCategory);
  let resetCovered = coveredCategories;
  if (available.length === 0) {
    resetCovered = [];
    available = CATEGORIES.filter((c) => c !== lastAskedCategory);
  }
  return { available, resetCovered };
}

type PlanStep = { step: string; why: string };
function isPlanSteps(value: unknown): value is PlanStep[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return false;
  return value.every((v) => {
    if (typeof v !== "object" || v === null) return false;
    const step = (v as Record<string, unknown>).step;
    const why = (v as Record<string, unknown>).why;
    return typeof step === "string" && step.trim().length > 0 && typeof why === "string" && why.trim().length > 0;
  });
}

type ChallengePlan = { challenge: string; steps: PlanStep[] };

export async function POST(request: Request) {
  const apiKey = getGroqApiKey();
  if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { data: previous, error: previousError } = await supabase.from("roasts")
    .select("id, roast_text, report_card, answers, category_scores, tone, mode, persona, continuity_memory, top_5_roasts")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (previousError || !previous) return NextResponse.json({ error: "No previous roast found" }, { status: 404 });
  const categoryScores = previous.category_scores as CategoryScores | null;
  if (!categoryScores) return NextResponse.json({ error: "Previous category grades are unavailable" }, { status: 409 });

  const groq = new Groq({ apiKey });
  if (body.action === "question") {
    try {
      const memory = (previous.continuity_memory as Record<string, unknown> | null) ?? {};
      const lastAskedCategory = memory.lastAskedCategory;
      const coveredCategories: Category[] = Array.isArray(memory.coveredCategories) ? memory.coveredCategories.filter(isCategory) : [];
      const { available } = getAvailableCategories(coveredCategories, lastAskedCategory);
      const finalCategory = available[0];

      const { data: historyRows } = await supabase
        .from("score_history")
        .select("category_grades, recorded_at")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(90);
      let historyFact: { daysAgo: number; wasGrade: Grade; nowGrade: Grade } | null = null;
      if (historyRows) {
        const currentGrade = categoryScores[finalCategory].grade;
        for (let i = 0; i < historyRows.length - 1; i++) {
          const newerGrade = (historyRows[i].category_grades as CategoryScores)?.[finalCategory]?.grade;
          const olderGrade = (historyRows[i + 1].category_grades as CategoryScores)?.[finalCategory]?.grade;
          if (newerGrade && olderGrade && newerGrade !== olderGrade) {
            const daysAgo = Math.max(0, Math.round((Date.now() - new Date(historyRows[i].recorded_at as string).getTime()) / 86400000));
            historyFact = { daysAgo, wasGrade: olderGrade, nowGrade: currentGrade };
            break;
          }
        }
      }

      const questionCompletion = await groq.chat.completions.create({
        model: MODEL, max_tokens: 100, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return strict JSON only: {\"activeTheme\":\"short current habit arc\",\"question\":\"short, specific roast-voice check-in question\"}. activeTheme is a short phrase describing the current habit arc for this category — continue naturally from the previous arc memory if it's about the same category, otherwise start a fresh one. Write a brand-new question about the given category, grounded in the real grade change provided. If told this category has never been asked about before, write a fresh baseline question instead of referencing any change. Never assert, imply, or say the user has 'failed,' is 'clearly struggling,' or has a pattern of failure with a previous challenge unless there is real evidence for it. Real evidence means: historyFact shows the grade has stayed flat or worsened, OR the previous arc memory's callbackCount is 2 or higher (meaning this specific challenge has already survived at least one full check-in cycle without resolving). If callbackCount is 0 or 1, or historyFact is null, treat any previous challenge neutrally — ask how it's going, don't accuse. It is always safer to ask than to assume." },
          { role: "user", content: `Category: ${finalCategory}\n${historyFact ? `Last asked about this category ${historyFact.daysAgo} day(s) ago. Grade was ${historyFact.wasGrade}, now ${historyFact.nowGrade}.` : "This category has never been specifically asked about before."}\nPrevious arc memory: ${JSON.stringify(previous.continuity_memory ?? {})}\nPrevious roast: ${previous.roast_text}` },
        ],
      });
      const parsedQuestion = JSON.parse(questionCompletion.choices[0]?.message?.content ?? "") as { activeTheme?: unknown; question?: unknown };
      if (typeof parsedQuestion.activeTheme !== "string" || typeof parsedQuestion.question !== "string" || !parsedQuestion.question.trim()) return NextResponse.json({ error: "Invalid check-in question response" }, { status: 502 });
      return NextResponse.json({ category: finalCategory, activeTheme: parsedQuestion.activeTheme.trim(), question: parsedQuestion.question.trim() });
    } catch (error) { logGroqError(error); return NextResponse.json({ error: "Failed to generate check-in question" }, { status: 502 }); }
  }

  const category = body.category;
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const activeTheme = typeof body.activeTheme === "string" ? body.activeTheme.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (body.action !== "submit" || !isCategory(category) || !answer) return NextResponse.json({ error: "Invalid check-in submission" }, { status: 400 });
  const previousGrade = categoryScores[category].grade;
  let filteredGradeUpdates: Partial<Record<Category, Grade>>;
  let suggestionLine: string;
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL, max_tokens: 300, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "The user is answering a daily check-in about their habits. Scan the user's full answer for ANY of the 5 categories they mention — sleep, fitness, discipline, focus, spending — not just the one the question was about. Grade every category genuinely referenced, even if unprompted. Read their answer freely — it may mention one habit, several, or be vague. Only include categories genuinely relevant to what they said. For each relevant category, return an updated letter grade (A/B/C/D/F) based on whether they're improving or slipping. Also write a coaching suggestion_line: 2 sentences max, acknowledge what improved, name what's still struggling, point to one concrete next step. Tone: honest coach, not a joke. Return strict JSON only, in this exact shape: {\"grade_updates\": {\"category\": \"grade\"}, \"suggestion_line\": \"string\"}." },
        { role: "user", content: `Check-in answer: ${answer}\nQuestion asked: ${question}\nCurrent theme: ${activeTheme}\nCurrent category grades: ${JSON.stringify(categoryScores)}` },
      ],
    });
    const rawContent = completion.choices[0]?.message?.content ?? "";
    console.error("[check-in] raw grading response:", rawContent);
    const parsed = JSON.parse(rawContent) as { grade_updates?: unknown; suggestion_line?: unknown };
    if (typeof parsed.suggestion_line !== "string" || !parsed.suggestion_line.trim() || typeof parsed.grade_updates !== "object" || parsed.grade_updates === null) return NextResponse.json({ error: "Invalid check-in grading response" }, { status: 502 });
    filteredGradeUpdates = {};
    for (const [key, value] of Object.entries(parsed.grade_updates as Record<string, unknown>)) {
      if (isCategory(key) && isGrade(value)) filteredGradeUpdates[key] = value;
    }
    suggestionLine = parsed.suggestion_line.trim();
  } catch (error) { logGroqError(error); return NextResponse.json({ error: "Failed to grade check-in" }, { status: 502 }); }

  const updatedCategoryScores: CategoryScores = { ...categoryScores };
  for (const key of CATEGORIES) {
    const newGrade = filteredGradeUpdates[key];
    if (newGrade) updatedCategoryScores[key] = { ...categoryScores[key], score: GRADE_SCORES[newGrade], grade: newGrade };
  }
  const lifeScore = calculateLifeScore(updatedCategoryScores);
  const previousLifeScore = calculateLifeScore(categoryScores);
  const categoryDirections: Record<Category, "improved" | "same" | "worsened"> = CATEGORIES.reduce((acc, key) => {
    const prevScore = GRADE_SCORES[categoryScores[key].grade];
    const newScore = GRADE_SCORES[updatedCategoryScores[key].grade];
    acc[key] = newScore > prevScore ? "improved" : newScore < prevScore ? "worsened" : "same";
    return acc;
  }, {} as Record<Category, "improved" | "same" | "worsened">);
  const overallDirection = lifeScore > previousLifeScore ? "improved" : "not improved";
  const changedCategoryScores: Partial<Record<Category, { was: number; now: number }>> = {};
  for (const key of CATEGORIES) {
    if (filteredGradeUpdates[key]) {
      changedCategoryScores[key] = { was: GRADE_SCORES[categoryScores[key].grade], now: GRADE_SCORES[updatedCategoryScores[key].grade] };
    }
  }
  const newGradeForCategory = filteredGradeUpdates[category] ?? previousGrade;
  const result = {
    new_grade: newGradeForCategory,
    direction: (GRADE_SCORES[newGradeForCategory] > GRADE_SCORES[previousGrade] ? "improved" : GRADE_SCORES[newGradeForCategory] < GRADE_SCORES[previousGrade] ? "worse" : "same") as "improved" | "same" | "worse",
  };

  let plan: ChallengePlan | null = null;
  try {
    const planCompletion = await groq.chat.completions.create({
      model: MODEL, max_tokens: 220, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only: {\"challenge\":\"small concrete challenge\",\"planSteps\":[{\"step\":\"concrete action\",\"why\":\"one short sentence why it matters\"}]}. The challenge must never specify a fixed multi-day duration (no '3 days', 'next week', '2 weeks', etc.) — keep it achievable as a short, concrete action, not a multi-day program. Never reuse or repeat a stale prior ask — write a fresh challenge grounded in what the user just said. planSteps must contain 2 or 3 objects, each a concrete next action with a one-sentence why in your blunt coaching voice — never generic filler like 'this will help you improve.' Branch on direction, which is the deciding signal, not the raw answer wording, since grading already judged whether the evidence supports it. If direction is 'improved' and the answer shows real follow-through, the challenge should push further — a harder version of the same category. If direction is 'same' and the answer shows an attempt, the challenge should target the specific point it broke down instead of just repeating 'try harder.' If direction is 'worse', or the answer is a flat refusal, change the approach entirely instead of repeating the same ask. If the answer gives specific real details, respond directly to those specifics instead of a generic version of the category. Pay attention not just to WHAT the user said, but HOW they said it — frustration, sarcasm, reluctant effort, genuine pride, resignation, dismissiveness, etc. Let that tone shape your wording, not just the plan's content. If the answer is frustrated, dismissive, or sounds like giving up (e.g. rejecting an approach outright), briefly acknowledge that specifically before pivoting to the challenge — don't quietly route around it like it wasn't said. If the answer shows genuine effort or real progress, name that specifically instead of defaulting to a generic plan. The challenge text and the first step's 'why' are where this tone should show up most — they should read like they were written by someone who actually heard what was said, not just extracted the topic from it." },
        { role: "user", content: `Category: ${category}\nUser's answer: ${answer}\nGrade direction: ${result.direction}` },
      ],
    });
    const parsedPlan = JSON.parse(planCompletion.choices[0]?.message?.content ?? "") as { challenge?: unknown; planSteps?: unknown };
    if (typeof parsedPlan.challenge === "string" && parsedPlan.challenge.trim() && isPlanSteps(parsedPlan.planSteps)) {
      plan = { challenge: parsedPlan.challenge.trim(), steps: parsedPlan.planSteps.map((s) => ({ step: s.step.trim(), why: s.why.trim() })) };
    }
  } catch (error) {
    logGroqError(error);
  }

  let funnyTitle = getFunnyTitle(lifeScore);
  let nextMemory: Record<string, unknown> = {
    ...(previous.continuity_memory as Record<string, unknown> ?? {}),
    activeTheme: activeTheme || "current habits",
    followUpQuestion: question,
    lastResponse: answer,
    callbackCount: Number((previous.continuity_memory as Record<string, unknown> | null)?.callbackCount ?? 0) + 1,
    resolved: false,
    updatedAt: new Date().toISOString(),
  };
  try {
    const memoryCompletion = await groq.chat.completions.create({
      model: MODEL, max_tokens: 150, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only: {\"activeTheme\":\"short current arc\",\"followUpQuestion\":\"the question asked\",\"lastResponse\":\"the user answer\",\"callbackCount\":number,\"resolved\":boolean,\"title\":\"short funny persona label, 2-4 words, reflecting the current theme and direction (improved|same|worse)\"}. Mark resolved true only if this answer shows meaningful, sustained progress; otherwise keep the same theme and increment callbackCount." },
        { role: "user", content: `Previous arc: ${JSON.stringify(previous.continuity_memory ?? {})}\nTheme: ${activeTheme}\nQuestion: ${question}\nAnswer: ${answer}\nGrade result: ${result.new_grade} (${result.direction})` },
      ],
    });
    const parsedMemory = JSON.parse(memoryCompletion.choices[0]?.message?.content ?? "") as Record<string, unknown>;
    if (typeof parsedMemory.activeTheme === "string" && typeof parsedMemory.followUpQuestion === "string" && typeof parsedMemory.lastResponse === "string" && typeof parsedMemory.callbackCount === "number" && typeof parsedMemory.resolved === "boolean") {
      nextMemory = { ...parsedMemory, updatedAt: new Date().toISOString() };
      if (typeof parsedMemory.title === "string" && parsedMemory.title.trim()) funnyTitle = parsedMemory.title.trim();
    }
  } catch (error) {
    logGroqError(error);
  }
  nextMemory.challenge = plan?.challenge ?? null;
  if (Number(nextMemory.callbackCount) >= 6) nextMemory.resolved = true;
  const priorMemory = (previous.continuity_memory as Record<string, unknown> | null) ?? {};
  const priorCovered: Category[] = Array.isArray(priorMemory.coveredCategories) ? priorMemory.coveredCategories.filter(isCategory) : [];
  const { resetCovered } = getAvailableCategories(priorCovered, priorMemory.lastAskedCategory);
  nextMemory.coveredCategories = [...resetCovered, category];
  nextMemory.lastAskedCategory = category;

  let newRoastText: string;
  try {
    const roastCompletion = await groq.chat.completions.create({
      model: MODEL, max_tokens: 150,
      messages: [
        { role: "system", content: "You are a gen z brutally honest roast comedian with zero filter. You roast people based on their exact habits and numbers. Rules: use their specific numbers, name the exact apps they mentioned, connect their bad habits to real life consequences, no sugarcoating, no encouragement. End with one devastatingly accurate one-liner. 100 words max. If the overall check-in shows improvement, stay funny but noticeably lighter and less brutal; if nothing improved or something got worse, keep it at full brutal intensity. Only cite a specific category's numeric score if it appears in \"Categories graded this check-in\" below, always as its exact was-to-now change — never invent, approximate, or reference a score for a category not listed there. The life score is a separate overall 0-100 average across all 5 categories — never present it as if it were a single category's score." },
        { role: "user", content: `Categories graded this check-in (score is 0-100 for that category only, separate from life score): ${JSON.stringify(changedCategoryScores)}\nCategory directions this check-in, all 5 (qualitative only, no numbers): ${JSON.stringify(categoryDirections)}\nOverall life score (0-100 average across all categories): was ${previousLifeScore}, now ${lifeScore} (${overallDirection})\nCheck-in answer: ${answer}\nContinuity memory: ${JSON.stringify(nextMemory)}` },
      ],
    });
    const generatedRoast = roastCompletion.choices[0]?.message?.content?.trim() ?? "";
    if (!generatedRoast) return NextResponse.json({ error: "Failed to generate check-in roast" }, { status: 502 });
    newRoastText = generatedRoast;
  } catch (error) { logGroqError(error); return NextResponse.json({ error: "Failed to generate check-in roast" }, { status: 502 }); }

  const { data: created, error: roastError } = await supabase.from("roasts").insert({
    user_id: user.id, roast_text: newRoastText, report_card: previous.report_card, week_start_date: getWeekStartDate(), model_used: MODEL, share_slug: generateShareSlug(),
    answers: previous.answers as OnboardingAnswers, life_score: lifeScore, funny_title: funnyTitle, top_5_roasts: previous.top_5_roasts ?? [], category_scores: updatedCategoryScores, suggestion_line: suggestionLine,
    tone: (previous.tone ?? "normal") as RoastTone, mode: (previous.mode ?? "roast") as RoastMode, persona: (previous.persona ?? "default") as RoastPersona, continuity_memory: nextMemory, plan_steps: plan,
  }).select("id").single();
  if (roastError || !created) return NextResponse.json({ error: "Failed to save check-in roast" }, { status: 500 });
  const { error: historyError } = await supabase.from("score_history").insert({ user_id: user.id, roast_id: created.id, life_score: lifeScore, category_grades: updatedCategoryScores });
  if (historyError) { console.error("[api/check-in] score history insert failed:", historyError.message); return NextResponse.json({ error: "Check-in saved, but score history could not be updated" }, { status: 500 }); }
  let newlyUnlockedAchievements: string[] = [];
  try {
    newlyUnlockedAchievements = (await unlockAchievements(supabase, user.id)).newlyUnlocked;
  } catch (error) {
    console.error("[api/check-in] achievement unlock failed:", error);
  }
  return NextResponse.json({ id: created.id, direction: result.direction, newlyUnlockedAchievements });
}
