import type { ItemCopy } from "./copy";
import { body, h3 } from "./ui";

/** Ruled, numbered list in the journal style (hairlines + Fraunces numerals). Not cards. */
export function NumberedList({ items }: { items: ItemCopy[] }) {
  return (
    <ol className="flex flex-col border-b border-border">
      {items.map((item, i) => (
        <li
          key={item.title}
          className="flex gap-5 border-t border-border py-7 lg:grid lg:grid-cols-[64px_minmax(0,380px)_minmax(0,1fr)] lg:items-baseline lg:gap-8 lg:py-9"
        >
          <span className="font-display w-8 shrink-0 text-[30px] font-normal leading-none text-text-muted lg:w-auto lg:text-[36px]" aria-hidden="true">
            {i + 1}
          </span>
          <div className="flex flex-col gap-2 lg:contents">
            <h3 className={h3}>{item.title}</h3>
            <p className={`${body} text-text-muted`}>{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
