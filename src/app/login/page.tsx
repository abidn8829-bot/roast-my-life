import type { Viewport } from "next";
import { Suspense } from "react";
import { AuthFrame } from "@/components/journal-auth-frame";
import { JournalTheme } from "@/components/journal-theme";
import { LoginForm } from "@/components/login-form";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Log In to Ember AI",
  description: "Log in to Ember to see your Life Score, daily check-ins and your latest roast.",
  path: "/login",
  absoluteTitle: true,
});

// Journal theme: browser UI colour matches the page background (this page only).
export const viewport: Viewport = { themeColor: "#DCE6EE" };

export default function LoginPage() {
  return (
    <JournalTheme>
      <AuthFrame>
        <Suspense fallback={<p className="text-sm text-text-muted">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </AuthFrame>
    </JournalTheme>
  );
}
