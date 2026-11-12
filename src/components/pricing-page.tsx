"use client";

import Link from "next/link";
import { useState } from "react";
import { EliteWaitlistModal } from "@/components/elite-waitlist-modal";
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from "@/lib/plans";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";
import { useUserEmail } from "@/lib/use-user-email";

export function PricingPage() {
  const [showEliteWaitlistModal, setShowEliteWaitlistModal] = useState(false);
  const userEmail = useUserEmail();

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-text-legacy">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href={userEmail ? "/dashboard" : "/"}
          className="mb-8 inline-block text-sm font-semibold text-ember-legacy hover:underline"
        >
          {userEmail ? "← Back to Dashboard" : "← Back to Home"}
        </Link>

        <header className="mb-12 text-center">
          <h1 className="text-4xl font-black tracking-tight mb-4">
            Choose Your <span className="text-ember-legacy">Roast Level</span>
          </h1>
          <p className="text-text-secondary-legacy">
            How much self-destruction can you handle?
          </p>
        </header>

        <div className="flex flex-col gap-6">
          {/* Free Tier */}
          <div className="rounded-xl border border-line-subtle-legacy bg-panel-legacy p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-text-legacy">Free</h2>
              <p className="text-3xl font-black text-ember-legacy">$0</p>
            </div>
            <ul className="mb-6 space-y-3 text-sm text-text-body-legacy">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-ember-legacy">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={userEmail ? "/dashboard" : "/signup"}
              className="block w-full rounded-lg border border-border-strong-legacy px-4 py-3 text-center text-sm font-semibold text-text-legacy transition hover:border-border-hover-legacy"
            >
              {userEmail ? "Current Plan" : "Get Started Free"}
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="rounded-xl border-2 border-ember-legacy bg-panel-legacy p-6 shadow-[0_0_32px_rgba(255,61,0,0.15)]">
            <div className="mb-2 inline-block rounded-full bg-ember-legacy/10 px-3 py-1 text-xs font-semibold text-ember-legacy">
              MOST POPULAR
            </div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-text-legacy">Pro</h2>
              <p className="text-3xl font-black text-ember-legacy">{PRO_PRICE}<span className="text-lg font-normal text-text-secondary-legacy">/month</span></p>
            </div>
            <ul className="mb-6 space-y-4 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f.title}>
                  <div className="flex items-center gap-2 font-semibold text-text-legacy">
                    <span className="text-ember-legacy">✓</span>
                    {f.title}
                  </div>
                  <p className="mt-1 pl-6 text-xs leading-relaxed text-text-secondary-legacy">{f.desc}</p>
                </li>
              ))}
            </ul>
            <a
              href={getUpgradeUrl(userEmail)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-ember-legacy px-4 py-3 text-center text-sm font-semibold text-on-accent shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110"
            >
              Upgrade to Pro 🔥
            </a>
            <p className="mt-2 text-center text-xs text-text-secondary-legacy">{UPGRADE_EMAIL_HINT}</p>
          </div>

          {/* Elite Tier */}
          <div className="rounded-xl border border-line-subtle-legacy bg-panel-legacy p-6">
            <div className="mb-2 inline-block rounded-full bg-line-subtle-legacy px-3 py-1 text-xs font-semibold text-text-secondary-legacy">
              COMING SOON
            </div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-text-legacy">Elite</h2>
              <p className="text-3xl font-black text-text-secondary-legacy">???</p>
            </div>
            <p className="mb-6 text-sm text-text-secondary-legacy">
              Everything in Pro, plus more we&apos;re still building. Join the waitlist to hear first.
            </p>
            <button
              type="button"
              onClick={() => setShowEliteWaitlistModal(true)}
              className="block w-full rounded-lg border border-border-strong-legacy px-4 py-3 text-center text-sm font-semibold text-text-legacy transition hover:border-border-hover-legacy"
            >
              Join Elite Waitlist 👑
            </button>
          </div>
        </div>
      </div>

      {showEliteWaitlistModal && (
        <EliteWaitlistModal isOpen onClose={() => setShowEliteWaitlistModal(false)} defaultEmail={userEmail} />
      )}
    </main>
  );
}
