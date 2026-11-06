import { Suspense } from "react";
import { SignupForm } from "@/components/signup-form";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sign Up Free",
  description: "Create a free Ember account: answer 5 questions, get your first AI roast and Life Score today.",
  path: "/signup",
  noindex: true,
});

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text-legacy">
      <Suspense
        fallback={
          <p className="text-sm text-text-secondary-legacy">Loading…</p>
        }
      >
        <SignupForm />
      </Suspense>
    </main>
  );
}
