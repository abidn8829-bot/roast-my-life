"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  label?: string;
  /** Path for ?error= when OAuth fails (e.g. "/signup" on the signup page). */
  errorReturnPath?: string;
};

export function GoogleAuthButton({
  label = "Continue with Google",
  errorReturnPath = "/login",
}: Props) {
  async function signInWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      window.location.href = `${errorReturnPath}?error=${encodeURIComponent(error.message)}`;
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle()}
      className="w-full rounded-md border border-neutral-700 bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-[#FAFAFA] transition hover:bg-neutral-800"
    >
      {label}
    </button>
  );
}
