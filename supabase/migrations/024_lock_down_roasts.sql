-- 024_lock_down_roasts.sql
--
-- PROBLEM: two hand-made policies on public.roasts are wide open to every
-- logged-in user:
--   "allow select roasts"  (SELECT, authenticated, USING true)
--       -> any logged-in user can read EVERY user's roasts
--          (answers, roast text, continuity memory, plan steps, ...)
--   "allow insert roasts"  (INSERT, authenticated, WITH CHECK true)
--       -> any logged-in user can create a roast under SOMEONE ELSE'S user_id
--
-- FIX: replace them with owner-only policies. The app never needs more:
--   * every roasts query in src/ is already filtered to the current user, and
--   * public share pages / OG images go through security-definer functions
--     (get_roast_for_og, get_roast_by_share_slug), and percentiles go through
--     the service-role client, which bypasses RLS.
--
-- NOT TOUCHED: the "Users can update own roasts" policy, table grants, the
-- security-definer functions, FORCE ROW LEVEL SECURITY (stays off).
--
-- Everything below runs in ONE transaction: if any step fails, nothing changes.
-- Rollback: supabase/rollbacks/024_lock_down_roasts_rollback.sql
-- Tests:    supabase/tests/024_lock_down_roasts_tests.sql

begin;

-- Step 1 (safety check): the update policy is the only thing that lets users
-- edit their own roasts (e.g. saving a reaction). It must already exist and we
-- must not leave the table without it, so stop with a clear message if it is
-- missing instead of guessing.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'roasts'
      and policyname = 'Users can update own roasts'
  ) then
    raise exception
      'Migration 024 aborted: the policy "Users can update own roasts" does not exist on public.roasts. Nothing was changed. Restore it first (see 011_add_roasts_update_policy.sql) and run this migration again.';
  end if;
end
$$;

-- Step 2: make sure row level security is switched on for roasts.
-- (A no-op if it is already on, which it should be.)
alter table public.roasts enable row level security;

-- Step 3: remove the two wide-open policies.
drop policy if exists "allow insert roasts" on public.roasts;
drop policy if exists "allow select roasts" on public.roasts;

-- Step 4: logged-in users may only INSERT a roast for themselves.
-- (The drop-if-exists just makes this file safe to run twice.)
drop policy if exists "Users can insert own roasts" on public.roasts;
create policy "Users can insert own roasts"
  on public.roasts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Step 5: logged-in users may only READ their own roasts.
drop policy if exists "Users can read own roasts" on public.roasts;
create policy "Users can read own roasts"
  on public.roasts
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Step 6 (final check): confirm the end state before committing. If anything
-- is off, the whole migration is rolled back.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roasts'
      and policyname = 'Users can update own roasts'
  ) then
    raise exception 'Migration 024 aborted: the update policy is missing after the change.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roasts'
      and (
        (cmd in ('SELECT', 'ALL') and btrim(coalesce(qual, ''), '() ') = 'true')
        or (cmd in ('INSERT', 'ALL') and btrim(coalesce(with_check, ''), '() ') = 'true')
      )
  ) then
    raise exception 'Migration 024 aborted: another wide-open (true) SELECT/INSERT policy still exists on public.roasts. Nothing was changed. List them with: select policyname, cmd, roles, qual, with_check from pg_policies where tablename = ''roasts'';';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.roasts'::regclass) then
    raise exception 'Migration 024 aborted: row level security is not enabled on public.roasts.';
  end if;
end
$$;

commit;
