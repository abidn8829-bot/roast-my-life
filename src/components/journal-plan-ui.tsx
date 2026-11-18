import type { ReactNode } from "react";
import { fraunces, gaegu, sora } from "@/app/journal-fonts";

/**
 * Pieces for the journal look of the pricing page and the upgrade modal.
 * Presentation only: no plan numbers live here (every Free/Pro line comes from src/lib/plans.ts), no logic,
 * no analytics. Hand-drawn pieces are plain inline SVG strokes in ink with an optional clay fill (decoration only,
 * aria-hidden, no animation), in the style of journal-roast-ui.tsx.
 */

const INK = "var(--text)";
const CLAY = "var(--clay)";

/** A small hand-drawn tick, drawn with a slightly uneven pen stroke. Replaces the text check mark. */
export function PlanTick() {
  return (
    <svg
      className="mt-[3px] h-[18px] w-[18px] shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.4 10.9 C 5.1 12.1, 6.7 13.8, 8.1 16.1 C 10.4 10.6, 13.5 6.3, 16.8 3.7"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A small hand-drawn flame: clay fill, ink outline. Replaces the flame emoji. */
export function EmberFlame({ className = "h-14 w-12" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 56" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M24 4 C 26 14, 38 20, 38 34 C 38 45, 31 52, 24 52 C 16 52, 10 45, 10 35 C 10 28, 14 24, 17 20 C 18 25, 20 27, 22 27 C 21 18, 21 10, 24 4 Z"
        fill={CLAY}
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M24 48 C 20 47, 18 43, 19 39 C 20 36, 23 34, 24 31 C 27 35, 29 38, 28 43 C 27 46, 26 47, 24 48"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The journal colours and fonts on ONE subtree, without touching <html> (see globals.css,
 * [data-theme="journal-scope"]). The upgrade modal wraps itself in this, so it looks the same on every screen it is
 * opened from, including inside a [data-theme="dark"] wrapper or over a dark page.
 */
export function JournalScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-theme="journal-scope"
      className={`${fraunces.variable} ${sora.variable} ${gaegu.variable} font-sans text-text ${className}`}
    >
      {children}
    </div>
  );
}
