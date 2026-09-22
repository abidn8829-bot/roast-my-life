"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ShareButtons } from "@/components/share-buttons";
import { ShareSheet } from "@/components/share-sheet";
import { gradeColor, scoreGlowBg, scoreTextColor } from "@/lib/grades";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import type { CategoryScores, Grade, OnboardingAnswers, ReportCard, RoastMode, RoastPersona } from "@/lib/roast-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DISMISS_EVENT = "share-sheet-dismissed";
function subscribeToDismissals(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}

type PlanStep = { step: string; why: string };
type ChallengePlan = { challenge: string; steps: PlanStep[] };

type Props = {
  roastId: string;
  roastText: string;
  reportCard: ReportCard;
  shareSlug: string;
  initialReaction?: string | null;
  canReact?: boolean;
  answers?: OnboardingAnswers;
  weekCount?: number;
  lifeScore?: number;
  funnyTitle?: string;
  subscriptionTier?: string;
  categoryScores?: CategoryScores;
  currentStreak?: number;
  longestStreak?: number;
  mode?: RoastMode;
  persona?: RoastPersona;
  suggestionLine?: string;
  showShareSheet?: boolean;
};

export function RoastView({
  roastId,
  roastText,
  reportCard,
  shareSlug,
  initialReaction = null,
  canReact = false,
  weekCount = 1,
  lifeScore = 50,
  funnyTitle = "Your Life",
  subscriptionTier,
  categoryScores,
  currentStreak = 0,
  longestStreak = 0,
  mode = "roast",
  persona = "default",
  suggestionLine,
  showShareSheet = false,
}: Props) {
  const router = useRouter();
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [savingReaction, setSavingReaction] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [plan, setPlan] = useState<ChallengePlan | null>(null);
  const [closedLocally, setClosedLocally] = useState(false);

  // ?share=1 opens the sheet. We deliberately leave the URL alone (editing it re-keys the
  // page in Next's router and can remount this component mid-navigation); instead the
  // sheet stays until dismissed, and "dismissed" is remembered per roast for the session.
  const dismissedKey = `share-sheet-dismissed:${roastId}`;
  const dismissedInSession = useSyncExternalStore(
    subscribeToDismissals,
    () => {
      try {
        return window.sessionStorage.getItem(dismissedKey) === "1";
      } catch {
        return false; // storage blocked: closedLocally still handles this page view
      }
    },
    () => false,
  );
  const shareSheetOpen = showShareSheet && !dismissedInSession && !closedLocally;

  function closeShareSheet() {
    try {
      window.sessionStorage.setItem(dismissedKey, "1");
      window.dispatchEvent(new Event(DISMISS_EVENT));
    } catch {
      // ignore
    }
    setClosedLocally(true);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("roasts")
        .select("plan_steps")
        .eq("id", roastId)
        .maybeSingle();
      const planSteps = data?.plan_steps as ChallengePlan | null | undefined;
      if (!cancelled && planSteps && planSteps.challenge && Array.isArray(planSteps.steps) && planSteps.steps.length > 0) {
        setPlan(planSteps);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roastId]);

  async function onReaction(emoji: ReactionEmoji) {
    if (!canReact || savingReaction) return;
    setSavingReaction(true);
    setReaction(emoji);

    try {
      const res = await fetch(`/api/roast/${roastId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) {
        setReaction(initialReaction);
      }
    } catch {
      setReaction(initialReaction);
    } finally {
      setSavingReaction(false);
    }
  }

  async function handleRoastAgain() {
    if (!canReact) {
      router.push("/onboarding");
      return;
    }

    setCheckingLimit(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/onboarding");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      const subscriptionTier = userData?.subscription_tier || "free";

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
          router.push("/pricing");
          return;
        }
      }

      router.push("/onboarding");
    } catch (error) {
      console.error("Error checking roast limit:", error);
      router.push("/onboarding");
    } finally {
      setCheckingLimit(false);
    }
  }

  function getStreakMessage(streak: number): string {
    if (streak === 1) return "Day 1 of facing reality 👀";
    if (streak === 3) return "3 days of self inflicted damage 🔥";
    if (streak === 7) return "7 day streak — therapy would be cheaper";
    if (streak === 30) return "30 days — you're either improving or masochistic 💀";
    if (streak >= 100) return `${streak} days — you need a new hobby at this point`;
    return `${streak} day streak`;
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8 pb-12">
      {/* Life Score Section */}
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className={`absolute inset-0 -z-10 rounded-full opacity-70 blur-3xl ${scoreGlowBg(lifeScore)}`} />
        <p className="text-xs font-semibold tracking-[0.35em] text-text-faint uppercase">
          Your Life Score
        </p>
        <div className={`text-8xl font-black tabular-nums tracking-tighter ${scoreTextColor(lifeScore)}`}>
          {lifeScore}
          <span className="text-4xl text-text-faint">/100</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
          {funnyTitle}
        </h1>
        <p className="text-xs text-text-faint">
          Week {weekCount} of facing reality
        </p>
        {currentStreak > 0 && (
          <div className="mt-2 rounded-full border border-ember/50 bg-ember-soft px-4 py-2">
            <p className="text-sm font-semibold text-ember">
              {getStreakMessage(currentStreak)}
            </p>
          </div>
        )}
      </div>

      {/* Full Roast */}
      <section className="flex flex-col gap-4">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-text-faint">
          The Full {mode === "coach" ? "Coach Report" : "Roast"}
        </p>
        <div className="rounded-xl border border-border bg-surface-2 p-6">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-text">
            {roastText}
          </p>
        </div>
      </section>

      {/* Category Scorecards */}
      {categoryScores && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(categoryScores).map(([key, data]) => (
            <div
              key={key}
              className={`rounded-xl border p-5 transition-transform hover:scale-[1.02] ${gradeColor(data.grade)}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                  {key}
                </span>
                <span className="text-2xl font-black">{data.grade}</span>
              </div>
              <div className="mb-2 text-3xl font-bold tabular-nums text-text">
                {Math.round(data.score / 10)}/10
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Upgrade CTA (free plan only) */}
      {subscriptionTier !== "pro" && (
        <section className="flex flex-col items-center gap-2 rounded-xl border border-ember/30 bg-ember-soft p-5 text-center">
          <p className="text-lg font-bold text-text">Ember has more to say.</p>
          <p className="text-sm text-text-muted">
            I found some patterns in your answers that aren&apos;t visible in your roast yet.
          </p>
          <a
            href={process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL || "/pricing"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Unlock My Full Read →
          </a>
          <span className="text-xs font-semibold uppercase tracking-widest text-ember">Pro</span>
        </section>
      )}

      {/* Improvement Suggestion */}
      {suggestionLine && suggestionLine.trim() && (
        <section className="flex flex-col gap-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-text-faint">
            Improvement Suggestion
          </p>
          <div className="rounded-xl border border-ember/30 bg-ember-soft p-4">
            <p className="text-sm text-text">{suggestionLine}</p>
          </div>
        </section>
      )}

      {/* Your Plan */}
      {plan && (
        <section className="flex flex-col gap-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-text-faint">
            Your Plan
          </p>
          <div className="rounded-xl border border-border bg-surface-2 p-5">
            <p className="mb-4 text-base font-semibold text-text">
              {plan.challenge}
            </p>
            <ol className="flex flex-col gap-4">
              {plan.steps.map((s, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ember text-xs font-bold text-ember">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-base text-text">{s.step}</p>
                    <p className="text-sm text-text-faint">{s.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Share Buttons */}
      <ShareButtons roastId={roastId} shareSlug={shareSlug} />

      {/* Reactions */}
      {canReact && (
        <section className="flex flex-col items-center gap-3">
          <p className="text-sm text-text-muted">How did that feel?</p>
          <div className="flex gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={savingReaction}
                onClick={() => void onReaction(emoji)}
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition ${
                  reaction === emoji
                    ? "border-ember bg-ember-soft scale-110"
                    : "border-border bg-surface hover:border-ember/50 hover:bg-surface-2"
                }`}
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Roast Again Button */}
      <button
        type="button"
        disabled={checkingLimit}
        onClick={() => void handleRoastAgain()}
        className="w-full rounded-xl border border-border px-4 py-3 text-center text-sm font-medium text-text transition hover:border-ember/40 disabled:opacity-50"
      >
        {checkingLimit ? "Checking..." : "Roast me again"}
      </button>

      {shareSheetOpen && (
        <ShareSheet
          roastId={roastId}
          shareSlug={shareSlug}
          onClose={closeShareSheet}
        />
      )}
    </div>
  );
}
