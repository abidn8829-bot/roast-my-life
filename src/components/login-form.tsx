"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";

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
    router.push(next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-black tracking-tight text-ember-legacy mb-2">
          EMBER
        </h1>
        <p className="text-sm text-text-secondary-legacy">
          Back for more punishment?
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {displayError ? (
          <p className="rounded-md border border-error-border/60 bg-error-bg/40 px-3 py-2 text-sm text-error-text">
            {displayError}
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
            autoComplete="current-password"
            required
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
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      <div className="relative text-center text-xs text-text-tertiary-legacy">
        <span className="relative z-10 bg-bg px-2">or</span>
        <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-line-subtle-legacy" />
      </div>

      <GoogleAuthButton />

      <p className="text-center text-sm text-text-secondary-legacy">
        No account?{" "}
        <Link
          href="/signup"
          className="font-medium text-ember-legacy hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
