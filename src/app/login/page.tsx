import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Log In to Ember AI",
  description: "Log in to Ember to see your Life Score, daily check-ins and your latest roast.",
  path: "/login",
  absoluteTitle: true,
});

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text-legacy">
      <Suspense
        fallback={
          <p className="text-sm text-text-secondary-legacy">Loading…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
