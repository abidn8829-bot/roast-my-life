-- 029_safety_flags_test.sql
--
-- Manual checks for 029_safety_flags.sql. Run them AFTER applying the migration, in a TEST
-- database or with test accounts only. Nothing here is saved: every block starts with "begin"
-- and ends with "rollback".
--
-- HOW TO USE
--   1. Replace <USER_ID> with the id (uuid) of a test account and <OTHER_USER_ID> with a
--      DIFFERENT account (Supabase -> Authentication -> Users). Not real customers.
--   2. Run ONE block at a time. Each block ends with a row that starts with PASS. A failed
--      check shows a red error that says "FAILED". If that happens, run  rollback;  on its
--      own to clear the open transaction.
--
-- The blocks pretend to be a logged-in user by switching to the "authenticated" role and
-- setting the user id the way Supabase does, and pretend to be the server with "service_role".


-- =====================================================================
-- BLOCK 0 (read-only): what do the rules look like right now?
-- Expected: exactly 4 columns (id, user_id, level, created_at); one policy
-- "Users can read own safety flags" (SELECT); authenticated can SELECT only;
-- anon can do nothing; service_role can SELECT, INSERT, DELETE (not UPDATE).
-- =====================================================================
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'safety_flags'
order by ordinal_position;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'safety_flags';

select r.role_name,
       has_table_privilege(r.role_name, 'public.safety_flags', 'SELECT') as can_select,
       has_table_privilege(r.role_name, 'public.safety_flags', 'INSERT') as can_insert,
       has_table_privilege(r.role_name, 'public.safety_flags', 'UPDATE') as can_update,
       has_table_privilege(r.role_name, 'public.safety_flags', 'DELETE') as can_delete
from (values ('anon'), ('authenticated'), ('service_role')) as r(role_name);


-- =====================================================================
-- BLOCK 1: the server (service_role) can write a flag; a user sees ONLY their own rows.
-- Expected: "PASS 1".
-- =====================================================================
begin;
set local role service_role;
insert into public.safety_flags (user_id, level) values ('<USER_ID>', 2), ('<OTHER_USER_ID>', 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
declare n integer; others integer;
begin
  select count(*) into n from public.safety_flags;
  select count(*) into others from public.safety_flags where user_id <> '<USER_ID>';
  if n <> 1 or others <> 0 then
    raise exception 'TEST 1 FAILED: user saw % rows (% belonging to someone else); expected exactly their own 1', n, others;
  end if;
end $$;
select 'PASS 1: a user reads only their own flag' as result;
rollback;


-- =====================================================================
-- BLOCK 2: a logged-in user must NOT be able to insert, update or delete flags.
-- Expected: "PASS 2".
-- =====================================================================
begin;
set local role service_role;
insert into public.safety_flags (user_id, level) values ('<USER_ID>', 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
begin
  begin
    insert into public.safety_flags (user_id, level) values ('<USER_ID>', 1);
    raise exception 'TEST 2 FAILED: authenticated could INSERT a flag';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.safety_flags set level = 1;
    raise exception 'TEST 2 FAILED: authenticated could UPDATE a flag';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.safety_flags;
    raise exception 'TEST 2 FAILED: authenticated could DELETE a flag';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'PASS 2: a user cannot insert, update or delete flags' as result;
rollback;


-- =====================================================================
-- BLOCK 3: a logged-out visitor (anon) cannot read or write anything.
-- Expected: "PASS 3".
-- =====================================================================
begin;
set local role anon;

do $$
begin
  begin
    perform 1 from public.safety_flags;
    raise exception 'TEST 3 FAILED: anon could read safety_flags';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.safety_flags (user_id, level) values ('<USER_ID>', 1);
    raise exception 'TEST 3 FAILED: anon could insert into safety_flags';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.safety_flag_monthly_totals;
    raise exception 'TEST 3 FAILED: anon could read the monthly totals';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'PASS 3: anon has no access' as result;
rollback;


-- =====================================================================
-- BLOCK 4: only levels 1 and 2 are accepted, and there is nowhere to put text.
-- Expected: "PASS 4".
-- =====================================================================
begin;
set local role service_role;

do $$
begin
  begin
    insert into public.safety_flags (user_id, level) values ('<USER_ID>', 0);
    raise exception 'TEST 4 FAILED: level 0 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.safety_flags (user_id, level) values ('<USER_ID>', 3);
    raise exception 'TEST 4 FAILED: level 3 was accepted';
  exception when check_violation then null;
  end;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'safety_flags'
      and data_type in ('text', 'character varying', 'json', 'jsonb')
  ) then
    raise exception 'TEST 4 FAILED: safety_flags has a text-like column';
  end if;
end $$;
select 'PASS 4: levels limited to 1 and 2; no text columns' as result;
rollback;


-- =====================================================================
-- BLOCK 5: the 30-day purge rolls old flags into anonymous monthly totals and deletes them;
-- recent flags stay; users cannot run it.
-- Expected: "PASS 5".
-- =====================================================================
begin;
set local role service_role;
insert into public.safety_flags (user_id, level, created_at) values
  ('<USER_ID>', 2, now() - interval '40 days'),
  ('<USER_ID>', 1, now() - interval '35 days'),
  ('<OTHER_USER_ID>', 1, now() - interval '1 day');

do $$
declare deleted integer; remaining integer; counted integer;
begin
  select public.purge_old_safety_flags() into deleted;
  select count(*) into remaining from public.safety_flags;
  select coalesce(sum(total), 0) into counted from public.safety_flag_monthly_totals;
  if deleted <> 2 or remaining <> 1 or counted <> 2 then
    raise exception 'TEST 5 FAILED: deleted=% remaining=% counted=% (expected 2, 1, 2)', deleted, remaining, counted;
  end if;
end $$;

set local role authenticated;
do $$
begin
  begin
    perform public.purge_old_safety_flags();
    raise exception 'TEST 5 FAILED: authenticated could run the purge';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'PASS 5: purge keeps recent flags, counts old ones anonymously, users cannot run it' as result;
rollback;
