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
    <div div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#141414] p-6">
        <div className="mb-6 text-center">
          <span className="text-5xl">🔥</span>
          <h2 className="mt-4 text-2xl font-bold text-[#FAFAFA]">
            Join Pro Waitlist
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
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
                className="w-full rounded-lg border border-neutral-700 bg-[#0A0A0A] px-4 py-3 text-sm text-[#FAFAFA] placeholder:text-neutral-500 focus:border-[#FF3D00] focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-500"
              >
                Maybe Later
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-[#FF3D00] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join Waitlist 🔥"}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-[#34d399]">{message}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
