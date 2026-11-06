"use client";

import Link from "next/link";
import { useState } from "react";
import { SafetyPage } from "@/components/safety-page";
import type { SafetyPagePayload } from "@/lib/safety";

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [safetyPage, setSafetyPage] = useState<SafetyPagePayload | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const safetyData = res.ok ? ((await res.json().catch(() => null)) as { safety?: { kind?: string } } | null) : null;
      if (safetyData?.safety?.kind === "page") {
        // The message was not sent anywhere; show the support page and drop the typed text.
        setSafetyPage(safetyData.safety as SafetyPagePayload);
        setMessage("");
        setName("");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (safetyPage) return <SafetyPage payload={safetyPage} />;

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-text-legacy">
      <div className="mx-auto w-full max-w-sm flex flex-col gap-6">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-black tracking-tight text-ember-legacy mb-2">
            EMBER
          </h1>
          <p className="text-sm text-text-secondary-legacy">Got something to say?</p>
        </div>

        {sent ? (
          <p className="rounded-md border border-border-strong-legacy bg-surface-sunken-legacy/60 px-3 py-2 text-sm text-text-emphasis-legacy text-center">
            Message sent. We&apos;ll get back to you.
          </p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            {error ? (
              <p className="rounded-md border border-error-border/60 bg-error-bg/40 px-3 py-2 text-sm text-error-text">
                {error}
              </p>
            ) : null}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-text-body-legacy">Name</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-line-subtle-legacy bg-surface px-3 py-2 text-text-legacy outline-none ring-ember-legacy focus:ring-2"
              />
            </label>

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
              <span className="text-text-body-legacy">Message</span>
              <textarea
                name="message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="ph-no-capture resize-none rounded-md border border-line-subtle-legacy bg-surface px-3 py-2 text-text-legacy outline-none ring-ember-legacy focus:ring-2"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-md bg-ember-legacy px-4 py-2.5 text-sm font-medium text-on-accent transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-text-secondary-legacy">
          <Link href="/" className="font-medium text-ember-legacy hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
