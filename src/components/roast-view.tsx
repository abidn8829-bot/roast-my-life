"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DarkScope } from "@/components/journal-onboarding-ui";
import { GradeRow, StepMarker, sectionLabel } from "@/components/journal-roast-ui";
import { ShareButtons } from "@/components/share-buttons";
import { ShareSheet } from "@/components/share-sheet";
import { cleanRoastText } from "@/lib/clean-roast-text";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import type { CategoryScores, Grade, OnboardingAnswers, ReportCard, RoastMode, RoastPersona } from "@/lib/roast-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";

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
  userEmail?: string;
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
  userEmail,
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
    if (streak === 1) return "Day 1 of facing reality";
    if (streak === 3) return "3 days of self inflicted damage";
    if (streak === 7) return "7 day streak — therapy would be cheaper";
    if (streak === 30) return "30 days — you're either improving or masochistic";
    if (streak >= 100) return `${streak} days — you need a new hobby at this point`;
    return `${streak} day streak`;
  }

  return (
    <div className="flex w-full flex-col gap-12 pb-12">
      {/* Life Score Section */}
      <div>
        <p className="text-[13px] text-text-muted">Your Life Score</p>
        <p className="mt-2 flex items-baseline gap-2 text-text">
          <span className="font-display text-[96px] font-medium leading-none tabular-nums">{lifeScore}</span>
          <span className="font-display text-[30px] leading-none text-text-muted">/100</span>
        </p>
        <h1 className="mt-5 font-display text-[34px] font-medium leading-[1.1] text-text">
          {funnyTitle}
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Week {weekCount} of facing reality
        </p>
        {currentStreak > 0 && (
          <p className="mt-1 text-sm text-text-muted">{getStreakMessage(currentStreak)}</p>
        )}
      </div>

      {/* Full Roast */}
      <section>
        <h2 className={sectionLabel}>The Full {mode === "coach" ? "Coach Report" : "Roast"}</h2>
        <div className="ph-no-capture mt-4 border-y border-border py-8">
          <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.6] text-text">
            {cleanRoastText(roastText)}
          </p>
        </div>
      </section>

      {/* Category rows: the letter carries the grade, the bar is the score */}
      {categoryScores && (
        <ul className="divide-y divide-border">
          {Object.entries(categoryScores).map(([key, data]) => (
            <GradeRow key={key} label={key} grade={data.grade} score={data.score} />
          ))}
        </ul>
      )}

      {/* Upgrade CTA (free plan only) */}
      {subscriptionTier !== "pro" && (
        <section className="flex flex-col items-center gap-2 rounded-xl border border-ember/30 bg-ember-soft p-5 text-center">
          <p className="text-lg font-bold text-text">Ember has more to say.</p>
          <p className="text-sm text-text-muted">
            I found some patterns in your answers that aren&apos;t visible in your roast yet.
          </p>
          <a
            href={getUpgradeUrl(userEmail)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110"
          >
            Unlock My Full Read →
          </a>
          <span className="text-xs font-semibold uppercase tracking-widest text-ember">Pro</span>
          <p className="text-xs text-text-faint">{UPGRADE_EMAIL_HINT}</p>
        </section>
      )}

      {/* Improvement Suggestion */}
      {suggestionLine && suggestionLine.trim() && (
        <section>
          <h2 className={sectionLabel}>Improvement Suggestion</h2>
          <p className="mt-3 text-base leading-[1.6] text-text">{suggestionLine}</p>
        </section>
      )}

      {/* Your Plan */}
      {plan && (
        <section>
          <h2 className={sectionLabel}>Your Plan</h2>
          <div className="ph-no-capture mt-4">
            <p className="text-[17px] font-medium leading-snug text-text">
              {plan.challenge}
            </p>
            <ol role="list" className="mt-5 flex flex-col gap-5">
              {plan.steps.map((s, index) => (
                <li key={index} className="flex gap-4">
                  <StepMarker />
                  <div className="flex flex-col gap-1">
                    <p className="text-base text-text">{s.step}</p>
                    <p className="text-sm text-text-muted">{s.why}</p>
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

      {/* The sheet is not restyled yet: it keeps its original dark colours and font on the light page. "contents"
          means this wrapper takes no space of its own (the sheet itself is fixed to the screen). */}
      {shareSheetOpen && (
        <DarkScope className="contents text-text [font-family:var(--font-poppins),Arial,Helvetica,sans-serif]">
          <ShareSheet
            roastId={roastId}
            shareSlug={shareSlug}
            onClose={closeShareSheet}
          />
        </DarkScope>
      )}
    </div>
  );
}
