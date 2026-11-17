-- 031_skills_test.sql
--
-- Manual checks for 031_skills.sql. Run them AFTER applying the migration, in a TEST database or
-- with test accounts only. Nothing here is saved: every block starts with "begin" and ends with
-- "rollback". It has NOT been run against any database yet.
--
-- HOW TO USE
--   1. Replace <USER_ID> with the id (uuid) of a test account and <OTHER_USER_ID> with a
--      DIFFERENT account (Supabase -> Authentication -> Users). Not real customers.
--      (Find-and-replace in the editor does it for the whole file.)
--   2. Run ONE block at a time. Each block ends with a row that starts with PASS. A failed
--      check shows a red error that says "FAILED". If that happens, run  rollback;  on its
--      own to clear the open transaction.
--   3. Each block adds its own made-up test content (pack id 'zz-test-pack', fixed uuids that
--      start with aaaaaaaa-0000) inside the transaction and rolls it back, so nothing is left behind.
--
-- The blocks pretend to be a logged-in user by switching to the "authenticated" role and setting
-- the user id the way Supabase does, and pretend to be the server with "service_role".


-- =====================================================================
-- BLOCK 0 (read-only): what do the rules look like right now?
-- Expected: 11 tables, all with row level security ON; exactly 5 policies, one SELECT policy
-- for authenticated on each USER table and none on the content tables; the privilege table shows
-- anon with all "false"; authenticated with can_select true ONLY on the 5 user tables and no
-- writes anywhere; service_role with can_select true everywhere and write rights only on the
-- 5 user tables.
-- =====================================================================
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relname like 'skill\_%' and c.relkind = 'r'
order by c.relname;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename like 'skill\_%'
order by tablename;

select t.tbl as table_name, r.role_name,
       has_table_privilege(r.role_name, 'public.' || t.tbl, 'SELECT') as can_select,
       has_table_privilege(r.role_name, 'public.' || t.tbl, 'INSERT') as can_insert,
       has_table_privilege(r.role_name, 'public.' || t.tbl, 'UPDATE') as can_update,
       has_table_privilege(r.role_name, 'public.' || t.tbl, 'DELETE') as can_delete
from (values ('skill_packs'), ('skill_months'), ('skill_weeks'), ('skill_sources'), ('skill_steps'),
             ('skill_test_items'), ('skill_enrollments'), ('skill_step_progress'), ('skill_review_items'),
             ('skill_notebook_entries'), ('skill_test_results')) as t(tbl)
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(role_name)
order by t.tbl, r.role_name;

-- The 5 user tables must delete their rows with the account (confdeltype c = cascade): 5 rows expected.
select conrelid::regclass as table_name, confdeltype as on_delete
from pg_constraint
where contype = 'f' and confrelid = 'auth.users'::regclass and conrelid::regclass::text like 'public.skill\_%';


-- =====================================================================
-- BLOCK 1: a user reads ONLY their own rows in every user table.
-- Expected: "PASS 1".
-- =====================================================================
begin;
-- seed (as the database owner; content tables are not writable by any app role):
insert into public.skill_packs (id, title, summary) values ('zz-test-pack', 'Test pack', 'Test');
insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free) values ('zz-test-pack', 1, 'M1', 't', true);
insert into public.skill_weeks (id, pack_id, month_no, week_no, title, goal_line, handout_md)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'zz-test-pack', 1, 1, 'W1', 'g', 'h');
insert into public.skill_sources (id, week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'S1', 'Src', 'Auth', 2020,
          'https://example.com', '2026-01-01', 'opened the page');
insert into public.skill_steps (id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                prove_question, prove_options, prove_correct, prove_explanation, hint)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'l', 'b', 'f',
          'aaaaaaaa-0000-4000-8000-000000000002', 'd', 'q', '["x","y","z"]'::jsonb, 1, 'e', 'h');
insert into public.skill_test_items (id, week_id, "position", covers_day, question, options, correct, explanation)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1, 'q', '["x","y"]'::jsonb, 0, 'e');
-- seed user rows for BOTH test users (as the server, service_role):
set local role service_role;
insert into public.skill_enrollments (user_id, pack_id)
  values ('<USER_ID>', 'zz-test-pack'), ('<OTHER_USER_ID>', 'zz-test-pack');
