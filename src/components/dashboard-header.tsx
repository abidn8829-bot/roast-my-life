"use client";

import { useState } from "react";
import Link from "next/link";
import { ProWaitlistModal } from "@/components/pro-waitlist-modal";
import { LogoutButton } from "@/components/logout-button";

type Props = {
  isPro: boolean;
  name: string;
};

export function DashboardHeader({ isPro, name }: Props) {
  const [showProWaitlistModal, setShowProWaitlistModal] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-[#FF3D00]">
            Roast My Life
          </Link>
          <div className="flex items-center gap-2">
            {isPro ? (
              <span className="flex items-center gap-1 rounded-full bg-[#FF3D00]/20 px-3 py-1 text-xs font-bold text-[#FF3D00]">
                🔥 PRO
              </span>
            ) : (
              <button
                onClick={() => setShowProWaitlistModal(true)}
                className="text-xs text-neutral-500 hover:text-[#FF3D00] transition"
              >
                Free Plan — Join Pro Waitlist 🔥
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-neutral-400 hover:text-[#FAFAFA] transition">
            Pricing
          </Link>
          <LogoutButton />
        </div>
      </div>
      <ProWaitlistModal
        isOpen={showProWaitlistModal}
        onClose={() => setShowProWaitlistModal(false)}
      />
    </>
  );
}
