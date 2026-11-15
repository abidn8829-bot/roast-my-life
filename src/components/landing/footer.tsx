import Link from "next/link";
import { FOOTER } from "./copy";
import { focusRing } from "./ui";

export function Footer() {
  return (
    <footer className="mt-24 flex flex-col gap-4 border-t border-border pt-6 text-[13px] text-text-muted sm:flex-row sm:items-center sm:justify-between lg:mt-[140px]">
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
    </footer>
  );
}
