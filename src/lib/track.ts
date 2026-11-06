import posthog from "posthog-js";

// Every analytics call goes through here so a missing key, a blocked script or an ad blocker can never
// break a page. Properties must be short fixed values (ids, keys, enums, numbers): NEVER answer text,
// emails, names or any other free text.
export function track(event: string, properties?: Record<string, string | number | boolean>): void {
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never throw into the UI.
  }
}
