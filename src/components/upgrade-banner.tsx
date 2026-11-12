"use client";

import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";

type Props = { userEmail?: string };

export function UpgradeBanner({ userEmail }: Props) {
  return (
    <div className="rounded-xl border border-line-subtle-legacy bg-panel-legacy p-4">
      <p className="text-sm text-text-body-legacy">
        You&apos;re on the free plan — 1 roast per day
      </p>
      <a
        href={getUpgradeUrl(userEmail)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-lg bg-ember-legacy px-4 py-2 text-sm font-semibold text-on-accent transition hover:brightness-110"
      >
        Upgrade to Pro 🔥
      </a>
      <p className="mt-2 text-xs text-text-tertiary-legacy">{UPGRADE_EMAIL_HINT}</p>
    </div>
  );
}
