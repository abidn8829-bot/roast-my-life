import Link from "next/link";
import { HERO } from "./copy";
import { body, ctaButton, label, note } from "./ui";

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
          {HERO.heading}
        </h1>
        <p className={`${body} max-w-[560px] text-text-muted`}>{HERO.body}</p>
        <div className="mt-2 flex w-full flex-col items-center gap-3">
          <Link href={HERO.cta.href} className={ctaButton}>
            {HERO.cta.label}
          </Link>
          <p className={note}>{HERO.note}</p>
        </div>
      </div>
    </section>
  );
}
