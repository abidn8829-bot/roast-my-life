"use client";

import { useCallback, useState } from "react";
import { roastShareUrl } from "@/lib/site";
import posthog from "posthog-js";

type Props = {
  roastId: string;
  shareSlug: string;
};

export function ShareButtons({ roastId, shareSlug }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shareUrl = roastShareUrl(shareSlug);

  const fetchReportCardPng = useCallback(async () => {
    const res = await fetch(`/api/og/${roastId}`);
    if (!res.ok) throw new Error("Failed to generate report card");
    return res.blob();
  }, [roastId]);

  const downloadImage = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/og/${roastId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "roast-my-life.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("Image saved!");
      posthog.capture('roast_shared');
    } catch (error) {
      console.error("[downloadImage] Download failed:", error);
      setStatus("Download failed");
      alert("Download failed, please try again");
    } finally {
      setLoading(false);
      window.setTimeout(() => setStatus(null), 3000);
    }
  }, [roastId]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Check my Ember results! ${shareUrl}`,
  )}`;

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `I just got roasted 💀 ${shareUrl}`,
  )}`;

  async function onInstagram() {
    await downloadImage();
    setStatus("Image saved! Open Instagram and share it as a story");
    window.setTimeout(() => setStatus(null), 3500);
    posthog.capture('roast_shared');
  }

  // One neutral button for every action: an ink hairline circle, no brand colours, no grow. 48px on a phone, 44px from
  // 1280px up (the desktop result page).
  const btnBase =
    "flex h-12 w-12 items-center justify-center rounded-full border border-text/35 bg-transparent transition hover:border-text hover:bg-text/10 disabled:opacity-50 " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-text " +
    "min-[1280px]:h-11 min-[1280px]:w-11 min-[1280px]:transition-none";

  return (
    <div className="flex flex-col items-center gap-3 min-[1280px]:shrink-0 min-[1280px]:flex-row min-[1280px]:gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-text-faint min-[1280px]:mr-1 min-[1280px]:whitespace-nowrap min-[1280px]:tracking-[0.08em] min-[1280px]:text-text-muted">
        Share the damage
      </p>
      <div className="flex flex-wrap justify-center gap-3 min-[1280px]:flex-nowrap min-[1280px]:gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture('roast_shared')}
          className={btnBase}
          aria-label="Share on WhatsApp"
        >
          <LineIcon><path d="M4.2 19.8 L5.6 15.4 C 3.4 11.6, 4.8 6.8, 8.9 4.9 C 13 3.1, 18 5.2, 19.4 9.5 C 20.8 13.9, 17.8 18.7, 13.1 19.4 C 11.1 19.7, 9.2 19.2, 7.7 18.3 Z" /><path d="M9.3 9.1 C 9.2 12, 12 14.8, 14.9 14.7" /></LineIcon>
        </a>
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture('roast_shared')}
          className={btnBase}
          aria-label="Share on X"
        >
          <LineIcon><path d="M5.2 4.8 C 9.5 9.6, 14.6 14.7, 18.9 19.4" /><path d="M18.8 4.7 C 14.8 9, 9.4 14.8, 5.1 19.3" /></LineIcon>
        </a>
        <button
          type="button"
          disabled={loading}
          onClick={() => void onInstagram()}
          className={btnBase}
          aria-label="Save for Instagram"
        >
          <LineIcon><path d="M8.4 4.2 C 11 3.9, 13.4 4, 15.6 4.2 C 18.4 4.6, 19.9 6.2, 19.8 8.8 C 19.9 11.2, 19.9 13.4, 19.7 15.6 C 19.4 18.2, 17.9 19.7, 15.4 19.8 C 13 20, 10.8 19.9, 8.5 19.8 C 5.8 19.5, 4.3 18, 4.2 15.4 C 4 13, 4.1 10.8, 4.3 8.6 C 4.6 6, 6 4.5, 8.4 4.2 Z" /><path d="M12.1 8.4 C 14.2 8.3, 15.7 10, 15.6 12.1 C 15.5 14.2, 13.9 15.7, 11.9 15.6 C 9.8 15.5, 8.3 13.9, 8.4 11.9 C 8.5 10, 10 8.5, 12.1 8.4 Z" /><path d="M16.6 7.4 L16.7 7.5" /></LineIcon>
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void downloadImage()}
          className={btnBase}
          aria-label="Download report card"
        >
          <LineIcon><path d="M12 4.2 C 12.1 7.6, 11.9 11.4, 12 15" /><path d="M7.4 10.7 C 9 12.1, 10.7 13.7, 12 15.1 C 13.3 13.7, 15.2 12, 16.7 10.6" /><path d="M5 19.4 C 8.8 19.1, 15.2 19.3, 19 19.2" /></LineIcon>
        </button>
      </div>
      {status ? <p className="text-sm text-text-muted">{status}</p> : null}
    </div>
  );
}

/**
 * Hand-drawn line icons, in the style of journal-roast-ui.tsx: 22px, loose ink strokes with round ends, no fill and
 * no brand colours (decorative; the button carries the aria-label).
 */
function LineIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
