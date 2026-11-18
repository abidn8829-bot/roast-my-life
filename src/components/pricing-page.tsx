"use client";

import Link from "next/link";
import { focusRing, outlineButton, primaryButton } from "@/components/journal-auth-ui";
import { PlanTick } from "@/components/journal-plan-ui";
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from "@/lib/plans";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";
import { useUserEmail } from "@/lib/use-user-email";

// Journal look. Rendered inside <JournalTheme> (see app/pricing/page.tsx). Every Free/Pro line is read from
// lib/plans.ts; nothing about the plans is typed here. Colour rules: ink text on every card; sage is a FILL only
// (the Pro card), never a text colour; no gradient, glow or shadow. The Pro card stands out by its fill and its
// heavier 2px ink border.
export function PricingPage() {
  const userEmail = useUserEmail();

  return (
    <main className="px-4 py-10 text-text">
      <div className="mx-auto w-full max-w-lg md:max-w-4xl">
        <Link
          href={userEmail ? "/dashboard" : "/"}
          className={`mb-8 inline-flex min-h-11 items-center text-sm text-text-muted underline underline-offset-4 hover:text-text ${focusRing}`}
        >
          {userEmail ? "← Back to Dashboard" : "← Back to Home"}
        </Link>

        <header className="mb-10 text-center">
          <h1 className="font-display mb-3 text-[38px] font-medium leading-[1.08] tracking-[-0.005em] md:text-5xl">
            Choose your roast level
          </h1>
          <p className="text-text-muted">How much self-destruction can you handle?</p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
          {/* Free */}
          <section aria-labelledby="plan-free" className="flex flex-col rounded-2xl border border-border-strong-legacy bg-surface p-6">
            <div className="mb-5">
              <h2 id="plan-free" className="text-[15px] font-medium text-text-muted">
                Free
              </h2>
              <p className="font-display text-4xl font-medium text-text">$0</p>
            </div>
            <ul className="mb-8 space-y-3 text-[15px] text-text">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <PlanTick />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href={userEmail ? "/dashboard" : "/signup"} className={`${outlineButton} mt-auto`}>
              {userEmail ? "Current Plan" : "Get Started Free"}
            </Link>
          </section>

          {/* Pro */}
          <section aria-labelledby="plan-pro" className="flex flex-col rounded-2xl border-2 border-text bg-sage p-6">
            <div className="mb-5">
              <h2 id="plan-pro" className="text-[15px] font-medium text-text">
                Pro
              </h2>
              <p className="font-display text-4xl font-medium text-text">
                {PRO_PRICE}
                <span className="font-sans text-base font-normal not-italic">/month</span>
              </p>
            </div>
            <ul className="mb-8 space-y-4 text-[15px] text-text">
              {PRO_FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <PlanTick />
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href={getUpgradeUrl(userEmail)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${primaryButton} mt-auto`}
            >
              Upgrade to Pro
            </a>
            <p className="mt-3 text-center text-xs leading-relaxed text-text">{UPGRADE_EMAIL_HINT}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
