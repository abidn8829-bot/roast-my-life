import type { ReactNode } from "react";
import { fraunces, gaegu, sora } from "@/app/journal-fonts";

/**
 * Opt-in wrapper for the light "journal" theme. Render it around a page's content.
 * - data-theme="journal" switches the colour tokens (see globals.css; html:has() puts
 *   them on <html> so the body background follows too).
 * - The three font variables are defined here, so the journal fonts load only on
 *   pages that use this wrapper.
 */
export function JournalTheme({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="journal"
      className={`${fraunces.variable} ${sora.variable} ${gaegu.variable} min-h-screen bg-bg font-sans text-text`}
    >
      {children}
    </div>
  );
}
