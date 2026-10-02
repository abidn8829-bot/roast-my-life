import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Log In",
  description: "Log in to Ember to see your Life Score, daily check-ins and your latest roast.",
  path: "/login",
  noindex: true,
});

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
      <Suspense
        fallback={
          <p className="text-sm text-neutral-400">Loading…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
