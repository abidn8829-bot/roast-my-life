"use client";

import { PostHogProvider as PHProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { ReactNode, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Initialises PostHog once. Safe to call many times: it does nothing if PostHog is already loaded, if the
// key is missing, or on the server. It also runs during the provider's first render so that child
// components that capture in their own mount effects (those run BEFORE this component's effect) are not dropped.
function initPostHog() {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || posthog.__loaded) return;
  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      // Safety layer: typed answers must never reach PostHog. Inputs are masked in recordings,
      // elements with the ph-no-capture class are blocked from autocapture and recordings,
      // and browser console output is not recorded (an error line could echo typed text).
      enable_recording_console_log: false,
      session_recording: {
        maskAllInputs: true,
        blockClass: "ph-no-capture",
      },
    });
  } catch {
    // A blocked or broken PostHog must never break the page.
  }
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  initPostHog();

  useEffect(() => {
    initPostHog();

    // Link this browser's activity to the account once the user is logged in. Only the Supabase user id is
    // sent: never the email or a name. Runs for an existing session on page load and again after a login.
    let identifiedId: string | null = null;
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        try {
          const id = session?.user?.id;
          if (id && id !== identifiedId) {
            identifiedId = id;
            posthog.identify(id);
          } else if (!id && event === "SIGNED_OUT") {
            identifiedId = null;
            posthog.reset();
          }
        } catch {
          // ignore
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Supabase env missing: stay anonymous.
    }
    return () => unsubscribe?.();
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
