"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { track } from "@/lib/track";

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
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-black tracking-tight text-ember-legacy mb-2">
          EMBER
        </h1>
        <p className="text-sm text-text-secondary-legacy">
          Ready to face the truth?
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {displayError ? (
          <p className="rounded-md border border-error-border/60 bg-error-bg/40 px-3 py-2 text-sm text-error-text">
            {displayError}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-md border border-border-strong-legacy bg-surface-sunken-legacy/60 px-3 py-2 text-sm text-text-emphasis-legacy">
            {info}
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-body-legacy">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line-subtle-legacy bg-surface px-3 py-2 text-text-legacy outline-none ring-ember-legacy focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-body-legacy">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-line-subtle-legacy bg-surface px-3 py-2 text-text-legacy outline-none ring-ember-legacy focus:ring-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-md bg-ember-legacy px-4 py-2.5 text-sm font-medium text-on-accent transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <div className="relative text-center text-xs text-text-tertiary-legacy">
        <span className="relative z-10 bg-bg px-2">or</span>
        <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-line-subtle-legacy" />
      </div>

      <GoogleAuthButton errorReturnPath="/signup" onStart={() => track("signup_started", { method: "google" })} />

      <p className="text-center text-sm text-text-secondary-legacy">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-ember-legacy hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
