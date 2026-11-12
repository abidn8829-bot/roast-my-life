"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { track } from "@/lib/track";
import { errorBox, fieldInput, fieldLabel, inkLink, primaryButton } from "@/components/journal-auth-ui";

function safeNext(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }
  return path;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track("login_viewed");
  }, []);

  const urlError = searchParams.get("error");
  const displayError =
    error ??
    (urlError === "oauth"
      ? "Google sign-in failed. Try again."
      : urlError
        ? decodeURIComponent(urlError)
        : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    track("login_completed", { method: "email" });
    router.push(next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <h1 className="font-display text-[clamp(2.5rem,9vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.01em]">
        Back for more punishment?
      </h1>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
        {displayError ? (
          <p role="alert" className={errorBox}>
            {displayError}
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldInput}
          />
        </label>

        <button type="submit" disabled={loading} className={`${primaryButton} mt-2`}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      <div className="relative text-center text-sm text-text-muted">
        <span className="relative z-10 bg-bg px-3">or</span>
        <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-border" />
      </div>

      <GoogleAuthButton />

      <p className="text-base font-light text-text-muted">
        No account?{" "}
        <Link href="/signup" className={inkLink}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
