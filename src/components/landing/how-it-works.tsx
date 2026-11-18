import Link from "next/link";
import { HOW } from "./copy";
import { BagDoodle, CupDoodle } from "./doodles";
import { NumberedList } from "./numbered-list";
import { ctaButton, h2, label, section } from "./ui";

export function HowItWorks() {
  return (
    <section id={HOW.id} aria-labelledby="how-heading" className={`${section} relative`}>
      {/* Decorative doodles in the empty space beside the H2, wide screens only. */}
      <div className="pointer-events-none absolute right-0 top-2 hidden items-end gap-3 lg:flex" aria-hidden="true">
        <CupDoodle className="h-[72px] w-[72px] -rotate-6" />
        <BagDoodle className="h-16 w-16 rotate-[8deg]" />
      </div>
      <div className="flex flex-col items-start gap-4">
        <p className={label}>{HOW.label}</p>
        <h2 id="how-heading" className={`${h2} max-w-[820px]`}>
          {HOW.heading}
        </h2>
      </div>
      <div className="mt-10 lg:mt-14">
        <NumberedList items={HOW.steps} />
      </div>
      <div className="mt-10">
        <Link href={HOW.cta.href} className={ctaButton}>
          {HOW.cta.label}
        </Link>
      </div>
    </section>
  );
}
