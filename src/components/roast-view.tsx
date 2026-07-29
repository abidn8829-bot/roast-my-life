"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShareButtons } from "@/components/share-buttons";
import { gradeColor } from "@/lib/grades";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import type { CategoryScores, Grade, OnboardingAnswers, ReportCard, RoastMode, RoastPersona } from "@/lib/roast-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
  top5Roasts?: string[];
  categoryScores?: CategoryScores;
  currentStreak?: number;
  longestStreak?: number;
  mode?: RoastMode;
  persona?: RoastPersona;
  suggestionLine?: string;
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
  top5Roasts = [],
  categoryScores,
  currentStreak = 0,
  longestStreak = 0,
  mode = "roast",
  persona = "default",
  suggestionLine,
}: Props) {
  const router = useRouter();
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [savingReaction, setSavingReaction] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [showFullRoast, setShowFullRoast] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Get color based on life score
  const getScoreColor = (score: number) => {
    if (score <= 40) return "text-red-500";
    if (score <= 70) return "text-amber-500";
    return "text-emerald-500";
  };

  const getScoreBgColor = (score: number) => {
    if (score <= 40) return "from-red-500/20 to-red-500/5";
    if (score <= 70) return "from-amber-500/20 to-amber-500/5";
    return "from-emerald-500/20 to-emerald-500/5";
  };

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

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
        <div
          className={`absolute inset-0 -z-10 rounded-full blur-3xl opacity-30 bg-gradient-to-b ${getScoreBgColor(lifeScore)}`}
        />
        <p className="text-xs font-semibold tracking-[0.35em] text-neutral-500 uppercase">
          Your Life Score
        </p>
        <div className={`text-8xl font-black tracking-tighter ${getScoreColor(lifeScore)}`}>
          {lifeScore}
          <span className="text-4xl text-neutral-500">/100</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#FAFAFA] sm:text-4xl">
          {funnyTitle}
        </h1>
        <p className="text-xs text-neutral-500">
          Week {weekCount} of facing reality
        </p>
        {currentStreak > 0 && (
          <div className="mt-2 rounded-full border border-[#FF3D00] bg-[#FF3D00]/10 px-4 py-2">
            <p className="text-sm font-semibold text-[#FF3D00]">
              {getStreakMessage(currentStreak)}
            </p>
          </div>
        )}
      </div>

      {/* Category Scorecards */}
      {categoryScores && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(categoryScores).map(([key, data]) => (
            <div
              key={key}
              className={`rounded-xl border border-neutral-800 bg-[#111111] p-5 transition-transform hover:scale-[1.02] ${gradeColor(data.grade)}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  {key}
                </span>
                <span className="text-2xl font-black">{data.grade}</span>
              </div>
              <div className="mb-2 text-3xl font-bold text-[#FAFAFA]">
                {Math.round(data.score / 10)}/10
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Top 5 Roasts */}
      {top5Roasts.length > 0 && (
        <section className="flex flex-col gap-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-neutral-500">
            Top 5 Roasts
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {top5Roasts.map((roast, index) => (
              <div
                key={index}
                className="group relative rounded-xl border border-neutral-800 bg-[#111111] p-4 transition-all hover:border-[#FF3D00]/50 hover:bg-[#1a1a1a]"
              >
                <p className="text-sm text-[#FAFAFA]">{roast}</p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(roast, index)}
                  className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Copy roast"
                >
                  {copiedIndex === index ? (
                    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Improvement Suggestion */}
      {suggestionLine && suggestionLine.trim() && (
        <section className="flex flex-col gap-4">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-neutral-500">
            Improvement Suggestion
          </p>
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4">
            <p className="text-sm text-[#FAFAFA]">{suggestionLine}</p>
          </div>
        </section>
      )}

      {/* Share Buttons */}
      <ShareButtons roastId={roastId} shareSlug={shareSlug} />

      {/* Copy Roast Button */}
      {top5Roasts.length > 0 && (
        <button
          type="button"
          onClick={() => copyToClipboard(top5Roasts[0], -1)}
          className="w-full rounded-lg border border-neutral-800 px-4 py-3 text-center text-sm font-medium text-[#FAFAFA] transition hover:border-[#FF3D00]/50 hover:bg-[#111111]"
        >
          {copiedIndex === -1 ? "✓ Copied!" : `📋 Copy: "${top5Roasts[0]}"`}
        </button>
      )}

      {/* Expandable Full Roast */}
      <section className="flex flex-col gap-4">
        {!showFullRoast ? (
          <button
            type="button"
            onClick={() => setShowFullRoast(true)}
            className="w-full rounded-lg border border-neutral-800 px-4 py-3 text-center text-sm font-medium text-[#FAFAFA] transition hover:border-[#FF3D00]/50 hover:bg-[#111111]"
          >
            Read full {mode === "coach" ? "coach report" : "roast"}
          </button>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-6">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-[#FAFAFA]">
              {roastText}
            </p>
          </div>
        )}
      </section>

      {/* Reactions */}
      {canReact && (
        <section className="flex flex-col items-center gap-3">
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
      )}

      {/* Roast Again Button */}
      <button
        type="button"
        disabled={checkingLimit}
        onClick={() => void handleRoastAgain()}
        className="w-full rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-medium text-[#FAFAFA] transition hover:border-[#FF3D00]/50 disabled:opacity-50"
      >
        {checkingLimit ? "Checking..." : "Roast me again"}
      </button>
    </div>
  );
}
