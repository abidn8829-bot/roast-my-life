import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "there";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 text-[#FAFAFA]">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <p className="text-lg text-[#FAFAFA]">Welcome, {email}</p>
        <Link
          href="/onboarding"
          className="w-full rounded-md bg-[#FF3D00] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
        >
          Get roasted
        </Link>
        <LogoutButton />
      </div>
    </main>
  );
}
