import Link from "next/link";

/**
 * Shared look for the journal login / signup pages. The class strings are copied from
 * src/components/journal-home.tsx (focus ring, Start button, wordmark) so the pages match.
 */

const ringBase = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-text";

// Same focus style as the landing page: 2px ink outline, 4px offset.
export const focusRing = `${ringBase} focus-visible:outline-offset-4`;

// Same shape as the landing "Start" button: ink fill, --on-accent text, 56 px high, rounded-xl.
// Disabled / loading: solid --text-faint fill (4.8:1 with the label) instead of a faded button.
export const primaryButton = `inline-flex h-14 w-full items-center justify-center rounded-xl bg-ember text-base font-medium text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-text-faint disabled:hover:opacity-100 ${focusRing}`;

// Outlined twin of the primary button: 1px hairline (ink at 28%), same height and radius.
export const outlineButton = `inline-flex h-14 w-full items-center justify-center rounded-xl border border-border-strong-legacy bg-transparent text-base font-medium text-text transition hover:bg-surface disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted ${focusRing}`;

export const fieldLabel = "flex flex-col gap-2 text-sm font-normal text-text-muted";

// 16 px text so iOS does not zoom on focus; .jl-input keeps autofill on the surface colour.
export const fieldInput = `jl-input h-12 w-full rounded-xl border border-border-strong-legacy bg-surface px-4 text-base text-text ${ringBase} focus-visible:outline-offset-2`;

export const inkLink = `inline-flex min-h-11 items-center font-medium text-text underline underline-offset-4 ${focusRing}`;

export const errorBox =
  "rounded-xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error-text";

export const noteBox =
  "rounded-xl border border-border-strong-legacy bg-surface px-4 py-3 text-sm text-text";

/** Wordmark exactly as in the landing nav: Ember in Fraunces italic with the small clay dot. */
export function JournalWordmark() {
  return (
    <Link href="/" className={`inline-flex min-h-11 items-center pr-3 ${focusRing}`}>
      <span className="jl-wm font-display relative text-[34px] font-normal leading-none">
        Ember
        <span
          className="jl-spark absolute -right-[11px] top-0 h-[7px] w-[7px] rounded-full bg-clay"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
