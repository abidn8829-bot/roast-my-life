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
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text">
      <div className="mb-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ember">Ember</h1>
        <p className="mt-2 text-sm text-text-muted">
          Answer honestly. We&apos;ll do the rest.
        </p>
      </div>
      <OnboardingWizard />
    </main>
  );
}
