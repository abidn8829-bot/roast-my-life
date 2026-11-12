"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { PRO_DAILY_LIMIT } from "@/lib/daily-limit";

/**
 * Home page in the light "journal" theme. Render it inside <JournalTheme>.
 *
 * Copy rule: every string comes from the design mockup (JournalLanding.dc.html), except
 *   - "Five questions. Free to start."  (mockup says "No signup."; not true yet)
 *   - "Example profile"
 *   - "Pricing" (nav link) and "What is Ember AI?" (footer link, text from the old page)
 *   - the FAQ (word for word from FAQS in home-page.tsx)
 *   - the sample-roast dialog body (from the old page, emoji removed) and its aria-label "Close"
 * Hover mechanics live in globals.css (.jl-*). Sage, powder, butter and clay are fills and
 * decoration only, never text colours.
 */

// TODO: switch to "Five questions. No signup." when anonymous onboarding ships.
const START_NOTE = "Five questions. Free to start.";

const FAQS = [
  {
    q: "Is this actually personalized, or just a random insult generator?",
    a: "It's built from your real answers and check-ins — your habits, your numbers, your specific patterns. The roast changes because you do.",
  },
  {
    q: "What happens after my free roast today?",
    a: `Come back tomorrow for your next free roast, or upgrade to Pro for ${PRO_DAILY_LIMIT} roasts a day, every persona.`,
  },
  {
    q: 'What\'s "Your Arc"?',
    a: "It's how Pro tracks where you're headed, not just where you are. The rest we'll let you discover.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — no contracts, no guilt trips (well, maybe one, this is Ember after all).",
  },
];

// TODO(copy): body text of the sample roast dialog is the old home page's sample with the
// emoji removed. Replace with approved journal copy if you want something else.
const SAMPLE_ROAST =
  "“Okay so bestie you slept four hours THREE nights in a row and then had the audacity to ask me why you’re “in a mood.” Your phone knows more about your 3am thoughts than your own therapist does at this point. And that $340 DoorDash spree? Babe. We talked about this. I’m only saying it because I love you: you’re not “busy,” you’re avoiding your whole life with main character energy and zero plot. Fix it. I’ll wait.”";
const SAMPLE_NOTE = "Illustrative example — your real roast is generated from your own answers.";

const STEPS: { title: string; text: string; note: string; icon: ReactNode }[] = [
  {
    title: "Say what you plan.",
    text: "Five questions about sleep, movement, focus and money. About two minutes.",
    note: "two minutes, tops",
    icon: <Pencil size={52} />,
  },
  {
    title: "Check in once a day.",
    text: "One question: did you do the thing you said you would?",
    note: "once. not hourly.",
    icon: <Calendar size={52} />,
  },
  {
    title: "Get the honest version.",
    text: "A roast that fits what actually happened, and a grade that moves when you do.",
    note: "fair, not cruel",
    icon: <Chat size={52} />,
  },
];

/* ------------------------------------------------------------------ example graph data */
// Deterministic (no Date.now / Math.random) so server and client render the same cells.
const SHADES = ["var(--surface)", "var(--powder)", "var(--sage)", "var(--progress)"];
const GRAPH_LINES = [
  "Gym. The gym was shocked.",
  "Five hours of sleep, called a lifestyle.",
  "Showed up. Bold.",
  "Did the thing you said you would.",
  "On time, for once.",
  "A quiet win.",
];
const N = 140;
const COLS = N / 7;
const CELLS = Array.from({ length: N }, (_, i) => {
  const col = Math.floor(i / 7);
  const row = i % 7;
  const v = (col * 5 + row * 3 + (col % 3) * 2 + Math.floor(col / 2)) % 11;
  const boost = col > COLS * 0.65 ? 2 : col > COLS * 0.35 ? 1 : 0;
  const level = Math.min(3, Math.floor(v / 3) + (v > 4 ? boost : 0));
  const d = new Date(2026, 10, 3 - (N - 1 - i));
  const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
  let tip = `${label}. Rest day.`;
  if (level === 1) tip = `${label}. Checked in.`;
  if (level >= 2) tip = `${label}. ${GRAPH_LINES[(i * 7) % GRAPH_LINES.length]}`;
  const today = i === N - 1;
  if (today) tip = `${label}. Today, still open.`;
  // Tooltips near the left / right edge open inward so they never leave the screen.
  const edge = col < 5 ? "l" : col > COLS - 6 ? "r" : "";
  return { bg: today ? "transparent" : SHADES[level], today, tip, edge };
});

