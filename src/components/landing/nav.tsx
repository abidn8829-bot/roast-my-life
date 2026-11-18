import Link from "next/link";
import { JournalWordmark } from "@/components/journal-auth-ui";
import { NAV } from "./copy";
import { focusRing } from "./ui";

/** Phone: wordmark + "Log in". From sm: also "How it works" and the filled sign-up button. */
export function Nav() {
  return (
    <header className="flex items-center justify-between gap-4">
      <JournalWordmark />
      <nav aria-label="Main" className="flex items-center gap-3 text-sm sm:gap-6">
        <a
          href={NAV.howItWorks.href}
          className={`hidden min-h-11 items-center text-text-muted hover:text-text sm:inline-flex ${focusRing}`}
        >
          {NAV.howItWorks.label}
        </a>
        <Link
          href={NAV.logIn.href}
          className={`inline-flex min-h-11 items-center rounded-[10px] border border-text px-[18px] text-text transition hover:bg-surface ${focusRing}`}
        >
          {NAV.logIn.label}
        </Link>
        <Link
          href={NAV.cta.href}
          className={`hidden min-h-11 items-center rounded-[10px] bg-ember px-[18px] font-medium text-on-accent transition hover:opacity-90 sm:inline-flex ${focusRing}`}
        >
          {NAV.cta.label}
        </Link>
      </nav>
    </header>
  );
}
