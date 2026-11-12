"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useState } from "react";
import { outlineButton } from "@/components/journal-auth-ui";

type Props = {
  label?: string;
  /** Path for ?error= when OAuth fails (e.g. "/signup" on the signup page). */
  errorReturnPath?: string;
  /** Called when the button is clicked, before the redirect to Google (analytics hook). */
  onStart?: () => void;
};

export function GoogleAuthButton({
  label = "Continue with Google",
  errorReturnPath = "/login",
  onStart,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    onStart?.();
    
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      
      if (error) {
        window.location.href = `${errorReturnPath}?error=${encodeURIComponent(error.message)}`;
      }
    } catch (err) {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle()}
      disabled={loading}
      className={outlineButton}
    >
      {loading ? "Connecting..." : label}
    </button>
  );
}
