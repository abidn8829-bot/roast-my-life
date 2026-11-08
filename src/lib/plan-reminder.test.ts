// Run with: node --test src/lib/plan-reminder.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Tests for the "Remind me tomorrow" button (src/lib/plan-reminder.ts, use-plan-reminder.ts and the panel in
// src/components/roast-view.tsx). Everything here is a FAKE browser: no real notification permission, no real push
// subscription, no network, no database. What it protects: nothing happens before a click; a click asks, then
// subscribes, then saves, once; only /api/push/subscribe is ever called; every state shows its exact words.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  REMINDER_COPY,
  REMINDER_EVENT,
  REMINDER_OUTCOMES,
  inspectReminder,
  runReminder,
  type ReminderEnv,
} from "./plan-reminder.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

// ---------------------------------------------------------------------------
// a fake browser that writes down every call it gets, in order
// ---------------------------------------------------------------------------

const FAKE_KEY = "BEl62iUYgUivxIkv69yViEuiBIa40HI80YBfH2yPzW-i6vQOUUsF1JPZc4A_qWLn7kD9FQ4vD6lQoRrdK0aBLEs"; // not a real key
const SUB_JSON = { endpoint: "https://push.example.invalid/abc", keys: { p256dh: "p", auth: "a" } };

type Opts = {
  supported?: boolean;
  permission?: string; // what Notification.permission says
  answer?: string; // what the permission prompt returns
  existing?: boolean; // the browser already has a push subscription
  postOk?: boolean;
  postThrows?: boolean;
  subscribeThrows?: boolean;
  vapid?: string | undefined;
  readyNever?: boolean;
};

function fakeBrowser(o: Opts = {}) {
  const calls: string[] = [];
  const posts: { url: string; body: string }[] = [];
  const subscribeArgs: { userVisibleOnly: boolean; applicationServerKey: unknown }[] = [];
  let permission = o.permission ?? "default";
  const sub = { toJSON: () => SUB_JSON };
  const registration = {
    pushManager: {
      getSubscription: async () => {
        calls.push("getSubscription");
        return o.existing ? sub : null;
      },
      subscribe: async (options: { userVisibleOnly: boolean; applicationServerKey: unknown }) => {
        calls.push("subscribe");
        subscribeArgs.push(options);
        if (o.subscribeThrows) throw new Error("subscribe failed");
        return sub;
      },
    },
  };
  const env: ReminderEnv = {
    supported: o.supported ?? true,
    permission: () => permission,
    requestPermission: async () => {
      calls.push("requestPermission");
      permission = o.answer ?? "granted";
      return permission;
    },
    getRegistration: async () => {
      calls.push("getRegistration");
      return registration as never;
    },
    ready: () => {
      calls.push("ready");
      return o.readyNever ? new Promise(() => {}) : Promise.resolve(registration as never);
    },
    post: async (url, body) => {
      calls.push(`post ${url}`);
      posts.push({ url, body });
      if (o.postThrows) throw new Error("network down");
      return { ok: o.postOk ?? true };
    },
    vapidPublicKey: "vapid" in o ? o.vapid : FAKE_KEY,
    readyTimeoutMs: 30,
  };
  return { env, calls, posts, subscribeArgs };
}

// ---------------------------------------------------------------------------
// on mount: look only
// ---------------------------------------------------------------------------

test("mount check: never asks for permission, never subscribes, never calls the network", async () => {
  for (const o of [{}, { permission: "granted" }, { permission: "granted", existing: true }, { permission: "denied" }, { supported: false }]) {
    const b = fakeBrowser(o);
    await inspectReminder(b.env);
    for (const forbidden of ["requestPermission", "subscribe", "ready"]) assert.ok(!b.calls.includes(forbidden), `${JSON.stringify(o)}: ${forbidden} was called on mount`);
    assert.equal(b.posts.length, 0, "no network on mount");
    assert.ok(!b.calls.some((c) => c.startsWith("post")));
  }
});

test("mount check: gives idle, subscribed, denied or unsupported for what the browser says", async () => {
  assert.equal(await inspectReminder(fakeBrowser().env), "idle");
  assert.equal(await inspectReminder(fakeBrowser({ permission: "granted" }).env), "idle", "granted but no subscription yet");
  assert.equal(await inspectReminder(fakeBrowser({ permission: "granted", existing: true }).env), "subscribed");
  assert.equal(await inspectReminder(fakeBrowser({ permission: "denied" }).env), "denied");
  assert.equal(await inspectReminder(fakeBrowser({ supported: false }).env), "unsupported");
  const broken = fakeBrowser();
  broken.env.getRegistration = async () => {
    throw new Error("x");
  };
  assert.equal(await inspectReminder(broken.env), "idle", "a failing look is not an error screen");
});

// ---------------------------------------------------------------------------
// the click
// ---------------------------------------------------------------------------

