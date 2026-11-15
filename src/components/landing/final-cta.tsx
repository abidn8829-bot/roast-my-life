import Link from "next/link";
import { FINAL_CTA } from "./copy";
import { HandDivider } from "./doodles";
import { ctaButton, h2, note, section } from "./ui";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-heading" className={section}>
      <HandDivider className="mb-16 lg:mb-20" />
      <div className="mx-auto flex max-w-[780px] flex-col items-center gap-7 text-center">
        <h2 id="final-cta-heading" className={h2}>
          {FINAL_CTA.heading}
        </h2>
        <div className="flex w-full flex-col items-center gap-3">
          <Link href={FINAL_CTA.cta.href} className={ctaButton}>
            {FINAL_CTA.cta.label}
          </Link>
          <p className={note}>{FINAL_CTA.note}</p>
        </div>
      </div>
    </section>
  );
}
