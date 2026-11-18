import type { ReactNode } from "react";

/**
 * Small hand-drawn icons for the check-in answer buttons (see onboarding-wizard.tsx). They replace the emoji that
 * used to sit in front of each button. Plain inline SVG strokes in ink with a soft fill offset by 2,2 (the same
 * "print offset" look as journal-onboarding-art.tsx and journal-roast-ui.tsx). Decoration only: aria-hidden, no
 * animation, no faces, no text. The wording of the buttons lives in @/lib/safety, not here.
 */

const INK = "var(--text)";
const line = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;

// A loose hand-drawn disc, 24x24 box.
const DISC = "M12 3 C 17.5 3, 21 7, 21 12.2 C 21 17.6, 17.2 21, 12 21 C 6.6 21, 3 17.4, 3 12 C 3 6.8, 6.6 3, 12 3 Z";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** "I actually did it": a sage disc with a pen tick. */
export function DidItIcon() {
  return (
    <Icon>
      <path d={DISC} fill="var(--sage)" transform="translate(1.5 1.5)" />
      <path d={DISC} {...line} strokeWidth="1.6" />
      <path d="M7.2 12.6 C 8.6 13.4, 9.6 14.4, 10.5 16 C 12 11.8, 14.2 9, 16.8 7.4" {...line} strokeWidth="2" />
    </Icon>
  );
}

/** "I tried": a ring that is half filled. */
export function TriedIcon() {
  return (
    <Icon>
      <path d={DISC} fill="var(--powder)" transform="translate(1.5 1.5)" />
      <path d="M12 3 C 6.6 3, 3 6.8, 3 12 C 3 17.4, 6.6 21, 12 21 Z" fill="var(--powder)" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={DISC} {...line} strokeWidth="1.6" />
    </Icon>
  );
}

/** "I failed again": a powder disc with a pen cross. */
export function FailedIcon() {
  return (
    <Icon>
      <path d={DISC} fill="var(--powder)" transform="translate(1.5 1.5)" />
      <path d={DISC} {...line} strokeWidth="1.6" />
      <path d="M8.4 8.6 L15.6 15.4 M15.4 8.4 L8.6 15.6" {...line} strokeWidth="2" />
    </Icon>
  );
}

/** "Custom answer": a pencil with a soft butter body. */
export function PencilIcon() {
  return (
    <Icon>
      <path d="M5 19 L5.8 15 L15.6 5.2 C 16.4 4.4, 17.6 4.4, 18.4 5.2 L 18.8 5.6 C 19.6 6.4, 19.6 7.6, 18.8 8.4 L9 18.2 Z" fill="var(--milestone)" transform="translate(1.2 1.2)" />
      <path d="M5 19 L5.8 15 L15.6 5.2 C 16.4 4.4, 17.6 4.4, 18.4 5.2 L 18.8 5.6 C 19.6 6.4, 19.6 7.6, 18.8 8.4 L9 18.2 Z" {...line} strokeWidth="1.6" />
      <path d="M13.8 7 L17 10.2 M5.8 15 L9 18.2" {...line} strokeWidth="1.4" />
    </Icon>
  );
}

/** The three preset buttons' icons, in the order of CHECKIN_CHIP_LABELS (the wording lives in @/lib/safety). */
export const CHECKIN_CHIP_ICONS = [DidItIcon, TriedIcon, FailedIcon] as const;
