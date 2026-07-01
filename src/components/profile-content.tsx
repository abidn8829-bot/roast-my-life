"use client";

import { UpgradeBanner } from "@/components/upgrade-banner";

type Props = {
  email: string;
  subscriptionTier: "free" | "pro";
};

export function ProfileContent({ email, subscriptionTier }: Props) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#141414] p-6">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Email</p>
          <p className="text-[#FAFAFA]">{email}</p>
        </div>

        <div>
          <p className="text-sm text-neutral-400 mb-1">Subscription</p>
          <div className="flex items-center gap-2">
            {subscriptionTier === "pro" ? (
              <>
                <span className="flex items-center gap-1 rounded-full bg-[#FF3D00]/20 px-3 py-1 text-xs font-bold text-[#FF3D00]">
                  🔥 PRO
                </span>
                <span className="text-[#FAFAFA]">Unlimited roasts, all features</span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-400">
                  FREE
                </span>
                <span className="text-neutral-400">1 roast/day, basic features</span>
              </>
            )}
          </div>
        </div>

        {subscriptionTier === "free" && <UpgradeBanner />}
      </div>
    </div>
  );
}