test("click with permission 'default': asks first, then subscribes, then saves, in that order, once each", async () => {
  const b = fakeBrowser({ permission: "default", answer: "granted" });
  const r = await runReminder(b.env);
  assert.deepEqual(r, { status: "subscribed", outcome: "subscribed" });
  const at = (c: string) => b.calls.indexOf(c);
  assert.ok(at("requestPermission") !== -1 && at("subscribe") !== -1 && at("post /api/push/subscribe") !== -1);
  assert.ok(at("requestPermission") < at("subscribe"), "permission is asked before subscribing");
  assert.ok(at("subscribe") < at("post /api/push/subscribe"), "the subscription is saved after it exists");
  for (const c of ["requestPermission", "subscribe", "post /api/push/subscribe"]) assert.equal(b.calls.filter((x) => x === c).length, 1, `${c} exactly once`);
});

test("click: subscribes with userVisibleOnly and the VAPID key, and saves exactly the subscription JSON", async () => {
  const b = fakeBrowser();
  await runReminder(b.env);
  assert.equal(b.subscribeArgs[0].userVisibleOnly, true);
  assert.ok(b.subscribeArgs[0].applicationServerKey instanceof Uint8Array && b.subscribeArgs[0].applicationServerKey.length > 0);
  assert.deepEqual(b.posts, [{ url: "/api/push/subscribe", body: JSON.stringify(SUB_JSON) }]);
});

test("click with permission already granted (but no subscription): does not ask again, subscribes and saves", async () => {
  const b = fakeBrowser({ permission: "granted" });
  assert.deepEqual(await runReminder(b.env), { status: "subscribed", outcome: "subscribed" });
  assert.ok(!b.calls.includes("requestPermission"));
  assert.equal(b.posts.length, 1);
});

test("click when the browser already has a subscription: saves that one, does not make a second", async () => {
  const b = fakeBrowser({ permission: "granted", existing: true });
  assert.deepEqual(await runReminder(b.env), { status: "subscribed", outcome: "already_subscribed" });
  assert.ok(!b.calls.includes("subscribe"));
  assert.equal(b.posts.length, 1);
});

test("click, permission blocked: denied, nothing is subscribed or saved", async () => {
  const blocked = fakeBrowser({ permission: "denied" });
  assert.deepEqual(await runReminder(blocked.env), { status: "denied", outcome: "denied" });
  assert.ok(!blocked.calls.includes("requestPermission"), "a blocked site is not asked again");
  const refused = fakeBrowser({ permission: "default", answer: "denied" });
  assert.deepEqual(await runReminder(refused.env), { status: "denied", outcome: "denied" });
  for (const b of [blocked, refused]) {
    assert.ok(!b.calls.includes("subscribe"));
    assert.equal(b.posts.length, 0);
  }
});

test("click, prompt closed without a choice: nothing is saved and the button stays available (idle)", async () => {
  const b = fakeBrowser({ permission: "default", answer: "default" });
  assert.deepEqual(await runReminder(b.env), { status: "idle", outcome: "denied" });
  assert.ok(!b.calls.includes("subscribe"));
  assert.equal(b.posts.length, 0);
});

test("click in a browser without push: unsupported, no calls at all", async () => {
  const b = fakeBrowser({ supported: false });
  assert.deepEqual(await runReminder(b.env), { status: "unsupported", outcome: "unsupported" });
  assert.deepEqual(b.calls, []);
});

test("errors: a failed save, a thrown save, a failed subscribe, no key and a service worker that never starts all give 'error', once, no retry", async () => {
  const cases: [string, Opts][] = [
    ["save returns not ok", { postOk: false }],
    ["save throws", { postThrows: true }],
    ["subscribe throws", { subscribeThrows: true }],
    ["no VAPID key", { vapid: undefined }],
    ["service worker never ready", { readyNever: true }],
  ];
  for (const [name, o] of cases) {
    const b = fakeBrowser(o);
    assert.deepEqual(await runReminder(b.env), { status: "error", outcome: "error" }, name);
    assert.ok(b.calls.filter((c) => c === "subscribe").length <= 1, `${name}: subscribe at most once`);
    assert.ok(b.posts.length <= 1, `${name}: saved at most once`);
  }
  assert.ok(!fakeBrowser({ vapid: undefined }).calls.includes("subscribe"));
});

