"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-sm flex flex-col gap-6">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-black tracking-tight text-[#FF3D00] mb-2">
            EMBER
          </h1>
          <p className="text-sm text-neutral-400">Got something to say?</p>
        </div>

        {sent ? (
          <p className="rounded-md border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 text-center">
            Message sent. We&apos;ll get back to you.
          </p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            {error ? (
              <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-300">Name</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-neutral-800 bg-[#141414] px-3 py-2 text-[#FAFAFA] outline-none ring-[#FF3D00] focus:ring-2"
              />
            </label>

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
              <span className="text-neutral-300">Message</span>
              <textarea
                name="message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none rounded-md border border-neutral-800 bg-[#141414] px-3 py-2 text-[#FAFAFA] outline-none ring-[#FF3D00] focus:ring-2"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-md bg-[#FF3D00] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-400">
          <Link href="/" className="font-medium text-[#FF3D00] hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
