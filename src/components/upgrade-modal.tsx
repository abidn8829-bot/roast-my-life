"use client";

import { useState } from "react";
import { PRO_DAILY_LIMIT } from "@/lib/daily-limit";
import { PRO_FEATURES } from "@/lib/plans";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason?: "daily_limit" | "pro_feature";
  userEmail?: string;
};

export function UpgradeModal({ isOpen, onClose, reason = "daily_limit", userEmail }: Props) {
  const [loading, setLoading] = useState(false);

  function handleUpgrade() {
    setLoading(true);
    window.open(getUpgradeUrl(userEmail), "_blank");
    setLoading(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line-subtle-legacy bg-surface p-6">
        <div className="mb-6 text-center">
          <span className="text-5xl">🔥</span>
          <h2 className="mt-4 text-2xl font-bold text-text-legacy">
            {reason === "daily_limit" ? "Daily Limit Reached" : "Pro Feature"}
          </h2>
          <p className="mt-2 text-sm text-text-secondary-legacy">
            {reason === "daily_limit"
              ? `You've used your free roast for today. Upgrade to Pro for ${PRO_DAILY_LIMIT} roasts a day!`
              : "This feature is available for Pro users only."}
          </p>
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-line-subtle-legacy bg-bg p-4">
          <h3 className="text-sm font-semibold text-ember-legacy">Pro Features:</h3>
          <ul className="space-y-2 text-sm text-text-body-legacy">
            {PRO_FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-2">
                <span className="text-ember-legacy">✓</span>
                {f.title}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border-strong-legacy px-4 py-3 text-sm font-medium text-text-body-legacy transition hover:border-border-hover-legacy"
          >
            Maybe Later
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 rounded-lg bg-ember-legacy px-4 py-3 text-sm font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Upgrade to Pro"}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-text-secondary-legacy">{UPGRADE_EMAIL_HINT}</p>
      </div>
    </div>
  );
}
