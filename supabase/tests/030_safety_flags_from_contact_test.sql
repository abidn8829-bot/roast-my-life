-- 030_safety_flags_from_contact_test.sql
--
-- Manual checks for 030_safety_flags_from_contact.sql. Run them AFTER applying the migration, with
-- TEST accounts only. Nothing here is saved: every write block starts with "begin" and ends with
-- "rollback".
--
-- HOW TO USE
--   1. Replace <USER_ID> with the id (uuid) of a throwaway test account (Supabase -> Authentication
--      -> Users). Not a real customer.
--   2. Run ONE block at a time. Each write block ends with a row that starts with PASS. A failed
--      check shows a red error that says "FAILED". If that happens, run  rollback;  on its own to
--      clear the open transaction.


-- =====================================================================
-- BLOCK 0 (read-only): what does the table look like right now?
-- Expected: 5 columns (id, user_id, level, created_at, from_contact); from_contact is boolean,
-- not nullable, default false.
-- =====================================================================
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'safety_flags'
order by ordinal_position;


-- =====================================================================
-- BLOCK 1: the default is false, the server can set it to true, a user still only reads their
-- own rows and still cannot write. Expected: "PASS 1".
-- =====================================================================
begin;
set local role service_role;
insert into public.safety_flags (user_id, level) values ('<USER_ID>', 1);                       -- old-style insert
insert into public.safety_flags (user_id, level, from_contact) values ('<USER_ID>', 1, true);   -- contact form

do $$
declare plain_rows integer; contact_rows integer;
begin
  select count(*) into plain_rows   from public.safety_flags where user_id = '<USER_ID>' and from_contact = false;
  select count(*) into contact_rows from public.safety_flags where user_id = '<USER_ID>' and from_contact = true;
  if plain_rows <> 1 or contact_rows <> 1 then
    raise exception 'TEST 1 FAILED: expected 1 plain row and 1 contact row, got % and %', plain_rows, contact_rows;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
declare n integer;
begin
  select count(*) into n from public.safety_flags where from_contact is not null;
  if n <> 2 then
    raise exception 'TEST 1 FAILED: the user should read their own 2 rows including the new column, got %', n;
  end if;
  begin
    insert into public.safety_flags (user_id, level, from_contact) values ('<USER_ID>', 1, true);
    raise exception 'TEST 1 FAILED: authenticated could insert a flag';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.safety_flags set from_contact = false;
    raise exception 'TEST 1 FAILED: authenticated could update a flag';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'PASS 1: default false, contact rows can be marked, users read their own rows and cannot write' as result;
rollback;
