-- 026_lock_down_function_grants_rollback.sql
--
-- Restores the state BEFORE migration 026: EXECUTE granted to PUBLIC, anon and
-- authenticated on handle_new_user() and get_category_averages()
-- (service_role keeps its access, as it had before).
--
-- WARNING: this lets anyone call these functions through the public API again.
-- get_category_averages() would again expose every user's latest category
-- scores (no user ids) to anonymous and logged-in callers.
--
-- Not touched: get_roast_for_og(uuid), the sign-up trigger.
-- One transaction: all or nothing.

begin;

-- Step 1: sign-up trigger function: executable by everyone again.
grant execute on function public.handle_new_user() to public, anon, authenticated;

-- Step 2: category averages: executable by everyone again.
grant execute on function public.get_category_averages() to public, anon, authenticated;

-- Step 3: service_role keeps (explicitly) what it always had.
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.get_category_averages() to service_role;

commit;