insert into public.skill_step_progress (user_id, step_id)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003');
insert into public.skill_review_items (user_id, step_id, stage, due_at)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now()), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now());
insert into public.skill_notebook_entries (user_id, step_id, body)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'my note'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'their note');
insert into public.skill_test_results (user_id, week_id, score, total, passed, weak_days)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 4, 5, true, '{2}'),
         ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 5, false, '{1,2,3}');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
declare t text; n integer; others integer;
begin
  foreach t in array array['skill_enrollments','skill_step_progress','skill_review_items','skill_notebook_entries','skill_test_results'] loop
    execute format('select count(*) from public.%I', t) into n;
    execute format('select count(*) from public.%I where user_id <> %L', t, '<USER_ID>') into others;
    if n <> 1 or others <> 0 then
      raise exception 'TEST 1 FAILED: on % the user saw % rows (% belonging to someone else); expected exactly their own 1', t, n, others;
    end if;
  end loop;
end $$;
select 'PASS 1: a user reads only their own rows in all 5 user tables' as result;
rollback;


-- =====================================================================
-- BLOCK 2: a logged-in user must NOT be able to insert, update or delete in ANY of the 11 skill
-- tables, and holds no write right on them.
-- Expected: "PASS 2".
-- =====================================================================
begin;
-- seed (as the database owner; content tables are not writable by any app role):
insert into public.skill_packs (id, title, summary) values ('zz-test-pack', 'Test pack', 'Test');
insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free) values ('zz-test-pack', 1, 'M1', 't', true);
insert into public.skill_weeks (id, pack_id, month_no, week_no, title, goal_line, handout_md)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'zz-test-pack', 1, 1, 'W1', 'g', 'h');
insert into public.skill_sources (id, week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'S1', 'Src', 'Auth', 2020,
          'https://example.com', '2026-01-01', 'opened the page');
insert into public.skill_steps (id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                prove_question, prove_options, prove_correct, prove_explanation, hint)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'l', 'b', 'f',
          'aaaaaaaa-0000-4000-8000-000000000002', 'd', 'q', '["x","y","z"]'::jsonb, 1, 'e', 'h');
insert into public.skill_test_items (id, week_id, "position", covers_day, question, options, correct, explanation)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1, 'q', '["x","y"]'::jsonb, 0, 'e');
-- seed user rows for BOTH test users (as the server, service_role):
set local role service_role;
insert into public.skill_enrollments (user_id, pack_id)
  values ('<USER_ID>', 'zz-test-pack'), ('<OTHER_USER_ID>', 'zz-test-pack');
insert into public.skill_step_progress (user_id, step_id)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003');
insert into public.skill_review_items (user_id, step_id, stage, due_at)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now()), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now());
insert into public.skill_notebook_entries (user_id, step_id, body)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'my note'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'their note');
insert into public.skill_test_results (user_id, week_id, score, total, passed, weak_days)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 4, 5, true, '{2}'),
         ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 5, false, '{1,2,3}');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
declare t text;
begin
  foreach t in array array['skill_packs','skill_months','skill_weeks','skill_sources','skill_steps','skill_test_items','skill_enrollments','skill_step_progress','skill_review_items','skill_notebook_entries','skill_test_results'] loop
    if has_any_column_privilege('authenticated', 'public.' || t, 'INSERT, UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE') then
      raise exception 'TEST 2 FAILED: authenticated holds a write right on %', t;
    end if;
  end loop;
end $$;
do $$
declare r record;
begin
  for r in select * from (values ('skill_packs','id'), ('skill_months','title'), ('skill_weeks','title'), ('skill_sources','title'),
                 ('skill_steps','learn_title'), ('skill_test_items','question'), ('skill_enrollments','last_new_step_at'),
                 ('skill_step_progress','do_done'), ('skill_review_items','stage'), ('skill_notebook_entries','body'),
                 ('skill_test_results','score')) as v(tbl, col) loop
    begin
      execute format('insert into public.%I default values', r.tbl);
      raise exception 'TEST 2 FAILED: authenticated could INSERT into %', r.tbl;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('update public.%I set %I = %I', r.tbl, r.col, r.col);
      raise exception 'TEST 2 FAILED: authenticated could UPDATE %', r.tbl;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from public.%I', r.tbl);
      raise exception 'TEST 2 FAILED: authenticated could DELETE from %', r.tbl;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