/* ---------------------------------------------------------------------------- icons */
// Hand-drawn line icons: paths copied from the mockup. Fill = soft colour, offset copy = "print" shadow.
const STAR = "M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z";
const FLAME = "M24 6 C 28 14, 38 18, 36 30 C 35 38, 29 43, 23 43 C 15 43, 10 37, 11 29 C 12 23, 16 20, 18 14 C 20 18, 22 18, 24 6 Z";
const PENCIL = "M10 38 L12 30 L30 12 L36 18 L18 36 Z";
const PLANT = "M24 40 C 20 30, 22 20, 24 14 C 29 20, 29 32, 24 40 Z M24 32 C 18 32, 12 28, 11 20 C 18 20, 23 24, 24 32 Z";
const MOON = "M30 8 C 18 10, 10 21, 13 33 C 16 43, 29 47, 39 41 C 27 40, 21 30, 23 21 C 24 15, 27 11, 30 8 Z";
const CALENDAR = "M8 12 C 8 10, 10 9, 12 9 L36 9 C 38 9, 40 10, 40 12 L40 36 C 40 38, 38 40, 36 40 L12 40 C 10 40, 8 38, 8 36 Z";
const CHAT = "M8 12 C 8 9, 11 8, 14 8 L34 8 C 38 8, 40 10, 40 14 L40 26 C 40 30, 38 32, 34 32 L22 32 L14 40 L14 32 C 10 32, 8 30, 8 26 Z";
const SCRIBBLE = "M52 4 C 80 2, 98 16, 96 32 C 94 50, 66 58, 42 56 C 16 54, 3 42, 5 26 C 7 10, 30 3, 56 5 C 66 6, 74 9, 80 14";
const STAMP_RING = "M48 5 C 72 3, 92 22, 91 47 C 90 72, 70 91, 46 90 C 22 89, 5 70, 6 46 C 7 22, 26 6, 50 6 C 58 6, 64 8, 70 11";

type IconSize = number | string;

