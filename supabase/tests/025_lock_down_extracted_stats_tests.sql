-- 025_lock_down_extracted_stats_tests.sql
--
-- Tests for migration 025_lock_down_extracted_stats.sql. Run AFTER applying 025.
-- (Run before 025, blocks 2, 3 and 4's insert/select checks are expected to FAIL.)
--
-- HOW TO RUN (Supabase SQL editor, as the postgres role):
--   * Run ONE block at a time: select everything from "begin;" to "rollback;"
--     of that block and press Run.
--   * Each block ends with a SELECT that returns PASS / FAIL / SKIP row(s), then
--     "rollback;" so NOTHING is saved.
--   * If the editor only shows "Success. No rows returned" (it shows the last
--     statement), run the block again WITHOUT its final "rollback;" line, read
--     the result, then run "rollback;" on its own. Nothing is ever committed.
--
-- TEST ACCOUNTS (real users):
--   A = 8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe
--   B = 990a8339-ce7f-4cd5-ba2d-d9e22d5925b3


-- =============================================================================
-- BLOCK 1: table state (run as postgres, read-only)
--   RLS on, no policies, anon/authenticated have no privileges, service_role does
-- =============================================================================
begin;
  select 'RLS is enabled on extracted_stats' as check_name,
         case when (select relrowsecurity from pg_class where oid = 'public.extracted_stats'::regclass) then 'PASS' else 'FAIL' end as result
  union all
  select 'no policies exist (service role only)',
         case when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'extracted_stats') then 'PASS' else 'FAIL' end
  union all
  select 'anon has no privileges on the table',
         case when not (has_table_privilege('anon', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                        or has_any_column_privilege('anon', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, REFERENCES')) then 'PASS' else 'FAIL' end
  union all
  select 'authenticated has no privileges on the table',
         case when not (has_table_privilege('authenticated', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                        or has_any_column_privilege('authenticated', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, REFERENCES')) then 'PASS' else 'FAIL' end
  union all
  select 'service_role can still read and write the table',
         case when has_table_privilege('service_role', 'public.extracted_stats', 'SELECT') and has_table_privilege('service_role', 'public.extracted_stats', 'INSERT') then 'PASS' else 'FAIL' end;
rollback;


-- =============================================================================
-- BLOCK 2: as A, selecting from extracted_stats returns 0 rows or is denied
-- =============================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  declare n bigint;
  begin
    select count(*) into n from public.extracted_stats;
    perform set_config('ember_test.result', case when n = 0 then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail', format('A sees %s row(s) (table is expected to be empty anyway)', n), true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'read was denied: ' || sqlerrm, true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 2: A cannot read extracted_stats' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 3: as A, inserting into extracted_stats is refused
--   (even with A's own user_id: nobody but the service role may write)
-- =============================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  begin
    insert into public.extracted_stats (user_id) values ('8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid);
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'A was able to insert into extracted_stats (rolled back)', true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'refused with: ' || sqlerrm, true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm || ' (anything other than "permission denied" means the lock is not in place)', true);
  end
  $$;

  reset role;
  select 'BLOCK 3: A cannot insert into extracted_stats' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 4: as anon (logged out), select and insert are both refused
-- =============================================================================
begin;
  set local role anon;
  select set_config('request.jwt.claims', '{"role":"anon"}', true);

  do $$
  declare
    n bigint;
    sel text;
    ins text;
  begin
    begin
      select count(*) into n from public.extracted_stats;
      sel := case when n = 0 then 'PASS (0 rows)' else 'FAIL (' || n || ' rows)' end;
    exception
      when insufficient_privilege then sel := 'PASS (denied)';
      when others then sel := 'FAIL (' || sqlstate || ': ' || sqlerrm || ')';
    end;

    begin
      insert into public.extracted_stats (user_id) values ('8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid);
      ins := 'FAIL (insert succeeded, rolled back)';
    exception
      when insufficient_privilege then ins := 'PASS (denied)';
      when others then ins := 'FAIL (' || sqlstate || ': ' || sqlerrm || ')';
    end;

    perform set_config('ember_test.result', case when sel like 'PASS%' and ins like 'PASS%' then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail', 'select: ' || sel || '; insert: ' || ins, true);
  end
  $$;

  reset role;
  select 'BLOCK 4: anon cannot read or write extracted_stats' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 5: as service_role, the table is still readable (server-side access works)
-- =============================================================================
begin;
  set local role service_role;
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);

  do $$
  declare n bigint;
  begin
    select count(*) into n from public.extracted_stats;
    perform set_config('ember_test.result', 'PASS', true);
    perform set_config('ember_test.detail', format('service_role can read the table (%s row(s))', n), true);
  exception when others then
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 5: service_role can still read extracted_stats' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;