select 'PASS 2: a user cannot insert, update or delete in any skill table' as result;
rollback;


-- =====================================================================
-- BLOCK 3: a logged-in user must NOT be able to read ANY content table (no locked months, no
-- answer keys through the public key).
-- Expected: "PASS 3".
-- =====================================================================
begin;
-- seed (as the database owner; content tables are not writable by any app role):
insert into public.skill_packs (id, title, summary) values ('zz-test-pack', 'Test pack', 'Test');
insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free) values ('zz-test-pack', 1, 'M1', 't', true);
insert into public.skill_weeks (id, pack_id, month_no, week_no, title, goal_line, handout_md)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'zz-test-pack', 1, 1, 'W1', 'g', 'h');
insert into public.skill_sources (id, week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'S1', 'Src', 'Auth', 2020,
          'https://example.com', '2026-01-01', 'opened the page');
insert into public.skill_steps (id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                prove_question, prove_options, prove_correct, prove_explanation, hint)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'l', 'b', 'f',
          'aaaaaaaa-0000-4000-8000-000000000002', 'd', 'q', '["x","y","z"]'::jsonb, 1, 'e', 'h');
insert into public.skill_test_items (id, week_id, "position", covers_day, question, options, correct, explanation)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1, 'q', '["x","y"]'::jsonb, 0, 'e');
set local role authenticated;
select set_config('request.jwt.claim.sub', '<USER_ID>', true);
select set_config('request.jwt.claims', '{"sub":"<USER_ID>","role":"authenticated"}', true);

do $$
declare t text;
begin
  foreach t in array array['skill_packs','skill_months','skill_weeks','skill_sources','skill_steps','skill_test_items'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'TEST 3 FAILED: authenticated could read content table %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
select 'PASS 3: a user cannot read any of the 6 content tables' as result;
rollback;


-- =====================================================================
-- BLOCK 4: a logged-out visitor (anon) cannot read or write any of the 11 skill tables.
-- Expected: "PASS 4".
-- =====================================================================
begin;
-- seed (as the database owner; content tables are not writable by any app role):
insert into public.skill_packs (id, title, summary) values ('zz-test-pack', 'Test pack', 'Test');
insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free) values ('zz-test-pack', 1, 'M1', 't', true);
insert into public.skill_weeks (id, pack_id, month_no, week_no, title, goal_line, handout_md)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'zz-test-pack', 1, 1, 'W1', 'g', 'h');
insert into public.skill_sources (id, week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'S1', 'Src', 'Auth', 2020,
          'https://example.com', '2026-01-01', 'opened the page');
insert into public.skill_steps (id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                prove_question, prove_options, prove_correct, prove_explanation, hint)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'l', 'b', 'f',
          'aaaaaaaa-0000-4000-8000-000000000002', 'd', 'q', '["x","y","z"]'::jsonb, 1, 'e', 'h');
insert into public.skill_test_items (id, week_id, "position", covers_day, question, options, correct, explanation)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1, 'q', '["x","y"]'::jsonb, 0, 'e');
-- seed user rows for BOTH test users (as the server, service_role):
set local role service_role;
insert into public.skill_enrollments (user_id, pack_id)
  values ('<USER_ID>', 'zz-test-pack'), ('<OTHER_USER_ID>', 'zz-test-pack');
insert into public.skill_step_progress (user_id, step_id)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003');
insert into public.skill_review_items (user_id, step_id, stage, due_at)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now()), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now());
insert into public.skill_notebook_entries (user_id, step_id, body)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'my note'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'their note');
insert into public.skill_test_results (user_id, week_id, score, total, passed, weak_days)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 4, 5, true, '{2}'),
         ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 5, false, '{1,2,3}');
reset role;
set local role anon;

