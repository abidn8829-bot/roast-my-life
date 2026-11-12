import type { ReactNode } from "react";
import { JournalAuthArt } from "@/components/journal-auth-art";
import { JournalWordmark } from "@/components/journal-auth-ui";

/**
 * Page frame for the journal login / signup pages: wordmark top-left, one left-aligned
 * column (max 28rem), no card. From the lg breakpoint a decorative doodle sits to the right;
 * on phones it is not rendered, so the form stays the whole screen.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="jl mx-auto flex w-full max-w-[1280px] flex-col px-4 pb-16 pt-6 sm:px-10 xl:px-24 xl:pt-8">
      <header>
        <JournalWordmark />
      </header>
      <div className="mt-14 flex w-full items-start gap-12 sm:mt-20 lg:gap-16 xl:mt-24">
        <main className="w-full max-w-[28rem] shrink-0">{children}</main>
        <div aria-hidden="true" className="hidden min-w-0 flex-1 lg:block">
          <div className="ml-auto w-full max-w-[560px]">
            <JournalAuthArt />
          </div>
        </div>
      </div>
    </div>
  );
}
