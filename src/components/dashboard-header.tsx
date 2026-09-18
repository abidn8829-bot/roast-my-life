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
          <Link href="/" className="text-sm font-bold text-ember">
            Ember
          </Link>
          <div className="flex items-center gap-2">
            {isPro ? (
              <span className="flex items-center gap-1 rounded-full bg-ember-soft px-3 py-1 text-xs font-bold text-ember">
                🔥 PRO
              </span>
            ) : (
              <button
                onClick={() => setShowProWaitlistModal(true)}
                className="text-xs text-text-muted hover:text-ember transition"
              >
                Free Plan — Join Pro Waitlist 🔥
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/arc" className="text-sm text-text-muted hover:text-text transition">
            Your Arc
          </Link>
          <Link href="/pricing" className="text-sm text-text-muted hover:text-text transition">
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
