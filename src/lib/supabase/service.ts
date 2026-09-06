import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server-only jobs (cron routes)
 * that must read/write across ALL users, not just whoever is currently
 * authenticated. This bypasses Row Level Security entirely — never import
 * it into anything reachable from a client request without its own auth
 * check first (e.g. the CRON_SECRET check already used by cron routes).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard -> Project
 * Settings -> API -> service_role key) — a DIFFERENT, more powerful key
 * than NEXT_PUBLIC_SUPABASE_ANON_KEY already in use elsewhere in this repo.
 * The old weekly-email cron broke because it called an admin API using the
 * anon key, which cannot do that — don't repeat that here.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
