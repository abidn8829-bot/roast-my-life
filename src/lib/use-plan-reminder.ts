"use client";

// React side of the "Remind me tomorrow" button (the logic is in plan-reminder.ts, tested with a fake browser).
//  - On mount it only LOOKS (inspectReminder): no permission prompt, no network, no subscription.
//  - request() is the click handler: the only place that asks for permission and subscribes.
//  - One event per click, plan_reminder_clicked, carrying only the outcome. No text, no ids.

import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { REMINDER_EVENT, browserReminderEnv, inspectReminder, runReminder, type ReminderStatus } from "./plan-reminder";

/** `enabled` is false when the page has no plan (no button is shown), so nothing is inspected at all. */
export function usePlanReminder(enabled: boolean) {
  const [status, setStatus] = useState<ReminderStatus>("idle");
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void inspectReminder(browserReminderEnv()).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const request = useCallback(async () => {
    if (busy.current) return; // a second click while one is running does nothing
    busy.current = true;
    setStatus("working");
    try {
      const result = await runReminder(browserReminderEnv());
      posthog.capture(REMINDER_EVENT, { outcome: result.outcome });
      setStatus(result.status);
    } finally {
      busy.current = false;
    }
  }, []);

  return { status, request };
}
