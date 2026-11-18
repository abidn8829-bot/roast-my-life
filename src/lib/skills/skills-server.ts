// Server layer for "learn a skill": reads content and reads/writes a user's progress with the SERVICE-ROLE client.
// No routes, no pages, no UI. The caller (a later step) verifies the session and passes the verified user id.
//
// Rules this file keeps (the same ones as src/lib/roast-insert.ts and recordFlag in safety-server.ts):
//   * The client is a parameter, so tests pass a fake. Nothing here imports "server-only" or "@/" paths
//     (src/lib/skills/*.test.ts load these files directly with Node).
//   * Every write is read back with .select(...). An error, no row, more than one row, or a row that does not
//     hold what was sent is an error. A write is never reported as saved on trust.
//   * Only a short error code is ever logged or returned: "[skills-server] <function> error code=<code>".
//     Never a note, a question, an answer, or a database message (Postgres "details" can echo them).
//   * Content reads name their columns. The correct answer and the explanation are selected only by the
//     functions that grade, and are returned only as described on each function.
//   * Every function that touches a month asks canOpenMonth with the tier the CALLER passes in. A locked month
//     returns { locked: true, month, teaser } and nothing else. A month counts as free only when BOTH the code
//     rule (isFreeMonth) and the is_free column in the database say so.
//   * No text in here may say "missed" or "failed" (wording.test.ts checks every string in this folder).
//
// Results: { data } on success, { locked: true, month, teaser } for a locked month, { error: { code } } on an
// error. The two weekly-test functions can also return { notReady: true } (not an error, no content).
//
// There is NO transaction across tables (supabase-js cannot do one). recordProve therefore writes in a fixed
// order, each write idempotent, so a retry after an error is safe. See recordProve.

import type { SupabaseClient } from "@supabase/supabase-js";
import { canOpenMonth, isFreeMonth } from "./access.ts";
import { WEEKLY_TEST_SIZE, gradeWeeklyTest, isCorrect } from "./grade.ts";
import { applyReview, buildReviewQueue, newReviewItem, nextNewStep } from "./schedule.ts";
import type { ReviewItem, ReviewStage, Tier, WeeklyAnswer } from "./types.ts";

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type LockedResult = { locked: true; month: number; teaser: string | null };
export type NotReadyResult = { notReady: true };
export type ErrorResult = { error: { code: string } };
export type SkillResult<T> = { data: T } | LockedResult | ErrorResult;
export type WeeklyResult<T> = SkillResult<T> | NotReadyResult;

/** The limit of the notebook (the database allows 1 to 600 characters). */
export const NOTEBOOK_MAX_CHARS = 600;
/** A week has five steps (day_no 1 to 5). */
export const STEPS_PER_WEEK = 5;
/** The second wrong answer to a step shows its explanation. */
export const WRONG_ATTEMPTS_BEFORE_EXPLANATION = 2;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Query = PromiseLike<{ data: unknown; error: unknown }>;

/** Thrown inside a function to end it with an error code. `log` is false for plain bad input from the caller. */
class Stop extends Error {
  code: string;
  log: boolean;
  constructor(code: string, log = true) {
    super(code);
    this.code = code;
    this.log = log;
  }
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_.:-]{1,20}$/.test(code) ? code : "unknown";
}

/** Runs one function body. Any error becomes { error: { code } }; only the function name and the code are logged. */
async function guard<T>(fn: string, body: () => Promise<T>): Promise<T | ErrorResult> {
  try {
    return await body();
  } catch (e) {
    const code = e instanceof Stop ? e.code : "exception";
    if (!(e instanceof Stop) || e.log) console.error(`[skills-server] ${fn} error code=${code}`);
    return { error: { code } };
  }
}

const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const iso = (ms: number) => new Date(ms).toISOString();
const sameTime = (a: unknown, ms: number) => typeof a === "string" && Date.parse(a) === ms;

function needUser(userId: unknown): asserts userId is string {
  if (!isId(userId)) throw new Stop("no-user", false);
}
function needId(value: unknown, code: string): asserts value is string {
  if (!isId(value)) throw new Stop(code, false);
}

/** A read: any error is a Stop with the short code; no data is an empty list. */
async function read(q: Query): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Stop(errorCode(error));
  return Array.isArray(data) ? data.filter(isRow) : [];
}

/** A write that must come back as exactly ONE row (the row is returned so the caller can compare it). */
async function writeOne(q: Query): Promise<Row> {
  const { data, error } = await q;
  if (error) throw new Stop(errorCode(error));
  if (!Array.isArray(data) || data.length !== 1 || !isRow(data[0])) throw new Stop("no-row");
  return data[0];
}

/** The read-back must hold what was sent; anything else is an error. */
function mustMatch(ok: boolean): void {
  if (!ok) throw new Stop("mismatch");
}

function asOptions(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5 || !value.every((o) => typeof o === "string")) {
    throw new Stop("bad-content");
  }
  return value as string[];
}

function asString(value: unknown): string {
  if (typeof value !== "string") throw new Stop("bad-content");
  return value;
}

function asNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Stop("bad-content");
  return value;
}

