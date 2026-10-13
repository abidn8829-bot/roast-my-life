"use client";

import { PostHogProvider as PHProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { ReactNode, useEffect } from "react";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
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
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
