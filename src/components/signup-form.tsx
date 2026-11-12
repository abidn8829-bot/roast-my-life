"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { track } from "@/lib/track";
import { errorBox, fieldInput, fieldLabel, inkLink, noteBox, primaryButton } from "@/components/journal-auth-ui";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    track("signup_viewed");
  }, []);

  const urlError = searchParams.get("error");
  const displayError =
    error ??
    (urlError ? decodeURIComponent(urlError) : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    track("signup_started", { method: "email" });
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setInfo(
      "Check your email to confirm your account, then log in. If confirmations are disabled in Supabase, try logging in.",
    );
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <h1 className="font-display text-[clamp(2.5rem,9vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.01em]">
        Ready to face the truth?
      </h1>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
        {displayError ? (
          <p role="alert" className={errorBox}>
            {displayError}
          </p>
        ) : null}
        {info ? (
          <p role="status" className={noteBox}>
            {info}
          </p>
        ) : null}

        <label className={fieldLabel}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldInput}
          />
        </label>

        <label className={fieldLabel}>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldInput}
          />
        </label>

        <button type="submit" disabled={loading} className={`${primaryButton} mt-2`}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <div className="relative text-center text-sm text-text-muted">
        <span className="relative z-10 bg-bg px-3">or</span>
        <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-border" />
      </div>

      <GoogleAuthButton errorReturnPath="/signup" onStart={() => track("signup_started", { method: "google" })} />

      <p className="text-base font-light text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className={inkLink}>
          Log in
        </Link>
      </p>
    </div>
  );
}
