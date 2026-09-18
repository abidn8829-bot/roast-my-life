import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { getGroqApiKey, logGroqError } from "@/lib/groq-error";
import { parseCategoryScores } from "@/lib/parse-category-scores";
import { computePercentile, MIN_SAMPLE_SIZE } from "@/lib/percentile";
import type { CategoryScores, Grade } from "@/lib/roast-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const MODEL = "openai/gpt-oss-120b";
const NEEDS_WORK_PERCENTILE = 50;

const CATEGORIES = ["sleep", "fitness", "discipline", "focus", "spending"] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_LABELS: Record<Category, string> = {
  sleep: "Sleep",
  fitness: "Fitness",
  discipline: "Discipline",
  focus: "Focus",
  spending: "Spending",
};

type FreeLayerEntry = {
  category: Category;
  label: string;
  fromGrade: Grade;
  toGrade: Grade;
};

type ProComparison = {
  category: Category;
  label: string;
  userScore: number;
  userGrade: Grade;
  avgScore: number | null;
  percentile: number | null;
  sampleSize: number;
  insufficientSample: boolean;
};

type Tip = {
  category: Category;
  label: string;
  steps: { step: string; why: string }[];
};

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

function buildFreeLayer(earliest: CategoryScores, latest: CategoryScores): FreeLayerEntry[] {
  const entries: FreeLayerEntry[] = [];
  for (const category of CATEGORIES) {
    const fromGrade = earliest[category].grade;
    const toGrade = latest[category].grade;
    if (fromGrade !== toGrade) {
      entries.push({ category, label: CATEGORY_LABELS[category], fromGrade, toGrade });
    }
  }
  return entries;
}

type DistributionRow = { avg_score: number; sample_size: number; scores: number[] };