do $$
declare t text;
begin
  foreach t in array array['skill_packs','skill_months','skill_weeks','skill_sources','skill_steps','skill_test_items','skill_enrollments','skill_step_progress','skill_review_items','skill_notebook_entries','skill_test_results'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'TEST 4 FAILED: anon could read %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
do $$
declare r record;
begin
  for r in select * from (values ('skill_packs','id'), ('skill_months','title'), ('skill_weeks','title'), ('skill_sources','title'),
                 ('skill_steps','learn_title'), ('skill_test_items','question'), ('skill_enrollments','last_new_step_at'),
                 ('skill_step_progress','do_done'), ('skill_review_items','stage'), ('skill_notebook_entries','body'),
                 ('skill_test_results','score')) as v(tbl, col) loop
    begin
      execute format('insert into public.%I default values', r.tbl);
      raise exception 'TEST 4 FAILED: anon could INSERT into %', r.tbl;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('update public.%I set %I = %I', r.tbl, r.col, r.col);
      raise exception 'TEST 4 FAILED: anon could UPDATE %', r.tbl;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from public.%I', r.tbl);
      raise exception 'TEST 4 FAILED: anon could DELETE from %', r.tbl;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
select 'PASS 4: anon has no access to any skill table' as result;
rollback;


-- =====================================================================
-- BLOCK 5: the server (service_role) can do what it is allowed to, and no more:
--   content tables: SELECT only (cannot insert, update or delete)
--   user tables:    SELECT, INSERT, UPDATE, DELETE
-- Expected: "PASS 5".
-- =====================================================================
begin;
-- seed (as the database owner; content tables are not writable by any app role):
insert into public.skill_packs (id, title, summary) values ('zz-test-pack', 'Test pack', 'Test');
insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free) values ('zz-test-pack', 1, 'M1', 't', true);
insert into public.skill_weeks (id, pack_id, month_no, week_no, title, goal_line, handout_md)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'zz-test-pack', 1, 1, 'W1', 'g', 'h');
insert into public.skill_sources (id, week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'S1', 'Src', 'Auth', 2020,
          'https://example.com', '2026-01-01', 'opened the page');
insert into public.skill_steps (id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                prove_question, prove_options, prove_correct, prove_explanation, hint)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'l', 'b', 'f',
          'aaaaaaaa-0000-4000-8000-000000000002', 'd', 'q', '["x","y","z"]'::jsonb, 1, 'e', 'h');
insert into public.skill_test_items (id, week_id, "position", covers_day, question, options, correct, explanation)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1, 'q', '["x","y"]'::jsonb, 0, 'e');
-- seed user rows for BOTH test users (as the server, service_role):
set local role service_role;
insert into public.skill_enrollments (user_id, pack_id)
  values ('<USER_ID>', 'zz-test-pack'), ('<OTHER_USER_ID>', 'zz-test-pack');
insert into public.skill_step_progress (user_id, step_id)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003');
insert into public.skill_review_items (user_id, step_id, stage, due_at)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now()), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 0, now());
insert into public.skill_notebook_entries (user_id, step_id, body)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'my note'), ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'their note');
insert into public.skill_test_results (user_id, week_id, score, total, passed, weak_days)
  values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 4, 5, true, '{2}'),
         ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 5, false, '{1,2,3}');
reset role;
set local role service_role;

