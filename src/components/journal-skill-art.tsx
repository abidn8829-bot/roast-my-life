/**
 * Small hand-drawn pieces for the "learn a skill" pages, in the same style as journal-roast-ui.tsx: plain inline SVG
 * strokes in ink, with a flat sage, powder or clay FILL where a shape needs one. Decoration only (aria-hidden), no
 * animation, no gradient. The meaning is always carried by words next to the icon, never by the icon alone.
 */

const INK = "var(--text)";
const SAGE = "var(--sage)";
const POWDER = "var(--powder)";
const CLAY = "var(--clay)";
const SURFACE = "var(--surface)";

type ArtProps = { className?: string };

function Frame({ className, children }: ArtProps & { children: React.ReactNode }) {
  return (
    <svg className={className ?? "h-6 w-6"} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** A padlock: a loose body with a sage fill, a shackle, a keyhole. */
export function SkillLockArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <path d="M8.2 11 C 7.9 7, 8.6 4.2, 12 4.1 C 15.4 4.2, 16.1 7, 15.8 11" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5.5 11.2 C 8 10.6, 16 10.6, 18.6 11.3 C 19.1 14.5, 19 17.6, 18.4 20 C 15.5 20.5, 9 20.5, 5.9 19.9 C 5.3 17.5, 5.2 14, 5.5 11.2 Z"
        fill={SAGE}
        stroke={INK}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15.1" r="1.25" fill={INK} />
      <path d="M12 16.2 L12 18.1" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </Frame>
  );
}

/** A tick in a loose sage circle: a finished step. */
export function SkillTickArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <path
        d="M12 3.2 C 17 3 21 7 20.8 12.2 C 20.6 17.3 16.8 21 11.8 20.8 C 6.8 20.6 3.1 16.8 3.3 11.8 C 3.5 7 7.3 3.3 12 3.2 Z"
        fill={SAGE}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.6 12.4 L10.7 15.6 L16.6 8.6" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** An open book with powder pages. */
export function SkillBookArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <path
        d="M12 6.2 C 9.6 4.8, 6.4 4.6, 3.6 5.4 L 3.8 18.4 C 6.6 17.6, 9.7 17.8, 12 19.2 C 14.3 17.8, 17.4 17.6, 20.2 18.4 L 20.4 5.4 C 17.6 4.6, 14.4 4.8, 12 6.2 Z"
        fill={POWDER}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 6.4 L12 19" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 8.6 C 7.6 8.3, 9 8.5, 10 9" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 11.6 C 7.6 11.3, 9 11.5, 10 12" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M14 9 C 15 8.5, 16.4 8.3, 18 8.6" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </Frame>
  );
}

/** A small calendar: two rings and a few day marks, one of them in clay. */
export function SkillCalendarArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <path
        d="M4.2 6.4 C 8 5.9, 16 5.9, 19.8 6.4 L 19.6 19.6 C 16 20.1, 8 20.1, 4.4 19.6 Z"
        fill={SURFACE}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.3 10.2 C 8 9.8, 16 9.8, 19.7 10.2" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 3.8 L8 7.4" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 3.8 L16 7.4" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8.6" cy="14.2" r="1.1" fill={INK} />
      <circle cx="12.2" cy="14.2" r="1.1" fill={INK} />
      <circle cx="15.8" cy="14.2" r="1.4" fill={CLAY} stroke={INK} strokeWidth="1" />
      <circle cx="8.6" cy="17.4" r="1.1" fill={INK} />
    </Frame>
  );
}
