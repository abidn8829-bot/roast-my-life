-- 026_lock_down_function_grants.sql
--
-- PROBLEM: two security-definer functions can be called by anyone through the
-- public API (EXECUTE is granted to PUBLIC, anon, authenticated, service_role):
--   * public.handle_new_user()      - the sign-up trigger function. It is only
--                                     meant to be fired by the on_auth_user_created
--                                     trigger, never called directly.
--   * public.get_category_averages() - returns every user's latest category
--                                     scores (no user ids). The app only calls it
--                                     with the service-role client
--                                     (src/lib/arc-comparisons.ts and
--                                     src/app/api/cron/weekly-arc-snapshot/route.ts).
--
-- FIX: revoke EXECUTE on both from PUBLIC, anon and authenticated.
--   * The sign-up trigger is NOT affected: Postgres only checks EXECUTE on a
--     trigger function when the trigger is created, not each time it fires, and
--     the function runs with its owner's rights (security definer).
--   * get_category_averages() stays executable by service_role (granted
--     explicitly below, so it does not depend on PUBLIC).
--
-- NOT TOUCHED: get_roast_for_og(uuid). It MUST stay callable by anon because
-- share pages and OG images use it. This migration only checks that it still is.
--
-- One transaction: if any step fails, nothing changes.
-- Rollback: supabase/rollbacks/026_lock_down_function_grants_rollback.sql
-- Tests:    supabase/tests/026_lock_down_function_grants_tests.sql

begin;

-- Step 1 (safety check): everything this migration relies on must exist, and
-- get_roast_for_og(uuid) must be callable by anon right now.
do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise exception 'Migration 026 aborted: function public.handle_new_user() does not exist. Nothing was changed.';
  end if;
  if to_regprocedure('public.get_category_averages()') is null then
    raise exception 'Migration 026 aborted: function public.get_category_averages() does not exist. Nothing was changed.';
  end if;
  if to_regprocedure('public.get_roast_for_og(uuid)') is null then
    raise exception 'Migration 026 aborted: function public.get_roast_for_og(uuid) does not exist. Nothing was changed.';
  end if;
  if not has_function_privilege('anon', 'public.get_roast_for_og(uuid)', 'EXECUTE') then
    raise exception 'Migration 026 aborted: anon cannot execute public.get_roast_for_og(uuid) even before this migration. Share pages are already affected; fix that first. Nothing was changed.';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    raise exception 'Migration 026 aborted: trigger on_auth_user_created was not found on auth.users. Nothing was changed.';
  end if;
end
$$;

-- Step 2: nobody can call the sign-up trigger function through the API any more.
-- (The trigger itself keeps working - see the header comment.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Step 3: the cross-user score distribution can no longer be fetched by
-- logged-in users or anonymous visitors, only by the server (service role).
-- Every caller in src/ already uses the service-role client.
revoke execute on function public.get_category_averages() from public, anon, authenticated;

-- Step 4: make the service role's access explicit so it never depends on PUBLIC.
grant execute on function public.get_category_averages() to service_role;

-- Step 5 (final check): confirm the end state before committing.
do $$
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'Migration 026 aborted: anon/authenticated can still execute handle_new_user().';
  end if;

  if has_function_privilege('anon', 'public.get_category_averages()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_category_averages()', 'EXECUTE') then
    raise exception 'Migration 026 aborted: anon/authenticated can still execute get_category_averages().';
  end if;

  if not has_function_privilege('service_role', 'public.get_category_averages()', 'EXECUTE') then
    raise exception 'Migration 026 aborted: service_role lost EXECUTE on get_category_averages().';
  end if;

  if not has_function_privilege('anon', 'public.get_roast_for_og(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_roast_for_og(uuid)', 'EXECUTE') then
    raise exception 'Migration 026 aborted: get_roast_for_og(uuid) is no longer callable by anon/authenticated.';
  end if;
end
$$;

commit;
