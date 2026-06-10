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
      const blob = await fetchReportCardPng();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "roast-my-life.png";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Image saved!");
      posthog.capture('roast_shared');
    } catch {
      setStatus("Download failed");
    } finally {
      setLoading(false);
      window.setTimeout(() => setStatus(null), 3000);
    }
  }, [fetchReportCardPng]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Check my Roast My Life results! ${shareUrl}`,
  )}`;

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `I just got roasted 💀 ${shareUrl}`,
  )}`;

  async function onInstagram() {
    await downloadImage();
    setStatus("Image saved! Now open Instagram and share it as a story 📸");
    window.setTimeout(() => setStatus(null), 3500);
    posthog.capture('roast_shared');
  }

  const btnBase =
    "flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-[#141414] transition hover:scale-105 disabled:opacity-50";

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
        Share the damage
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture('roast_shared')}
          className={`${btnBase} hover:border-[#25D366] hover:bg-[#25D366]/10`}
          aria-label="Share on WhatsApp"
        >
          <WhatsAppIcon />
        </a>
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture('roast_shared')}
          className={`${btnBase} hover:border-neutral-400 hover:bg-neutral-900`}
          aria-label="Share on X"
        >
          <XIcon />
        </a>
        <button
          type="button"
          disabled={loading}
          onClick={() => void onInstagram()}
          className={`${btnBase} hover:border-[#E4405F] hover:bg-[#E4405F]/10`}
          aria-label="Save for Instagram"
        >
          <InstagramIcon />
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void downloadImage()}
          className={`${btnBase} hover:border-[#FF3D00] hover:bg-[#FF3D00]/10`}
          aria-label="Download report card"
        >
          <DownloadIcon />
        </button>
      </div>
      {status ? <p className="text-sm text-neutral-400">{status}</p> : null}
    </div>
  );
}


function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#FAFAFA" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FD5949" />
          <stop offset="50%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ig)"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF3D00"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
