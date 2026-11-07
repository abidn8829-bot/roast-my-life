import { redirect } from "next/navigation";
import { fraunces, gaegu, sora } from "@/app/journal-fonts";
import { JournalWordmark } from "@/components/journal-auth-ui";
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

  // The header block is hidden ONLY while the break notice (data-break-notice, see GentleNotice) is on screen.
  // While a question screen is showing (the wizard marks it with data-journal-question) the classic heading
  // and tagline are swapped for the journal wordmark; every other screen keeps the header it always had.
  // The journal font variables are defined here so the wordmark can use them outside the wizard's wrapper.
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-text [&:has([data-break-notice])_[data-onboarding-header]]:hidden [&:has([data-journal-question])_[data-header-classic]]:hidden [&:has([data-journal-question])_[data-header-journal]]:block [&:has([data-journal-question])]:justify-start ${fraunces.variable} ${sora.variable} ${gaegu.variable}`}
    >
      <div data-onboarding-header className="mb-8 w-full max-w-md text-center">
        <h1 data-header-classic className="text-2xl font-semibold tracking-tight text-ember">Ember</h1>
        <p data-header-classic className="mt-2 text-sm text-text-muted">
          Answer honestly. We&apos;ll do the rest.
        </p>
        <div data-header-journal className="hidden text-left">
          <JournalWordmark />
          <p className="text-sm text-text-muted">Answer honestly. We&apos;ll do the rest.</p>
        </div>
      </div>
      <OnboardingWizard userEmail={user.email ?? undefined} />
    </main>
  );
}