-- reads everything
do $$
declare t text; n integer;
begin
  foreach t in array array['skill_packs','skill_months','skill_weeks','skill_sources','skill_steps','skill_test_items'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n < 1 then raise exception 'TEST 5 FAILED: service_role sees no rows in content table %', t; end if;
  end loop;
  foreach t in array array['skill_enrollments','skill_step_progress','skill_review_items','skill_notebook_entries','skill_test_results'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n < 2 then raise exception 'TEST 5 FAILED: service_role sees % rows in %; expected both test users', n, t; end if;
  end loop;
end $$;

-- cannot write content tables
do $$
declare r record;
begin
  for r in select * from (values ('skill_packs','id'), ('skill_months','title'), ('skill_weeks','title'), ('skill_sources','title'),
                 ('skill_steps','learn_title'), ('skill_test_items','question'), ('skill_enrollments','last_new_step_at'),
                 ('skill_step_progress','do_done'), ('skill_review_items','stage'), ('skill_notebook_entries','body'),
                 ('skill_test_results','score')) as v(tbl, col) where v.tbl in ('skill_packs','skill_months','skill_weeks','skill_sources','skill_steps','skill_test_items') loop
    begin
      execute format('insert into public.%I default values', r.tbl);
      raise exception 'TEST 5 FAILED: service_role (content) could INSERT into %', r.tbl;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('update public.%I set %I = %I', r.tbl, r.col, r.col);
      raise exception 'TEST 5 FAILED: service_role (content) could UPDATE %', r.tbl;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from public.%I', r.tbl);
      raise exception 'TEST 5 FAILED: service_role (content) could DELETE from %', r.tbl;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

-- can write user tables
do $$
declare n integer;
begin
  insert into public.skill_test_results (user_id, week_id, score, total, passed)
    values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000001', 5, 5, true);
  update public.skill_step_progress set do_done = true, prove_correct = true, prove_attempts = 1, completed_at = now()
    where user_id = '<USER_ID>';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST 5 FAILED: service_role UPDATE changed % rows (expected 1)', n; end if;
  update public.skill_enrollments set last_new_step_at = now() where user_id = '<USER_ID>';
  update public.skill_review_items set stage = 1, last_correct = true where user_id = '<USER_ID>';
  update public.skill_notebook_entries set body = 'edited', updated_at = now() where user_id = '<USER_ID>';
  delete from public.skill_notebook_entries where user_id = '<USER_ID>';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST 5 FAILED: service_role DELETE removed % rows (expected 1)', n; end if;
  delete from public.skill_review_items where user_id = '<USER_ID>';
  delete from public.skill_step_progress where user_id = '<USER_ID>';
  delete from public.skill_enrollments where user_id = '<USER_ID>';
  delete from public.skill_test_results where user_id = '<USER_ID>';
end $$;
select 'PASS 5: service_role reads everything, writes user tables, cannot write content tables' as result;
rollback;


-- =====================================================================
-- BLOCK 6: the data rules (run as the database owner). Each bad row must be refused.
--   notebook body 1..600 characters; one note per user per step; review stage 0..3;
--   weeks 1..24 with the right month; days 1..5; 2 to 5 string options; correct answer inside
--   the options; test item position 1..8; a test item can only cover a day that has a step;
--   a step that has user progress cannot be deleted.
-- Expected: "PASS 6".
-- =====================================================================
begin;
-- seed (as the database owner; content tables are not writable by any app role):
insert into public.skill_packs (id, title, summary) values ('zz-test-pack', 'Test pack', 'Test');
insert into public.skill_months (pack_id, month_no, title, teaser_line, is_free) values ('zz-test-pack', 1, 'M1', 't', true);
insert into public.skill_weeks (id, pack_id, month_no, week_no, title, goal_line, handout_md)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'zz-test-pack', 1, 1, 'W1', 'g', 'h');
insert into public.skill_sources (id, week_id, ref, title, author_or_publisher, year, url, verified_on, verified_how)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'S1', 'Src', 'Auth', 2020,
          'https://example.com', '2026-01-01', 'opened the page');
insert into public.skill_steps (id, week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                prove_question, prove_options, prove_correct, prove_explanation, hint)
  values ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'l', 'b', 'f',
          'aaaaaaaa-0000-4000-8000-000000000002', 'd', 'q', '["x","y","z"]'::jsonb, 1, 'e', 'h');
insert into public.skill_test_items (id, week_id, "position", covers_day, question, options, correct, explanation)
  values ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 1, 'q', '["x","y"]'::jsonb, 0, 'e');

