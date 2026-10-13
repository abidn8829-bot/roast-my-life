-- 024_lock_down_roasts_rollback.sql
--
-- Restores the state BEFORE migration 024: the two wide-open policies on
-- public.roasts, with the same names and role (authenticated).
--
-- WARNING: this re-opens a data leak. Any logged-in user can read every user's
-- roasts and insert roasts under any user_id again. Only use it if the lock-down
-- broke something and you need time to fix it.
--
-- Not touched: "Users can update own roasts", table grants, RLS (stays on).
-- Run it in the Supabase SQL editor. One transaction: all or nothing.

begin;

-- Step 1: remove the owner-only policies created by 024.
drop policy if exists "Users can insert own roasts" on public.roasts;
drop policy if exists "Users can read own roasts" on public.roasts;

-- Step 2: recreate the old open policies (drop first so this can be re-run).
drop policy if exists "allow select roasts" on public.roasts;
create policy "allow select roasts"
  on public.roasts
  for select
  to authenticated
  using (true);

drop policy if exists "allow insert roasts" on public.roasts;
create policy "allow insert roasts"
  on public.roasts
  for insert
  to authenticated
  with check (true);

-- Step 3 (final check): the update policy must still be there and the two
-- restored policies must exist.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roasts' and policyname = 'Users can update own roasts'
  ) then
    raise exception 'Rollback 024 aborted: "Users can update own roasts" is missing. Nothing was changed.';
  end if;
  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'roasts'
      and policyname in ('allow select roasts', 'allow insert roasts')
  ) <> 2 then
    raise exception 'Rollback 024 aborted: the old policies were not restored. Nothing was changed.';
  end if;
end
$$;

commit;
