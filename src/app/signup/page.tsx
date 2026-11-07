import type { Viewport } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";
import { SignupForm } from "@/components/signup-form";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sign Up Free",
  description: "Create a free Ember account: answer 5 questions, get your first AI roast and Life Score today.",
  path: "/signup",
  noindex: true,
});

// Journal theme: browser UI colour matches the page background (this page only).
export const viewport: Viewport = { themeColor: "#DCE6EE" };

export default function SignupPage() {
  return (
    <JournalTheme>
      <AuthFrame>
        <Suspense fallback={<p className="text-sm text-text-muted">Loading…</p>}>
          <SignupForm />
        </Suspense>
      </AuthFrame>
    </JournalTheme>
  );
}
