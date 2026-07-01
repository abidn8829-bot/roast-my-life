"use client";

import { useState } from "react";
import { ProWaitlistModal } from "@/components/pro-waitlist-modal";

export function UpgradeBanner() {
  const [showProWaitlistModal, setShowProWaitlistModal] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4">
        <p className="text-sm text-neutral-300">
          You&apos;re on the free plan — 1 roast per day
        </p>
        <button
          onClick={() => setShowProWaitlistModal(true)}
          className="mt-3 inline-block rounded-lg bg-[#FF3D00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Join Pro Waitlist 🔥
        </button>
      </div>
      <ProWaitlistModal
        isOpen={showProWaitlistModal}
        onClose={() => setShowProWaitlistModal(false)}
      />
    </>
  );
}
