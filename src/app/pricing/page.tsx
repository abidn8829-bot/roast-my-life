"use client";

import Link from "next/link";
import { useState } from "react";
import { EliteWaitlistModal } from "@/components/elite-waitlist-modal";
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from "@/lib/plans";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";
import { useUserEmail } from "@/lib/use-user-email";

export default function PricingPage() {
  const [showEliteWaitlistModal, setShowEliteWaitlistModal] = useState(false);
  const userEmail = useUserEmail();

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/dashboard"
          className="mb-8 inline-block text-sm font-semibold text-[#FF3D00] hover:underline"
        >
          ← Back to Dashboard
        </Link>

        <header className="mb-12 text-center">
          <h1 className="text-4xl font-black tracking-tight mb-4">
            Choose Your <span className="text-[#FF3D00]">Roast Level</span>
          </h1>
          <p className="text-neutral-400">
            How much self-destruction can you handle?
          </p>
        </header>

        <div className="flex flex-col gap-6">
          {/* Free Tier */}
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-[#FAFAFA]">Free</h2>
              <p className="text-3xl font-black text-[#FF3D00]">$0</p>
            </div>
            <ul className="mb-6 space-y-3 text-sm text-neutral-300">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-[#FF3D00]">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="block w-full rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-semibold text-[#FAFAFA] transition hover:border-neutral-500"
            >
              Current Plan
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="rounded-xl border-2 border-[#FF3D00] bg-[#111111] p-6 shadow-[0_0_32px_rgba(255,61,0,0.15)]">
            <div className="mb-2 inline-block rounded-full bg-[#FF3D00]/10 px-3 py-1 text-xs font-semibold text-[#FF3D00]">
              MOST POPULAR
            </div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-[#FAFAFA]">Pro</h2>
              <p className="text-3xl font-black text-[#FF3D00]">{PRO_PRICE}<span className="text-lg font-normal text-neutral-400">/month</span></p>
            </div>
            <ul className="mb-6 space-y-4 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f.title}>
                  <div className="flex items-center gap-2 font-semibold text-[#FAFAFA]">
                    <span className="text-[#FF3D00]">✓</span>
                    {f.title}
                  </div>
                  <p className="mt-1 pl-6 text-xs leading-relaxed text-neutral-400">{f.desc}</p>
                </li>
              ))}
            </ul>
            <a
              href={getUpgradeUrl(userEmail)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-[#FF3D00] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110"
            >
              Upgrade to Pro 🔥
            </a>
            <p className="mt-2 text-center text-xs text-neutral-400">{UPGRADE_EMAIL_HINT}</p>
          </div>

          {/* Elite Tier */}
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-6">
            <div className="mb-2 inline-block rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-400">
              COMING SOON
            </div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-[#FAFAFA]">Elite</h2>
              <p className="text-3xl font-black text-neutral-400">???</p>
            </div>
            <p className="mb-6 text-sm text-neutral-400">
              Everything in Pro, plus more we&apos;re still building. Join the waitlist to hear first.
            </p>
            <button
              type="button"
              onClick={() => setShowEliteWaitlistModal(true)}
              className="block w-full rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-semibold text-[#FAFAFA] transition hover:border-neutral-500"
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
