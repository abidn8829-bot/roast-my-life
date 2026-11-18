import Link from "next/link";
import { HERO } from "./copy";
import { Arrow, ScribbleUnderline } from "./doodles";
import { body, ctaButton, label, note } from "./ui";

// Split the heading around the underlined word. The H1's text stays exactly HERO.heading;
// the underline is an aria-hidden SVG, so screen readers read one unbroken sentence.
const cut = HERO.heading.indexOf(HERO.underlineWord);
const before = cut >= 0 ? HERO.heading.slice(0, cut) : HERO.heading;
const after = cut >= 0 ? HERO.heading.slice(cut + HERO.underlineWord.length) : "";

/**
 * Single centred column for now. A later phase adds the example mockup beside it
 * (wrap this column and the mockup in a two-column row at lg).
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="mt-16 lg:mt-[110px]">
      <div className="mx-auto flex max-w-[820px] flex-col items-center gap-6 text-center">
        <p className={label}>{HERO.label}</p>
        <h1
          id="hero-heading"
          className="font-display text-[clamp(2.75rem,9.5vw,4.75rem)] font-medium leading-[1.04] tracking-[-0.01em]"
        >
          {before}
          {cut >= 0 && (
            <span className="relative inline-block">
              {HERO.underlineWord}
              <ScribbleUnderline className="pointer-events-none absolute -bottom-[0.22em] left-[-2%] h-[0.22em] w-[104%]" />
            </span>
          )}
          {after}
        </h1>
        <p className={`${body} max-w-[560px] text-text-muted`}>{HERO.body}</p>
        <div className="mt-2 flex w-full flex-col items-center gap-3">
          <div className="relative flex w-full justify-center sm:w-auto">
            <Link href={HERO.cta.href} className={ctaButton}>
              {HERO.cta.label}
            </Link>
            {/* lg+: handwritten aside to the right of the button, arrow pointing back at it. */}
            <div className="pointer-events-none absolute left-full top-1/2 hidden -translate-y-1/2 items-center gap-1 pl-3 lg:flex" aria-hidden="true">
              <Arrow className="h-8 w-12 shrink-0" />
              <span className="font-note whitespace-nowrap text-[22px] leading-none text-text-muted [transform:rotate(-3deg)]">
                {HERO.handNote}
              </span>
            </div>
          </div>
          <p className={note}>{HERO.note}</p>
          {/* Below lg: same note under the button, no arrow. */}
          <p className="font-note text-[22px] leading-none text-text-muted [transform:rotate(-3deg)] lg:hidden" aria-hidden="true">
            {HERO.handNote}
          </p>
        </div>
      </div>
    </section>
  );
}
