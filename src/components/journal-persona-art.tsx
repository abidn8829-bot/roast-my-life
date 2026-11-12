import type { ReactNode } from "react";

/**
 * Small hand-drawn icons for the persona rows, one per persona, keyed by the stored persona id.
 * Same treatment as the other journal doodles: a soft colour fill drawn again offset by 3,3, then an
 * ink outline of about 2.1, round joins and caps, drawn in a 48-unit box. Objects only: no faces, no
 * text, no gradients. Decorative (aria-hidden), no animation. To swap a picture, edit its function
 * (or one line in ICONS).
 */

const INK = "var(--text)";
const line = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;

// Soft fill offset by 3,3 plus the ink outline.
function Shape({ d, fill, sw = 2.1 }: { d: string; fill: string; sw?: number }) {
  return (
    <>
      <path d={d} fill={fill} transform="translate(3 3)" />
      <path d={d} {...line} strokeWidth={sw} />
    </>
  );
}

// Ember: a small flame.
function Flame() {
  return (
    <>
      <Shape d="M24 6 C 28 14, 38 18, 36 30 C 35 38, 29 43, 23 43 C 15 43, 10 37, 11 29 C 12 23, 16 20, 18 14 C 20 18, 22 18, 24 6 Z" fill="var(--milestone)" />
      <path d="M23 40 C 19 40, 17 36, 19 32 C 21 29, 23 28, 24 24 C 27 29, 29 32, 28 36 C 27 39, 25 40, 23 40 Z" {...line} strokeWidth="1.6" />
    </>
  );
}

// Chef: a frying pan with one thin wisp of smoke.
function Pan() {
  return (
    <>
      <Shape d="M20 19 C 27 19, 32 24, 32 31 C 32 38, 27 43, 20 43 C 13 43, 8 38, 8 31 C 8 24, 13 19, 20 19 Z" fill="var(--powder)" />
      <Shape d="M31 29 L42 29 C 43.5 29, 44 30, 44 31 C 44 32, 43.5 33, 42 33 L31 33 Z" fill="var(--powder)" />
      <path d="M20 24 C 24 24, 27 27, 27 31 C 27 35, 24 38, 20 38 C 16 38, 13 35, 13 31 C 13 27, 16 24, 20 24 Z" {...line} strokeWidth="1.6" />
      <path d="M20 15 C 17 12, 23 9, 20 5" {...line} strokeWidth="1.6" />
    </>
  );
}

// Drill sergeant: a whistle (mouthpiece, round chamber, ring).
function Whistle() {
  return (
    <>
      <Shape d="M7 22 L22 22 C 23 19, 26 17, 30 17 C 36 17, 41 22, 41 28 C 41 34, 36 39, 30 39 C 26 39, 23 37, 22 33 L22 31 L7 31 C 5.5 31, 5 30, 5 29 L5 24 C 5 23, 5.5 22, 7 22 Z" fill="var(--sage)" />
      <path d="M12 22 L12 19.5 L17 19.5 L17 22" {...line} strokeWidth="1.6" />
      <circle cx="30" cy="28" r="3.2" {...line} strokeWidth="1.6" />
      <circle cx="39" cy="15" r="3.2" {...line} strokeWidth="1.8" />
    </>
  );
}

// Toxic best friend: a speech bubble with a jagged edge.
function JaggedBubble() {
  return (
    <>
      <Shape d="M7 17 L12 12 L17 15 L23 9 L29 14 L35 10 L40 16 L37 22 L42 27 L36 31 L38 36 L30 34 L24 38 L19 33 L16 42 L13 33 L7 32 L10 26 L6 22 Z" fill="var(--clay)" />
      <path d="M15 21 L31 21 M15 27 L26 27" {...line} strokeWidth="1.6" />
    </>
  );
}

// Corporate manager: a clipboard with two short lines.
function Clipboard() {
  return (
    <>
      <Shape d="M10 10 L38 10 C 39.5 10, 40 11, 40 12 L40 40 C 40 41.5, 39 42, 38 42 L10 42 C 8.5 42, 8 41, 8 40 L8 12 C 8 11, 8.5 10, 10 10 Z" fill="var(--powder)" />
      <Shape d="M18 6 L30 6 C 31 6, 32 7, 32 8 L32 12 L16 12 L16 8 C 16 7, 17 6, 18 6 Z" fill="var(--milestone)" />
      <path d="M15 23 L33 23 M15 30 L27 30" {...line} strokeWidth="1.8" />
    </>
  );
}

// Savage grandma: a ball of yarn with two crossed knitting needles.
function Yarn() {
  return (
    <>
      <Shape d="M22 15 C 29 15, 35 21, 35 28 C 35 35, 29 41, 22 41 C 15 41, 9 35, 9 28 C 9 21, 15 15, 22 15 Z" fill="var(--sage)" />
      <path d="M12 22 C 18 24, 26 24, 33 20 M10.5 29 C 18 31, 27 31, 34.5 27 M13 36 C 19 36, 26 36, 32 34" {...line} strokeWidth="1.6" />
      <path d="M24 40 L43 12 M44 38 L27 10" {...line} strokeWidth="2.1" />
      <circle cx="43.5" cy="11.5" r="2.4" fill="var(--milestone)" stroke={INK} strokeWidth="1.6" />
      <circle cx="26.5" cy="9.5" r="2.4" fill="var(--milestone)" stroke={INK} strokeWidth="1.6" />
    </>
  );
}

// Stored persona id -> drawing.
const ICONS: Record<string, () => ReactNode> = {
  default: Flame,
  gordon_ramsay: Pan,
  drill_sergeant: Whistle,
  toxic_friend: JaggedBubble,
  corporate_manager: Clipboard,
  savage_grandma: Yarn,
};

/** The icon for a persona id, or nothing if the id is unknown. */
export function PersonaIcon({ id }: { id: string }) {
  const Icon = ICONS[id];
  if (!Icon) return null;
  return (
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false" className="shrink-0">
      <Icon />
    </svg>
  );
}
