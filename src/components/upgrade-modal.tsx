"use client";

import { useState } from "react";
import { focusRing } from "@/components/journal-auth-ui";
import { EmberFlame, JournalScope, PlanTick } from "@/components/journal-plan-ui";
import { PRO_FEATURES, UPGRADE_LIMIT_TEXT } from "@/lib/plans";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason?: "daily_limit" | "pro_feature";
  userEmail?: string;
};

const buttonBase = `inline-flex h-12 flex-1 items-center justify-center rounded-xl px-4 text-sm font-medium transition ${focusRing}`;

// Journal look. The modal wraps itself in <JournalScope>, so it looks the same wherever it is opened (the onboarding
// wizard renders it both beside journal screens and inside a dark wrapper). Plan wording and numbers come from
// lib/plans.ts only (UPGRADE_LIMIT_TEXT, PRO_FEATURES); nothing about the plans is typed here.
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
    <JournalScope className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border-2 border-text bg-surface p-6 text-left"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <EmberFlame />
          <h2 id="upgrade-modal-title" className="font-display mt-4 text-[30px] font-medium leading-tight text-text">
            {reason === "daily_limit" ? "Daily limit reached" : "Pro feature"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
            {reason === "daily_limit" ? UPGRADE_LIMIT_TEXT : "This feature is available for Pro users only."}
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-border-strong-legacy bg-bg p-4">
          <h3 className="mb-3 text-[13px] font-medium text-text-muted">Pro features</h3>
          <ul className="space-y-2.5 text-[15px] text-text">
            {PRO_FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <PlanTick />
                <span>{f.title}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`${buttonBase} border border-border-strong-legacy bg-transparent text-text hover:bg-bg`}
          >
            Maybe Later
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className={`${buttonBase} bg-ember text-on-accent hover:opacity-90 disabled:cursor-not-allowed disabled:bg-text-faint disabled:hover:opacity-100`}
          >
            {loading ? "Loading..." : "Upgrade to Pro"}
          </button>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-text-muted">{UPGRADE_EMAIL_HINT}</p>
      </div>
    </JournalScope>
  );
}