function Icon({ size, children }: { size: IconSize; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}

function Star({ size, t = 1.5, sw = 1.5 }: { size: IconSize; t?: number; sw?: number }) {
  return (
    <Icon size={size}>
      <path d={STAR} fill="var(--milestone)" transform={`translate(${t} ${t})`} />
      <path d={STAR} stroke="var(--text)" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </Icon>
  );
}

function Flame({ size, t, sw }: { size: IconSize; t: number; sw: number }) {
  return (
    <Icon size={size}>
      <path d={FLAME} fill="var(--milestone)" transform={`translate(${t} ${t})`} />
      <path d={FLAME} stroke="var(--text)" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path
        d="M23 40 C 19 40, 17 36, 19 32 C 21 29, 23 28, 24 24 C 27 29, 29 32, 28 36 C 27 39, 25 40, 23 40 Z"
        stroke="var(--text)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </Icon>
  );
}

function Pencil({ size }: { size: IconSize }) {
  return (
    <Icon size={size}>
      <path d={PENCIL} fill="var(--milestone)" transform="translate(2.4 2.4)" />
      <path d={PENCIL} stroke="var(--text)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d="M28 14 L34 20 M10 38 L18 36" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </Icon>
  );
}

function Plant({ size }: { size: IconSize }) {
  return (
    <Icon size={size}>
      <path d={PLANT} fill="var(--sage)" transform="translate(2.4 2.4)" />
      <path d={PLANT} stroke="var(--text)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d="M24 44 L24 28 M15 44 L33 44" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </Icon>
  );
}

function Moon({ size }: { size: IconSize }) {
  return (
    <Icon size={size}>
      <path d={MOON} fill="var(--powder)" transform="translate(2.4 2.4)" />
      <path d={MOON} stroke="var(--text)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </Icon>
  );
}

function Calendar({ size }: { size: IconSize }) {
  return (
    <Icon size={size}>
      <path d={CALENDAR} fill="var(--powder)" transform="translate(2.4 2.4)" />
      <path d={CALENDAR} stroke="var(--text)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d="M8 18 L40 18 M16 5 L16 12 M32 5 L32 12" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="29" r="3.4" fill="var(--milestone)" stroke="var(--text)" strokeWidth="1.4" />
    </Icon>
  );
}

function Chat({ size }: { size: IconSize }) {
  return (
    <Icon size={size}>
      <path d={CHAT} fill="var(--powder)" transform="translate(2.4 2.4)" />
      <path d={CHAT} stroke="var(--text)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d="M16 17 L32 17 M16 24 L26 24" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </Icon>
  );
}

/** Hand-drawn loop that draws itself when its row is hovered / focused (.jl-hov .jl-draw). */
function Scribble({ className }: { className?: string }) {
  return (
    <svg
      className={`jl-draw absolute left-0 top-0 h-full w-full overflow-visible ${className ?? ""}`}
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={SCRIBBLE}
        stroke="var(--clay)"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Wordmark({ size }: { size: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <span
      className={`jl-wm font-display relative font-normal leading-none ${big ? "text-[34px]" : "text-[22px]"}`}
    >
      Ember
      <span
        className={`jl-spark absolute top-0 rounded-full bg-clay ${big ? "-right-[11px] h-[7px] w-[7px]" : "-right-[9px] h-[5px] w-[5px]"}`}
        aria-hidden="true"
      />
    </span>
  );
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`flex items-center gap-2 text-sm font-normal text-text-muted ${className ?? ""}`}>
      <Star size={20} />
      {children}
    </h2>
  );
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text";

/* ---------------------------------------------------------------------- the graph */
function ContribGraph() {
  const [active, setActive] = useState(N - 1);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  // One tab stop for the whole graph; arrow keys move between days (columns are weeks).
  const move = (to: number) => {
    const next = Math.max(0, Math.min(N - 1, to));
    setActive(next);
    cellRefs.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    const target =
      e.key === "ArrowRight" ? i + 7 : e.key === "ArrowLeft" ? i - 7 : e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? N - 1 : null;
    if (target === null) return;
    e.preventDefault();
    move(target);
  };

  return (
    <div
      role="group"
      aria-labelledby="jl-graph-caption"
      className="grid w-full max-w-[476px] grid-flow-col gap-1 [grid-auto-columns:minmax(0,1fr)] [grid-template-rows:repeat(7,auto)]"
    >
      {CELLS.map((c, i) => (
        <div
          key={i}
          ref={(el) => {
            cellRefs.current[i] = el;
          }}
          role="img"
          aria-label={c.tip}
          tabIndex={i === active ? 0 : -1}
          onFocus={() => setActive(i)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`jl-cell box-border aspect-square rounded-[4px] ${c.edge} ${c.today ? "border border-dashed border-text" : ""}`}
          style={{ background: c.bg }}
        >
          <span className="jl-tip" aria-hidden="true">
            {c.tip}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- hero doodles */
// Positions are the mockup's pixel values, converted to container-query units of the 420 px
// circle, so the whole drawing scales down on small screens.
const q = (px: number) => `${((px / 420) * 100).toFixed(2)}cqw`;

function Doodle({ x, y, size, rotate, children }: { x: number; y: number; size: number; rotate?: number; children: ReactNode }) {
  return (
    <div
      className="absolute z-[1]"
      style={{ left: q(x), top: q(y), width: q(size), height: q(size), transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    >
      {children}
    </div>
  );
}

function DoodleCircle() {
  return (
    <div
      className="@container relative aspect-[420/340] w-full max-w-[420px] xl:absolute xl:-right-5 xl:-top-[110px] xl:w-[420px]"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 470 400" fill="none">
        <path
          d="M232 14 C 330 -4, 438 58, 452 168 C 466 270, 396 372, 286 388 C 178 404, 62 360, 28 258 C -6 154, 70 36, 232 14 Z"
          fill="var(--surface)"
        />
        <path
          d="M236 26 C 326 10, 428 66, 440 168 C 452 262, 388 360, 286 374 C 184 388, 76 348, 44 254 C 14 160, 84 44, 236 26 Z"
          stroke="var(--text)"
          strokeWidth="1.2"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
      </svg>
      <Doodle x={110} y={46} size={120} rotate={-6}>
        <Flame size="100%" t={3.5} sw={2.2} />
      </Doodle>
      <Doodle x={16} y={90} size={34}>
        <Star size="100%" t={2} sw={1.6} />
      </Doodle>
      <Doodle x={270} y={80} size={54} rotate={10}>
        <Pencil size="100%" />
      </Doodle>
      <Doodle x={250} y={180} size={58}>
        <Plant size="100%" />
      </Doodle>
      <Doodle x={16} y={180} size={50}>
        <Moon size="100%" />
      </Doodle>
      <div className="absolute z-[1]" style={{ left: q(100), top: q(210), width: q(120), height: q(18) }}>
        <svg className="h-full w-full" viewBox="0 0 120 18" fill="none">
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

/* -------------------------------------------------------------------------- page */
const startButton =
  "inline-flex h-14 items-center justify-center rounded-xl bg-ember text-base font-medium text-on-accent transition hover:opacity-90";

export function JournalHome() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="jl mx-auto flex w-full max-w-[1280px] flex-col px-5 pb-12 pt-6 sm:px-10 xl:px-24 xl:pt-8">
      {/* Nav */}
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className={`inline-flex min-h-11 items-center pr-3 ${focusRing}`}>
          <Wordmark size="lg" />
        </Link>
        <nav className="flex items-center gap-2 text-sm text-text-muted sm:gap-8">
          <a href="#how-it-works" className={`hidden min-h-11 items-center sm:inline-flex ${focusRing}`}>
            How it works
          </a>
          <a href="#profile" className={`hidden min-h-11 items-center sm:inline-flex ${focusRing}`}>
            Profile
          </a>
          <Link href="/pricing" className={`inline-flex min-h-11 items-center px-2 sm:px-0 ${focusRing}`}>
            Pricing
          </Link>
          <Link
            href="/login"
            className={`inline-flex min-h-11 items-center rounded-[10px] border border-text px-[18px] text-text ${focusRing}`}
          >
            Log in
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mt-14 flex flex-col gap-14 xl:mt-[110px] xl:flex-row xl:items-start xl:justify-between xl:gap-0">
          <div className="relative z-[1] flex flex-col gap-[30px] xl:w-[620px]">
            <button
              type="button"
              onClick={() => dialogRef.current?.showModal()}
              className={`inline-flex min-h-11 items-center gap-2.5 self-start text-sm text-text-muted underline decoration-dotted decoration-1 underline-offset-4 ${focusRing}`}
            >
              <Star size={22} />A sample roast
            </button>
            <h1 className="font-display text-[clamp(2.75rem,9.5vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.01em]">
              You said nine hours of screen time like it was a{" "}
              <span className="font-note relative isolate inline-block px-2.5 text-[1.22em] font-bold not-italic leading-[0.9]">
                <svg
                  className="absolute -left-0.5 top-1.5 -z-10 h-[86%] w-[calc(100%+4px)]"
                  viewBox="0 0 200 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 14 C 40 4, 150 2, 194 10 C 198 26, 196 44, 190 54 C 150 58, 50 58, 8 52 C 2 40, 2 26, 6 14 Z"
                    fill="var(--powder)"
                  />
                </svg>
                personality.
              </span>
            </h1>
            <p className="max-w-[500px] text-lg font-light leading-[1.55] text-text-muted">
              Tell Ember what you plan to do. Check in each day. It tells you how it went, with a joke.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/signup" className={`${startButton} px-11 ${focusRing}`}>
                Start
              </Link>
              <span className="text-sm text-text-muted">{START_NOTE}</span>
            </div>
          </div>

          <div className="relative flex flex-col gap-8 xl:h-[520px] xl:w-[440px] xl:shrink-0 xl:gap-0">
            <DoodleCircle />
            <div className="jl-hov relative z-[1] flex flex-col items-start gap-3 xl:absolute xl:left-[-30px] xl:top-[206px] xl:w-[476px] xl:items-end">
              <span
                className="font-note text-[28px] leading-tight text-text-muted xl:mr-2.5"
                style={{ transform: "rotate(-3deg)" }}
              >
                Look at you, showing up.
              </span>
              <ContribGraph />
              <span id="jl-graph-caption" className="text-[13px] text-text-muted">
                Example data. The dashed one is today.
              </span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-24 flex scroll-mt-6 flex-col gap-6 xl:mt-[120px] xl:flex-row xl:gap-24">
          <SectionLabel className="xl:mt-8 xl:w-[200px] xl:shrink-0 xl:self-start">How it works</SectionLabel>
          <ol className="flex flex-1 flex-col border-b border-border">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                tabIndex={0}
                className={`jl-hov flex flex-col gap-4 border-t border-border py-6 lg:py-[30px] lg:flex-row lg:items-center lg:gap-7 ${focusRing}`}
              >
                <div className="flex items-center gap-5 lg:gap-7">
                  <div className="flex w-14 justify-center">{s.icon}</div>
                  <span className="font-display relative w-6 text-center text-[30px] font-normal text-text-muted">
                    {i + 1}
                    <span className="absolute -left-3 -top-1.5 h-11 w-12" aria-hidden="true">
                      <Scribble />
                    </span>
                  </span>
                  <h3 className="font-display text-[30px] font-normal leading-[1.1] lg:w-[330px] lg:text-[36px]">{s.title}</h3>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-base font-light leading-[1.6] text-text-muted">{s.text}</span>
                  <span
                    className="jl-rev font-note self-start text-[22px] text-text-muted"
                    style={{ "--r": "-2deg" } as CSSProperties}
                  >
                    {s.note}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Your profile */}
        <section
          id="profile"
          className="mt-24 flex scroll-mt-6 flex-col gap-6 border-t border-border pt-8 xl:mt-[130px] xl:flex-row xl:gap-24"
        >
          <SectionLabel className="xl:h-6 xl:w-[200px] xl:shrink-0 xl:self-start">Your profile</SectionLabel>
          <div className="flex flex-1 flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 lg:w-[420px]">
              <h3 className="font-display text-[32px] font-normal leading-[1.12] sm:text-[40px]">
                Your streak and badges live on a page you can share.
              </h3>
              <p className="text-base font-light leading-[1.6] text-text-muted">
                Private until you switch it on. Sleep and spending stay hidden. A missed day is a gap, not a failure.
              </p>
              <div className="mt-3 flex items-center gap-3.5">
                <Plant size={52} />
                <span className="font-note text-2xl text-text-muted" style={{ transform: "rotate(-2deg)" }}>
                  private until you say so
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-8">
              <span className="text-[13px] text-text-muted">Example profile</span>
              <div tabIndex={0} className={`jl-hov relative flex items-baseline gap-3 ${focusRing}`}>
                <span className="font-display relative px-[22px] text-[110px] font-normal leading-[0.9] sm:text-[150px]">
                  6
                  <span className="absolute -left-[0.04em] -top-[0.093em] h-[1em] w-[0.867em]" aria-hidden="true">
                    <Scribble />
                  </span>
                </span>
                <span className="text-lg font-light text-text-muted">days</span>
                <span
                  className="jl-rev font-note absolute left-[150px] top-[30px] w-[150px] text-[22px] leading-[1.05] text-text-muted sm:left-[190px]"
                  style={{ "--r": "-4deg" } as CSSProperties}
                >
                  one more day and you earn a stamp
                </span>
              </div>
              <div className="flex gap-6">
                <div tabIndex={0} className={`jl-stamp flex flex-col items-center gap-2 ${focusRing}`}>
                  <svg width="92" height="92" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                    <path d={STAMP_RING} stroke="var(--text)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path
                      d="M48 30 L51.5 44.5 L66 48 L51.5 51.5 L48 66 L44.5 51.5 L30 48 L44.5 44.5 Z"
                      stroke="var(--text)"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                      fill="var(--milestone)"
                    />
                    <g className="jl-mark">
                      <path d="M80 14 L80 22 M76 18 L84 18" stroke="var(--clay)" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M12 80 L12 86 M9 83 L15 83" stroke="var(--clay)" strokeWidth="1.3" strokeLinecap="round" />
                    </g>
                  </svg>
                  <span className="font-display text-[15px] font-normal">first roast</span>
                </div>
                <div tabIndex={0} className={`jl-stamp flex flex-col items-center gap-2 ${focusRing}`}>
                  <svg width="92" height="92" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                    <path d={STAMP_RING} stroke="var(--text)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path
                      d="M34 58 C 26 44, 40 30, 55 34 C 68 38, 68 54, 56 62"
                      stroke="var(--text)"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M52 63 L58 63 L58 56"
                      stroke="var(--text)"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <g className="jl-mark">
                      <path d="M80 14 L80 22 M76 18 L84 18" stroke="var(--clay)" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M12 80 L12 86 M9 83 L15 83" stroke="var(--clay)" strokeWidth="1.3" strokeLinecap="round" />
                    </g>
                  </svg>
                  <span className="font-display text-[15px] font-normal">comeback</span>
                </div>
                <div tabIndex={0} className={`jl-stamp flex flex-col items-center gap-2 ${focusRing}`}>
                  <svg width="92" height="92" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                    <path
                      d={STAMP_RING}
                      stroke="var(--text-muted)"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray="4 4"
                    />
                    {[32.0, 37.4, 42.8, 48.2, 53.6, 59.0, 64.4].map((x) => (
                      <path
                        key={x}
                        d={`M${x} 38 L${x} 58`}
                        stroke="var(--text-muted)"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    ))}
                  </svg>
                  <span className="font-display text-[15px] font-normal text-text-muted">7 days</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="mt-28 flex flex-col items-center gap-7 border-t border-border pt-16 text-center xl:mt-[140px] xl:pt-20">
          <div className="flex items-end gap-[18px]" aria-hidden="true">
            <Star size={30} t={2} sw={1.6} />
            <Flame size={64} t={3} sw={2} />
            <Star size={22} t={1.6} sw={1.4} />
          </div>
          <h2 className="font-display max-w-[780px] text-[clamp(2.25rem,7vw,3.75rem)] font-medium leading-[1.05]">
            Find out what your week looks like to someone else.
          </h2>
          <Link href="/signup" className={`${startButton} px-12 ${focusRing}`}>
            Start
          </Link>
          <span className="text-sm text-text-muted">{START_NOTE}</span>
        </section>

        {/* FAQ: plain list, word for word from the old page.
            TODO(copy): the mockup has no FAQ, so there is no section label; add one if wanted. */}
        <section className="mt-20 xl:pl-[296px]">
          <ul>
            {FAQS.map((f) => (
              <li key={f.q} className="border-t border-border py-7">
                <h3 className="font-display text-[26px] font-normal leading-[1.15] sm:text-[30px]">{f.q}</h3>
                <p className="mt-2 max-w-[620px] text-base font-light leading-[1.6] text-text-muted">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="jl-foot relative mt-24 flex flex-col gap-4 overflow-x-clip border-t border-border pt-6 text-[13px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="jl-shoot" style={{ left: 40, top: -40, transform: "rotate(-4deg)" }} aria-hidden="true">
          <svg width="110" height="14" viewBox="0 0 110 14" fill="none">
            <path d="M2 7 L96 4 L96 10 Z" fill="var(--clay)" fillOpacity="0.75" />
            <g transform="translate(96 1)">
              <path
                d="M6 0.5 L7.7 4.4 L11.8 4.7 L8.6 7.3 L9.7 11.3 L6 9.2 L2.4 11.4 L3.5 7.4 L0.3 4.6 L4.4 4.4 Z"
                fill="var(--milestone)"
                stroke="var(--text)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </span>
        <Link href="/" className={`inline-flex min-h-11 items-center pr-3 text-text ${focusRing}`}>
          <Wordmark size="sm" />
        </Link>
        <div className="flex flex-wrap items-center gap-x-7">
          <Link href="/privacy" className={`inline-flex min-h-11 min-w-11 items-center justify-center ${focusRing}`}>
            Privacy
          </Link>
          <Link href="/terms" className={`inline-flex min-h-11 min-w-11 items-center justify-center ${focusRing}`}>
            Terms
          </Link>
          <Link href="/contact" className={`inline-flex min-h-11 min-w-11 items-center justify-center ${focusRing}`}>
            Contact
          </Link>
          <Link href="/what-is-ember-ai" className={`inline-flex min-h-11 min-w-11 items-center justify-center ${focusRing}`}>
            What is Ember AI?
          </Link>
        </div>
      </footer>

      {/* Sample roast dialog (native <dialog>: Escape and the close button both close it). */}
      <dialog
        ref={dialogRef}
        aria-labelledby="jl-sample-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-text backdrop:bg-overlay/70"
      >
        <div className="p-6 sm:p-7">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="jl-sample-title" className="flex items-center gap-2.5 text-sm font-normal text-text-muted">
              <Star size={22} />A sample roast
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
              className={`-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:text-text ${focusRing}`}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <p className="font-display text-[22px] font-normal leading-[1.3]">{SAMPLE_ROAST}</p>
          <p className="mt-3 text-xs text-text-muted">{SAMPLE_NOTE}</p>
          <Link href="/signup" className={`${startButton} mt-6 w-full ${focusRing}`}>
            Start
          </Link>
        </div>
      </dialog>
    </div>
  );
}
