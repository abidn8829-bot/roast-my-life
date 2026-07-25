"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const urlError = searchParams.get("error");
  const displayError =
    error ??
    (urlError ? decodeURIComponent(urlError) : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        <h1 className="text-3xl font-black tracking-tight text-[#FF3D00] mb-2">
          EMBER
        </h1>
        <p className="text-sm text-neutral-400">
          Ready to face the truth?
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {displayError ? (
          <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {displayError}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-md border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200">
            {info}
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-300">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-800 bg-[#141414] px-3 py-2 text-[#FAFAFA] outline-none ring-[#FF3D00] focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-300">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-800 bg-[#141414] px-3 py-2 text-[#FAFAFA] outline-none ring-[#FF3D00] focus:ring-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-md bg-[#FF3D00] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <div className="relative text-center text-xs text-neutral-500">
        <span className="relative z-10 bg-[#0A0A0A] px-2">or</span>
        <span className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-neutral-800" />
      </div>

      <GoogleAuthButton errorReturnPath="/signup" />

      <p className="text-center text-sm text-neutral-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#FF3D00] hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
