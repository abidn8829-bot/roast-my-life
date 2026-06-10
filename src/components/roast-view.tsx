"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShareButtons } from "@/components/share-buttons";
import { gradeColor } from "@/lib/grades";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import type { Grade, OnboardingAnswers, ReportCard } from "@/lib/roast-types";

const GRADE_LABELS: { key: keyof ReportCard; label: string }[] = [
  { key: "screenTime", label: "Screen Time" },
  { key: "sleep", label: "Sleep" },
  { key: "spending", label: "Spending" },
  { key: "productivity", label: "Productivity" },
];

type Props = {
  roastId: string;
  roastText: string;
  reportCard: ReportCard;
  shareSlug: string;
  initialReaction?: string | null;
  canReact?: boolean;
  answers?: OnboardingAnswers;
  weekCount?: number;
};

export function RoastView({
  roastId,
  roastText,
  reportCard,
  shareSlug,
  initialReaction = null,
  canReact = false,
  answers,
  weekCount = 1,
}: Props) {
  const [displayed, setDisplayed] = useState("");
  const [doneTyping, setDoneTyping] = useState(false);
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [savingReaction, setSavingReaction] = useState(false);
  const indexRef = useRef(0);

  // Find worst grade
  const worstGrade = Object.entries(reportCard).reduce<{ key: string; grade: Grade } | null>(
    (worst, [key, grade]) => {
      if (!grade) return worst;
      const gradeOrder: Record<Grade, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };
      if (!worst || gradeOrder[grade] < gradeOrder[worst.grade]) {
        return { key, grade };
      }
      return worst;
    },
    null
  );

  const worstGradeLabel = worstGrade ? GRADE_LABELS.find(l => l.key === worstGrade.key)?.label || worstGrade.key : 'Unknown';

  // Generate consequences based on answers
  const consequences = answers ? generateConsequences(answers) : [];

  function generateConsequences(ans: OnboardingAnswers): string[] {
    const cons: string[] = [];
    
    if (ans.phoneHours >= 8) {
      cons.push(`At ${ans.phoneHours}h/day of screen time, you'll have carpel tunnel by 30 and your attention span will be shorter than a TikTok.`);
    } else if (ans.phoneHours >= 5) {
      cons.push(`With ${ans.phoneHours}h daily screen time, your brain is literally rewiring itself to need constant dopamine hits.`);
    }
    
    if (ans.sleepHours <= 5) {
      cons.push(`Sleeping ${ans.sleepHours}h/night? Your cognitive decline is accelerating faster than your credit card debt.`);
    } else if (ans.sleepHours <= 6) {
      cons.push(`At ${ans.sleepHours}h of sleep, you're operating at 60% capacity. No wonder you're mediocre at everything.`);
    }
    
    if (ans.foodDeliverySpend >= 200) {
      cons.push(`$${ans.foodDeliverySpend}/week on delivery? That's $10k+ a year on laziness. Your bank account is crying.`);
    } else if (ans.foodDeliverySpend >= 100) {
      cons.push(`Spending $${ans.foodDeliverySpend}/week on delivery adds up to $5k/year. Hope that instant gratification is worth it.`);
    }
    
    if (ans.socialMediaHours && ans.socialMediaHours >= 4) {
      cons.push(`${ans.socialMediaHours}h on social media daily? You're literally watching other people live instead of living your own life.`);
    }
    
    if (ans.workoutFrequency === 0) {
      cons.push(`Zero workouts this week? Your muscles are atrophying as we speak. Sedentary lifestyle incoming.`);
    }
    
    // Return 2-3 consequences
    return cons.slice(0, 3);
  }

  useEffect(() => {
    setDisplayed("");
    setDoneTyping(false);
    indexRef.current = 0;
    let timeoutId: number | undefined;

    const tick = () => {
      indexRef.current += 1;
      setDisplayed(roastText.slice(0, indexRef.current));
      if (indexRef.current < roastText.length) {
        timeoutId = window.setTimeout(tick, 18);
      } else {
        setDoneTyping(true);
      }
    };

    timeoutId = window.setTimeout(tick, 400);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [roastText]);

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

  return (
    <div className="relative flex w-full max-w-lg flex-col gap-8">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF3D00 0%, transparent 70%)" }}
      />

      <header className="relative z-10 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl" aria-hidden>
          🔥
        </span>
        <p className="text-xs font-semibold tracking-[0.35em] text-[#FF3D00]">
          YOUR WEEKLY ROAST
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-[#FAFAFA]">
          Report Card
        </h1>
        <p className="text-xs text-neutral-500">
          Week {weekCount} of facing reality
        </p>
      </header>

      <article className="relative z-10 rounded-xl border border-neutral-800/80 bg-[#111111] p-5 shadow-[0_0_40px_rgba(255,61,0,0.06)]">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-[#FAFAFA]">
          {displayed}
          {!doneTyping ? (
            <span className="ml-0.5 inline-block animate-pulse text-[#FF3D00]">
              |
            </span>
          ) : null}
        </p>
      </article>

      {doneTyping ? (
        <>
          {/* Worst Grade Callout */}
          {worstGrade && (
            <div className="relative z-10 rounded-xl border-2 border-[#FF3D00] bg-[#FF3D00]/10 p-4">
              <p className="text-center text-sm font-semibold text-[#FF3D00]">
                Your biggest problem this week 🔥
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-lg font-bold text-[#FAFAFA]">{worstGradeLabel}:</span>
                <span className={`text-3xl font-black ${gradeColor(worstGrade.grade)}`}>{worstGrade.grade}</span>
              </div>
            </div>
          )}

          <section className="relative z-10">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-neutral-500">
              The damage
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRADE_LABELS.map(({ key, label }) => {
                const grade = reportCard[key];
                return (
                  <div
                    key={key}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-4 text-center transition-transform hover:scale-[1.02] ${gradeColor(grade ?? 'F')}`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {label}
                    </span>
                    <span className="text-3xl font-black">{grade}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Consequences Section */}
          {consequences.length > 0 && (
            <div className="relative z-10 rounded-xl border border-neutral-800 bg-[#111111] p-5">
              <p className="mb-3 text-center text-sm font-semibold text-[#FAFAFA]">
                If you keep this up...
              </p>
              <ul className="space-y-2">
                {consequences.map((consequence, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300">
                    <span className="mt-0.5 text-[#FF3D00]">•</span>
                    <span>{consequence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}

      {doneTyping && canReact ? (
        <section className="relative z-10 flex flex-col items-center gap-3">
          <p className="text-sm text-neutral-400">How did that feel?</p>
          <div className="flex gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={savingReaction}
                onClick={() => void onReaction(emoji)}
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition ${
                  reaction === emoji
                    ? "border-[#FF3D00] bg-[#FF3D00]/20 scale-110"
                    : "border-neutral-700 bg-[#141414] hover:border-[#FF3D00]/60 hover:bg-[#1a1a1a]"
                }`}
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {doneTyping ? (
        <div className="relative z-10 flex flex-col gap-6">
          <ShareButtons roastId={roastId} shareSlug={shareSlug} />
          <Link
            href="/onboarding"
            className="block w-full rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-medium text-[#FAFAFA] transition hover:border-[#FF3D00]/50"
          >
            Roast me again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
