import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArcSection } from "@/components/arc-section";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ArcPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const subscriptionTier = userData?.subscription_tier || "free";

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-text">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <DashboardHeader isPro={subscriptionTier === "pro"} name={user.email || ""} />
        <ArcSection variant="full" />
      </div>
    </main>
  );
}
