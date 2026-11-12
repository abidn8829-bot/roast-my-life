import Link from "next/link";
import { primaryButton } from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";

export default function NotFound() {
  return (
    <JournalTheme>
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display mb-4 text-[clamp(5rem,24vw,9rem)] font-medium leading-none">404</h1>
          <p className="mb-8 text-xl text-text-muted">Roast not found</p>
          <div className="mx-auto w-full max-w-[16rem]">
            <Link href="/" className={primaryButton}>
              Go Home
            </Link>
          </div>
        </div>
      </main>
    </JournalTheme>
  );
}
