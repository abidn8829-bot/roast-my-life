"use client";

import { useEffect } from "react";

const SYNCED_KEY = "ember-tz-synced";

// Sends the browser's time zone to the server once per tab session, in the background.
// Renders nothing. Every failure is silent: it never shows an error and never blocks the page.
export function TimezoneSync() {
  useEffect(() => {
    try {
      try {
        if (window.sessionStorage.getItem(SYNCED_KEY) === "1") return;
      } catch {
        // sessionStorage blocked (private mode, settings): still try once per page load.
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone) return;

      fetch("/api/user/timezone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
        keepalive: true,
      })
        .then((res) => {
          if (!res.ok) return;
          try {
            window.sessionStorage.setItem(SYNCED_KEY, "1");
          } catch {
            // ignore
          }
        })
        .catch(() => {
          // network error: ignore, try again on the next tab session
        });
    } catch {
      // never let this break the page
    }
  }, []);

  return null;
}
