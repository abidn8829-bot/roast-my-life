import Link from "next/link";

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
        stroke="#FF3D00"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 8H27V16"
        stroke="#FF3D00"
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
    desc: "Every conversation builds a profile of your habits and goals.",
  },
  {
    emoji: "🎯",
    title: "Personalized check-ins",
    desc: "Questions tailored to your specific arc, not generic reminders.",
  },
  {
    emoji: "📈",
    title: "Tracks real progress",
    desc: "Grades your improvement in specific areas, shows the trend.",
  },
  {
    emoji: "🔥",
    title: "Roasts with precision",
    desc: "Jokes get sharper because the AI actually knows you.",
  },
  {
    emoji: "🔄",
    title: "Rotates accountability",
    desc: "When you improve one area, it moves to the next challenge.",
  },
  {
    emoji: "⚡",
    title: "Builds streaks that stick",
    desc: "Daily micro-commits that compound into real change.",
  },
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
    desc: "Personalized questions based on your last roast, not a generic reminder.",
  },
  {
    number: "03",
    icon: "📊",
    title: "Watch yourself improve",
    desc: "Your grades update, themes rotate, accountability compounds.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }
      `}</style>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <EmberMark className="h-6 w-6" />
          <span className="font-display text-2xl tracking-wide">
            Ember<span className="text-[#FF3D00]">.ai</span>
          </span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-[#FAFAFA] border border-white/20 rounded-lg hover:bg-white/10 transition"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm bg-[#FF3D00] text-white rounded-lg hover:bg-[#e63600] hover:scale-[1.03] transition font-bold"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12 items-center px-6 py-20 md:py-32 max-w-6xl mx-auto">
        <div>
          <div className="inline-block bg-[#FF3D00]/10 border border-[#FF3D00]/30 text-[#FF3D00] text-xs font-mono tracking-widest px-4 py-2 rounded-full mb-8">
            AI ACCOUNTABILITY COACH
          </div>
          <h1 className="font-display text-6xl md:text-7xl leading-[0.95] mb-6">
            Ember<span className="text-[#FF3D00]">.ai</span>
          </h1>
          <p className="text-2xl md:text-3xl font-semibold leading-tight mb-6 max-w-xl">
            The AI accountability coach that{" "}
            <span className="text-[#FF3D00]">roasts you into taking action</span>.
          </p>
          <p className="text-base md:text-lg text-white/60 max-w-md mb-10 leading-relaxed">
            An AI companion that remembers your patterns, tracks your progress,
            and calls you out when you slip — all with humor that lands because
            it actually knows you.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-[#FF3D00] text-white font-bold text-lg rounded-xl hover:bg-[#e63600] hover:scale-[1.02] transition"
          >
            Start your arc →
          </Link>
        </div>

        <div className="hidden md:flex items-center justify-center">
          <div className="relative w-full max-w-xs aspect-square rounded-full border border-[#FF3D00]/20 flex items-center justify-center">
            <div className="absolute inset-6 rounded-full border border-[#FF3D00]/10" />
            <EmberMark className="h-28 w-28" />
          </div>
        </div>
      </section>

      {/* What Ember Does */}
      <section className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
        <div className="mb-12 max-w-lg">
          <h2 className="font-display text-4xl md:text-5xl mb-3">
            What Ember Does
          </h2>
          <p className="text-white/50 text-base">
            Not another habit tracker. An AI that actually pays attention.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="bg-[#111111] border border-[#FF3D00]/20 rounded-2xl p-6 transition hover:-translate-y-1 hover:border-[#FF3D00]/40"
            >
              <div className="text-3xl mb-4">{c.emoji}</div>
              <div className="font-bold text-lg mb-2">{c.title}</div>
              <div className="text-white/50 text-sm leading-relaxed">{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 md:py-28 max-w-6xl mx-auto">
        <h2 className="font-display text-4xl md:text-5xl mb-16 text-center">
          How It Works
        </h2>
        <div className="flex flex-col md:flex-row gap-10 md:gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`flex-1 ${i === 1 ? "md:mt-10" : ""}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="font-display text-3xl text-[#FF3D00]">
                  {step.number}
                </span>
                <span className="text-2xl">{step.icon}</span>
              </div>
              <div className="font-bold text-lg mb-2">{step.title}</div>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center text-center px-6 py-24 md:py-32">
        <h2 className="font-display text-4xl md:text-6xl mb-4 max-w-2xl">
          Start your accountability arc.
        </h2>
        <p className="text-white/50 text-base md:text-lg mb-10">
          No credit card required. First 7 days free.
        </p>
        <Link
          href="/signup"
          className="px-10 py-4 bg-[#FF3D00] text-white font-black text-xl rounded-xl hover:bg-[#e63600] hover:scale-[1.02] transition tracking-wide"
        >
          Get Started Free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-white/30 text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <EmberMark className="h-4 w-4" />
            <span>Ember.ai</span>
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#FAFAFA] transition">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#FAFAFA] transition">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-[#FAFAFA] transition">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
