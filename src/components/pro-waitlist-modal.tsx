"use client";

import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProWaitlistModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/pro-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setEmail("");
      } else {
        setMessage(data.error || "Failed to join waitlist");
      }
    } catch (error) {
      setMessage("Failed to join waitlist");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 text-center">
          <span className="text-5xl">🔥</span>
          <h2 className="mt-4 text-2xl font-bold text-text">
            Join Pro Waitlist
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Be the first to know when Pro launches with unlimited roasts, custom personas, and more!
          </p>
        </div>

        {!message ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-faint focus:border-ember focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-muted transition hover:border-text-faint"
              >
                Maybe Later
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-ember px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join Waitlist 🔥"}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-grade-a">{message}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition hover:border-text-faint"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
