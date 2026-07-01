import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { ProfileContent } from "@/components/profile-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <DashboardHeader isPro={subscriptionTier === "pro"} name={user.email || ""} />
        <ProfileContent
          email={user.email || ""}
          subscriptionTier={subscriptionTier}
        />
      </div>
    </main>
  );
}