/** The one published pack, or the named one (which must be published). */
async function pickPack(client: SupabaseClient, packId?: string): Promise<string> {
  let q = client.from("skill_packs").select("id").eq("is_published", true);
  if (packId !== undefined) {
    needId(packId, "no-pack");
    q = q.eq("id", packId);
  }
  const rows = await read(q);
  if (rows.length === 0) throw new Stop("no-pack");
  if (rows.length > 1) throw new Stop("ambiguous-pack");
  return asString(rows[0]!.id);
}

type MonthRow = { monthNo: number; title: string | null; teaser: string | null; isFree: boolean };

function toMonth(row: Row): MonthRow {
  return {
    monthNo: asNumber(row.month_no),
    title: typeof row.title === "string" ? row.title : null,
    teaser: typeof row.teaser_line === "string" ? row.teaser_line : null,
    // Free only when the database AND the code rule agree. If they ever differ, the month stays locked.
    isFree: row.is_free === true && isFreeMonth(asNumber(row.month_no)),
  };
}

const MONTH_COLS = "month_no, title, teaser_line, is_free";

async function loadMonth(client: SupabaseClient, packId: string, monthNo: number): Promise<MonthRow> {
  const rows = await read(client.from("skill_months").select(MONTH_COLS).eq("pack_id", packId).eq("month_no", monthNo));
  if (rows.length !== 1) throw new Stop("no-month");
  return toMonth(rows[0]!);
}

const isOpen = (m: MonthRow, tier: Tier) => canOpenMonth({ monthIsFree: m.isFree, tier }) === "open";
const lockedResult = (m: MonthRow): LockedResult => ({ locked: true, month: m.monthNo, teaser: m.teaser });

type StepContext = { step: Row; packId: string; weekId: string; weekNo: number; month: MonthRow };

/** A step, its week and its month, and whether the caller's tier may open that month. */
async function resolveStep(
  client: SupabaseClient,
  stepId: string,
  stepColumns: string,
  tier: Tier,
): Promise<StepContext | LockedResult> {
  const steps = await read(client.from("skill_steps").select(stepColumns).eq("id", stepId));
  if (steps.length !== 1) throw new Stop("no-step", false);
  const step = steps[0]!;
  const weekId = asString(step.week_id);
  const weeks = await read(client.from("skill_weeks").select("id, pack_id, month_no, week_no").eq("id", weekId));
  if (weeks.length !== 1) throw new Stop("no-week");
  const week = weeks[0]!;
  const packId = asString(week.pack_id);
  const month = await loadMonth(client, packId, asNumber(week.month_no));
  if (!isOpen(month, tier)) return lockedResult(month);
  return { step, packId, weekId, weekNo: asNumber(week.week_no), month };
}

type OrderedStep = { stepId: string; weekId: string; weekNo: number; monthNo: number; dayNo: number };

/** Every step of a pack in learning order (week, then day). */
async function loadPackOrder(client: SupabaseClient, packId: string): Promise<OrderedStep[]> {
  const weeks = await read(
    client.from("skill_weeks").select("id, month_no, week_no").eq("pack_id", packId).order("week_no", { ascending: true }),
  );
  if (weeks.length === 0) return [];
  const byWeek = new Map(weeks.map((w) => [asString(w.id), w]));
  const steps = await read(client.from("skill_steps").select("id, week_id, day_no").in("week_id", [...byWeek.keys()]));
  const ordered: OrderedStep[] = [];
  for (const s of steps) {
    const w = byWeek.get(asString(s.week_id));
    if (!w) continue;
    ordered.push({
      stepId: asString(s.id),
      weekId: asString(s.week_id),
      weekNo: asNumber(w.week_no),
      monthNo: asNumber(w.month_no),
      dayNo: asNumber(s.day_no),
    });
  }
  return ordered.sort((a, b) => a.weekNo - b.weekNo || a.dayNo - b.dayNo);
}

/** The ids of every step this user has completed (completed_at is set). */
async function loadCompleted(client: SupabaseClient, userId: string): Promise<Set<string>> {
  const rows = await read(
    client.from("skill_step_progress").select("step_id").eq("user_id", userId).not("completed_at", "is", null),
  );
  return new Set(rows.map((r) => asString(r.step_id)));
}

