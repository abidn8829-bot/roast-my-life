-- 029_safety_flags_rollback.sql
--
-- Undoes migration 029: removes the safety flag table, the anonymous monthly totals and the
-- purge function.
--
-- WARNING: this PERMANENTLY DELETES every stored safety flag and the monthly totals. After it,
-- gentle mode can no longer remember anyone (the app treats a missing table as "not gentle").
-- Only use it if the migration caused a problem and you accept losing that data.
--
-- If you scheduled the purge with pg_cron, unschedule it first:
--   select cron.unschedule('purge-safety-flags');
--
-- Not touched: any other table, function, policy or grant.
-- Run it in the Supabase SQL editor. One transaction: all or nothing.

begin;

-- Step 1: the purge function.
drop function if exists public.purge_old_safety_flags();

-- Step 2: the policy, then the tables (the policy also goes with the table; this is explicit).
drop policy if exists "Users can read own safety flags" on public.safety_flags;
drop table if exists public.safety_flag_monthly_totals;
drop table if exists public.safety_flags;

-- Step 3 (final check): everything is gone.
do $$
begin
  if to_regclass('public.safety_flags') is not null
     or to_regclass('public.safety_flag_monthly_totals') is not null
     or to_regprocedure('public.purge_old_safety_flags()') is not null then
    raise exception 'Rollback of 029 aborted: something from the safety layer is still there. Nothing was changed.';
  end if;
end
$$;

commit;
