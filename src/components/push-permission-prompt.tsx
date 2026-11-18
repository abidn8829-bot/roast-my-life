"use client";

import { useEffect, useState, type CSSProperties } from "react";

// The prompt sits on the dashboard, which is not on the journal theme yet. <JournalTheme> would also repaint the
// whole page (its tokens are set on <html>), so the journal values are scoped to this one card instead. The values
// are the ones in globals.css under [data-theme="journal"]. Once the dashboard is wrapped in <JournalTheme> this
// scope is simply redundant.
const JOURNAL_SCOPE = {
  "--surface": "#ecf1f6",
  "--text": "#293a35",
  "--text-muted": "#555750",
  "--text-faint": "#566563",
  "--border": "rgba(41, 58, 53, 0.13)",
  "--border-strong-legacy": "rgba(41, 58, 53, 0.28)",
  "--ember": "#293a35",
  "--on-accent": "#dce6ee",
} as CSSProperties;

const RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";

/** A small hand-drawn bell: ink stroke with a clay clapper, decoration only (same stroke style as journal-roast-ui). */
function BellMark() {
  return (
    <svg className="h-8 w-8 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M7 22 C 9 19, 9 15, 10 12 C 11 7, 14 5, 16 5 C 19 5, 21 8, 22 12 C 23 16, 23 19, 25 22 C 21 23, 11 23, 7 22 Z"
        stroke="var(--text)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 26 C 14 28, 18 28, 19 26" stroke="var(--clay)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

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
    if (Notification.permission === "denied") return;

    if (Notification.permission === "default") {
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
      return;
    }

    // Permission is already "granted" (e.g. toggled directly in OS settings,
    // or an earlier subscription went stale and was cleaned up server-side)
    // but this device may not actually have a live PushSubscription yet —
    // in that case still offer the button so the user has a way back in.
    void (async () => {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) setVisible(true);
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.error("[push] Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
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
      if (!res.ok) {
        console.error("[push] subscribe request failed:", res.status, await res.text());
      }
    } catch (error) {
      console.error("[push] Failed to subscribe:", error);
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
    <div
      style={JOURNAL_SCOPE}
      className="flex flex-col gap-4 rounded-xl border border-border-strong-legacy bg-surface px-4 py-4 text-text min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
    >
      <div className="flex items-center gap-3">
        <BellMark />
        <p className="text-sm leading-snug text-text">Want Ember to roast you when you forget to check in?</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={dismiss}
          className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm text-text-muted underline underline-offset-4 hover:text-text ${RING}`}
        >
          No
        </button>
        <button
          onClick={() => void enable()}
          disabled={busy}
          className={`inline-flex min-h-11 items-center rounded-xl bg-ember px-5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-text-faint disabled:hover:opacity-100 ${RING}`}
        >
          {busy ? "..." : "Turn on"}
        </button>
      </div>
    </div>
  );
}
