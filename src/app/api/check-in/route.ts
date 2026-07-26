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
      const completion = await groq.chat.completions.create({
        model: MODEL, max_tokens: 100, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return strict JSON only: {\"category\":\"sleep|fitness|discipline|focus|spending\",\"activeTheme\":\"short current habit arc\",\"question\":\"short, specific roast-voice check-in question\",\"challenge\":\"small concrete challenge\"}. Continue the current activeTheme with a callback unless its memory says resolved; then retire it and choose a fresh theme. If continuity_memory.challenge exists, the question must directly ask about completion of that specific challenge. Rotate through exactly 4 of 5 categories (sleep, fitness, discipline, focus, spending). Never ask about spending on consecutive check-ins. Track which category was last asked via continuity_memory.lastAskedCategory and skip it this round. Choose exactly one category." },
          { role: "user", content: `Previous roast: ${previous.roast_text}\nCurrent category grades: ${JSON.stringify(categoryScores)}\nCurrent arc memory: ${JSON.stringify(previous.continuity_memory ?? {})}` },
        ],
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "") as { category?: unknown; activeTheme?: unknown; question?: unknown; challenge?: unknown };
      if (!isCategory(parsed.category) || typeof parsed.activeTheme !== "string" || typeof parsed.question !== "string" || typeof parsed.challenge !== "string" || !parsed.question.trim()) return NextResponse.json({ error: "Invalid check-in question response" }, { status: 502 });
      return NextResponse.json({ category: parsed.category, activeTheme: parsed.activeTheme.trim(), question: parsed.question.trim(), challenge: parsed.challenge.trim() });
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
        { role: "system", content: "The user is answering a daily check-in about their habits. Read their answer freely — it may mention one habit, several, or be vague. Determine which of these categories it actually relates to: sleep, fitness, discipline, focus, spending. Only include categories genuinely relevant to what they said. For each relevant category, return an updated letter grade (A/B/C/D/F) based on whether they're improving or slipping. Also write a coaching suggestion_line: 2 sentences max, acknowledge what improved, name what's still struggling, point to one concrete next step. Tone: honest coach, not a joke." },
        { role: "user", content: `Check-in answer: ${answer}\nQuestion asked: ${question}\nCurrent theme: ${activeTheme}\nCurrent category grades: ${JSON.stringify(categoryScores)}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "") as { grade_updates?: unknown; suggestion_line?: unknown };
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
  const newGradeForCategory = filteredGradeUpdates[category] ?? previousGrade;
  const result = {
    new_grade: newGradeForCategory,
    direction: (GRADE_SCORES[newGradeForCategory] > GRADE_SCORES[previousGrade] ? "improved" : GRADE_SCORES[newGradeForCategory] < GRADE_SCORES[previousGrade] ? "worse" : "same") as "improved" | "same" | "worse",
  };
  let funnyTitle = getFunnyTitle(lifeScore);
  let nextMemory: Record<string, unknown> = {
    ...(previous.continuity_memory as Record<string, unknown> ?? {}),
    activeTheme: activeTheme || "current habits",
    followUpQuestion: question,
    lastResponse: answer,
    callbackCount: Number((previous.continuity_memory as Record<string, unknown> | null)?.callbackCount ?? 0) + 1,
    resolved: false,
    challenge: (previous.continuity_memory as Record<string, unknown> | null)?.challenge ?? null,
    updatedAt: new Date().toISOString(),
  };
  try {
    const memoryCompletion = await groq.chat.completions.create({
      model: MODEL, max_tokens: 150, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only: {\"activeTheme\":\"short current arc\",\"followUpQuestion\":\"the question asked\",\"lastResponse\":\"the user answer\",\"callbackCount\":number,\"resolved\":boolean,\"challenge\":\"short concrete challenge\",\"title\":\"short funny persona label, 2-4 words, reflecting the current theme and direction (improved|same|worse)\"}. Mark resolved true only if this answer shows meaningful, sustained progress; otherwise keep the same theme and increment callbackCount." },
        { role: "user", content: `Previous arc: ${JSON.stringify(previous.continuity_memory ?? {})}\nTheme: ${activeTheme}\nQuestion: ${question}\nAnswer: ${answer}\nGrade result: ${result.new_grade} (${result.direction})` },
      ],
    });
    const parsedMemory = JSON.parse(memoryCompletion.choices[0]?.message?.content ?? "") as Record<string, unknown>;
    if (typeof parsedMemory.activeTheme === "string" && typeof parsedMemory.followUpQuestion === "string" && typeof parsedMemory.lastResponse === "string" && typeof parsedMemory.callbackCount === "number" && typeof parsedMemory.resolved === "boolean" && typeof parsedMemory.challenge === "string") {
      nextMemory = { ...parsedMemory, updatedAt: new Date().toISOString() };
      if (typeof parsedMemory.title === "string" && parsedMemory.title.trim()) funnyTitle = parsedMemory.title.trim();
    }
  } catch (error) {
    logGroqError(error);
  }
  if (Number(nextMemory.callbackCount) >= 6) nextMemory.resolved = true;
  nextMemory.lastAskedCategory = category;

  let newRoastText: string;
  try {
    const roastCompletion = await groq.chat.completions.create({
      model: MODEL, max_tokens: 150,
      messages: [
        { role: "system", content: "You are a gen z brutally honest roast comedian with zero filter. You roast people based on their exact habits and numbers. Rules: use their specific numbers, name the exact apps they mentioned, connect their bad habits to real life consequences, no sugarcoating, no encouragement. End with one devastatingly accurate one-liner. 100 words max." },
        { role: "user", content: `Current category grades: ${JSON.stringify(updatedCategoryScores)}\nCheck-in answer: ${answer}\nContinuity memory: ${JSON.stringify(nextMemory)}` },
      ],
    });
    const generatedRoast = roastCompletion.choices[0]?.message?.content?.trim() ?? "";
    if (!generatedRoast) return NextResponse.json({ error: "Failed to generate check-in roast" }, { status: 502 });
    newRoastText = generatedRoast;
  } catch (error) { logGroqError(error); return NextResponse.json({ error: "Failed to generate check-in roast" }, { status: 502 }); }

  const { data: created, error: roastError } = await supabase.from("roasts").insert({
    user_id: user.id, roast_text: newRoastText, report_card: previous.report_card, week_start_date: getWeekStartDate(), model_used: MODEL, share_slug: generateShareSlug(),
    answers: previous.answers as OnboardingAnswers, life_score: lifeScore, funny_title: funnyTitle, top_5_roasts: [suggestionLine], category_scores: updatedCategoryScores,
    tone: (previous.tone ?? "normal") as RoastTone, mode: (previous.mode ?? "roast") as RoastMode, persona: (previous.persona ?? "default") as RoastPersona, continuity_memory: nextMemory,
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
