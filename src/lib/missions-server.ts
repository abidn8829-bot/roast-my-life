import Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, ARC_CATEGORIES, ARC_CATEGORY_LABELS, buildDailySeries, type ArcCategory, type DayPoint } from "@/lib/arc-trend";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import {
  MISSION_LENGTH,
  parseMissionRow,
  repeatsPreviousStep,
  settleMission,
  templateOutcomeSummary,
  type MissionDay,
  type MissionRow,
  type MissionStatus,
} from "@/lib/missions";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import type { CategoryScores } from "@/lib/roast-types";

const MODEL = "openai/gpt-oss-120b";
const MAX_TEXT = 400;

// ---------- DB access (every write is verified; RLS gaps have silently dropped writes before) ----------

export async function getSubscriptionTier(supabase: SupabaseClient, userId: string): Promise<"pro" | "free"> {
  const { data } = await supabase.from("users").select("subscription_tier").eq("id", userId).single();
  return data?.subscription_tier === "pro" ? "pro" : "free";
}

export async function getLatestScores(supabase: SupabaseClient, userId: string): Promise<CategoryScores | null> {
  const { data, error } = await supabase
    .from("roasts")
    .select("category_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error("[missions] latest roast read failed:", error.message);
  return parseCategoryScores(data?.category_scores);
}

export async function loadActiveMission(supabase: SupabaseClient, userId: string): Promise<MissionRow | null> {
  const { data, error } = await supabase
    .from("arc_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    console.error("[missions] active mission read failed:", error.message);
    throw new Error("Failed to load mission");
  }
  return data ? parseMissionRow(data as Record<string, unknown>) : null;
}

export async function loadLatestFinishedMission(supabase: SupabaseClient, userId: string): Promise<MissionRow | null> {
  const { data, error } = await supabase
    .from("arc_missions")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error("[missions] finished mission read failed:", error.message);
  return data ? parseMissionRow(data as Record<string, unknown>) : null;
}

export async function insertMission(
  supabase: SupabaseClient,
  row: Omit<MissionRow, "id" | "created_at" | "updated_at" | "outcome_summary">,
): Promise<MissionRow> {
  const { data, error } = await supabase.from("arc_missions").insert(row).select("*").maybeSingle();
  if (error) {
    console.error("[missions] INSERT FAILED:", JSON.stringify(error));
    throw Object.assign(new Error(error.message), { code: error.code });
  }
  if (!data) {
    console.error("[missions] INSERT wrote 0 rows — check arc_missions insert/select RLS policies (021_arc_missions.sql)");
    throw new Error("Mission insert did not persist");
  }
  return parseMissionRow(data as Record<string, unknown>)!;
}

export async function updateMission(
  supabase: SupabaseClient,
  mission: MissionRow,
  patch: Partial<Pick<MissionRow, "days" | "status" | "outcome_summary">>,
): Promise<MissionRow> {
  const { data, error } = await supabase
    .from("arc_missions")
    .update(patch)
    .eq("id", mission.id)
    .eq("user_id", mission.user_id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[missions] UPDATE FAILED:", mission.id, JSON.stringify(error));
    throw new Error(error.message);
  }
  if (!data) {
    console.error("[missions] UPDATE wrote 0 rows for", mission.id, "— check arc_missions update RLS policy (021_arc_missions.sql)");
    throw new Error("Mission update did not persist");
  }
  return parseMissionRow(data as Record<string, unknown>)!;
}

// ---------- AI context ----------

function formatSeries(series: DayPoint[]): string {
  if (series.length === 0) return "(no check-ins in the last 30 days)";
  return series
    .map((p) => `${p.date}: life ${p.lifeScore} | ${ARC_CATEGORIES.map((c) => `${c} ${p.categories[c].grade}(${p.categories[c].score})`).join(" ")}`)
    .join("\n");
}

export async function buildMissionContext(supabase: SupabaseClient, userId: string, today: string) {
  const since = `${addDays(today, -30)}T00:00:00Z`;
  const [historyRes, roastsRes, missionsRes] = await Promise.all([
    supabase
      .from("score_history")
      .select("life_score, category_grades, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(300),
    supabase
      .from("roasts")
      .select("continuity_memory, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("arc_missions")
      .select("category, status, start_date, baseline_score, target_score, root_cause, outcome_summary")
      .eq("user_id", userId)
      .neq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (historyRes.error) console.error("[missions] score_history read failed:", historyRes.error.message);
  if (roastsRes.error) console.error("[missions] roasts read failed:", roastsRes.error.message);
  if (missionsRes.error) console.error("[missions] past missions read failed:", missionsRes.error.message);

  const series = buildDailySeries(
    (historyRes.data ?? []).flatMap((r) => {
      const categories = parseCategoryScores(r.category_grades);
      return categories ? [{ recordedAt: r.recorded_at as string, lifeScore: Number(r.life_score), categories }] : [];
    }),
  );

  const seen = new Set<string>();
  const answers: string[] = [];
  for (const r of roastsRes.data ?? []) {
    const memory = (r.continuity_memory as Record<string, unknown> | null) ?? {};
    const answer = typeof memory.lastResponse === "string" ? memory.lastResponse.trim() : "";
    if (!answer || seen.has(answer)) continue;
    seen.add(answer);
    const question = typeof memory.followUpQuestion === "string" ? memory.followUpQuestion : "";
    answers.push(`${String(r.created_at).split("T")[0]} — Q: ${question} A: ${answer}`);
    if (answers.length >= 7) break;
  }
  const continuityMemory = (roastsRes.data?.[0]?.continuity_memory as Record<string, unknown> | null) ?? {};

  const pastMissions = (missionsRes.data ?? []).map(
    (m) =>
      `${m.start_date} ${m.category}: ${m.status} (${Math.round(Number(m.baseline_score))} → target ${Math.round(Number(m.target_score))}). Root cause then: ${m.root_cause ?? "-"}. Outcome: ${m.outcome_summary ?? "-"}`,
  );

  return {
    historyText: formatSeries(series),
    answersText: answers.length ? answers.join("\n") : "(no recent check-in answers)",
    continuityText: JSON.stringify(continuityMemory),
    pastMissionsText: pastMissions.length ? pastMissions.join("\n") : "(no past missions)",
  };
}

// ---------- AI calls ----------

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_TEXT) : null;
}

function getGroq(): Groq | null {
  const apiKey = getGroqApiKey();
  return apiKey ? new Groq({ apiKey }) : null;
}

async function jsonCompletion(groq: Groq, system: string, user: string, maxTokens: number): Promise<Record<string, unknown> | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed: unknown = JSON.parse(completion.choices[0]?.message?.content ?? "");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch (error) {
    logGroqError(error);
    return null;
  }
}

const START_SYSTEM =
  'You are Ember\'s mission coach: blunt, specific, no fluff. You are starting a 7-day mission on ONE weak habit category. Return strict JSON only: {"root_cause":"1-2 sentences","step":"one concrete action for today","why":"one short sentence"}. root_cause explains WHY this category is weak for this specific person — the leak. You may link it to another category (e.g. "focus drops on days after late sleep") ONLY if the day-by-day history or their check-in answers actually show that pattern; if the data is thin, say what the data does show and name the most likely driver from their own words. Never invent a pattern, number, app, or detail that is not in the input. Use past missions as memory: do not reuse a step or approach that failed before; build on what worked. The day 1 step must be small, specific, doable today, and aimed straight at the root cause — no multi-day programs, no generic filler like "try harder".';

export async function generateMissionStart(
  input: { category: ArcCategory; currentScore: number; target: number; targetLabel: string } & Awaited<ReturnType<typeof buildMissionContext>>,
): Promise<{ rootCause: string; step: string; why: string } | null> {
  const groq = getGroq();
  if (!groq) return null;
  const user = `Mission category: ${ARC_CATEGORY_LABELS[input.category]}
Current ${input.category} score: ${Math.round(input.currentScore)}/100. Target in 7 days: ${input.target} (${input.targetLabel}).
Last 30 days, one line per check-in day (grade(score) per category):
${input.historyText}
Recent check-in answers:
${input.answersText}
Continuity memory: ${input.continuityText}
Past missions and outcomes:
${input.pastMissionsText}`;
  const parsed = await jsonCompletion(groq, START_SYSTEM, user, 500);
  const rootCause = clean(parsed?.root_cause);
  const step = clean(parsed?.step);
  const why = clean(parsed?.why);
  return rootCause && step && why ? { rootCause, step, why } : null;
}

const NEXT_SYSTEM =
  'You are Ember\'s mission coach: blunt, specific, no fluff. Write the next day\'s step of a 7-day mission. Return strict JSON only: {"step":"one concrete action for that day","why":"one short sentence"}. If the previous day was DONE, make the step slightly harder — the next rung of the same approach. If it was MISSED, make it easier or switch to a different approach that still attacks the same root cause. Never repeat any previous step word-for-word or near word-for-word. Keep it doable in one day. Never invent details about the user that are not in the input.';

export async function generateNextStep(mission: MissionRow, forDay: number, currentScore: number): Promise<{ step: string; why: string } | null> {
  const groq = getGroq();
  if (!groq) return null;
  const previous = mission.days.filter((d) => d.day < forDay);
  const last = previous[previous.length - 1];
  const user = `Category: ${ARC_CATEGORY_LABELS[mission.category]}
Root cause: ${mission.root_cause ?? "unknown"}
Score now ${Math.round(currentScore)}, target ${Math.round(mission.target_score)} (${mission.target_label}).
Planning day ${forDay} of ${MISSION_LENGTH}.
Previous days:
${previous.map((d) => `Day ${d.day} (${d.status.toUpperCase()}): ${d.step ?? "(no step)"}`).join("\n") || "(none)"}
Previous day result: ${last ? last.status.toUpperCase() : "none"}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = await jsonCompletion(
      groq,
      NEXT_SYSTEM,
      attempt === 0 ? user : `${user}\nYour last answer repeated an earlier step. Write a genuinely different one.`,
      350,
    );
    const step = clean(parsed?.step);
    const why = clean(parsed?.why);
    if (step && why && !repeatsPreviousStep(step, mission.days)) return { step, why };
  }
  return null;
}

async function generateOutcomeSummary(mission: MissionRow, days: MissionDay[], currentScore: number, status: MissionStatus): Promise<string> {
  const fallback = templateOutcomeSummary({ ...mission, days }, currentScore, status);
  const groq = getGroq();
  if (!groq) return fallback;
  const parsed = await jsonCompletion(
    groq,
    'Summarize a finished 7-day habit mission for the coach\'s memory. Return strict JSON only: {"outcome_summary":"max 2 sentences: what worked and what didn\'t, specific to the steps listed"}. Only use facts in the input.',
    `Category: ${mission.category}. Result: ${status}. Score ${Math.round(mission.baseline_score)} → ${Math.round(currentScore)}, target ${Math.round(mission.target_score)}.
Root cause: ${mission.root_cause ?? "-"}
${days.map((d) => `Day ${d.day} (${d.status}): ${d.step ?? "(no step)"}`).join("\n")}`,
    250,
  );
  const summary = clean(parsed?.outcome_summary);
  return summary ? `${summary} (${Math.round(mission.baseline_score)} → ${Math.round(currentScore)}, target ${Math.round(mission.target_score)})` : fallback;
}

/** Separate from check-in grading on purpose — grading never sees mission text. */
export async function detectMissionStepDone(groq: Groq, step: string, answer: string): Promise<boolean> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 150,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Return strict JSON only: {"done": boolean}. done is true ONLY if the check-in answer clearly and explicitly says the user did this specific step (or an obviously equivalent action) today. Vague, partial, planned, or unrelated answers are false.',
        },
        { role: "user", content: `Today's mission step: ${step}\nCheck-in answer: ${answer}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "") as { done?: unknown };
    return parsed.done === true;
  } catch (error) {
    logGroqError(error);
    return false;
  }
}

// ---------- Orchestration ----------

/**
 * Settles the mission up to today (auto-missed days, finish on target/day 7),
 * generates any missing step, writes the outcome summary on finish, and
 * persists once. AI failures never throw — the card falls back to the last
 * saved step and the next load retries.
 */
export async function advanceMission(
  supabase: SupabaseClient,
  mission: MissionRow,
  currentScore: number,
  today: string,
  options: { dirty?: boolean } = {},
): Promise<MissionRow> {
  const settled = settleMission(mission, currentScore, today);
  let days = settled.days;
  let dirty = Boolean(options.dirty) || settled.changed;

  if (settled.finishedStatus) {
    const outcome = await generateOutcomeSummary(mission, days, currentScore, settled.finishedStatus);
    console.log("[missions] finished", mission.id, settled.finishedStatus);
    return updateMission(supabase, mission, { days, status: settled.finishedStatus, outcome_summary: outcome });
  }

  if (settled.stepNeeded) {
    const { day, date } = settled.stepNeeded;
    const next = await generateNextStep({ ...mission, days }, day, currentScore);
    if (next) {
      const existing = days.find((d) => d.day === day);
      days = existing
        ? days.map((d) => (d.day === day ? { ...d, step: next.step, why: next.why } : d))
        : [...days, { day, date, step: next.step, why: next.why, status: "pending" as const }].sort((a, b) => a.day - b.day);
      dirty = true;
    } else {
      console.error("[missions] step generation failed for", mission.id, "day", day, "— showing last saved step");
    }
  }

  return dirty ? updateMission(supabase, mission, { days }) : mission;
}

/**
 * Called by /api/check-in AFTER the roast + score_history are saved (Pro only).
 * If the answer clearly says today's step was done, marks it done. Never marks
 * missed — the Done/Missed buttons stay the source of truth. The next Arc load
 * generates tomorrow's step (and finishes the mission if the target was hit).
 */
export async function applyCheckInToMission(supabase: SupabaseClient, groq: Groq, userId: string, answer: string, today: string): Promise<void> {
  const mission = await loadActiveMission(supabase, userId);
  if (!mission) return;
  const entry = mission.days.find((d) => d.date === today && d.status === "pending" && d.step);
  if (!entry?.step) return;
  if (!(await detectMissionStepDone(groq, entry.step, answer))) return;
  await updateMission(supabase, mission, {
    days: mission.days.map((d) => (d.day === entry.day ? { ...d, status: "done" as const } : d)),
  });
  console.log("[missions] check-in marked day", entry.day, "done for", mission.id);
}
