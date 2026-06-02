import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
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

        <div className="rounded-xl border border-neutral-800 bg-[#141414] p-6">
          <h1 className="text-2xl font-bold mb-6">Profile</h1>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-neutral-400 mb-1">Email</p>
              <p className="text-[#FAFAFA]">{user.email}</p>
            </div>

            <div>
              <p className="text-sm text-neutral-400 mb-1">Subscription</p>
              <div className="flex items-center gap-2">
                {subscriptionTier === "pro" ? (
                  <>
                    <span className="flex items-center gap-1 rounded-full bg-[#FF3D00]/20 px-3 py-1 text-xs font-bold text-[#FF3D00]">
                      🔥 PRO
                    </span>
                    <span className="text-[#FAFAFA]">Unlimited roasts, all features</span>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-400">
                      FREE
                    </span>
                    <span className="text-neutral-400">1 roast/day, basic features</span>
                  </>
                )}
              </div>
            </div>

            {subscriptionTier === "free" && process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL && (
              <a
                href={process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 rounded-lg bg-[#FF3D00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Upgrade to Pro
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
