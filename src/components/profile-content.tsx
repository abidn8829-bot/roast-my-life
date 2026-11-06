"use client";

import { UpgradeBanner } from "@/components/upgrade-banner";
import { PRO_DAILY_LIMIT } from "@/lib/daily-limit";

type Props = {
  email: string;
  subscriptionTier: "free" | "pro";
};

export function ProfileContent({ email, subscriptionTier }: Props) {
  return (
    <div className="rounded-xl border border-line-subtle-legacy bg-surface p-6">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-text-secondary-legacy mb-1">Email</p>
          <p className="text-text-legacy">{email}</p>
        </div>

        <div>
          <p className="text-sm text-text-secondary-legacy mb-1">Subscription</p>
          <div className="flex items-center gap-2">
            {subscriptionTier === "pro" ? (
              <>
                <span className="flex items-center gap-1 rounded-full bg-ember-legacy/20 px-3 py-1 text-xs font-bold text-ember-legacy">
                  🔥 PRO
                </span>
                <span className="text-text-legacy">{PRO_DAILY_LIMIT} roasts a day, all features</span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-line-subtle-legacy px-3 py-1 text-xs font-semibold text-text-secondary-legacy">
                  FREE
                </span>
                <span className="text-text-secondary-legacy">1 roast/day, basic features</span>
              </>
            )}
          </div>
        </div>

        {subscriptionTier === "free" && <UpgradeBanner userEmail={email || undefined} />}
      </div>
    </div>
  );
}
