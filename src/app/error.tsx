"use client";

import Link from "next/link";
import { outlineButton, primaryButton } from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";

// The friendly page for anything that throws below the root layout. Journal look: powder mist, ink green text.
// The error itself is never shown: not the message, not the digest. (Next still reports it on the server.)
// global-error.tsx is the twin for errors in the root layout; it has to draw its own <html> and cannot share this file.

const ERROR_MESSAGE = "Something went wrong. Try again.";

/** A loose hand-drawn circular arrow ("try again"): ink ring, clay arrowhead, decoration only. */
function RetryMark() {
  return (
    <svg className="mb-6 h-14 w-14" viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M42 17 C 35 9, 23 8, 16 16 C 9 24, 11 38, 20 44 C 29 50, 43 46, 47 34"
        stroke="var(--text)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M39.7 39.3 L47 34 L49.5 42.7" stroke="var(--clay)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <JournalTheme>
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-[22rem] flex-col items-center text-center">
          <RetryMark />
          <h1 className="font-display mb-8 text-[28px] font-medium leading-snug">{ERROR_MESSAGE}</h1>
          <div className="flex w-full flex-col gap-3">
            <button type="button" onClick={() => reset()} className={primaryButton}>
              Try again
            </button>
            <Link href="/" className={outlineButton}>
              Go Home
            </Link>
          </div>
        </div>
      </main>
    </JournalTheme>
  );
}
