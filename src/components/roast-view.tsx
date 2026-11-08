"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DarkScope } from "@/components/journal-onboarding-ui";
import { PersonaIcon } from "@/components/journal-persona-art";
import { GradeRow, PlanArrow, ScoreRing, ScoreStar, StepMarker, WavyUnderline, sectionLabel } from "@/components/journal-roast-ui";
import { ShareButtons } from "@/components/share-buttons";
import { ShareSheet } from "@/components/share-sheet";
import { cleanRoastText } from "@/lib/clean-roast-text";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import { personaLabel } from "@/lib/roast-personas";
import { REMINDER_COPY } from "@/lib/plan-reminder";
import { usePlanReminder } from "@/lib/use-plan-reminder";
import { weakestCategory } from "@/lib/weakest-category";
import { isRoastPersona, type CategoryScores, type Grade, type OnboardingAnswers, type ReportCard, type RoastMode, type RoastPersona } from "@/lib/roast-types";
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
  /** The plan, loaded on the server with the roast. When it is valid the browser fetch below is skipped. */
  initialPlan?: ChallengePlan | null;
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
  persona,
  suggestionLine,
  initialPlan = null,
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

  // The server already sent a valid plan: draw it now and skip the browser fetch. Otherwise (no plan, or one that did
  // not pass the server's check) the fetch below runs exactly as it always did.
  const visiblePlan = initialPlan ?? plan;

  // "Remind me tomorrow": inactive (no looking, no asking) unless a plan is shown. It only ever acts on a click.
  const reminder = usePlanReminder(Boolean(visiblePlan));
  const reminderShowsButton = reminder.status === "idle" || reminder.status === "working" || reminder.status === "error";
  const reminderLine =
    reminder.status === "subscribed" ? REMINDER_COPY.subscribed
    : reminder.status === "denied" ? REMINDER_COPY.denied
    : reminder.status === "unsupported" ? REMINDER_COPY.unsupported
    : reminder.status === "error" ? REMINDER_COPY.error
    : "";

  useEffect(() => {
    if (initialPlan) return;
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
  }, [roastId, initialPlan]);

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

  // The weakest category (lowest score, the first one on a tie) gets the clay circle on the desktop spread.
  const weakestKey = weakestCategory(categoryScores);

  return (
    <div className="flex w-full flex-col gap-12 pb-12 min-[1280px]:gap-3.5 min-[1280px]:pb-4 compact:gap-3 compact:pb-3">
      {/* The spread. Below 1280px the wrappers are "contents" (no box of their own), so everything stacks in the old
          order. From 1280px up they become two pages side by side with a dashed line between them. */}
      <div className="contents min-[1280px]:grid min-[1280px]:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] min-[1280px]:items-stretch">
        {/* Left page */}
        <div className="contents min-[1280px]:flex min-[1280px]:min-h-[490px] min-[1280px]:flex-col min-[1280px]:rounded-l-[18px] min-[1280px]:border min-[1280px]:border-r-0 min-[1280px]:border-border min-[1280px]:bg-surface min-[1280px]:px-9 min-[1280px]:py-8 compact:min-h-0 compact:px-7 compact:py-5">
          {/* Life Score Section */}
          <div className="min-[1280px]:grid min-[1280px]:grid-cols-[auto_1fr] min-[1280px]:items-start min-[1280px]:gap-x-6">
            <p className="text-[13px] text-text-muted min-[1280px]:col-span-2">Your Life Score</p>
            <p className="mt-2 flex items-baseline gap-2 text-text min-[1280px]:mt-1 min-[1280px]:gap-1">
              <span className="relative inline-block min-[1280px]:px-7 min-[1280px]:py-3 compact:py-1">
                <ScoreRing />
                <span className="relative font-display text-[96px] font-medium leading-none tabular-nums min-[1280px]:text-[118px] compact:text-[88px]">{lifeScore}</span>
                <ScoreStar />
              </span>
              <span className="font-display text-[30px] leading-none text-text-muted">/100</span>
            </p>
            <div className="min-[1280px]:mt-2 min-[1280px]:flex min-[1280px]:flex-col">
              <h1 className="mt-5 break-words font-display text-[34px] font-medium leading-[1.1] text-text min-[1280px]:mt-0 min-[1280px]:text-[40px] min-[1280px]:leading-[1.05] compact:text-[34px]">
                {funnyTitle}
              </h1>
              <WavyUnderline />
              <p className="mt-3 text-sm text-text-muted min-[1280px]:order-2 min-[1280px]:mt-2 min-[1280px]:max-w-[9rem] min-[1280px]:origin-left min-[1280px]:-rotate-2 min-[1280px]:font-note min-[1280px]:text-[23px] min-[1280px]:leading-[1.1]">
                Week {weekCount} of facing reality
              </p>
              {currentStreak > 0 && (
                <p className="mt-1 text-sm text-text-muted min-[1280px]:order-1 min-[1280px]:text-[13px]">{getStreakMessage(currentStreak)}</p>
              )}
            </div>
          </div>

          {/* Full Roast */}
          <section className="min-[1280px]:mt-3.5 min-[1280px]:flex min-[1280px]:flex-1 min-[1280px]:flex-col">
            <h2 className={`${sectionLabel} min-[1280px]:sr-only`}>The Full {mode === "coach" ? "Coach Report" : "Roast"}</h2>
            <div className="ph-no-capture mt-4 border-y border-border py-8 min-[1280px]:mt-0 min-[1280px]:flex-1 min-[1280px]:border-b-0 min-[1280px]:pb-0 min-[1280px]:pt-3.5 compact:pt-2">
              <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.6] text-text min-[1280px]:text-[15px] min-[1280px]:leading-[1.5] compact:text-[14px]">
                {cleanRoastText(roastText)}
              </p>
            </div>
          </section>

          {/* The persona that wrote it: its doodle and signature (desktop only; none for a roast without a persona) */}
          {persona && isRoastPersona(persona) ? (
            <div className="hidden min-[1280px]:mt-auto min-[1280px]:flex min-[1280px]:items-center min-[1280px]:justify-end min-[1280px]:gap-2 min-[1280px]:pt-2">
              <PersonaIcon id={persona} />
              <span className="-rotate-2 font-note text-[26px] font-bold leading-none text-text">— {personaLabel(persona)}</span>
            </div>
          ) : null}
        </div>

        {/* Right page */}
        <div className="contents min-[1280px]:flex min-[1280px]:flex-col min-[1280px]:rounded-r-[18px] min-[1280px]:border min-[1280px]:border-border min-[1280px]:border-l-text/40 min-[1280px]:[border-left-style:dashed] min-[1280px]:bg-surface min-[1280px]:px-9 min-[1280px]:py-8 compact:px-7 compact:py-5">
          {/* Category rows: the letter carries the grade, the bar is the score */}
          {categoryScores && (
            <>
              <h2 className="sr-only">Category scores</h2>
              <ul className="divide-y divide-border min-[1280px]:border-b min-[1280px]:border-border">
                {Object.entries(categoryScores).map(([key, data]) => (
                  <GradeRow key={key} label={key} grade={data.grade} score={data.score} weakest={key === weakestKey} />
                ))}
              </ul>
            </>
          )}

          {/* Upgrade CTA (free plan only). On the desktop spread the offer is a quiet link in the bottom bar instead. */}
          {subscriptionTier !== "pro" && (
            <section className="flex flex-col items-center gap-2 rounded-xl border border-ember/30 bg-ember-soft p-5 text-center min-[1280px]:hidden">
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
            <section className="min-[1280px]:mt-6 compact:mt-4">
              <h2 className={`${sectionLabel} min-[1280px]:font-display min-[1280px]:text-[23px] min-[1280px]:leading-[1.2] min-[1280px]:text-text`}>Improvement Suggestion</h2>
              <p className="mt-3 break-words text-base leading-[1.6] text-text min-[1280px]:mt-1.5 min-[1280px]:text-[15px] min-[1280px]:leading-[1.55]">{suggestionLine}</p>
            </section>
          )}
        </div>
      </div>

      {/* Your Plan: a dark band with the check-in panel. Only when a plan exists: no plan, no band, no panel. */}
      {visiblePlan && (
        <section className="flex flex-col gap-6 rounded-[18px] bg-text px-6 py-6 text-bg min-[1280px]:flex-row min-[1280px]:items-stretch min-[1280px]:gap-6 min-[1280px]:px-7 min-[1280px]:py-5 compact:py-4">
          <div className="ph-no-capture flex min-w-0 flex-col gap-6 min-[1280px]:flex-1 min-[1280px]:flex-row min-[1280px]:gap-6">
            <div className="min-w-0 min-[1280px]:w-[22%] min-[1280px]:shrink-0">
              <h2 className="font-display text-[28px] font-medium leading-[1.1]">Your Plan</h2>
              <p className="mt-3 break-words text-[17px] font-medium leading-snug min-[1280px]:text-[15px] min-[1280px]:leading-[1.4]">
                {visiblePlan.challenge}
              </p>
            </div>
            <ol role="list" className="flex min-w-0 flex-col gap-5 min-[1280px]:flex-1 min-[1280px]:flex-row min-[1280px]:gap-6">
              {visiblePlan.steps.map((s, index) => (
                <li key={index} className="flex min-w-0 gap-3 min-[1280px]:flex-1">
                  <StepMarker onDark />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="break-words text-base text-bg min-[1280px]:text-sm min-[1280px]:leading-[1.4]">{s.step}</p>
                    <p className="break-words text-sm text-powder min-[1280px]:text-[13px] min-[1280px]:leading-[1.4]">{s.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <PlanArrow />
          <div className="rounded-[14px] bg-bg px-[18px] py-4 text-text min-[1280px]:px-4 min-[1280px]:py-3 min-[1280px]:flex min-[1280px]:w-[31%] min-[1280px]:shrink-0 min-[1280px]:flex-col min-[1280px]:justify-center compact:py-3">
            <p className="font-display text-[23px] font-medium leading-[1.1] min-[1280px]:text-[21px]">Do it today. Check in tomorrow.</p>
            <p className="mt-1 text-sm leading-[1.3] text-text-muted">See if your {lifeScore} moves.</p>
            <div className="mt-2 flex min-h-[62px] flex-col gap-0.5">
              {reminderShowsButton && (
                <button
                  type="button"
                  onClick={() => void reminder.request()}
                  disabled={reminder.status === "working"}
                  className="h-11 w-full rounded-xl bg-text px-5 text-[15px] font-medium text-bg hover:opacity-90 disabled:cursor-default disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-text"
                >
                  {reminder.status === "working" ? REMINDER_COPY.working : "Remind me tomorrow"}
                </button>
              )}
              <p role="status" aria-live="polite" className="text-xs leading-[1.3] text-text">
                {reminderLine}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Bottom bar: share, reactions, the upgrade link, roast again. Stacked below 1280px, one row from 1280px up. */}
      <div className="contents min-[1280px]:flex min-[1280px]:flex-wrap min-[1280px]:items-center min-[1280px]:justify-between min-[1280px]:gap-x-4 min-[1280px]:gap-y-3">
        {/* Share Buttons */}
        <ShareButtons roastId={roastId} shareSlug={shareSlug} />

        {/* Reactions */}
        {canReact && (
          <section className="flex flex-col items-center gap-3 min-[1280px]:shrink-0 min-[1280px]:flex-row min-[1280px]:gap-2">
            <p className="text-sm text-text-muted min-[1280px]:mr-1 min-[1280px]:whitespace-nowrap min-[1280px]:text-xs min-[1280px]:uppercase min-[1280px]:tracking-[0.08em]">How did that feel?</p>
            <div className="flex gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={savingReaction}
                  onClick={() => void onReaction(emoji)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition min-[1280px]:h-11 min-[1280px]:w-11 min-[1280px]:text-xl min-[1280px]:transition-none min-[1280px]:focus-visible:outline min-[1280px]:focus-visible:outline-2 min-[1280px]:focus-visible:outline-offset-[3px] min-[1280px]:focus-visible:outline-text ${
                    reaction === emoji
                      ? "border-ember bg-ember-soft scale-110 min-[1280px]:scale-100"
                      : "border-border bg-surface hover:border-ember/50 hover:bg-surface-2 min-[1280px]:border-text/35 min-[1280px]:bg-transparent min-[1280px]:hover:border-text min-[1280px]:hover:bg-text/10"
                  }`}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="contents min-[1280px]:flex min-[1280px]:shrink-0 min-[1280px]:items-center min-[1280px]:gap-3">
          {/* The upgrade offer as a quiet link (desktop only; same condition as the card above) */}
          {subscriptionTier !== "pro" && (
            <div className="hidden min-[1280px]:flex min-[1280px]:items-center min-[1280px]:gap-3">
              <span className="whitespace-nowrap text-xs text-text-muted">Ember has more to say.</span>
              <a
                href={getUpgradeUrl(userEmail)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-medium text-text underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-text"
              >
                Unlock My Full Read →
              </a>
            </div>
          )}

          {/* Roast Again Button */}
          <button
            type="button"
            disabled={checkingLimit}
            onClick={() => void handleRoastAgain()}
            className="w-full rounded-xl border border-border px-4 py-3 text-center text-sm font-medium text-text transition hover:border-ember/40 disabled:opacity-50 min-[1280px]:h-11 min-[1280px]:w-auto min-[1280px]:whitespace-nowrap min-[1280px]:border-text min-[1280px]:bg-transparent min-[1280px]:px-4 min-[1280px]:py-0 min-[1280px]:text-[15px] min-[1280px]:transition-none min-[1280px]:hover:border-text min-[1280px]:hover:bg-text/10 min-[1280px]:focus-visible:outline min-[1280px]:focus-visible:outline-2 min-[1280px]:focus-visible:outline-offset-[3px] min-[1280px]:focus-visible:outline-text"
          >
            {checkingLimit ? "Checking..." : "Roast me again"}
          </button>
        </div>
      </div>

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
