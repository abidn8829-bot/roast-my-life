-- EMERGENCY USE ONLY. Running this file reopens the security hole (users can
-- edit their own subscription_tier and read other users' rows). Do not run it
-- unless production is broken and you have read this file.
--
-- 023_lock_down_users_rollback.sql
--
-- Puts public.users back EXACTLY as it was before 023_lock_down_users.sql.
-- WARNING: the old state is the INSECURE one (anyone can read and insert user
-- rows, and logged-in users can edit every column including subscription_tier).
-- Only use this if the lock-down broke something and you need the app working
-- again right away, then fix forward as soon as possible.
--
-- This file lives in supabase/rollbacks/, NOT supabase/migrations/, so it
-- never runs automatically. Run it by hand in the Supabase SQL editor.
--
-- Assumptions (the original policies/grants were made by hand and are not in
-- the repo): the two old policies applied to all roles (no "to ..." clause)
-- and Supabase's default table grants were in place for anon and
-- authenticated. Row-level security itself is NOT switched off here; it was
-- already on before the migration.
--
-- One transaction: if any step fails, nothing is applied.

begin;

-- Plain English: put back the policy that let anyone insert a user row.
drop policy if exists "allow insert users" on public.users;
create policy "allow insert users"
  on public.users
  for insert
  to authenticated
  with check (true);

-- Plain English: put back the "anyone can read every row" policy and remove
-- the "own row only" policy that the migration added.
drop policy if exists "Users can read own record" on public.users;
drop policy if exists "allow select users" on public.users;
create policy "allow select users"
  on public.users
  for select
  to authenticated
  using (true);

-- Plain English: give back the right to insert and delete rows.
grant insert, delete on public.users to anon, authenticated;

-- Plain English: give back the right to update EVERY column (table-level
-- grant, which covers all columns including subscription_tier). Row-level
-- policy "Users can update own record" (unchanged) still limits updates to
-- the user's own row.
grant update on public.users to anon, authenticated;

-- "Users can update own record" was never touched by the migration, so there
-- is nothing to restore for it.

commit;
