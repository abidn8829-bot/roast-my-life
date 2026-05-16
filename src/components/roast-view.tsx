"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gradeColor } from "@/lib/grades";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import { roastShareUrl } from "@/lib/site";
import type { ReportCard } from "@/lib/roast-types";

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
};

function isMobileShare(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function RoastView({
  roastId,
  roastText,
  reportCard,
  shareSlug,
  initialReaction = null,
  canReact = false,
}: Props) {
  const [displayed, setDisplayed] = useState("");
  const [doneTyping, setDoneTyping] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reaction, setReaction] = useState<string | null>(initialReaction);
  const [savingReaction, setSavingReaction] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDoneTyping(false);
    indexRef.current = 0;
    let timeoutId: number | undefined;

    const tick = () => {
      indexRef.current += 1;
      const next = roastText.slice(0, indexRef.current);
      setDisplayed(next);
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

  const fetchReportCardPng = useCallback(async () => {
    const res = await fetch(`/api/og/${roastId}`);
    if (!res.ok) throw new Error("Failed to generate report card");
    return res.blob();
  }, [roastId]);

  async function onShare() {
    setSharing(true);
    setShareStatus(null);
    const shareUrl = roastShareUrl(shareSlug);

    try {
      const blob = await fetchReportCardPng();
      const file = new File([blob], "roast-report-card.png", {
        type: "image/png",
      });

      const mobile = isMobileShare();

      if (
        mobile &&
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: "Roast My Life — Weekly Report Card",
          text: "They roasted my life choices.",
          files: [file],
          url: shareUrl,
        });
        setShareStatus("Shared!");
      } else if (mobile && typeof navigator.share === "function") {
        await navigator.share({
          title: "Roast My Life",
          text: "They roasted my life choices.",
          url: shareUrl,
        });
        setShareStatus("Link shared!");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "roast-report-card.png";
        a.click();
        URL.revokeObjectURL(url);

        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("Image downloaded · link copied");
      }
    } catch (err) {
      console.error("Share failed:", err);
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("Link copied");
      } catch {
        setShareStatus("Could not share");
      }
    } finally {
      setSharing(false);
      window.setTimeout(() => setShareStatus(null), 3500);
    }
  }

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
        <section className="relative z-10 opacity-100 transition-opacity duration-500">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-neutral-500">
            The damage
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRADE_LABELS.map(({ key, label }) => {
              const grade = reportCard[key];
              return (
                <div
                  key={key}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-4 text-center transition-transform hover:scale-[1.02] ${gradeColor(grade)}`}
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
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void onShare()}
            disabled={sharing}
            className="flex-1 rounded-lg bg-[#FF3D00] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(255,61,0,0.35)] transition hover:brightness-110 disabled:opacity-60"
          >
            {sharing ? "Preparing card…" : "Share"}
          </button>
          <Link
            href="/onboarding"
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-medium text-[#FAFAFA] transition hover:border-[#FF3D00]/50"
          >
            Roast me again
          </Link>
        </div>
      ) : null}

      {shareStatus ? (
        <p className="relative z-10 text-center text-sm text-neutral-400">
          {shareStatus}
        </p>
      ) : null}
    </div>
  );
}
