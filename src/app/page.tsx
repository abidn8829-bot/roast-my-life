import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-sm">
        <span className="text-[#FF3D00] font-black text-xl tracking-widest">
          ROAST MY LIFE
        </span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-[#FAFAFA] border border-white/20 rounded-lg hover:bg-white/10 transition"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm bg-[#FF3D00] text-white rounded-lg hover:bg-[#e63600] transition font-bold"
          >
            Roast Me
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-block bg-[#FF3D00]/10 border border-[#FF3D00]/30 text-[#FF3D00] text-xs font-mono tracking-widest px-4 py-2 rounded-full mb-6">
          AI POWERED SELF DESTRUCTION
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 leading-none">
          YOUR LIFE.<br />
          <span className="text-[#FF3D00]">ROASTED.</span>
        </h1>
        <p className="text-lg text-white/60 max-w-md mb-10">
          Answer 5 questions. Get brutally roasted by AI. Share your shame with the world.
        </p>
        <Link
          href="/signup"
          className="px-10 py-4 bg-[#FF3D00] text-white font-black text-xl rounded-xl hover:bg-[#e63600] transition tracking-wide"
        >
          ROAST ME NOW →
        </Link>
      </section>

      {/* Sample Roast Card */}
      <section className="px-6 py-12 flex justify-center">
        <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-2xl p-6">
          <div className="text-[#FF3D00] font-mono text-xs tracking-widest mb-4">
            SAMPLE ROAST 🔥
          </div>
          <p className="text-white/70 text-sm leading-relaxed italic mb-6">
            "bestie you spend 8 hours a day on TikTok but only 4 hours sleeping?
            your brain is literally running on fumes and trending audios. you've
            spent $400 this month on Uber Eats which is wild because you also
            said you'd start cooking. that was 6 months ago. your future self
            is not okay. your future self is actually in shambles."
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Screen Time", grade: "F", color: "text-[#FF3D00]" },
              { label: "Sleep", grade: "D", color: "text-orange-400" },
              { label: "Spending", grade: "C", color: "text-amber-400" },
              { label: "Productivity", grade: "F", color: "text-[#FF3D00]" },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[#1A1A1A] border border-white/10 rounded-xl p-3 text-center"
              >
                <div className="text-white/40 text-xs mb-1">{item.label}</div>
                <div className={`text-2xl font-black ${item.color}`}>
                  {item.grade}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              emoji: "🔥",
              title: "Brutally Honest",
              desc: "No sugarcoating. No encouragement. Just the cold hard truth about your habits.",
            },
            {
              emoji: "🎯",
              title: "Scarily Accurate",
              desc: "Uses your real numbers to call you out. Specific, personal, and devastatingly accurate.",
            },
            {
              emoji: "📸",
              title: "Built to Share",
              desc: "Get a shareable Report Card image. Post it. Let your friends suffer too.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-[#141414] border border-white/10 rounded-2xl p-6"
            >
              <div className="text-3xl mb-3">{f.emoji}</div>
              <div className="font-bold text-lg mb-2">{f.title}</div>
              <div className="text-white/50 text-sm leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16">
        <h2 className="text-center text-white/30 font-mono text-xs tracking-widest mb-8">
          PEOPLE WHO HAVE BEEN DESTROYED
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: "sarah k.",
              handle: "@sarahkofficial",
              text: "i got an F in screen time and a D in sleep and honestly i deserved it. showed my therapist. she agreed.",
            },
            {
              name: "zaid m.",
              handle: "@zaidbuilds",
              text: "bro this app called me out for spending $340 on uber eats in ONE month. i am not okay. 10/10 would recommend.",
            },
            {
              name: "priya s.",
              handle: "@priyavibes",
              text: "the roast said my bed is 'just a suggestion at this point' because i sleep 4 hours. i felt that in my soul.",
            },
          ].map((t) => (
            <div
              key={t.handle}
              className="bg-[#141414] border border-white/10 rounded-2xl p-6"
            >
              <p className="text-white/70 text-sm leading-relaxed italic mb-4">
                "{t.text}"
              </p>
              <div className="text-white/40 text-xs">
                {t.name} · {t.handle}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center text-center px-6 py-24">
        <h2 className="text-4xl md:text-6xl font-black mb-6">
          READY TO FACE<br />
          <span className="text-[#FF3D00]">THE TRUTH?</span>
        </h2>
        <Link
          href="/signup"
          className="px-10 py-4 bg-[#FF3D00] text-white font-black text-xl rounded-xl hover:bg-[#e63600] transition tracking-wide"
        >
          GET ROASTED →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-white/30 text-sm">
        ROAST MY LIFE · Made with 🔥
      </footer>
    </main>
  );
}
