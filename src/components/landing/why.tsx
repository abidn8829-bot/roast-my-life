import { WHY } from "./copy";
import { ClockDoodle, PhoneDoodle } from "./doodles";
import { NumberedList } from "./numbered-list";
import { h2, label, section } from "./ui";

export function Why() {
  return (
    <section id={WHY.id} aria-labelledby="why-heading" className={`${section} relative`}>
      {/* Decorative doodles in the empty space beside the H2, wide screens only. */}
      <div className="pointer-events-none absolute right-0 top-2 hidden items-end gap-3 lg:flex" aria-hidden="true">
        <PhoneDoodle className="h-[72px] w-[72px] -rotate-6" />
        <ClockDoodle className="h-16 w-16 rotate-[8deg]" />
      </div>
      <div className="flex flex-col items-start gap-4">
        <p className={label}>{WHY.label}</p>
        <h2 id="why-heading" className={`${h2} max-w-[820px]`}>
          {WHY.heading}
        </h2>
      </div>
      <div className="mt-10 lg:mt-14">
        <NumberedList items={WHY.items} />
      </div>
    </section>
  );
}