test("network: the only address ever called is /api/push/subscribe (never unsubscribe)", async () => {
  const urls = new Set<string>();
  for (const o of [{}, { permission: "granted", existing: true }, { postOk: false }]) {
    const b = fakeBrowser(o);
    await runReminder(b.env);
    b.posts.forEach((p) => urls.add(p.url));
  }
  assert.deepEqual([...urls], ["/api/push/subscribe"]);
  const code = stripComments(read("./plan-reminder.ts"));
  assert.doesNotMatch(code, /unsubscribe/i);
  assert.deepEqual(code.match(/["']\/api\/[^"']*["']/g), ['"/api/push/subscribe"']);
  assert.equal(code.match(/\bfetch\(/g)?.length, 1, "one fetch, inside the browser env's post()");
});

// ---------------------------------------------------------------------------
// the words, the event
// ---------------------------------------------------------------------------

test("copy: every state shows exactly its agreed words", () => {
  assert.deepEqual(REMINDER_COPY, {
    idle: "Remind me tomorrow",
    working: "Setting it up…",
    subscribed: "Reminder on. Ember will nudge you tomorrow if you haven't checked in.",
    denied: "Notifications are blocked in your browser. Come back tomorrow and check in from Ember.",
    unsupported: "Come back tomorrow and check in.",
    error: "Couldn't set the reminder. Try again.",
  });
  // no promise of a time in any of them
  for (const text of Object.values(REMINDER_COPY)) assert.doesNotMatch(text, /\b\d{1,2}(:\d\d)?\s?(am|pm|utc)\b|\bat \d|\bo'clock|\bmorning|\bafternoon|\bevening/i, text);
});

test("event: plan_reminder_clicked with one property, outcome, from a fixed list; no text or ids", () => {
  assert.equal(REMINDER_EVENT, "plan_reminder_clicked");
  assert.deepEqual([...REMINDER_OUTCOMES], ["subscribed", "already_subscribed", "denied", "unsupported", "error"]);
  const hook = stripComments(read("./use-plan-reminder.ts"));
  assert.match(hook, /posthog\.capture\(REMINDER_EVENT, \{ outcome: result\.outcome \}\);/);
  assert.equal(hook.match(/posthog\.capture\(/g)?.length, 1);
  assert.match(hook, /import posthog from "posthog-js";/);
});

// ---------------------------------------------------------------------------
// the hook and the panel: nothing without a click
// ---------------------------------------------------------------------------

test("hook: on mount it only inspects; asking and subscribing live only in request()", () => {
  const hook = stripComments(read("./use-plan-reminder.ts"));
  const effect = hook.slice(hook.indexOf("useEffect(() => {"), hook.indexOf("}, [enabled]);"));
  assert.match(effect, /inspectReminder\(/);
  for (const word of ["runReminder", "request", "requestPermission", "subscribe", "fetch", "posthog"]) assert.ok(!effect.includes(word), `the mount effect must not use ${word}`);
  assert.equal(hook.match(/runReminder\(/g)?.length, 1);
  assert.ok(hook.indexOf("const request = useCallback") < hook.indexOf("runReminder("), "runReminder is only inside request()");
  assert.match(hook, /if \(!enabled\) return;/, "no looking when there is no plan");
  assert.match(hook, /if \(busy\.current\) return;/, "a second click while one runs does nothing");
});

test("panel: the button calls request() only on click, is a real button, and shows the states in a live region", () => {
  const view = stripComments(read("../components/roast-view.tsx"));
  assert.match(view, /const reminder = usePlanReminder\(Boolean\(visiblePlan\)\);/);
  assert.match(view, /onClick=\{\(\) => void reminder\.request\(\)\}/);
  assert.equal(view.match(/reminder\.request\(\)/g)?.length, 1);
  assert.match(view, /disabled=\{reminder\.status === "working"\}/);
  assert.match(view, /<p role="status" aria-live="polite"/);
  assert.match(view, /focus-visible:outline focus-visible:outline-2/);
  assert.match(view, /Do it today\. Check in tomorrow\./);
  assert.match(view, /See if your \{lifeScore\} moves\./);
  assert.match(view, /: "Remind me tomorrow"\}/, "the idle label");
  // states come from the shared copy
  for (const key of ["working", "subscribed", "denied", "unsupported", "error"]) assert.ok(view.includes(`REMINDER_COPY.${key}`), `REMINDER_COPY.${key} is used`);
  // the panel (and so the plan band) exists only with a plan
  assert.ok(view.indexOf("{visiblePlan && (") < view.indexOf("Remind me tomorrow"));
});

test('the text "/dashboard" appears in none of the files created or edited for the reminder', () => {
  for (const file of ["./plan-reminder.ts", "./use-plan-reminder.ts", "../components/roast-view.tsx"]) {
    assert.doesNotMatch(stripComments(read(file)), /\/dashboard/, `${file} must not contain /dashboard`);
  }
});

test("the push files this feature relies on are untouched: it adds a caller, not new push code", () => {
  const prompt = read("../components/push-permission-prompt.tsx");
  assert.match(prompt, /export function PushPermissionPrompt\(\)/);
  assert.match(prompt, /fetch\("\/api\/push\/subscribe"/);
  assert.match(read("../app/sw.ts"), /addEventListener\("push"/);
});
