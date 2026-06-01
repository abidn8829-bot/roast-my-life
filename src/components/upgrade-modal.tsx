"use client";

import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason?: "daily_limit" | "pro_feature";
};

export function UpgradeModal({ isOpen, onClose, reason = "daily_limit" }: Props) {
  const [loading, setLoading] = useState(false);

  function handleUpgrade() {
    setLoading(true);
    const gumroadUrl = process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL;
    if (gumroadUrl) {
      window.open(gumroadUrl, "_blank");
    }
    setLoading(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#141414] p-6">
        <div className="mb-6 text-center">
          <span className="text-5xl">🔥</span>
          <h2 className="mt-4 text-2xl font-bold text-[#FAFAFA]">
            {reason === "daily_limit" ? "Daily Limit Reached" : "Pro Feature"}
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {reason === "daily_limit"
              ? "You've used your free roast for today. Upgrade to Pro for unlimited roasts!"
              : "This feature is available for Pro users only."}
          </p>
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-neutral-800 bg-[#0A0A0A] p-4">
          <h3 className="text-sm font-semibold text-[#FF3D00]">Pro Features:</h3>
          <ul className="space-y-2 text-sm text-neutral-300">
            <li className="flex items-center gap-2">
              <span className="text-[#FF3D00]">✓</span>
              Unlimited roasts per day
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#FF3D00]">✓</span>
              5 categories (screen time, sleep, spending, social media, fitness)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#FF3D00]">✓</span>
              3 roast tones (Normal, No Mercy, Destroy Me)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#FF3D00]">✓</span>
              Share cards without watermark
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#FF3D00]">✓</span>
              Full history all time
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#FF3D00]">✓</span>
              Grade trend charts (last 8 weeks)
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-500"
          >
            Maybe Later
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 rounded-lg bg-[#FF3D00] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Upgrade to Pro"}
          </button>
        </div>
      </div>
    </div>
  );
}
