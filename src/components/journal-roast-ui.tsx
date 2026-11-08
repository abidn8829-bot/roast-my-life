import { focusRing } from "@/components/journal-auth-ui";

/**
 * Pieces for the journal look of the roast RESULT page (see roast-view.tsx and app/roast/[id]/page.tsx).
 * Presentation only: no logic, no analytics. Nothing here works out a grade: the letter and the score are the
 * values the page has always been given, this file only draws them.
 *
 * Two layouts share one markup: below 1280px the page is the stacked column, from 1280px up it is the two-page
 * spread (classes starting with `min-[1280px]:`). `compact:` is the same spread on a short screen (see globals.css).
 * The hand-drawn pieces are plain inline SVG strokes in ink and clay: decoration only (aria-hidden), no animation.
 */

// "← Back to dashboard" as a quiet text link (the page still has exactly one <Link>, with its pinned shape).
export const roastBackLink = `inline-flex min-h-11 items-center gap-2 text-sm text-text-muted underline underline-offset-4 hover:text-text ${focusRing}`;

// Small muted label above a block of the page. It is rendered as a real <h2>.
export const sectionLabel = "text-[13px] font-medium text-text-muted";

/** The bar length in whole percent: the score is 0 to 100, anything else is clamped (and a missing number is 0). */
export function barPercent(score: number): number {
  return Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 0;
}

const INK = "var(--text)";
const CLAY = "var(--clay)";

/**
 * One category: its label on the left, the grade letter in ink (this is what carries the meaning), a bar, and the
 * score out of 10. The bar is a powder track with a 1 px ink outline and a deeper-green fill whose length is the
 * score. No tint, no hover effect, no animation. `weakest` draws a clay hand-drawn circle round the letter (desktop
 * only). Render inside a <ul>.
 */
export function GradeRow({ label, grade, score, weakest = false }: { label: string; grade: string; score: number; weakest?: boolean }) {
  return (
    <li className="flex items-center gap-4 py-4 min-[1280px]:min-h-[52px] min-[1280px]:py-0 compact:min-h-[40px]">
      <span className="w-24 shrink-0 text-[15px] capitalize text-text-muted">{label}</span>
      <span className="relative w-7 shrink-0 font-display text-[28px] font-medium leading-none text-text min-[1280px]:w-14 min-[1280px]:text-[36px] compact:text-[30px]">
        {weakest ? (
          <svg
            className="absolute -left-2 -top-1.5 hidden h-[48px] w-[52px] min-[1280px]:block compact:-top-2 compact:h-[42px]"
            viewBox="0 0 52 48"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M12 24 C 10 10, 30 2, 40 10 C 50 18, 46 36, 32 42 C 20 46, 8 38, 8 26 C 8 20, 12 14, 20 10"
              stroke={CLAY}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        <span className="relative">{grade}</span>
      </span>
      <span aria-hidden="true" className="relative block h-3 min-w-0 flex-1 overflow-hidden rounded-[3px] border border-text bg-powder min-[1280px]:rounded-md">
        <span className="absolute inset-y-0 left-0 block bg-bar" style={{ width: `${barPercent(score)}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-text-muted min-[1280px]:w-[52px] min-[1280px]:text-sm">{Math.round(score / 10)}/10</span>
    </li>
  );
}

/** The dashed square in front of a plan step: the same dashed square as "today" in the landing page graph. */
export function StepMarker({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-[5px] block h-4 w-4 shrink-0 rounded-[3px] border border-dashed min-[1280px]:mt-[3px] ${onDark ? "border-bg" : "border-text"}`}
    />
  );
}

/** Ember wordmark with the small clay dot, as on the landing page. Not a link. Desktop top bar only. */
export function EmberMark() {
  return (
    <span className="relative font-display text-[26px] font-medium leading-none text-text" aria-hidden="true">
      Ember
      <span className="absolute -right-[9px] top-0 h-[5px] w-[5px] rounded-full bg-clay" />
    </span>
  );
}

/** A loose hand-drawn ring that stretches to fit the score. Desktop only. */
export function ScoreRing() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden h-full w-full min-[1280px]:block"
      viewBox="0 0 214 138"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22 68 C 17 24, 72 6, 111 7 C 164 9, 195 41, 188 77 C 181 113, 130 135, 87 131 C 44 127, 17 104, 24 65 C 27 46, 45 31, 69 22"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A small clay star next to the score. Desktop only. */
export function ScoreStar() {
  return (
    <svg
      className="absolute -right-1 -top-0.5 hidden h-[22px] w-[22px] min-[1280px]:block"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z" fill={CLAY} transform="translate(2 2)" />
      <path d="M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A wavy clay underline for the roast title. Desktop only. */
export function WavyUnderline() {
  return (
    <svg className="mt-0.5 hidden h-[14px] w-[110px] min-[1280px]:block" viewBox="0 0 130 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8 C 12 1, 20 1, 28 8 C 36 14, 44 14, 52 8 C 60 1, 68 1, 76 8 C 84 14, 92 14, 100 8 C 108 3, 116 3, 126 7" stroke={CLAY} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A small curved arrow between the plan steps and the check-in panel. Desktop only. */
export function PlanArrow() {
  return (
    <svg className="hidden h-10 w-10 shrink-0 min-[1280px]:block" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 26 C 12 10, 24 8, 34 18 M34 18 L25 16 M34 18 L32 27" stroke="var(--bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