do $$
begin
  -- notebook: 600 ok, 601 refused, empty refused, second note for the same step refused
  insert into public.skill_notebook_entries (user_id, step_id, body)
    values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', repeat('x', 600));
  begin
    insert into public.skill_notebook_entries (user_id, step_id, body)
      values ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', repeat('x', 601));
    raise exception 'TEST 6 FAILED: a 601-character note was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_notebook_entries (user_id, step_id, body)
      values ('<OTHER_USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', '');
    raise exception 'TEST 6 FAILED: an empty note was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_notebook_entries (user_id, step_id, body)
      values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 'second note, same step');
    raise exception 'TEST 6 FAILED: two notes for the same user and step were accepted';
  exception when unique_violation then null;
  end;

  -- review stage
  begin
    insert into public.skill_review_items (user_id, step_id, stage, due_at)
      values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003', 4, now());
    raise exception 'TEST 6 FAILED: review stage 4 was accepted';
  exception when check_violation then null;
  end;

  -- weeks
  begin
    insert into public.skill_weeks (pack_id, month_no, week_no, title, goal_line, handout_md)
      values ('zz-test-pack', 1, 5, 'bad', 'g', 'h');
    raise exception 'TEST 6 FAILED: week 5 in month 1 was accepted (week 5 belongs to month 2)';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_weeks (pack_id, month_no, week_no, title, goal_line, handout_md)
      values ('zz-test-pack', 1, 25, 'bad', 'g', 'h');
    raise exception 'TEST 6 FAILED: week 25 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_weeks (pack_id, month_no, week_no, title, goal_line, handout_md)
      values ('zz-test-pack', 1, 1, 'dup', 'g', 'h');
    raise exception 'TEST 6 FAILED: a second week 1 in the same pack was accepted';
  exception when unique_violation then null;
  end;

  -- steps
  begin
    insert into public.skill_steps (week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                    prove_question, prove_options, prove_correct, prove_explanation, hint)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 6, 'l', 'b', 'f', 'aaaaaaaa-0000-4000-8000-000000000002',
              'd', 'q', '["x","y"]'::jsonb, 0, 'e', 'h');
    raise exception 'TEST 6 FAILED: day 6 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_steps (week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                    prove_question, prove_options, prove_correct, prove_explanation, hint)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 2, 'l', 'b', 'f', 'aaaaaaaa-0000-4000-8000-000000000002',
              'd', 'q', '["only one"]'::jsonb, 0, 'e', 'h');
    raise exception 'TEST 6 FAILED: a step with 1 option was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_steps (week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                    prove_question, prove_options, prove_correct, prove_explanation, hint)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 2, 'l', 'b', 'f', 'aaaaaaaa-0000-4000-8000-000000000002',
              'd', 'q', '["a","b","c"]'::jsonb, 3, 'e', 'h');
    raise exception 'TEST 6 FAILED: prove_correct = 3 with only 3 options was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_steps (week_id, day_no, learn_title, learn_body, fact_line, source_id, do_prompt,
                                    prove_question, prove_options, prove_correct, prove_explanation, hint)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 2, 'l', 'b', 'f', 'aaaaaaaa-0000-4000-8000-000000000002',
              'd', 'q', '[1,2]'::jsonb, 0, 'e', 'h');
    raise exception 'TEST 6 FAILED: non-string options were accepted';
  exception when check_violation then null;
  end;

  -- test items
  begin
    insert into public.skill_test_items (week_id, "position", covers_day, question, options, correct, explanation)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 9, 1, 'q', '["x","y"]'::jsonb, 0, 'e');
    raise exception 'TEST 6 FAILED: test item position 9 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_test_items (week_id, "position", covers_day, question, options, correct, explanation)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 2, 1, 'q', '["x","y"]'::jsonb, 2, 'e');
    raise exception 'TEST 6 FAILED: a correct answer outside the options was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.skill_test_items (week_id, "position", covers_day, question, options, correct, explanation)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 2, 2, 'q', '["x","y"]'::jsonb, 0, 'e');
    raise exception 'TEST 6 FAILED: a test item covering day 2 was accepted although week 1 has no day-2 step';
  exception when foreign_key_violation then null;
  end;

  -- a step with user progress cannot be deleted (progress is never wiped by a content change)
  insert into public.skill_step_progress (user_id, step_id)
    values ('<USER_ID>', 'aaaaaaaa-0000-4000-8000-000000000003');
  begin
    delete from public.skill_test_items;
    delete from public.skill_steps;
    raise exception 'TEST 6 FAILED: a step that has user progress was deleted';
  exception when foreign_key_violation then null;
  end;
end $$;
select 'PASS 6: every bad row is refused (lengths, ranges, options, weeks, covers_day, progress safety)' as result;
rollback;
