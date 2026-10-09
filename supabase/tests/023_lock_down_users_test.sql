-- 023_lock_down_users_test.sql
--
-- Manual checks for 023_lock_down_users.sql. Run them in the Supabase SQL
-- editor AFTER applying the migration. Nothing here is saved: every block
-- starts with "begin" and ends with "rollback".
--
-- HOW TO USE
--   1. Replace <USER_ID> with the id (uuid) of a real test account. You can
--      find it in Supabase -> Authentication -> Users. Use a test account,
--      not a real customer.
--   2. For Block 3, replace <OTHER_USER_ID> with the id of a DIFFERENT
--      account (any other user in the table).
--   3. Run ONE block at a time (select just that block and press Run).
--   4. Each block ends with a result row that starts with PASS. If the check
--      fails you will instead see a red error that says "FAILED". If that
--      happens, run  rollback;  on its own to clear the open transaction.
--
-- The blocks pretend to be the logged-in test user by switching to the
-- "authenticated" role and setting the user id the way Supabase does.


-- =====================================================================
-- BLOCK 0 (read-only, optional): what do the rules look like right now?
-- Expected: policies "Users can read own record" (SELECT) and
-- "Users can update own record" (UPDATE); NO "allow insert users" and NO
-- "allow select users". In the second query, authenticated_can_update must be
-- true ONLY for achievements, current_streak and longest_streak, and
-- anon_can_update must be false for every column.
-- =====================================================================
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'users'
order by policyname;

select a.attname as column_name,
       has_column_privilege('authenticated', 'public.users', a.attname, 'UPDATE') as authenticated_can_update,
       has_column_privilege('anon', 'public.users', a.attname, 'UPDATE') as anon_can_update
from pg_attribute a
where a.attrelid = 'public.users'::regclass
  and a.attnum > 0
  and not a.attisdropped
order by a.attnum;


-- =====================================================================
-- BLOCK 1: a logged-in user must NOT be able to change subscription_tier.
-- This is the "make myself Pro" hole.
-- Expected: result row "PASS 1 ...". The update is refused with
-- "permission denied for table users" (the block catches that error and
-- reports PASS). If the update is allowed, you get a red error
-- "TEST 1 FAILED".
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims',
  '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
begin
  update public.users
     set subscription_tier = 'pro'
   where id = '<USER_ID>'::uuid;
  raise exception 'TEST 1 FAILED: update of subscription_tier was allowed';
exception
  when insufficient_privilege then
    null; -- permission denied: this is what we want
end $$;

select 'PASS 1: subscription_tier update was refused' as result;
rollback;


-- =====================================================================
-- BLOCK 2: a logged-in user MUST still be able to update current_streak
-- on their own row (the app does this when you get roasted).
-- Expected: result row "PASS 2 ...". If the update is refused, or no row
-- is updated (wrong <USER_ID>, or that user has no row in public.users),
-- you get a red error "TEST 2 FAILED". The value is set to itself, and
-- the rollback undoes it anyway.
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims',
  '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
declare
  rows_updated integer;
begin
  update public.users
     set current_streak = coalesce(current_streak, 0)
   where id = '<USER_ID>'::uuid;
  get diagnostics rows_updated = row_count;
  if rows_updated <> 1 then
    raise exception 'TEST 2 FAILED: expected 1 row updated, got %', rows_updated;
  end if;
end $$;

select 'PASS 2: current_streak update on own row succeeded' as result;
rollback;


-- =====================================================================
-- BLOCK 3: a logged-in user must NOT be able to read another user's row.
-- Expected: other_rows = 0 and visible_rows = 1 (only your own row), and
-- the verdict column says PASS 3. Anything else says FAIL 3.
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims',
  '{"sub":"<USER_ID>","role":"authenticated"}', true);

select
  count(*) filter (where id = '<OTHER_USER_ID>'::uuid) as other_rows,
  count(*) as visible_rows,
  case
    when count(*) filter (where id = '<OTHER_USER_ID>'::uuid) = 0
     and count(*) = 1
    then 'PASS 3: only my own row is visible'
    else 'FAIL 3: other users rows are still readable'
  end as verdict
from public.users;
rollback;


-- =====================================================================
-- BLOCK 4: a logged-in user must NOT be able to insert a new users row.
-- Expected: result row "PASS 4 ...". The insert is refused with
-- "permission denied for table users" (the block catches that error and
-- reports PASS). If the insert is allowed you get a red error
-- "TEST 4 FAILED". Nothing is saved either way (rollback).
-- =====================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims',
  '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
begin
  insert into public.users (id, email)
  values (gen_random_uuid(), 'lockdown-test@example.invalid');
  raise exception 'TEST 4 FAILED: insert into public.users was allowed';
exception
  when insufficient_privilege then
    null; -- permission denied: this is what we want
end $$;

select 'PASS 4: insert into public.users was refused' as result;
rollback;


-- =====================================================================
-- BLOCK 5 (optional extra): a logged-OUT visitor must see no user rows.
-- Expected: visible_rows = 0 and verdict PASS 5. (A "permission denied"
-- error here is also acceptable and means the visitor is blocked.)
-- =====================================================================
begin;
set local role anon;

select
  count(*) as visible_rows,
  case when count(*) = 0
       then 'PASS 5: logged-out visitors see nothing'
       else 'FAIL 5: logged-out visitors can read user rows'
  end as verdict
from public.users;
rollback;
