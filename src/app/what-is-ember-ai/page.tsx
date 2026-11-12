import type { Viewport } from "next";
import Link from "next/link";
import { focusRing, inkLink, primaryButton } from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";
import { PRO_PRICE } from "@/lib/plans";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "What is Ember AI? | Ember AI",
  description:
    "Ember AI is an AI accountability app. Answer 5 quick questions, get a Life Score and report card, then check in daily so you actually follow through.",
  path: "/what-is-ember-ai",
  absoluteTitle: true,
});

// Light journal theme: browser UI colour matches the page background (this page only).
export const viewport: Viewport = { themeColor: "#DCE6EE" };

export default function WhatIsEmberAiPage() {
  return (
    <JournalTheme>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <Link href="/" className={`${inkLink} mb-6 gap-2 text-sm`}>
          <span aria-hidden="true">←</span>
          Back to Home
        </Link>

        <h1 className="mb-6 font-display text-[clamp(2.25rem,8vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.01em]">What is Ember AI?</h1>

        <p className="mb-8 text-lg leading-relaxed text-text">
          Ember AI is an AI accountability app. You answer 5 quick questions about your phone
          time, sleep, spending and biggest broken promise. Ember AI roasts your habits using
          your own answers, gives you a Life Score and a report card, and checks in on you every
          day so you actually do something about it.
        </p>

        <div className="mb-12 max-w-[20rem]">
          <Link href="/signup" className={primaryButton}>
            Start your arc →
          </Link>
        </div>

        <div className="space-y-8 text-text">
          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">What does Ember AI do?</h2>
            <p className="leading-relaxed">
              Ember AI is a web app that holds you accountable for your habits. It asks 5 quick
              questions, writes a funny, honest roast from your answers, grades you in five
              categories, and gives you a daily check-in so you keep going.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">How is the roast different?</h2>
            <p className="leading-relaxed">
              Every roast is written from your own answers, like your screen time, sleep and
              spending. It&apos;s blunt and funny, with a point: to push you into doing something
              about it.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">What is the Life Score?</h2>
            <p className="leading-relaxed">
              Your Life Score is an overall score from 0 to 100 based on your answers. Ember AI
              also grades you from A to F in five categories: Sleep, Fitness, Discipline, Focus
              and Spending. Your report card shows those grades, and they update as you check in.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Is Ember AI free?</h2>
            <p className="leading-relaxed">
              Yes. You can start for free, with no credit card. There is also a paid plan, Ember
              AI Pro, at {PRO_PRICE}/month for people who want more.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Who makes Ember AI?</h2>
            <p className="leading-relaxed">Ember AI is built and run by a solo founder.</p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">
              Is Ember AI related to other products called Ember?
            </h2>
            <p className="leading-relaxed">
              No. Ember AI is an independent app and is not affiliated with any other product,
              company or service that uses the name Ember.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">How do I log in?</h2>
            <p className="leading-relaxed">
              Go to the{" "}
              <Link
                href="/login"
                className={`font-medium text-text underline underline-offset-4 ${focusRing}`}
              >
                login page
              </Link>{" "}
              and sign in with your email and password, or with Google.
            </p>
          </section>
        </div>
      </main>
    </JournalTheme>
  );
}
