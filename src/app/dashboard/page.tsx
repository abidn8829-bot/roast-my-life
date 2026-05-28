import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardView, type DashboardRoast } from "@/components/dashboard-view";
import { LogoutButton } from "@/components/logout-button";
import { getDisplayName } from "@/lib/display-name";
import { parseAnswers } from "@/lib/parse-answers";
import { parseReportCard } from "@/lib/parse-report-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's subscription tier
  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";

  let rows: Array<{
    id: string;
    roast_text: string;
    report_card: unknown;
    week_start_date: string;
    share_slug: string;
    answers?: unknown;
    created_at: string;
  }> | null = null;

  const { data, error } = await supabase
    .from("roasts")
    .select(
      "id, roast_text, report_card, week_start_date, share_slug, answers, created_at",
    )
    .eq("user_id", user.id)
    .order("week_start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (error?.code === "42703" || error?.message?.includes("answers")) {
    const fallback = await supabase
      .from("roasts")
      .select(
        "id, roast_text, report_card, week_start_date, share_slug, created_at",
      )
      .eq("user_id", user.id)
      .order("week_start_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12);
    rows = fallback.data;
    if (fallback.error) {
      console.error("[dashboard] fetch error:", fallback.error.message);
    }
  } else {
    rows = data;
    if (error) {
      console.error("[dashboard] fetch error:", error.message);
    }
  }

  const roasts: DashboardRoast[] = [];
  for (const row of rows ?? []) {
    const report_card = parseReportCard(row.report_card);
    if (!report_card) continue;
    roasts.push({
      id: row.id,
      roast_text: row.roast_text,
      report_card,
      week_start_date: row.week_start_date,
      share_slug: row.share_slug,
      answers: parseAnswers(row.answers),
    });
  }

  const name = getDisplayName(user);

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#FF3D00]">
            Roast My Life
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-neutral-400 hover:text-[#FAFAFA] transition">
              Pricing
            </Link>
            <LogoutButton />
          </div>
        </div>
        {subscriptionTier === "free" && (
          <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4">
            <p className="text-sm text-neutral-300">
              You're on the free plan — 1 roast per day
            </p>
            {process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL && (
              <a
                href={process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-lg bg-[#FF3D00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Upgrade to Pro for unlimited roasts 🔥
              </a>
            )}
          </div>
        )}
        <DashboardView name={name} roasts={roasts} />
      </div>
    </main>
  );
}
