"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}

function GradeBar({
  label,
  grade,
  percent,
  color,
  revealed,
}: {
  label: string;
  grade: string;
  percent: number;
  color: string;
  revealed: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-text-muted">
        <span>{label}</span>
        <span style={{ color }}>{grade}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: revealed ? `${percent}%` : "0%", background: color }}
        />
      </div>
    </div>
  );
}

function EmberMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M4 24L12.5 15.5L18 20L27 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 8H27V16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CAPABILITIES = [
  {
    emoji: "🧠",
    title: "Remembers your patterns",
    desc: "Every check-in builds on the last — the AI knows your habits, not just your answers.",
  },
  {
    emoji: "🎯",
    title: "Personalized check-ins",
    desc: "Questions tailored to your specific arc, not generic reminders.",
  },
  {
    emoji: "📊",
    title: "A real Life Report Card",
    desc: "Letter grades across 5 categories, updated every time you check in.",
  },
  {
    emoji: "🔥",
    title: "Roasts with precision",
    desc: "Jokes get sharper because the AI actually knows you — your numbers, your excuses.",
  },
  {
    emoji: "🔄",
    title: "Rotates accountability",
    desc: "Improve one category, Ember moves to the next thing you're avoiding.",
  },
  {
    emoji: "⚡",
    title: "Builds streaks that stick",
    desc: "Daily micro-commits that compound into a report card you're not embarrassed by.",
  },
];

const PERSONAS: { name: string; emoji: string; desc: string; free?: boolean }[] = [
  { name: "Default", emoji: "🔥", desc: "Savage roast comedian", free: true },
  { name: "Gordon Ramsay", emoji: "👨‍🍳", desc: "Screaming chef energy" },
  { name: "Drill Sergeant", emoji: "🎖️", desc: "Brutal discipline" },
  { name: "Toxic Best Friend", emoji: "💅", desc: "Savage but loving" },
  { name: "Corporate Manager", emoji: "💼", desc: "Performance review style" },
  { name: "Savage Grandma", emoji: "👵", desc: "Disappointed but funny" },
];

const TONES: { name: string; emoji: string; desc: string; free?: boolean }[] = [
  { name: "Normal", emoji: "🔥", desc: "Honest and funny", free: true },
  { name: "No Mercy", emoji: "💀", desc: "Extremely brutal, no filter" },
  { name: "Destroy Me", emoji: "☠️", desc: "Absolutely savage, existential crisis level" },
];

const STEPS = [
  {
    number: "01",
    icon: "📝",
    title: "Answer a few questions",
    desc: "The AI builds your initial profile — habits, goals, the stuff you'd rather not admit.",
  },
  {
    number: "02",
    icon: "💬",
    title: "Daily check-ins",
    desc: "One personalized question based on your last roast, not a generic reminder.",
  },
  {
    number: "03",
    icon: "📊",
    title: "Watch yourself improve",
    desc: "Your grades update, themes rotate, accountability compounds.",
  },
];

const REPORT_CARD_CATEGORIES = [
  { label: "Sleep", grade: "F", percent: 18, color: "var(--grade-f)" },
  { label: "Discipline", grade: "D+", percent: 42, color: "var(--grade-d)" },
  { label: "Spending", grade: "C-", percent: 58, color: "var(--grade-c)" },
  { label: "Focus", grade: "B-", percent: 74, color: "var(--grade-b)" },
  { label: "Fitness", grade: "A-", percent: 88, color: "var(--grade-a)" },
];

const FAQS = [
  {
    q: "Is this actually personalized, or just a random insult generator?",
    a: "It's built from your real answers and check-ins — your habits, your numbers, your specific patterns. The roast changes because you do.",
  },
  {
    q: "What happens after my free roast today?",
    a: "Come back tomorrow for your next free roast, or upgrade to Pro for unlimited roasts, every tone, every persona.",
  },
  {
    q: "What's \"Your Arc\"?",
    a: "It's how Pro tracks where you're headed, not just where you are. The rest we'll let you discover.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — no contracts, no guilt trips (well, maybe one, this is Ember after all).",
  },
];

