import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
      <div className="mb-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ember</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Answer honestly. We&apos;ll do the rest.
        </p>
      </div>
      <OnboardingWizard />
    </main>
  );
}
