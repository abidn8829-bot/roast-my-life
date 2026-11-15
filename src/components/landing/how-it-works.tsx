import Link from "next/link";
import { HOW } from "./copy";
import { NumberedList } from "./numbered-list";
import { ctaButton, h2, label, section } from "./ui";

export function HowItWorks() {
  return (
    <section id={HOW.id} aria-labelledby="how-heading" className={section}>
      <div className="flex flex-col gap-4">
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
