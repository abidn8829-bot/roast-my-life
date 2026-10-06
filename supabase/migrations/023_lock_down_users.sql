-- 023_lock_down_users.sql
--
-- Locks down public.users. Before this migration (found by a live-database
-- check):
--   * "allow insert users" had WITH CHECK (true)  -> anyone could insert rows.
--   * "allow select users" had USING (true)       -> anyone could read every
--                                                    row, emails included.
--   * the logged-in role could UPDATE every column, including
--     subscription_tier, id, email and created_at -> a user could make
--     themselves Pro from the browser.
--
-- After this migration:
--   * Nobody can insert or delete users rows through the public API. New rows
--     are still created by the on_auth_user_created trigger, which runs as a
--     security definer function and is not affected by these policies/grants.
--   * A logged-in user can read ONLY their own row.
--   * A logged-in user can update ONLY achievements, current_streak and
--     longest_streak (the only columns the app writes as the user), and only
--     on their own row.
--   * subscription_tier is written only by the Gumroad webhook, which uses the
--     service-role key and bypasses all of this.
--
-- Rollback: supabase/rollbacks/023_lock_down_users_rollback.sql (kept outside
-- this folder on purpose so it never runs automatically).
--
-- Everything below runs in ONE transaction: if any step fails, nothing is
-- applied.

begin;

-- Safety check 1 (plain English): the app still needs to update its own row
-- (streaks and achievements), and that depends on the existing policy
-- "Users can update own record". If it is missing, stop before locking
-- anything, so we never lock the app out of its own updates.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Users can update own record'
      and cmd = 'UPDATE'
  ) then
    raise exception 'Aborting: policy "Users can update own record" not found on public.users';
  end if;
end $$;

-- Safety check 2 (plain English): new users get their row from the sign-up
-- trigger, not from app code. If the trigger is missing, removing the open
-- insert policy would stop new sign-ups from getting a row, so stop here.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    raise exception 'Aborting: trigger on_auth_user_created not found; new sign-ups would break';
  end if;
end $$;

-- Safety belt (plain English): make sure row-level security is switched ON for
-- this table. If it is already on (expected), this does nothing. If it were
-- off, none of the policies below would protect anything.
alter table public.users enable row level security;

-- Step a (plain English): remove the policy that let anyone insert a user row.
drop policy if exists "allow insert users" on public.users;

-- Step b (plain English): take away the right to add or delete user rows from
-- the public API for both logged-out and logged-in visitors. The sign-up
-- trigger and the service-role key are unaffected.
revoke insert, delete on public.users from anon, authenticated;

-- Step c (plain English): take away the right to edit users rows entirely,
-- then give back the right to edit only three columns, and only to logged-in
-- users. Revoking at table level also clears any column-level grants, so
-- subscription_tier, id, email, created_at (and the unused display_name and
-- timezone) become read-only for everyone except the service-role key.
revoke update on public.users from anon, authenticated;
grant update (achievements, current_streak, longest_streak)
  on public.users to authenticated;

-- Step d (plain English): replace the "anyone can read everyone" policy with
-- "a logged-in user can read only their own row". Logged-out visitors can
-- read nothing. The drop-if-exists on the new name makes this file safe to
-- re-run.
drop policy if exists "allow select users" on public.users;
drop policy if exists "Users can read own record" on public.users;
create policy "Users can read own record"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

-- Step e (plain English): "Users can update own record" (auth.uid() = id) is
-- intentionally NOT touched. It is what limits the three writable columns
-- above to the user's own row. Safety check 1 confirmed it exists.

commit;
