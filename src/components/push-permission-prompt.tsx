"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Asks a logged-in user to enable push notifications, then subscribes them
 * via the service worker's PushManager and saves the subscription to
 * /api/push/subscribe. Only shown when notifications are supported and the
 * user hasn't already granted/denied or dismissed this prompt before on
 * this device (tracked locally, not a server-side preference — fine for a
 * one-time nudge like this).
 */
export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem("ember_push_prompt_dismissed") === "1") return;
    } catch {
      // localStorage unavailable (private mode etc.) — just show the prompt.
    }
    // Browser feature/permission detection is only knowable client-side
    // after mount (window/Notification don't exist during SSR), so this
    // genuinely has to happen inside the effect rather than as initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert(`[push debug] Permission not granted: ${permission}`);
        setVisible(false);
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        alert("[push debug] Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
        setVisible(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast needed: lib.dom's PushSubscriptionOptionsInit wants a
        // Uint8Array<ArrayBuffer> specifically, but TS infers this literal
        // as Uint8Array<ArrayBufferLike>. It's a real Uint8Array either way.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const text = await res.text();
      alert(`[push debug] subscribe POST -> ${res.status}: ${text}`);
    } catch (error) {
      alert(`[push debug] Failed to subscribe: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem("ember_push_prompt_dismissed", "1");
    } catch {
      // Best-effort only.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-[#141414] px-4 py-3">
      <p className="text-sm text-neutral-200">Want Ember to roast you when you forget to check in?</p>
      <div className="flex shrink-0 gap-2">
        <button onClick={dismiss} className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200">
          No
        </button>
        <button
          onClick={() => void enable()}
          disabled={busy}
          className="rounded-md bg-[#FF3D00] px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "..." : "Turn on"}
        </button>
      </div>
    </div>
  );
}
