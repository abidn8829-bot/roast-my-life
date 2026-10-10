import Link from "next/link";
import { PRO_PRICE } from "@/lib/plans";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "What is Ember AI? | Ember AI",
  description:
    "Ember AI is an AI accountability app. Answer 5 quick questions, get a Life Score and report card, then check in daily so you actually follow through.",
  path: "/what-is-ember-ai",
  absoluteTitle: true,
});

export default function WhatIsEmberAiPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-semibold text-[#FF3D00] hover:underline"
        >
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-black mb-6">What is Ember AI?</h1>

        <p className="mb-8 text-lg leading-relaxed text-neutral-300">
          Ember AI is an AI accountability app. You answer 5 quick questions about your phone
          time, sleep, spending and biggest broken promise. Ember AI roasts your habits using
          your own answers, gives you a Life Score and a report card, and checks in on you every
          day so you actually do something about it.
        </p>

        <Link
          href="/signup"
          className="mb-12 inline-block rounded-xl bg-ember px-8 py-4 text-lg font-bold text-white transition hover:brightness-110 hover:scale-[1.02]"
        >
          Start your arc →
        </Link>

        <div className="space-y-6 text-neutral-300">
          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">What does Ember AI do?</h2>
            <p className="leading-relaxed">
              Ember AI is a web app that holds you accountable for your habits. It asks 5 quick
              questions, writes a funny, honest roast from your answers, grades you in five
              categories, and gives you a daily check-in so you keep going.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">How is the roast different?</h2>
            <p className="leading-relaxed">
              Every roast is written from your own answers, like your screen time, sleep and
              spending. It&apos;s blunt and funny, with a point: to push you into doing something
              about it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">What is the Life Score?</h2>
            <p className="leading-relaxed">
              Your Life Score is an overall score from 0 to 100 based on your answers. Ember AI
              also grades you from A to F in five categories: Sleep, Fitness, Discipline, Focus
              and Spending. Your report card shows those grades, and they update as you check in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Is Ember AI free?</h2>
            <p className="leading-relaxed">
              Yes. You can start for free, with no credit card. There is also a paid plan, Ember
              AI Pro, at {PRO_PRICE}/month for people who want more.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Who makes Ember AI?</h2>
            <p className="leading-relaxed">Ember AI is built and run by a solo founder.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">
              Is Ember AI related to other products called Ember?
            </h2>
            <p className="leading-relaxed">
              No. Ember AI is an independent app and is not affiliated with any other product,
              company or service that uses the name Ember.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">How do I log in?</h2>
            <p className="leading-relaxed">
              Go to the{" "}
              <Link href="/login" className="font-semibold text-[#FF3D00] hover:underline">
                login page
              </Link>{" "}
              and sign in with your email and password, or with Google.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