const FREE_FEATURES = [
  "1 roast per day",
  "Daily check-in",
  "5 categories graded",
  "Your Life Report Card",
];

const PRO_FEATURES = [
  {
    title: "Unlimited roasts",
    desc: "Every day, any time — no waiting for tomorrow.",
  },
  {
    title: "All 6 personas + every tone",
    desc: "Gordon Ramsay, Drill Sergeant, Destroy Me mode — the full arsenal.",
  },
  {
    title: "Your Arc",
    desc: "See how you stack up against everyone else brave enough to do this — and get a plan for closing the gap. We're not explaining the rest. You'll see.",
  },
  {
    title: "More categories, unlocking soon",
    desc: "We're not done grading you yet.",
  },
];

export default function Home() {
  const heroCard = useRevealOnScroll<HTMLDivElement>();
  const showcaseCard = useRevealOnScroll<HTMLDivElement>();
  const sampleDialogRef = useRef<HTMLDialogElement>(null);

  return (
    <main className="min-h-screen bg-bg text-text">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-bg/95 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <EmberMark className="h-6 w-6 text-ember" />
          <span className="text-2xl font-black tracking-tight">
            Ember<span className="text-ember">ai</span>
          </span>
        </div>
        <div className="hidden items-center gap-7 text-sm font-semibold text-text-muted md:flex">
          <a href="#what-it-does" className="transition hover:text-text">What it does</a>
          <a href="#personas" className="transition hover:text-text">Personas</a>
          <a href="#report-card" className="transition hover:text-text">Report card</a>
          <a href="#pricing" className="transition hover:text-text">Free vs Pro</a>
          <a href="#faq" className="transition hover:text-text">FAQ</a>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-border px-4 py-2 text-sm text-text transition hover:bg-surface"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-ember px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 hover:scale-[1.03]"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-[1.2fr_1fr] md:py-32">
        <div>
          <div className="mb-8 inline-block rounded-full border border-ember/30 bg-ember-soft px-4 py-2 font-mono text-xs tracking-widest text-ember">
            AI ACCOUNTABILITY COACH
          </div>
          <h1 className="mb-6 text-6xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Ember<span className="text-ember">ai</span>
          </h1>
          <p className="mb-6 max-w-xl text-2xl font-semibold leading-tight md:text-3xl">
            The AI accountability coach that{" "}
            <span className="text-ember">roasts you into taking action</span>.
          </p>
          <p className="mb-10 max-w-md text-base leading-relaxed text-text-muted md:text-lg">
            Answer 5 quick questions. Ember roasts your habits with brutal honesty, then hands you
            a Life Report Card — and checks in on you tomorrow.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-ember px-8 py-4 text-lg font-bold text-white transition hover:brightness-110 hover:scale-[1.02]"
            >
              Start your arc →
            </Link>
            <button
              type="button"
              onClick={() => sampleDialogRef.current?.showModal()}
              className="inline-flex items-center justify-center rounded-xl border-2 border-border px-8 py-4 text-base font-bold text-text transition hover:border-text-faint"
            >
              See a sample roast
            </button>
          </div>
          <p className="mt-4 text-xs font-medium text-text-faint">
            Free forever tier · No credit card required
          </p>
        </div>

        <div className="flex justify-center md:justify-end">
          <div
            ref={heroCard.ref}
            className="animate-ember-float w-full max-w-xs rounded-3xl border border-border bg-surface p-6 shadow-2xl"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-faint">
              Life Report Card
            </p>
            <p className="mb-5 text-2xl font-black">
              This Week: <span className="text-grade-d">D+</span>
            </p>
            <div className="space-y-3">
              <GradeBar label="Sleep" grade="F" percent={20} color="var(--grade-f)" revealed={heroCard.revealed} />
              <GradeBar label="Discipline" grade="D" percent={38} color="var(--grade-d)" revealed={heroCard.revealed} />
              <GradeBar label="Spending" grade="C-" percent={52} color="var(--grade-c)" revealed={heroCard.revealed} />
              <GradeBar label="Focus" grade="B-" percent={70} color="var(--grade-b)" revealed={heroCard.revealed} />
            </div>
          </div>
        </div>
      </section>

      {/* What Ember Does */}
      <section id="what-it-does" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-12 max-w-lg">
          <h2 className="mb-3 text-4xl font-black tracking-tight md:text-5xl">
            What Ember Does
          </h2>
          <p className="text-base text-text-muted">
            Not another habit tracker. An AI that actually pays attention.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-1 hover:border-ember/40"
            >
              <div className="mb-4 text-3xl">{c.emoji}</div>
              <div className="mb-2 text-lg font-bold">{c.title}</div>
              <div className="text-sm leading-relaxed text-text-muted">{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section id="personas" className="border-y border-border bg-surface/40 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-lg">
            <h2 className="mb-3 text-4xl font-black tracking-tight md:text-5xl">
              Choose Your Roaster
            </h2>
            <p className="text-base text-text-muted">
              Six ways to get destroyed. One is free — the rest are Pro.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PERSONAS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-xl border-2 p-4 text-center transition ${
                  p.free
                    ? "border-ember bg-ember-soft"
                    : "border-border bg-surface hover:border-ember/40"
                }`}
              >
                {!p.free && (
                  <span className="absolute -top-2 -right-2 rounded-full bg-ember px-2 py-0.5 text-[10px] font-bold text-white">
                    PRO
                  </span>
                )}
                <div className="mb-2 text-3xl">{p.emoji}</div>
                <div className="text-sm font-bold">{p.name}</div>
                <div className="mt-1 text-xs text-text-faint">{p.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-14 max-w-lg">
            <h3 className="mb-3 text-2xl font-black tracking-tight">Pick Your Intensity</h3>
            <p className="text-sm text-text-muted">Normal is free. The rest, you have to earn.</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TONES.map((t) => (
              <div
                key={t.name}
                className={`relative rounded-2xl border-2 p-6 text-left ${
                  t.free ? "border-ember bg-ember-soft" : "border-border bg-surface"
                }`}
              >
                {!t.free && (
                  <span className="absolute top-4 right-4 rounded-full bg-ember px-2 py-0.5 text-[10px] font-bold text-white">
                    PRO
                  </span>
                )}
                <div className="mb-3 text-3xl">{t.emoji}</div>
                <div className="mb-1 font-bold">{t.name}</div>
                <p className="text-sm text-text-muted">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <h2 className="mb-16 text-center text-4xl font-black tracking-tight md:text-5xl">
          How It Works
        </h2>
        <div className="flex flex-col gap-10 md:flex-row md:gap-6">
          {STEPS.map((step, i) => (
            <div key={step.number} className={`flex-1 ${i === 1 ? "md:mt-10" : ""}`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl font-black text-ember">{step.number}</span>
                <span className="text-2xl">{step.icon}</span>
              </div>
              <div className="mb-2 text-lg font-bold">{step.title}</div>
              <p className="max-w-xs text-sm leading-relaxed text-text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Report Card Showcase */}
      <section id="report-card" className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ember">
            The Life Report Card
          </p>
          <h2 className="text-4xl font-black tracking-tight md:text-5xl">
            Letter grades for your bad decisions.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-text-muted">
            Five categories, graded A to F based on what you actually told Ember. Download it,
            post it, and let your friends find out how their week is going too.
          </p>
          <ul className="mt-6 space-y-2 text-sm font-semibold">
            <li className="flex items-center gap-2">
              <span className="text-grade-a">●</span> A / B — you&apos;re doing better than you think
            </li>
            <li className="flex items-center gap-2">
              <span className="text-grade-c">●</span> C — room to improve, no judgment (okay, some judgment)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-grade-f">●</span> D / F — Ember has thoughts, and it will share them
            </li>
          </ul>
        </div>

        <div className="flex justify-center md:justify-end">
          <div
            ref={showcaseCard.ref}
            className="w-full max-w-sm rounded-3xl border border-border bg-surface p-7 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-faint">
                Overall Grade
              </p>
              <p className="text-4xl font-black text-grade-c">C-</p>
            </div>
            <div className="space-y-4">
              {REPORT_CARD_CATEGORIES.map((c) => (
                <GradeBar
                  key={c.label}
                  label={c.label}
                  grade={c.grade}
                  percent={c.percent}
                  color={c.color}
                  revealed={showcaseCard.revealed}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Pro */}
      <section id="pricing" className="border-y border-border bg-surface/40 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-4xl font-black tracking-tight md:text-5xl">
              Free vs <span className="text-ember">Pro</span>
            </h2>
            <p className="text-base text-text-muted">
              Start free. Upgrade when you're ready to see the whole picture.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-border bg-surface p-7">
              <h3 className="text-xl font-bold">Free</h3>
              <p className="mt-1 text-3xl font-black">$0</p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-ember">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 block rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold transition hover:border-text-faint"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-ember bg-surface p-7 shadow-[0_0_32px_rgba(255,90,54,0.15)]">
              <span className="absolute -top-3 left-7 rounded-full bg-ember px-3 py-1 text-xs font-bold text-white">
                MOST POPULAR
              </span>
              <h3 className="text-xl font-bold">Pro</h3>
              <p className="mt-1 text-3xl font-black">
                $4.99<span className="text-lg font-normal text-text-faint">/month</span>
              </p>
              <ul className="mt-6 space-y-4 text-sm">
                {PRO_FEATURES.map((f) => (
                  <li key={f.title}>
                    <div className="flex items-center gap-2 font-semibold text-text">
                      <span className="text-ember">✓</span>
                      {f.title}
                    </div>
                    <p className="mt-1 pl-6 text-xs leading-relaxed text-text-muted">{f.desc}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="mt-8 block rounded-lg bg-ember px-4 py-3 text-center text-sm font-bold text-white shadow-[0_0_24px_rgba(255,90,54,0.3)] transition hover:brightness-110"
              >
                Upgrade to Pro 🔥
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-surface/40 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-10 text-center text-3xl font-black tracking-tight md:text-4xl">
            Questions, answered honestly.
          </h2>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-surface p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-bold marker:content-none">
                  {item.q}
                  <svg
                    className="h-4 w-4 shrink-0 transition group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center px-6 py-24 text-center md:py-32">
        <h2 className="mb-4 max-w-2xl text-4xl font-black tracking-tight md:text-6xl">
          Start your accountability arc.
        </h2>
        <p className="mb-10 text-base text-text-muted md:text-lg">
          No credit card required. First roast is on us.
        </p>
        <Link
          href="/signup"
          className="rounded-xl bg-ember px-10 py-4 text-xl font-black tracking-wide text-white transition hover:brightness-110 hover:scale-[1.02]"
        >
          Get Started Free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-text-faint">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <EmberMark className="h-4 w-4 text-ember" />
            <span>Emberai</span>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition hover:text-text">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-text">
              Terms
            </Link>
            <Link href="/contact" className="transition hover:text-text">
              Contact
            </Link>
          </div>
        </div>
      </footer>

      {/* Sample Roast Dialog */}
      <dialog
        ref={sampleDialogRef}
        aria-labelledby="sample-roast-title"
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="p-7">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-ember">
                Sample Roast
              </p>
              <h3 id="sample-roast-title" className="text-xl font-black">
                💅 Toxic Best Friend
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => sampleDialogRef.current?.close()}
              className="rounded-full p-1.5 text-text-faint transition hover:bg-surface-2 hover:text-text"
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

          <p className="text-[15px] leading-relaxed text-text-muted">
            "Okay so bestie 🙄 you slept four hours THREE nights in a row and then had the
            audacity to ask me why you're &ldquo;in a mood.&rdquo; Your phone knows more about your
            3am thoughts than your own therapist does at this point 📱💀. And that $340 DoorDash
            spree? Babe. We talked about this. I'm only saying it because I love you: you're not
            &ldquo;busy,&rdquo; you're avoiding your whole life with main character energy and zero
            plot 💅✨. Fix it. I'll wait. 😘"
          </p>
          <p className="mt-3 text-xs italic text-text-faint">
            Illustrative example — your real roast is generated from your own answers.
          </p>

          <Link
            href="/signup"
            className="mt-6 block rounded-xl bg-ember px-6 py-3.5 text-center text-base font-extrabold text-white transition hover:brightness-110"
          >
            Get my real roast →
          </Link>
        </div>
      </dialog>
    </main>
  );
}