/** When the user's last new step was completed (epoch ms), or null. */
async function loadLastNewStepAt(client: SupabaseClient, userId: string, packId: string): Promise<number | null> {
  const rows = await read(
    client.from("skill_enrollments").select("last_new_step_at").eq("user_id", userId).eq("pack_id", packId),
  );
  const v = rows[0]?.last_new_step_at;
  const ms = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/** True only when the week has all five steps and this user has completed every one of them. */
async function weekIsComplete(client: SupabaseClient, userId: string, weekId: string): Promise<boolean> {
  const steps = await read(client.from("skill_steps").select("id").eq("week_id", weekId));
  if (steps.length !== STEPS_PER_WEEK) return false;
  const ids = steps.map((s) => asString(s.id));
  const done = await read(
    client.from("skill_step_progress").select("step_id").eq("user_id", userId).in("step_id", ids).not("completed_at", "is", null),
  );
  const doneIds = new Set(done.map((r) => asString(r.step_id)));
  return ids.every((id) => doneIds.has(id));
}

type WeekContext = { packId: string; weekNo: number; title: string | null; month: MonthRow };

async function resolveWeek(client: SupabaseClient, weekId: string, tier: Tier): Promise<WeekContext | LockedResult> {
  const weeks = await read(client.from("skill_weeks").select("id, pack_id, month_no, week_no, title").eq("id", weekId));
  if (weeks.length !== 1) throw new Stop("no-week", false);
  const w = weeks[0]!;
  const packId = asString(w.pack_id);
  const month = await loadMonth(client, packId, asNumber(w.month_no));
  if (!isOpen(month, tier)) return lockedResult(month);
  return { packId, weekNo: asNumber(w.week_no), title: typeof w.title === "string" ? w.title : null, month };
}

/** The five test questions of a week: for each day 1 to 5, the item with the lowest position. */
function pickTestItems(rows: Row[]): Row[] {
  const byDay = new Map<number, Row>();
  for (const r of [...rows].sort((a, b) => asNumber(a.position) - asNumber(b.position))) {
    const day = asNumber(r.covers_day);
    if (!byDay.has(day)) byDay.set(day, r);
  }
  const picked: Row[] = [];
  for (let day = 1; day <= WEEKLY_TEST_SIZE; day++) {
    const item = byDay.get(day);
    if (!item) throw new Stop("no-test");
    picked.push(item);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// getPackMap
// ---------------------------------------------------------------------------

export type PackMapMonth =
  | { month: number; title: string | null; teaser: string | null; locked: true }
  | {
      month: number;
      title: string | null;
      teaser: string | null;
      locked: false;
      weeks: Array<{ weekId: string; weekNo: number; title: string; goalLine: string }>;
    };

/**
 * The map of a pack: months 1 to 6 with titles.
 * A LOCKED month returns only { month, title, teaser, locked: true }. Weeks are queried only for open months, so
 * the content of a locked month never leaves the database. Steps and handouts are never returned here.
 */
export async function getPackMap(
  client: SupabaseClient,
  tier: Tier,
  opts: { packId?: string } = {},
): Promise<SkillResult<{ packId: string; months: PackMapMonth[] }>> {
  return guard("getPackMap", async () => {
    const packId = await pickPack(client, opts.packId);
    const monthRows = await read(
      client.from("skill_months").select(MONTH_COLS).eq("pack_id", packId).order("month_no", { ascending: true }),
    );
    const months = monthRows.map(toMonth).filter((m) => m.monthNo >= 1 && m.monthNo <= 6);
    const openNumbers = months.filter((m) => isOpen(m, tier)).map((m) => m.monthNo);
    const weeks = openNumbers.length
      ? await read(
          client
            .from("skill_weeks")
            .select("id, month_no, week_no, title, goal_line")
            .eq("pack_id", packId)
            .in("month_no", openNumbers)
            .order("week_no", { ascending: true }),
        )
      : [];
    const out: PackMapMonth[] = months.map((m) => {
      if (!openNumbers.includes(m.monthNo)) return { month: m.monthNo, title: m.title, teaser: m.teaser, locked: true };
      return {
        month: m.monthNo,
        title: m.title,
        teaser: m.teaser,
        locked: false,
        weeks: weeks
          .filter((w) => w.month_no === m.monthNo)
          .map((w) => ({
            weekId: asString(w.id),
            weekNo: asNumber(w.week_no),
            title: asString(w.title),
            goalLine: asString(w.goal_line),
          })),
      };
    });
    return { data: { packId, months: out } };
  });
}

// ---------------------------------------------------------------------------
// getTodayStep
// ---------------------------------------------------------------------------

export type TodayStep =
  | { done: true }
  | { open: false; opensAt: string | null }
  | {
      open: true;
      stepId: string;
      month: number;
      weekNo: number;
      dayNo: number;
      learn_title: string;
      learn_body: string;
      fact_line: string;
      source: { title: string; year: number | null };
      do_prompt: string;
      prove_question: string;
      prove_options: string[];
      hint: string;
    };

// NOTE: no prove_correct and no prove_explanation in this list, on purpose.
const STEP_PUBLIC_COLUMNS =
  "id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt, prove_question, prove_options, hint";

/**
 * The next step for this user: the first step they have not completed, in learning order, once the 20-hour wait
 * (schedule.ts) is over. A long gap changes nothing: they get the SAME next step.
 * NEVER returns the correct answer or the explanation: they are not even selected from the database here.
 */
export async function getTodayStep(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  opts: { packId?: string; now?: number } = {},
): Promise<SkillResult<TodayStep>> {
  return guard("getTodayStep", async () => {
    needUser(userId);
    const now = opts.now ?? Date.now();
    const packId = await pickPack(client, opts.packId);
    const order = await loadPackOrder(client, packId);
    if (order.length === 0) throw new Stop("no-content");
    const completed = await loadCompleted(client, userId);
    const index = order.findIndex((s) => !completed.has(s.stepId));
    if (index === -1) return { data: { done: true } };
    const target = order[index]!;

    const month = await loadMonth(client, packId, target.monthNo);
    if (!isOpen(month, tier)) return lockedResult(month);

    const next = nextNewStep(index, await loadLastNewStepAt(client, userId, packId), now);
    if (!next.open) return { data: { open: false, opensAt: next.opensAt === null ? null : iso(next.opensAt) } };

    const steps = await read(client.from("skill_steps").select(STEP_PUBLIC_COLUMNS).eq("id", target.stepId));
    if (steps.length !== 1) throw new Stop("no-step");
    const s = steps[0]!;
    const sources = await read(client.from("skill_sources").select("title, year").eq("id", asString(s.source_id)));
    if (sources.length !== 1) throw new Stop("no-source");
    const src = sources[0]!;

    // Built field by field (never spread from the row), so nothing extra can ever slip through.
    return {
      data: {
        open: true,
        stepId: target.stepId,
        month: target.monthNo,
        weekNo: target.weekNo,
        dayNo: target.dayNo,
        learn_title: asString(s.learn_title),
        learn_body: asString(s.learn_body),
        fact_line: asString(s.fact_line),
        source: { title: asString(src.title), year: typeof src.year === "number" ? src.year : null },
        do_prompt: asString(s.do_prompt),
        prove_question: asString(s.prove_question),
        prove_options: asOptions(s.prove_options),
        hint: asString(s.hint),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// recordProve
// ---------------------------------------------------------------------------

export type ProveOutcome = {
  correct: boolean;
  /** True when the step was already completed earlier: nothing was written. */
  alreadyDone: boolean;
  /** Answers given so far (wrong ones plus the right one). */
  attempts: number;
  /** Only after a correct answer, or from the 2nd wrong answer on. Otherwise null. */
  explanation: string | null;
};

const STEP_GRADING_COLUMNS = "id, week_id, day_no, prove_options, prove_correct, prove_explanation";

/**
 * Grades one answer to a step's question and saves it.
 *
 * Only the user's CURRENT step can be answered (the first one not completed, and only once its 20-hour wait is
 * over); a step already completed writes nothing and returns alreadyDone. Bad input (an index that is not a whole
 * number inside the options) writes nothing and counts as no attempt.
 *
 * Wrong: skill_step_progress gets attempts + 1 (one write, verified).
 * Right: three writes, each verified by reading it back, in this order:
 *   1. the review item (stage 0, due after the first interval)      skill_review_items
 *   2. the step as completed (attempts, correct, completed_at)      skill_step_progress
 *   3. last_new_step_at on the enrollment (starts the 20-hour wait) skill_enrollments (row created if missing)
 * There is no transaction, so the order is chosen to be safe: every write is an upsert, an error before step 2
 * leaves the step open so the same answer can simply be sent again, and an error at step 3 can at worst skip the
 * 20-hour wait once. It can never lengthen it. Nothing is ever counted against the user.
 */
export async function recordProve(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  stepId: string,
  chosenIndex: number,
  opts: { now?: number } = {},
): Promise<SkillResult<ProveOutcome>> {
  return guard("recordProve", async () => {
    needUser(userId);
    needId(stepId, "no-step");
    const now = opts.now ?? Date.now();

    const ctx = await resolveStep(client, stepId, STEP_GRADING_COLUMNS, tier);
    if ("locked" in ctx) return ctx;
    const options = asOptions(ctx.step.prove_options);
    if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= options.length) {
      throw new Stop("bad-answer", false);
    }
    const correctIndex = asNumber(ctx.step.prove_correct);
    const explanation = asString(ctx.step.prove_explanation);

    const order = await loadPackOrder(client, ctx.packId);
    const completed = await loadCompleted(client, userId);
    const position = order.findIndex((s) => s.stepId === stepId);
    if (position === -1) throw new Stop("no-step");
    if (completed.has(stepId)) {
      return { data: { correct: true, alreadyDone: true, attempts: 0, explanation } };
    }
    const current = order.findIndex((s) => !completed.has(s.stepId));
    if (position !== current) throw new Stop("not-current", false);
    const next = nextNewStep(current, await loadLastNewStepAt(client, userId, ctx.packId), now);
    if (!next.open) throw new Stop("not-open", false);

    const before = await read(
      client.from("skill_step_progress").select("prove_attempts").eq("user_id", userId).eq("step_id", stepId),
    );
    const attempts = (typeof before[0]?.prove_attempts === "number" ? before[0].prove_attempts : 0) + 1;
    const correct = isCorrect(chosenIndex, correctIndex);

    if (!correct) {
      const row = await writeOne(
        client
          .from("skill_step_progress")
          .upsert({ user_id: userId, step_id: stepId, prove_attempts: attempts, prove_correct: false }, { onConflict: "user_id,step_id" })
          .select("step_id, prove_attempts, prove_correct, completed_at"),
      );
      mustMatch(row.step_id === stepId && row.prove_attempts === attempts && row.prove_correct === false && row.completed_at == null);
      return {
        data: {
          correct: false,
          alreadyDone: false,
          attempts,
          explanation: attempts >= WRONG_ATTEMPTS_BEFORE_EXPLANATION ? explanation : null,
        },
      };
    }

    // 1. the review item
    const item = newReviewItem(stepId, ctx.month.monthNo, now);
    const review = await writeOne(
      client
        .from("skill_review_items")
        .upsert(
          { user_id: userId, step_id: stepId, stage: item.stage, due_at: iso(item.dueAt), last_correct: true, retired: false },
          { onConflict: "user_id,step_id" },
        )
        .select("step_id, stage, due_at, last_correct, retired"),
    );
    mustMatch(
      review.step_id === stepId && review.stage === item.stage && sameTime(review.due_at, item.dueAt) && review.last_correct === true && review.retired === false,
    );

    // 2. the step is completed
    const progress = await writeOne(
      client
        .from("skill_step_progress")
        .upsert(
          { user_id: userId, step_id: stepId, prove_attempts: attempts, prove_correct: true, completed_at: iso(now) },
          { onConflict: "user_id,step_id" },
        )
        .select("step_id, prove_attempts, prove_correct, completed_at"),
    );
    mustMatch(progress.step_id === stepId && progress.prove_attempts === attempts && progress.prove_correct === true && sameTime(progress.completed_at, now));

    // 3. the 20-hour wait starts. started_at is not in the payload, so an existing enrollment keeps it.
    const enrollment = await writeOne(
      client
        .from("skill_enrollments")
        .upsert({ user_id: userId, pack_id: ctx.packId, last_new_step_at: iso(now) }, { onConflict: "user_id,pack_id" })
        .select("pack_id, last_new_step_at"),
    );
    mustMatch(enrollment.pack_id === ctx.packId && sameTime(enrollment.last_new_step_at, now));

    return { data: { correct: true, alreadyDone: false, attempts, explanation } };
  });
}

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

/** Characters as Postgres counts them (code points), not UTF-16 units. */
const charLength = (s: string) => Array.from(s).length;

/**
 * Saves (or replaces) the user's one note for a step. The note is clipped to 600 characters, written with an
 * upsert on (user_id, step_id), and updated_at is set HERE (the table has no trigger). It is then read back and
 * the returned note must be the same length as the one sent. The note text is never logged and never returned.
 *
 * IMPORTANT: call this ONLY AFTER the safety check has passed: gentleGate, ruleFloorLevel and runSafetyClassify.
 * A note is free text from the user, so the API route (a later step) must run those checks first and must NOT
 * call this function when any of them flags the text. This file deliberately does not run them. It only saves.
 */
export async function saveNotebookEntry(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  stepId: string,
  body: string,
  opts: { now?: number } = {},
): Promise<SkillResult<{ id: string; updatedAt: string }>> {
  return guard("saveNotebookEntry", async () => {
    needUser(userId);
    needId(stepId, "no-step");
    if (typeof body !== "string") throw new Stop("empty-body", false);
    const clipped = Array.from(body).slice(0, NOTEBOOK_MAX_CHARS).join("");
    if (clipped.trim() === "") throw new Stop("empty-body", false);
    const now = opts.now ?? Date.now();

    const ctx = await resolveStep(client, stepId, "id, week_id", tier);
    if ("locked" in ctx) return ctx;

    const row = await writeOne(
      client
        .from("skill_notebook_entries")
        .upsert({ user_id: userId, step_id: stepId, body: clipped, updated_at: iso(now) }, { onConflict: "user_id,step_id" })
        .select("id, step_id, body, updated_at"),
    );
    mustMatch(
      isId(row.id) &&
        row.step_id === stepId &&
        typeof row.body === "string" &&
        charLength(row.body) === charLength(clipped) &&
        sameTime(row.updated_at, now),
    );
    return { data: { id: row.id as string, updatedAt: iso(now) } };
  });
}

/**
 * Deletes one of the user's own notes. The delete is limited to this id AND this user, and must come back with
 * exactly one row (the deleted id). Deleting needs no month check: a user can always remove their own note.
 */
export async function deleteNotebookEntry(
  client: SupabaseClient,
  userId: string,
  entryId: string,
): Promise<SkillResult<{ id: string }>> {
  return guard("deleteNotebookEntry", async () => {
    needUser(userId);
    needId(entryId, "no-entry");
    const row = await writeOne(
      client.from("skill_notebook_entries").delete().eq("id", entryId).eq("user_id", userId).select("id"),
    );
    mustMatch(row.id === entryId);
    return { data: { id: entryId } };
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type DueReview = {
  stepId: string;
  month: number;
  stage: ReviewStage;
  dueAt: string;
  learn_title: string;
  prove_question: string;
  prove_options: string[];
};

const isStage = (v: unknown): v is ReviewStage => v === 0 || v === 1 || v === 2 || v === 3;

/**
 * The reviews due now, oldest first. Free users do not get items from locked months (they stay stored). Each item
 * carries the question and its options, never the correct answer.
 */
export async function getDueReviews(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  now: number,
): Promise<SkillResult<{ items: DueReview[] }>> {
  return guard("getDueReviews", async () => {
    needUser(userId);
    if (!Number.isFinite(now)) throw new Stop("bad-time", false);
    const due = await read(
      client
        .from("skill_review_items")
        .select("step_id, stage, due_at")
        .eq("user_id", userId)
        .eq("retired", false)
        .lte("due_at", iso(now))
        .order("due_at", { ascending: true }),
    );
    if (due.length === 0) return { data: { items: [] } };

    const stepIds = due.map((r) => asString(r.step_id));
    const steps = await read(client.from("skill_steps").select("id, week_id").in("id", stepIds));
    const weekIds = [...new Set(steps.map((s) => asString(s.week_id)))];
    const weeks = weekIds.length ? await read(client.from("skill_weeks").select("id, pack_id, month_no").in("id", weekIds)) : [];
    const packIds = [...new Set(weeks.map((w) => asString(w.pack_id)))];
    const monthRows = packIds.length ? await read(client.from("skill_months").select("pack_id, " + MONTH_COLS).in("pack_id", packIds)) : [];

    const weekOf = new Map(weeks.map((w) => [asString(w.id), w]));
    const stepWeek = new Map(steps.map((s) => [asString(s.id), asString(s.week_id)]));
    const monthOf = new Map(monthRows.map((m) => [`${asString(m.pack_id)}:${asNumber(m.month_no)}`, toMonth(m)]));

    const items: ReviewItem[] = [];
    for (const r of due) {
      const week = weekOf.get(stepWeek.get(asString(r.step_id)) ?? "");
      const dueAt = typeof r.due_at === "string" ? Date.parse(r.due_at) : NaN;
      if (!week || !isStage(r.stage) || !Number.isFinite(dueAt)) continue;
      const month = monthOf.get(`${asString(week.pack_id)}:${asNumber(week.month_no)}`);
      if (!month || !isOpen(month, tier)) continue;
      items.push({ id: asString(r.step_id), month: month.monthNo, stage: r.stage, dueAt });
    }
    const queue = buildReviewQueue(items, tier, now);
    if (queue.length === 0) return { data: { items: [] } };

    const content = await read(
      client.from("skill_steps").select("id, learn_title, prove_question, prove_options").in("id", queue.map((q) => q.id)),
    );
    const contentOf = new Map(content.map((c) => [asString(c.id), c]));
    const out: DueReview[] = [];
    for (const q of queue) {
      const c = contentOf.get(q.id);
      if (!c) continue;
      out.push({
        stepId: q.id,
        month: q.month,
        stage: q.stage,
        dueAt: iso(q.dueAt),
        learn_title: asString(c.learn_title),
        prove_question: asString(c.prove_question),
        prove_options: asOptions(c.prove_options),
      });
    }
    return { data: { items: out } };
  });
}

export type ReviewAnswerOutcome = {
  correct: boolean;
  retired: boolean;
  stage: ReviewStage;
  /** When it is due again (ISO), or null when the item is retired. */
  dueAt: string | null;
  /** Shown after the answer is saved, right or wrong: this is revision, the answer is already recorded. */
  explanation: string;
};

/**
 * Answers one due review and saves where the item goes next (schedule.ts applyReview): right moves it up a stage
 * (retired after the last), wrong sends it back to stage 0. One update limited to this user and step; it must
 * come back as exactly one row holding the new stage, due time, last_correct and retired flag.
 */
export async function answerReview(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  stepId: string,
  chosenIndex: number,
  now: number,
): Promise<SkillResult<ReviewAnswerOutcome>> {
  return guard("answerReview", async () => {
    needUser(userId);
    needId(stepId, "no-step");
    if (!Number.isFinite(now)) throw new Stop("bad-time", false);

    const ctx = await resolveStep(client, stepId, STEP_GRADING_COLUMNS, tier);
    if ("locked" in ctx) return ctx;
    const options = asOptions(ctx.step.prove_options);
    if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= options.length) {
      throw new Stop("bad-answer", false);
    }

    const items = await read(
      client.from("skill_review_items").select("stage, due_at, retired").eq("user_id", userId).eq("step_id", stepId),
    );
    if (items.length !== 1) throw new Stop("no-review", false);
    const item = items[0]!;
    if (item.retired === true) throw new Stop("retired", false);
    if (!isStage(item.stage)) throw new Stop("bad-content");
    const dueAt = typeof item.due_at === "string" ? Date.parse(item.due_at) : NaN;
    if (!Number.isFinite(dueAt)) throw new Stop("bad-content");
    if (dueAt > now) throw new Stop("not-due", false);

    const correct = isCorrect(chosenIndex, asNumber(ctx.step.prove_correct));
    const outcome = applyReview(item.stage, correct, now);
    const payload = outcome.retired
      ? { last_correct: true, retired: true }
      : { stage: outcome.stage, due_at: iso(outcome.dueAt), last_correct: correct, retired: false };

    const row = await writeOne(
      client
        .from("skill_review_items")
        .update(payload)
        .eq("user_id", userId)
        .eq("step_id", stepId)
        .select("step_id, stage, due_at, last_correct, retired"),
    );
    mustMatch(
      row.step_id === stepId &&
        row.last_correct === payload.last_correct &&
        row.retired === payload.retired &&
        (outcome.retired || (row.stage === outcome.stage && sameTime(row.due_at, outcome.dueAt))),
    );
    return {
      data: {
        correct,
        retired: outcome.retired,
        stage: outcome.retired ? item.stage : outcome.stage,
        dueAt: outcome.retired ? null : iso(outcome.dueAt),
        explanation: asString(ctx.step.prove_explanation),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Weekly test
// ---------------------------------------------------------------------------

export type WeeklyTest = {
  weekId: string;
  weekNo: number;
  title: string | null;
  /** One question per day 1 to 5, in day order. No correct answer and no explanation. */
  questions: Array<{ itemId: string; day: number; question: string; options: string[] }>;
};

/**
 * The weekly test: one question for each of the 5 days (the item with the lowest position for that day).
 * Returns { notReady: true } and nothing else until the user has completed all 5 steps of the week. A locked
 * month is checked first and returns { locked, month, teaser }. The correct answers are never selected here.
 */
export async function getWeeklyTest(
  client: SupabaseClient,
  userId: string,
  weekId: string,
  tier: Tier,
): Promise<WeeklyResult<WeeklyTest>> {
  return guard("getWeeklyTest", async () => {
    needUser(userId);
    needId(weekId, "no-week");
    const ctx = await resolveWeek(client, weekId, tier);
    if ("locked" in ctx) return ctx;
    if (!(await weekIsComplete(client, userId, weekId))) return { notReady: true } as const;

    const rows = await read(
      client.from("skill_test_items").select("id, position, covers_day, question, options").eq("week_id", weekId),
    );
    const items = pickTestItems(rows);
    return {
      data: {
        weekId,
        weekNo: ctx.weekNo,
        title: ctx.title,
        questions: items.map((r) => ({
          itemId: asString(r.id),
          day: asNumber(r.covers_day),
          question: asString(r.question),
          options: asOptions(r.options),
        })),
      },
    };
  });
}

export type TestAnswer = { itemId: string; chosenIndex: number };
export type SavedTestResult = { id: string; score: number; total: number; passed: boolean; weakDays: number[] };

const sameNumbers = (a: unknown, b: number[]) =>
  Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Grades the weekly test (grade.ts gradeWeeklyTest) and saves ONE result row.
 *
 * Refuses unless exactly WEEKLY_TEST_SIZE answers are given (checked before the database is touched), each for a
 * different question of this week's test. The correct answers come from the database, never from the caller.
 * Like getWeeklyTest it returns { notReady: true } until all 5 steps of the week are completed, and a locked
 * month returns { locked, month, teaser }. One insert, never retried, read back: the row must come back as
 * exactly one row holding the same score, total, passed and weak days. Returns the result only, no answers.
 */
export async function saveTestResult(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  weekId: string,
  answers: readonly TestAnswer[],
  opts: { now?: number } = {},
): Promise<WeeklyResult<SavedTestResult>> {
  return guard("saveTestResult", async () => {
    needUser(userId);
    needId(weekId, "no-week");
    if (!Array.isArray(answers) || answers.length !== WEEKLY_TEST_SIZE) throw new Stop("answer-count", false);
    const seen = new Set<string>();
    for (const a of answers) {
      if (!isRow(a) || !isId(a.itemId) || !Number.isInteger(a.chosenIndex) || seen.has(a.itemId)) {
        throw new Stop("bad-answer", false);
      }
      seen.add(a.itemId);
    }
    const now = opts.now ?? Date.now();

    const ctx = await resolveWeek(client, weekId, tier);
    if ("locked" in ctx) return ctx;
    if (!(await weekIsComplete(client, userId, weekId))) return { notReady: true } as const;

    const rows = await read(
      client
        .from("skill_test_items")
        .select("id, position, covers_day, options, correct")
        .eq("week_id", weekId),
    );
    const items = pickTestItems(rows);
    const byId = new Map(items.map((r) => [asString(r.id), r]));
    const graded: WeeklyAnswer[] = [];
    for (const a of answers) {
      const item = byId.get(a.itemId);
      if (!item) throw new Stop("bad-answer", false);
      const optionCount = asOptions(item.options).length;
      if (a.chosenIndex < 0 || a.chosenIndex >= optionCount) throw new Stop("bad-answer", false);
      graded.push({ day: asNumber(item.covers_day), chosenIndex: a.chosenIndex, correctIndex: asNumber(item.correct) });
    }
    const result = gradeWeeklyTest(graded);
    if (result.total !== WEEKLY_TEST_SIZE) throw new Stop("bad-answer", false);

    const row = await writeOne(
      client
        .from("skill_test_results")
        .insert({
          user_id: userId,
          week_id: weekId,
          score: result.score,
          total: result.total,
          passed: result.passed,
          weak_days: result.weakDays,
          taken_at: iso(now),
        })
        .select("id, week_id, score, total, passed, weak_days"),
    );
    mustMatch(
      isId(row.id) &&
        row.week_id === weekId &&
        row.score === result.score &&
        row.total === result.total &&
        row.passed === result.passed &&
        sameNumbers(row.weak_days, result.weakDays),
    );
    return {
      data: { id: row.id as string, score: result.score, total: result.total, passed: result.passed, weakDays: result.weakDays },
    };
  });
}

// ---------------------------------------------------------------------------
// getHome and getHandout (READ ONLY: pages for the skills home, the pack map and the weekly handout)
// ---------------------------------------------------------------------------

export type HomeNext =
  | { done: true }
  /** The next step is open now. */
  | { open: true; month: number; weekNo: number; dayNo: number }
  /** The next step opens later (the 20-hour wait). */
  | { open: false; month: number; weekNo: number; dayNo: number; opensAt: string | null }
  /** The next step is in a month this plan cannot open: exactly { locked, month, teaser } and nothing else. */
  | LockedResult;

export type HomeData = {
  packId: string;
  packTitle: string | null;
  /** True once at least one step is completed. */
  hasProgress: boolean;
  completedSteps: number;
  totalSteps: number;
  /** Reviews due now (the same rule as getDueReviews: a free user does not count locked-month items). */
  dueReviews: number;
  next: HomeNext;
  /** For weeks of OPEN months only: the day numbers (1 to 5) this user has completed. Locked months have no entry. */
  progress: Array<{ weekNo: number; doneDays: number[] }>;
};

/**
 * Everything the skills home and the pack map need about THIS user, in one read-only call. It selects only ids,
 * numbers, titles and progress: never a step's question, options, correct answer, explanation or any handout text.
 * If the user's next step is in a locked month, `next` is exactly { locked: true, month, teaser }, and the progress
 * of locked months is left out.
 */
export async function getHome(
  client: SupabaseClient,
  userId: string,
  tier: Tier,
  opts: { packId?: string; now?: number } = {},
): Promise<SkillResult<HomeData>> {
  return guard("getHome", async () => {
    needUser(userId);
    const now = opts.now ?? Date.now();
    const packId = await pickPack(client, opts.packId);
    const packs = await read(client.from("skill_packs").select("title").eq("id", packId));
    const order = await loadPackOrder(client, packId);
    if (order.length === 0) throw new Stop("no-content");
    const completed = await loadCompleted(client, userId);

    const monthRows = await read(
      client.from("skill_months").select(MONTH_COLS).eq("pack_id", packId).order("month_no", { ascending: true }),
    );
    const months = new Map(monthRows.map(toMonth).map((m) => [m.monthNo, m]));

    const index = order.findIndex((s) => !completed.has(s.stepId));
    let next: HomeNext;
    if (index === -1) {
      next = { done: true };
    } else {
      const target = order[index]!;
      const month = months.get(target.monthNo) ?? (await loadMonth(client, packId, target.monthNo));
      if (!isOpen(month, tier)) {
        next = lockedResult(month);
      } else {
        const gate = nextNewStep(index, await loadLastNewStepAt(client, userId, packId), now);
        next = gate.open
          ? { open: true, month: target.monthNo, weekNo: target.weekNo, dayNo: target.dayNo }
          : {
              open: false,
              month: target.monthNo,
              weekNo: target.weekNo,
              dayNo: target.dayNo,
              opensAt: gate.opensAt === null ? null : iso(gate.opensAt),
            };
      }
    }

    const doneByWeek = new Map<number, number[]>();
    let completedSteps = 0;
    for (const s of order) {
      const month = months.get(s.monthNo);
      if (completed.has(s.stepId)) completedSteps += 1;
      if (!month || !isOpen(month, tier)) continue;
      const days = doneByWeek.get(s.weekNo) ?? [];
      if (completed.has(s.stepId)) days.push(s.dayNo);
      doneByWeek.set(s.weekNo, days);
    }
    const progress = [...doneByWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([weekNo, doneDays]) => ({ weekNo, doneDays: [...doneDays].sort((a, b) => a - b) }));

    const due = await getDueReviews(client, userId, tier, now);
    if ("error" in due) throw new Stop(due.error.code, false);
    const dueReviews = "data" in due ? due.data.items.length : 0;

    return {
      data: {
        packId,
        packTitle: typeof packs[0]?.title === "string" ? packs[0].title : null,
        hasProgress: completedSteps > 0,
        completedSteps,
        totalSteps: order.length,
        dueReviews,
        next,
        progress,
      },
    };
  });
}

export type HandoutSource = { ref: string; title: string; publisher: string | null; year: number | null; url: string | null };

export type Handout = {
  packId: string;
  weekId: string;
  weekNo: number;
  month: number;
  title: string;
  goalLine: string;
  handoutMd: string;
  sources: HandoutSource[];
};

/** Only http(s) links are ever handed to a page; anything else (javascript:, data:, a bare word) becomes null. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : null;
}

/**
 * One week's handout and its source list (title, publisher, year, link). The week is found by its number (1 to 24).
 * The month is checked FIRST and the handout text is selected only after the month is known to be open, so a
 * locked week returns exactly { locked: true, month, teaser } and its content never leaves the database. No step,
 * question, answer or explanation is read here.
 */
export async function getHandout(
  client: SupabaseClient,
  tier: Tier,
  weekNo: number,
  opts: { packId?: string } = {},
): Promise<SkillResult<Handout>> {
  return guard("getHandout", async () => {
    if (!Number.isInteger(weekNo) || weekNo < 1 || weekNo > 24) throw new Stop("no-week", false);
    const packId = await pickPack(client, opts.packId);
    const weeks = await read(
      client.from("skill_weeks").select("id, month_no, week_no").eq("pack_id", packId).eq("week_no", weekNo),
    );
    if (weeks.length !== 1) throw new Stop("no-week", false);
    const w = weeks[0]!;
    const month = await loadMonth(client, packId, asNumber(w.month_no));
    if (!isOpen(month, tier)) return lockedResult(month);

    const weekId = asString(w.id);
    const body = await read(client.from("skill_weeks").select("title, goal_line, handout_md").eq("id", weekId));
    if (body.length !== 1) throw new Stop("no-week");
    const sources = await read(
      client
        .from("skill_sources")
        .select("ref, title, author_or_publisher, year, url")
        .eq("week_id", weekId)
        .order("ref", { ascending: true }),
    );
    return {
      data: {
        packId,
        weekId,
        weekNo: asNumber(w.week_no),
        month: month.monthNo,
        title: asString(body[0]!.title),
        goalLine: asString(body[0]!.goal_line),
        handoutMd: asString(body[0]!.handout_md),
        sources: sources.map((s) => ({
          ref: asString(s.ref),
          title: asString(s.title),
          publisher: typeof s.author_or_publisher === "string" && s.author_or_publisher.trim() ? s.author_or_publisher : null,
          year: typeof s.year === "number" ? s.year : null,
          url: safeUrl(s.url),
        })),
      },
    };
  });
}
