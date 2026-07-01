"use client";

import Link from "next/link";
import { useState } from "react";
import { ProWaitlistModal } from "@/components/pro-waitlist-modal";

export default function PricingPage() {
  const [showProWaitlistModal, setShowProWaitlistModal] = useState(false);

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
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                1 roast per day
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                3 categories graded
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                Basic report card
              </li>
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
              <p className="text-3xl font-black text-[#FF3D00]">$4.99<span className="text-lg font-normal text-neutral-400">/month</span></p>
            </div>
            <ul className="mb-6 space-y-3 text-sm text-neutral-300">
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                Unlimited roasts
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                Full roast history
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                Destroy me mode
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#FF3D00]">✓</span>
                5 categories graded
              </li>
            </ul>
            <button
              onClick={() => setShowProWaitlistModal(true)}
              className="block w-full rounded-lg bg-[#FF3D00] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110"
            >
              Join Pro Waitlist 🔥
            </button>
          </div>

          {/* Elite Tier */}
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-6 opacity-60">
            <div className="mb-2 inline-block rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-400">
              COMING SOON
            </div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-[#FAFAFA]">Elite</h2>
              <p className="text-3xl font-black text-neutral-400">???</p>
            </div>
            <ul className="mb-6 space-y-3 text-sm text-neutral-400">
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">○</span>
                Real progress tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">○</span>
                Daily check-ins
              </li>
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">○</span>
                Streak system
              </li>
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">○</span>
                And more...
              </li>
            </ul>
            <button
              disabled
              className="block w-full rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-semibold text-neutral-500 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>

      <ProWaitlistModal
        isOpen={showProWaitlistModal}
        onClose={() => setShowProWaitlistModal(false)}
      />
    </main>
  );
}
