import type { ReactNode } from "react";

/**
 * Hand-drawn decorations for the landing page. Purely decorative: every SVG is
 * aria-hidden and never carries data. Colours come from the journal tokens via
 * stroke/fill (sage, powder, butter and clay are fills/strokes only, never text).
 */

type SvgProps = { className?: string };

const ink = "var(--text)";
const line = {
  stroke: ink,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

/** Loose two-pass stroke that sits under one word. Stretches to the word's width. */
export function ScribbleUnderline({ className }: SvgProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 20"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 12 C 30 7, 62 9, 96 8 C 128 7, 160 6, 197 9"
        stroke="var(--clay)"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14 16 C 50 12, 98 13, 140 12 C 160 11.5, 176 12, 188 13"
        stroke="var(--clay)"
        strokeWidth="1.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Loose curved arrow pointing left (towards the thing it annotates). */
export function Arrow({ className }: SvgProps) {
  return (
    <svg className={className} viewBox="0 0 64 40" aria-hidden="true" focusable="false" {...line}>
      <path d="M60 8 C 48 4, 34 8, 26 18 C 20 25, 14 29, 6 30" strokeWidth="1.75" />
      <path d="M13 23 C 10 26, 7 28.5, 5.5 30 C 8 31.5, 11 33, 14 35.5" strokeWidth="1.75" />
    </svg>
  );
}

function Doodle({ className, children }: SvgProps & { children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Phone: rounded slab, a screen, a little speaker slot. */
export function PhoneDoodle({ className }: SvgProps) {
  const body = "M21 7 C 26 6, 38 6, 43 7 C 46 7.5, 47 9, 47 12 L 47.5 52 C 47.5 55, 46 57, 43 57 L 21.5 57.5 C 18.5 57.5, 17 56, 17 53 L 16.5 12 C 16.5 9, 18 7.5, 21 7 Z";
  return (
    <Doodle className={className}>
      <path d={body} fill="var(--powder)" transform="translate(2.5 2.5)" />
      <path d={body} {...line} strokeWidth="2" />
      <path d="M21 14 L 43 13.5 L 43.5 47 L 21 47.5 Z" {...line} strokeWidth="1.5" />
      <path d="M28.5 10.5 L 35.5 10.3" {...line} strokeWidth="1.75" />
      <path d="M30 52.5 C 31.5 51.8, 33 51.8, 34.5 52.4" {...line} strokeWidth="1.75" />
    </Doodle>
  );
}

/** Coffee cup on a saucer with two steam squiggles. */
export function CupDoodle({ className }: SvgProps) {
  const cup = "M14 26 C 22 25, 38 25, 46 26 C 46 36, 43 46, 34 48 C 30 49, 27 48.5, 24 47.5 C 17 45, 14 36, 14 26 Z";
  return (
    <Doodle className={className}>
      <path d={cup} fill="var(--milestone)" transform="translate(2.5 2.5)" />
      <path d={cup} {...line} strokeWidth="2" />
      <path d="M46 30 C 52 29, 55 33, 53 37 C 51.5 40, 48 41, 44.5 40" {...line} strokeWidth="1.75" />
      <path d="M9 53 C 20 55.5, 40 55.5, 53 52.5" {...line} strokeWidth="1.75" />
      <path d="M24 20 C 21 16, 27 13.5, 24 9" {...line} strokeWidth="1.5" />
      <path d="M33 20 C 30 15.5, 36 13, 33 8" {...line} strokeWidth="1.5" />
    </Doodle>
  );
}

/** Alarm clock: round face, two bells, hands, little feet. */
export function ClockDoodle({ className }: SvgProps) {
  const face = "M32 15 C 43 14.5, 51 23, 50.5 34 C 50 45, 42 52.5, 31.5 52 C 21 51.5, 13.5 43.5, 14 33 C 14.5 22.5, 22 15.5, 32 15 Z";
  return (
    <Doodle className={className}>
      <path d={face} fill="var(--sage)" transform="translate(2.5 2.5)" />
      <path d={face} {...line} strokeWidth="2" />
      <path d="M13 17 C 14 11, 20 8, 25 11.5 C 21 13, 16.5 15, 13 17 Z" {...line} strokeWidth="1.75" />
      <path d="M51 17 C 50 11, 44 8, 39 11.5 C 43 13, 47.5 15, 51 17 Z" {...line} strokeWidth="1.75" />
      <path d="M32 33.5 L 32.3 23.5 M 32 33.5 L 39.5 37" {...line} strokeWidth="2" />
      <path d="M20 50 L 16.5 55 M 44 50 L 47.5 55" {...line} strokeWidth="1.75" />
    </Doodle>
  );
}

/** Gym bag: barrel shape, two handles, a zip line. */
export function BagDoodle({ className }: SvgProps) {
  const bag = "M10 30 C 10 25, 14 23, 19 23 L 45 22.5 C 50.5 22.5, 54 25, 54 30 L 54.5 46 C 54.5 50, 51.5 52, 47 52 L 17 52.5 C 12.5 52.5, 9.5 50.5, 9.5 46.5 Z";
  return (
    <Doodle className={className}>
      <path d={bag} fill="var(--powder)" transform="translate(2.5 2.5)" />
      <path d={bag} {...line} strokeWidth="2" />
      <path d="M22 23 C 22 15, 26 12.5, 32 12.5 C 38 12.5, 42 15, 42 22.8" {...line} strokeWidth="2" />
      <path d="M14 31 C 26 30, 40 30, 50 31" {...line} strokeWidth="1.5" strokeDasharray="2.5 3.5" />
      <path d="M44 31 L 45 36" {...line} strokeWidth="1.75" />
      <path d="M19.5 23 L 20 52.5 M 44.5 22.6 L 44.5 52" {...line} strokeWidth="1.25" />
    </Doodle>
  );
}

/** Wavy hand-drawn line used instead of a plain border between sections. */
export function HandDivider({ className }: SvgProps) {
  return (
    <svg
      className={`block h-3 w-full ${className ?? ""}`}
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 6 Q 11.0 3.4, 21.0 6 Q 30.0 9.2, 39.0 6 Q 48.0 3.8, 57.0 6 Q 67.0 9.0, 77.0 6 Q 86.0 3.2, 95.0 6 Q 104.0 8.4, 113.0 6 Q 123.0 2.7, 133.0 6 Q 142.0 8.5, 151.0 6 Q 160.0 3.4, 169.0 6 Q 179.0 9.2, 189.0 6 Q 198.0 3.8, 207.0 6 Q 216.0 9.0, 225.0 6 Q 235.0 3.2, 245.0 6 Q 254.0 8.4, 263.0 6 Q 272.0 2.7, 281.0 6 Q 291.0 8.5, 301.0 6 Q 310.0 3.4, 319.0 6 Q 328.0 9.2, 337.0 6 Q 347.0 3.8, 357.0 6 Q 366.0 9.0, 375.0 6 Q 384.0 3.2, 393.0 6 Q 403.0 8.4, 399.0 6"
        stroke={ink}
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
