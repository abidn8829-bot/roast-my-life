import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JournalTheme } from "@/components/journal-theme";
import { EmberMark, roastBackLink } from "@/components/journal-roast-ui";
import { RoastView } from "@/components/roast-view";
import { backfillCardPunchline } from "@/lib/card-punchline";
import { fetchOwnRoastById } from "@/lib/fetch-own-roast";
import { isUuid } from "@/lib/is-uuid";
import { parsePlanSteps } from "@/lib/parse-plan-steps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Private (UUID) roasts and the legacy /roast/<slug> redirect: never index, never canonicalize.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RoastDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id: param } = await params;
  const { share } = await searchParams;
  const roastId = decodeURIComponent(param).trim();

  if (!roastId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isUuid(roastId)) {
    if (!user) {
      redirect(`/login?next=/roast/${roastId}`);
    }

    const roast = await fetchOwnRoastById(supabase, roastId, user.id);
    if (!roast) {
      notFound();
    }

    // Make sure the share card has a real punchline before the share sheet asks for the image.
    await backfillCardPunchline(supabase, roast, user.id);

    // Fetch user streak data
    const { data: userData } = await supabase
      .from("users")
      .select("current_streak, longest_streak, subscription_tier")
      .eq("id", user.id)
      .single();

    return (
      <JournalTheme>
        <main className="mx-auto w-full max-w-[40rem] px-4 pb-12 pt-8 sm:max-[1279px]:pt-12 min-[1280px]:max-w-[1320px] min-[1280px]:px-10 min-[1280px]:pb-0 min-[1280px]:pt-1 compact:pt-0">
          {/* Owner-only: this branch is only reached by the logged-in owner of the roast (see the guards above), so
              the link can never send a logged-out or other viewer to the login page. */}
          <div className="relative">
            <div className="mb-10 min-[1280px]:mb-1 min-[1280px]:flex min-[1280px]:min-h-[48px] min-[1280px]:items-center min-[1280px]:justify-between compact:min-h-[44px]">
              <Link href="/dashboard" className={roastBackLink}>
                <span aria-hidden>←</span>
                Back to dashboard
              </Link>
              <span className="hidden min-[1280px]:block">
                <EmberMark />
              </span>
            </div>
            <RoastView
              roastId={roast.id}
              roastText={roast.roast_text}
              reportCard={roast.report_card}
              shareSlug={roast.share_slug}
              initialReaction={roast.reaction}
              canReact
              answers={roast.answers}
              lifeScore={roast.life_score}
              funnyTitle={roast.funny_title}
              subscriptionTier={userData?.subscription_tier ?? "free"}
              categoryScores={roast.category_scores}
              currentStreak={userData?.current_streak}
              longestStreak={userData?.longest_streak}
              mode={roast.mode}
              persona={roast.persona}
              suggestionLine={roast.suggestion_line}
              initialPlan={parsePlanSteps(roast.plan_steps)}
              showShareSheet={share === "1"}
              userEmail={user.email ?? undefined}
            />
          </div>
        </main>
      </JournalTheme>
    );
  }

  // Public links live at /share/[slug]; keep old /roast/[slug] links working.
  redirect(`/share/${encodeURIComponent(roastId)}`);
}
