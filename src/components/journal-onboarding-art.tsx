import type { ReactNode } from "react";

/**
 * Small illustrations above each onboarding question, in the journal treatment from the design
 * mockups: a soft blob, one hand-drawn object (soft fill offset by 3,3 plus an ink outline of about
 * 2.1), a star and a wavy line. Decorative only (aria-hidden), no faces, no text.
 *
 * Each object is a separate small component and ART maps a question key to one of them, so
 * replacing a drawing later means editing one function (or one line in ART).
 */

const INK = "var(--text)";
const line = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;
const STAR = "M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z";

// Soft shadow shape + outline, shared by every object (the mockups' "print offset" look).
function Shape({ d, fill }: { d: string; fill: string }) {
  return (
    <>
      <path d={d} fill={fill} transform="translate(3 3)" />
      <path d={d} {...line} strokeWidth="2.1" />
    </>
  );
}

/* ---- objects, all drawn in a 48x48 box ---- */

// Mockup 1: crescent moon (sleep).
const MOON = "M30 8 C 18 10, 10 21, 13 33 C 16 43, 29 47, 39 41 C 27 40, 21 30, 23 21 C 24 15, 27 11, 30 8 Z";
function Moon() {
  return <Shape d={MOON} fill="var(--powder)" />;
}

// Mockup 3: dial with a pointer (phone, doomscroll).
const DIAL = "M24 6 C 34 6, 42 14, 42 24 C 42 35, 34 42, 24 42 C 13 42, 6 34, 6 24 C 6 14, 14 6, 24 6 Z";
function Dial() {
  return (
    <>
      <Shape d={DIAL} fill="var(--sage)" />
      <path d="M24 15 C 29 15, 33 19, 33 24 C 33 29, 29 33, 24 33 C 19 33, 15 29, 15 24 C 15 19, 19 15, 24 15 Z" {...line} strokeWidth="1.8" />
      <circle cx="24" cy="24" r="2.2" fill={INK} />
      <path d="M26 22 L40 8 M36 8 L40 8 L40 12" {...line} strokeWidth="1.8" />
    </>
  );
}

// Mockup 5: coin (food delivery spend).
const COIN = "M24 7 C 34 7, 41 14, 41 24 C 41 34, 34 41, 24 41 C 14 41, 7 34, 7 24 C 7 14, 14 7, 24 7 Z";
function Coin() {
  return (
    <>
      <Shape d={COIN} fill="var(--milestone)" />
      <path d="M24 16 C 28 16, 31 19, 31 24 C 31 29, 28 32, 24 32 C 20 32, 17 29, 17 24 C 17 19, 20 16, 24 16 Z" {...line} strokeWidth="1.6" />
    </>
  );
}

// Own drawing: rounded app tile with a small badge dot (favourite app).
const TILE = "M14 8 L34 8 C 38 8, 40 10, 40 14 L40 34 C 40 38, 38 40, 34 40 L14 40 C 10 40, 8 38, 8 34 L8 14 C 8 10, 10 8, 14 8 Z";
function Tile() {
  return (
    <>
      <Shape d={TILE} fill="var(--powder)" />
      <path d="M17 24 L31 24 M24 17 L24 31" {...line} strokeWidth="1.8" />
      <circle cx="37" cy="11" r="4" fill="var(--clay)" stroke={INK} strokeWidth="1.6" />
    </>
  );
}

// Own drawing: small box with a lid (the promise you keep).
const BOX_BODY = "M10 21 L38 21 L38 39 C 38 40, 37 41, 36 41 L12 41 C 11 41, 10 40, 10 39 Z";
function Box() {
  return (
    <>
      <Shape d={BOX_BODY} fill="var(--sage)" />
      <path d="M7 14 L41 14 L41 21 L7 21 Z" {...line} strokeWidth="2.1" />
      <path d="M20 29 L28 29" {...line} strokeWidth="1.8" />
    </>
  );
}

// Own drawing: tally marks on a soft plate (times you moved this week).
const PLATE = "M8 12 L40 12 C 41 12, 42 13, 42 14 L42 34 C 42 35, 41 36, 40 36 L8 36 C 7 36, 6 35, 6 34 L6 14 C 6 13, 7 12, 8 12 Z";
function Tally() {
  return (
    <>
      <Shape d={PLATE} fill="var(--milestone)" />
      <path d="M14 17 L14 31 M21 17 L21 31 M28 17 L28 31 M35 17 L35 31" {...line} strokeWidth="1.9" />
      <path d="M10 29 L38 19" {...line} strokeWidth="1.9" />
    </>
  );
}

// Question key -> drawing. Change a line here to swap a picture.
const ART: Record<string, () => ReactNode> = {
  phoneHours: Dial,
  worstApp: Tile,
  sleepHours: Moon,
  foodDeliverySpend: Coin,
  neverDoThing: Box,
  socialMediaHours: Dial,
  workoutFrequency: Tally,
};

export function QuestionArt({ questionKey }: { questionKey: string }) {
  const Object_ = ART[questionKey] ?? Dial;
  return (
    <div className="relative h-[104px] w-[220px]" aria-hidden="true">
      {/* soft blob */}
      <svg width="150" height="104" viewBox="0 0 150 104" fill="none" className="absolute left-0 top-0">
        <path
          d="M10 52 C 6 22, 40 4, 78 8 C 112 12, 142 34, 138 62 C 134 90, 96 102, 60 98 C 30 94, 12 80, 10 52 Z"
          fill="var(--surface)"
        />
      </svg>
      {/* the object */}
      <div className="absolute left-[28px] top-[12px] [transform:rotate(-5deg)]">
        <svg width="80" height="80" viewBox="0 0 48 48" fill="none" className="shrink-0">
          <Object_ />
        </svg>
      </div>
      {/* star */}
      <div className="absolute left-[124px] top-[8px]">
        <svg width="26" height="26" viewBox="0 0 48 48" fill="none" className="shrink-0">
          <path d={STAR} fill="var(--milestone)" transform="translate(1.8 1.8)" />
          <path d={STAR} {...line} strokeWidth="1.5" />
        </svg>
      </div>
      {/* wavy line */}
      <div className="absolute left-[150px] top-[56px]">
        <svg width="70" height="18" viewBox="0 0 120 18" fill="none">
          <path
            d="M3 10 C 12 2, 20 2, 28 10 C 36 18, 44 18, 52 10 C 60 2, 68 2, 76 10 C 84 18, 92 18, 100 10 C 106 5, 112 4, 117 8"
            stroke="var(--clay)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
