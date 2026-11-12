"use client";

import Link from "next/link";
import { useState } from "react";
import {
  errorBox,
  fieldInput,
  fieldLabel,
  inkLink,
  JournalWordmark,
  noteBox,
  primaryButton,
} from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";
import { SafetyPage } from "@/components/safety-page";
import type { SafetyPagePayload } from "@/lib/safety";

// Same 16 px text, border and ink focus ring as the login fields (fieldInput), minus its fixed 48 px height.
const textareaInput =
  "jl-input ph-no-capture w-full resize-none rounded-xl border border-border-strong-legacy bg-surface px-4 py-3 text-base text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";

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
    <JournalTheme>
      <div className="jl mx-auto flex w-full max-w-[28rem] flex-col px-4 pb-16 pt-6">
        <header>
          <JournalWordmark />
        </header>

        <main className="mt-14 flex flex-col gap-6">
          <h1 className="font-display text-[clamp(2.25rem,9vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.01em]">
            Got something to say?
          </h1>

          {sent ? (
            <p className={`${noteBox} text-center`}>
              Message sent. We&apos;ll get back to you.
            </p>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
              {error ? <p className={errorBox}>{error}</p> : null}

              <label className={fieldLabel}>
                <span>Name</span>
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldInput}
                />
              </label>

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
                <span>Message</span>
                <textarea
                  name="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={textareaInput}
                />
              </label>

              <button type="submit" disabled={loading} className={`${primaryButton} mt-1`}>
                {loading ? "Sending…" : "Send message"}
              </button>
            </form>
          )}

          <p>
            <Link href="/" className={inkLink}>
              Back to home
            </Link>
          </p>
        </main>
      </div>
    </JournalTheme>
  );
}
