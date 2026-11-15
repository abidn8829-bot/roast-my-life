import { WHY } from "./copy";
import { NumberedList } from "./numbered-list";
import { h2, label, section } from "./ui";

export function Why() {
  return (
    <section id={WHY.id} aria-labelledby="why-heading" className={section}>
      <div className="flex flex-col gap-4">
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
