import Link from "next/link";
import { FOOTER } from "./copy";
import { HandDivider } from "./doodles";
import { focusRing } from "./ui";

export function Footer() {
  return (
    <footer className="mt-24 text-[13px] text-text-muted lg:mt-[140px]">
      <HandDivider />
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className={`inline-flex min-h-11 items-center pr-3 text-text ${focusRing}`}>
          <span className="font-display text-[22px] font-normal leading-none">{FOOTER.wordmark}</span>
        </Link>
        <ul className="flex flex-wrap items-center gap-x-7">
          {FOOTER.links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={`inline-flex min-h-11 min-w-11 items-center hover:text-text ${focusRing}`}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
