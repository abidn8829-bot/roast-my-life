import { FinalCta } from "./final-cta";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Nav } from "./nav";
import { Why } from "./why";

/**
 * Landing page (server component). Render it inside <JournalTheme>.
 * Sections render top to bottom in the order listed in <main>. Later phases slot in:
 *   - example mockup beside the hero (inside hero.tsx)
 *   - comparison, plans, FAQ and the waitlist block between HowItWorks and FinalCta
 * All text lives in ./copy.ts.
 */
export function LandingPage() {
  return (
    <div className="jl mx-auto flex w-full max-w-[1280px] flex-col px-5 pb-12 pt-6 sm:px-10 xl:px-24 xl:pt-8">
      <Nav />
      <main>
        <Hero />
        <Why />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
