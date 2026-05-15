import { Suspense } from "react";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
      <Suspense
        fallback={
          <p className="text-sm text-neutral-400">Loading…</p>
        }
      >
        <SignupForm />
      </Suspense>
    </main>
  );
}
