import Link from "next/link";
import type { ReactNode } from "react";
import { errorBox, focusRing } from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";

/** The page frame for every "learn a skill" page: the journal theme, one narrow column, mobile first. */
export function SkillsShell({ children }: { children: ReactNode }) {
  return (
    <JournalTheme>
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-8 sm:pt-12">{children}</main>
    </JournalTheme>
  );
}

/** A quiet text link to the page above this one. */
export function SkillsBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted underline underline-offset-4 hover:text-text ${focusRing}`}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

/** The one error state: a friendly sentence in a journal error box. Never a raw error, a code or a stack. */
export function SkillsErrorBox() {
  return (
    <div role="alert" className={errorBox}>
      {"Can't load this right now. Try again in a minute."}
    </div>
  );
}

export function SkillsErrorView() {
  return (
    <SkillsShell>
      <SkillsErrorBox />
    </SkillsShell>
  );
}