async function fetchLiveDistribution(
  service: ReturnType<typeof createSupabaseServiceClient>,
): Promise<Map<string, DistributionRow> | null> {
  const { data, error } = await service.rpc("get_category_averages");
  if (error) {
    console.error("[api/user/arc] get_category_averages failed:", error.message);
    return null;
  }
  const byCategory = new Map<string, DistributionRow>();
  for (const row of (data ?? []) as { category: string; avg_score: number; sample_size: number; scores: number[] }[]) {
    byCategory.set(row.category, row);
  }
  return byCategory;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await supabase
    .from("roasts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count || count < 2) {
    return NextResponse.json({ hasEnoughHistory: false });
  }

  const [{ data: earliestRows }, { data: latestRows }] = await Promise.all([
    supabase
      .from("roasts")
      .select("category_scores, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("roasts")
      .select("category_scores, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const earliest = parseCategoryScores(earliestRows?.[0]?.category_scores);
  const latest = parseCategoryScores(latestRows?.[0]?.category_scores);

  if (!earliest || !latest) {
    return NextResponse.json({ hasEnoughHistory: false });
  }

  const earliestDate = earliestRows?.[0]?.created_at ? new Date(earliestRows[0].created_at as string) : null;
  const latestDate = latestRows?.[0]?.created_at ? new Date(latestRows[0].created_at as string) : null;
  const weeksSpan =
    earliestDate && latestDate
      ? Math.max(1, Math.round((latestDate.getTime() - earliestDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : null;

  const freeLayer = buildFreeLayer(earliest, latest);

  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";

  if (subscriptionTier !== "pro") {
    return NextResponse.json({ hasEnoughHistory: true, freeLayer, weeksSpan, locked: true });
  }

  // Prefer the latest weekly snapshot (RLS already scopes this to the caller) —
  // the score/grade shown always stays live (from `latest` above) so the page
  // never visibly disagrees with the rest of the dashboard, but the percentile/
  // average is "as of" whenever the snapshot cron last ran.
  const { data: snapshotRows } = await supabase
    .from("arc_percentile_snapshots")
    .select("category, avg_score, percentile, sample_size, week_start")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false });

  const snapshotByCategory = new Map<string, { avg_score: number | null; percentile: number | null; sample_size: number; week_start: string }>();
  for (const row of snapshotRows ?? []) {
    if (!snapshotByCategory.has(row.category as string)) {
      snapshotByCategory.set(row.category as string, {
        avg_score: row.avg_score as number | null,
        percentile: row.percentile as number | null,
        sample_size: row.sample_size as number,
        week_start: row.week_start as string,
      });
    }
  }

  let source: "snapshot" | "live" = "snapshot";
  let asOf: string | null = snapshotByCategory.size > 0 ? [...snapshotByCategory.values()][0]!.week_start : null;
  let liveDistribution: Map<string, DistributionRow> | null = null;

  // Bridge case: a brand-new Pro upgrade has no snapshot rows yet (first
  // Monday run hasn't happened) — fall back to computing live so they aren't
  // staring at "not enough data" for up to a week right after paying.
  if (snapshotByCategory.size === 0) {
    source = "live";
    asOf = null;
    const service = createSupabaseServiceClient();
    liveDistribution = await fetchLiveDistribution(service);
  }

  const comparisons: ProComparison[] = CATEGORIES.map((category) => {
    const userScore = latest[category].score;
    const userGrade = latest[category].grade;
    const snapshot = snapshotByCategory.get(category);

    if (snapshot) {
      const hasEnoughSample = snapshot.percentile !== null && snapshot.avg_score !== null && snapshot.sample_size >= MIN_SAMPLE_SIZE;
      return {
        category,
        label: CATEGORY_LABELS[category],
        userScore,
        userGrade,
        avgScore: hasEnoughSample ? Number(snapshot.avg_score) : null,
        percentile: hasEnoughSample ? Number(snapshot.percentile) : null,
        sampleSize: snapshot.sample_size,
        insufficientSample: !hasEnoughSample,
      };
    }

    const distribution = liveDistribution?.get(category);
    const sampleSize = distribution?.sample_size ?? 0;
    const peerScores = Array.isArray(distribution?.scores) ? distribution.scores : null;
    const hasEnoughSample = Boolean(distribution && peerScores && peerScores.length > 0 && sampleSize >= MIN_SAMPLE_SIZE);

    return {
      category,
      label: CATEGORY_LABELS[category],
      userScore,
      userGrade,
      avgScore: hasEnoughSample ? Number(distribution!.avg_score) : null,
      percentile: hasEnoughSample ? computePercentile(userScore, peerScores!) : null,
      sampleSize,
      insufficientSample: !hasEnoughSample,
    };
  });

  const ranked = comparisons.filter((c) => c.percentile !== null && c.percentile < NEEDS_WORK_PERCENTILE);
  const weakest = ranked.length > 0
    ? ranked.reduce((worst, c) => (c.percentile! < worst.percentile! ? c : worst))
    : null;

  let tip: Tip | null = null;
  if (weakest) {
    const apiKey = getGroqApiKey();
    if (apiKey) {
      try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          model: MODEL,
          max_tokens: 350,
          reasoning_effort: "low",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a blunt but supportive coach helping someone close a gap between their habits and other Ember users. Return strict JSON only: {"steps":[{"step":"concrete action","why":"one short sentence why it matters"}]}. steps must contain 2 or 3 objects. Frame everything around closing the gap for the one category given — concrete, practical, no fluff, no generic filler like "just try harder."',
            },
            {
              role: "user",
              content: `Category: ${weakest.label}\nUser's current score: ${weakest.userScore}/100 (grade ${weakest.userGrade})\nUser is ahead of only ${weakest.percentile}% of Ember users on this category\nAverage Ember user's score for this category: ${Math.round(weakest.avgScore!)}/100`,
            },
          ],
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "") as { steps?: unknown };
        if (isPlanSteps(parsed.steps)) {
          tip = {
            category: weakest.category,
            label: weakest.label,
            steps: parsed.steps.map((s) => ({ step: s.step.trim(), why: s.why.trim() })),
          };
        }
      } catch (error) {
        logGroqError(error);
      }
    }
  }

  return NextResponse.json({
    hasEnoughHistory: true,
    freeLayer,
    weeksSpan,
    locked: false,
    pro: { comparisons, tip, asOf, source },
  });
}
