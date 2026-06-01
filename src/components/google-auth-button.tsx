"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";

type Props = {
  label?: string;
  /** Path for ?error= when OAuth fails (e.g. "/signup" on the signup page). */
  errorReturnPath?: string;
};

export function GoogleAuthButton({
  label = "Continue with Google",
  errorReturnPath = "/login",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    console.log("Google auth button clicked");
    setLoading(true);
    
    try {
      const supabase = createSupabaseBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      console.log("Attempting OAuth with redirect to:", `${appUrl}/auth/callback?next=/dashboard`);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
        },
      });
      
      if (error) {
        console.error("OAuth error:", error);
        window.location.href = `${errorReturnPath}?error=${encodeURIComponent(error.message)}`;
      }
    } catch (err) {
      console.error("Unexpected error during OAuth:", err);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle()}
      disabled={loading}
      className="w-full rounded-md border-2 border-neutral-700 bg-[#1a1a1a] px-4 py-3 text-sm font-bold text-[#FAFAFA] transition hover:bg-neutral-800 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Connecting..." : label}
    </button>
  );
}
