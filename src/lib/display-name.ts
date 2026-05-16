import type { User } from "@supabase/supabase-js";

export function getDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    "";

  if (full) {
    return full.trim().split(/\s+/)[0] ?? full;
  }

  if (user.email) {
    return user.email.split("@")[0] ?? "there";
  }

  return "there";
}
