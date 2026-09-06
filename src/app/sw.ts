/// <reference lib="webworker" />
/// <reference no-default-lib="true"/>

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// This app generates fresh, personalized AI content on nearly every request
// (roast text, check-in grading, category grades, OG images). A cached /api/
// response here is a real bug, not a performance win. This rule is placed
// before `...defaultCache` so it always wins (routing is first-match-wins),
// regardless of what defaultCache's own "apis" NetworkFirst+cache rule does.
// Covers /api/check-in, /api/roast, /api/og, /api/auth/*, /api/user/*, and
// any other route under /api/ — always hits the network, never the cache.
const apiNetworkOnly: RuntimeCaching = {
  matcher: ({ url }) => url.pathname.startsWith("/api/"),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNetworkOnly, ...defaultCache],
});

serwist.addEventListeners();

// Real Web Push notifications (the daily "roast nudge" cron sends these).
// Registered directly on `self` alongside Serwist's own install/activate/
// fetch listeners — these are separate event types, so they don't conflict.
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Ember", body: event.data.text() };
  }
  const title = payload.title || "Ember";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c && c.url.includes(url));
      if (existing && "focus" in existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
