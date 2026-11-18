import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { openService, readTier } from "@/lib/skills/route-helpers";
import type { Tier } from "@/lib/skills/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type Viewer =
  | { kind: "ok"; service: SupabaseClient; userId: string; email: string | null; tier: Tier }
  /** The session or the plan could not be read: the page shows its friendly error, never the reason. */
  | { kind: "error" };

/**
 * Who is looking, on the server. ONLY the skills pages call this, and only AFTER they have checked skillsEnabled().
 * No login sends the visitor to /login and back. The plan is read fresh from users.subscription_tier with the same
 * reader the API routes use (readTier): it is never taken from the URL, a cookie or the browser. The service client
 * is opened only after the login is verified and is used only for the read-only skills-server functions.
 */
export async function loadViewer(nextPath: string): Promise<Viewer> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  let user: { id: string; email?: string | null } | null;
  try {
    supabase = await createSupabaseServerClient();
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    return { kind: "error" };
  }
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  let tier: Tier;
  try {
    tier = await readTier(supabase, user.id);
  } catch {
    return { kind: "error" };
  }
  const service = openService(createSupabaseServiceClient);
  if (service instanceof Response) return { kind: "error" };
  return { kind: "ok", service, userId: user.id, email: user.email ?? null, tier };
}
