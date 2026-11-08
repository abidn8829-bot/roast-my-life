// The "Remind me tomorrow" button on the roast result page: turn on the EXISTING push system for this browser.
//
// It does what the dashboard prompt (src/components/push-permission-prompt.tsx) does, once, from a click: ask for
// permission, subscribe through the service worker with the public VAPID key, and save the subscription with a POST
// to /api/push/subscribe. Nothing else: it never unsubscribes, never retries, never sends a notification. The daily
// nudge job (src/app/api/cron/push-nudge/route.ts) is what actually sends; this only gets a device onto its list.
//
// Plain functions with an injected `env`, so src/lib/plan-reminder.test.ts runs them with a fake browser (no React,
// no network). The React part is src/lib/use-plan-reminder.ts. No "@/" imports on purpose.
//
// Never logs or sends anything the user typed. Errors are swallowed into a status.

export type ReminderStatus = "unsupported" | "idle" | "working" | "subscribed" | "denied" | "error";

/** The only values the plan_reminder_clicked event may carry. */
export const REMINDER_OUTCOMES = ["subscribed", "already_subscribed", "denied", "unsupported", "error"] as const;
export type ReminderOutcome = (typeof REMINDER_OUTCOMES)[number];

export const REMINDER_EVENT = "plan_reminder_clicked";

/** The exact words shown in the check-in panel for each state (the idle label is also written out in roast-view.tsx). */
export const REMINDER_COPY = {
  idle: "Remind me tomorrow",
  working: "Setting it up…",
  subscribed: "Reminder on. Ember will nudge you tomorrow if you haven't checked in.",
  denied: "Notifications are blocked in your browser. Come back tomorrow and check in from Ember.",
  unsupported: "Come back tomorrow and check in.",
  error: "Couldn't set the reminder. Try again.",
} as const;

export const SUBSCRIBE_URL = "/api/push/subscribe";

type SubscriptionLike = { toJSON(): unknown };
type RegistrationLike = {
  pushManager: {
    getSubscription(): Promise<SubscriptionLike | null>;
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: BufferSource }): Promise<SubscriptionLike>;
  };
};

/** Everything the reminder needs from the browser, so a test can hand in a fake one. */
export type ReminderEnv = {
  /** serviceWorker, PushManager and Notification all exist in this browser. */
  supported: boolean;
  permission: () => string;
  requestPermission: () => Promise<string>;
  /** The current service-worker registration, or undefined. Never waits (unlike `ready`). */
  getRegistration: () => Promise<RegistrationLike | undefined>;
  /** Resolves when the service worker is active. Can wait forever when none is registered (for example in dev). */
  ready: () => Promise<RegistrationLike>;
  post: (url: string, body: string) => Promise<{ ok: boolean }>;
  vapidPublicKey: string | undefined;
  /** How long to wait for the service worker before giving up. */
  readyTimeoutMs: number;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * What the button should show before anyone clicks. ONLY looks: it never asks for permission, never subscribes and
 * never calls the network. "subscribed" means this browser already has an active push subscription.
 */
export async function inspectReminder(env: ReminderEnv): Promise<ReminderStatus> {
  try {
    if (!env.supported) return "unsupported";
    if (env.permission() === "denied") return "denied";
    const registration = await env.getRegistration();
    const existing = registration ? await registration.pushManager.getSubscription() : null;
    return existing ? "subscribed" : "idle";
  } catch {
    return "idle";
  }
}

export type ReminderResult = { status: ReminderStatus; outcome: ReminderOutcome };

/**
 * The click. Call it ONLY from a click handler (the browser shows its permission prompt only then). One attempt:
 * ask if needed, subscribe, save. Any failure is the "error" status and the button is usable again; nothing is retried.
 */
export async function runReminder(env: ReminderEnv): Promise<ReminderResult> {
  try {
    if (!env.supported) return { status: "unsupported", outcome: "unsupported" };

    let permission = env.permission();
    if (permission === "denied") return { status: "denied", outcome: "denied" };
    if (permission === "default") permission = await env.requestPermission();
    // The prompt was closed without a choice: nothing happened, so the button simply stays available.
    if (permission === "default") return { status: "idle", outcome: "denied" };
    if (permission !== "granted") return { status: "denied", outcome: "denied" };

    if (!env.vapidPublicKey) return { status: "error", outcome: "error" };

    const registration = await withTimeout(env.ready(), env.readyTimeoutMs);
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey) as unknown as BufferSource,
      }));

    const res = await env.post(SUBSCRIBE_URL, JSON.stringify(subscription.toJSON()));
    if (!res.ok) return { status: "error", outcome: "error" };
    return { status: "subscribed", outcome: existing ? "already_subscribed" : "subscribed" };
  } catch {
    return { status: "error", outcome: "error" };
  }
}

/** The real browser, as a ReminderEnv. Only called from the hook, in the browser. */
export function browserReminderEnv(): ReminderEnv {
  const hasWindow = typeof window !== "undefined" && typeof navigator !== "undefined";
  const supported = hasWindow && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    supported,
    permission: () => (supported ? Notification.permission : "denied"),
    requestPermission: () => Notification.requestPermission(),
    getRegistration: () => navigator.serviceWorker.getRegistration() as Promise<RegistrationLike | undefined>,
    ready: () => navigator.serviceWorker.ready as Promise<RegistrationLike>,
    post: (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }),
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    readyTimeoutMs: 8000,
  };
}
