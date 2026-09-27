"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { getUpgradeUrl } from "@/lib/upgrade-url";

type Props = {
  isPro: boolean;
  name: string;
  userEmail?: string;
};

export function DashboardHeader({ isPro, userEmail }: Props) {
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
              <a
                href={getUpgradeUrl(userEmail)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-muted hover:text-ember transition"
              >
                Free Plan — Upgrade to Pro 🔥
              </a>
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
    </>
  );
}
