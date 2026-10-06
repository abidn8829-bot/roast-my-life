-- 024_lock_down_roasts_tests.sql
--
-- Tests for migration 024_lock_down_roasts.sql. Run AFTER applying 024.
-- (Run before 024, blocks 1, 3 and 6 are expected to FAIL: that is the bug.)
--
-- HOW TO RUN (Supabase SQL editor, as the postgres role):
--   * Run ONE block at a time: select everything from "begin;" to "rollback;"
--     of that block and press Run.
--   * Each block ends with a SELECT that returns a PASS / FAIL / SKIP row, then
--     "rollback;" so NOTHING is saved (test rows are inserted and thrown away).
--   * If the editor only shows "Success. No rows returned" (it shows the last
--     statement), run the block again WITHOUT its final "rollback;" line, read
--     the result, then run "rollback;" on its own. Nothing is ever committed.
--
-- TEST ACCOUNTS (real users):
--   A = 8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe
--   B = 990a8339-ce7f-4cd5-ba2d-d9e22d5925b3
--
-- Roast rows are inserted with the 6 columns that are NOT NULL in the repo's
-- migrations: user_id, roast_text, report_card, week_start_date, model_used,
-- share_slug. If your live table has extra NOT NULL columns, the test says so
-- in the "detail" column (SQLSTATE 23502) instead of silently passing.


-- =============================================================================
-- BLOCK 1: as A, roasts that belong to other users are invisible (expect 0 rows)
-- =============================================================================
begin;

  -- Setup (as postgres): add a throw-away roast for B so there is something to
  -- (not) see, and count how many other-user rows exist.
  do $$
  begin
    insert into public.roasts (user_id, roast_text, report_card, week_start_date, model_used, share_slug)
    values ('990a8339-ce7f-4cd5-ba2d-d9e22d5925b3'::uuid, 'RLS test fixture (rolled back)', '{}'::jsonb, current_date, 'rls-test', 'rls-test-' || gen_random_uuid()::text);
    perform set_config('ember_test.fixture', 'fixture roast for B inserted (rolled back at the end)', true);
  exception when others then
    perform set_config('ember_test.fixture', 'could not insert fixture for B (' || sqlerrm || ')', true);
  end
  $$;
  select set_config('ember_test.others_total',
    (select count(*) from public.roasts where user_id <> '8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid)::text, true);

  -- Act as A.
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  declare n bigint;
  begin
    select count(*) into n from public.roasts where user_id <> '8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid;
    perform set_config('ember_test.result', case when n = 0 then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail',
      format('A sees %s row(s) of other users; %s such row(s) exist; %s', n, current_setting('ember_test.others_total'), current_setting('ember_test.fixture')), true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'read was denied outright', true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 1: A cannot read other users'' roasts' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 2: as A, A's OWN roasts are still readable
-- =============================================================================
begin;

  -- Setup (as postgres): how many roasts A really has.
  select set_config('ember_test.own_total',
    (select count(*) from public.roasts where user_id = '8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid)::text, true);

  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  declare
    n bigint;
    expected bigint := current_setting('ember_test.own_total')::bigint;
  begin
    select count(*) into n from public.roasts where user_id = '8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid;
    if expected = 0 then
      perform set_config('ember_test.result', 'SKIP', true);
      perform set_config('ember_test.detail', 'A has no roasts in the database, so there is nothing to read. Create one in the app and re-run.', true);
    elsif n = expected then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', format('A can read all %s of their own roast(s)', n), true);
    else
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', format('A has %s roast(s) but can only read %s', expected, n), true);
    end if;
  exception when others then
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 2: A can read A''s own roasts' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 3: as A, inserting a roast under B's user_id is REFUSED
-- =============================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  begin
    insert into public.roasts (user_id, roast_text, report_card, week_start_date, model_used, share_slug)
    values ('990a8339-ce7f-4cd5-ba2d-d9e22d5925b3'::uuid, 'RLS test: A pretending to be B', '{}'::jsonb, current_date, 'rls-test', 'rls-test-' || gen_random_uuid()::text);
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'A was able to insert a roast owned by B (rolled back)', true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'refused with: ' || sqlerrm, true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm || ' (23502 = a required column is missing from this test insert)', true);
  end
  $$;

  reset role;
  select 'BLOCK 3: A cannot insert a roast as B' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 4: as A, inserting a roast under A's own user_id SUCCEEDS
--          (uses RETURNING, exactly like the app's .insert().select("id"))
-- =============================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  declare new_id uuid;
  begin
    insert into public.roasts (user_id, roast_text, report_card, week_start_date, model_used, share_slug)
    values ('8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid, 'RLS test: A inserting own roast', '{}'::jsonb, current_date, 'rls-test', 'rls-test-' || gen_random_uuid()::text)
    returning id into new_id;
    perform set_config('ember_test.result', 'PASS', true);
    perform set_config('ember_test.detail', 'A inserted and re-read their own roast ' || new_id || ' (rolled back)', true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'A was refused for their own user_id: ' || sqlerrm, true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm || ' (23502 = a required column is missing from this test insert)', true);
  end
  $$;

  reset role;
  select 'BLOCK 4: A can insert a roast as A' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 5: as A, updating B's roast changes 0 rows
-- =============================================================================
begin;

  -- Setup (as postgres): make sure B owns at least one roast (throw-away).
  do $$
  begin
    insert into public.roasts (user_id, roast_text, report_card, week_start_date, model_used, share_slug)
    values ('990a8339-ce7f-4cd5-ba2d-d9e22d5925b3'::uuid, 'RLS test fixture (rolled back)', '{}'::jsonb, current_date, 'rls-test', 'rls-test-' || gen_random_uuid()::text);
  exception when others then
    null; -- fall back to B's real roasts, if any
  end
  $$;
  select set_config('ember_test.b_total',
    (select count(*) from public.roasts where user_id = '990a8339-ce7f-4cd5-ba2d-d9e22d5925b3'::uuid)::text, true);

  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  declare n bigint;
  begin
    if current_setting('ember_test.b_total')::bigint = 0 then
      perform set_config('ember_test.result', 'SKIP', true);
      perform set_config('ember_test.detail', 'B has no roasts and the fixture insert failed, so there is nothing to try to update', true);
      return;
    end if;
    update public.roasts set roast_text = roast_text
    where user_id = '990a8339-ce7f-4cd5-ba2d-d9e22d5925b3'::uuid;
    get diagnostics n = row_count;
    perform set_config('ember_test.result', case when n = 0 then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail', format('A updated %s of B''s roast row(s)', n), true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'update was denied outright', true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 5: A cannot update B''s roast' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 6: as anon (logged out), selecting from roasts returns 0 rows or is denied
-- =============================================================================
begin;
  set local role anon;
  select set_config('request.jwt.claims', '{"role":"anon"}', true);

  do $$
  declare n bigint;
  begin
    select count(*) into n from public.roasts;
    perform set_config('ember_test.result', case when n = 0 then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail', format('anon sees %s row(s)', n), true);
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
  select 'BLOCK 6: anon cannot read roasts' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 7: as anon, get_roast_for_og(uuid) STILL works for a real roast of A
--          (this is what share pages and OG images rely on)
-- =============================================================================
begin;

  -- Setup (as postgres, BEFORE switching role): look up one real roast id of A.
  -- If A has none, a throw-away roast is inserted for A instead (rolled back).
  select set_config('ember_test.roast_id',
    coalesce((select id::text from public.roasts
              where user_id = '8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid
              order by created_at desc limit 1), ''), true);
  select set_config('ember_test.roast_source', 'a real roast of A', true);

  do $$
  declare new_id uuid;
  begin
    if current_setting('ember_test.roast_id') = '' then
      insert into public.roasts (user_id, roast_text, report_card, week_start_date, model_used, share_slug)
      values ('8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe'::uuid, 'RLS test fixture (rolled back)', '{}'::jsonb, current_date, 'rls-test', 'rls-test-' || gen_random_uuid()::text)
      returning id into new_id;
      perform set_config('ember_test.roast_id', new_id::text, true);
      perform set_config('ember_test.roast_source', 'a throw-away fixture roast (A had none)', true);
    end if;
  exception when others then
    perform set_config('ember_test.roast_source', 'NO roast available: ' || sqlerrm, true);
  end
  $$;

  set local role anon;
  select set_config('request.jwt.claims', '{"role":"anon"}', true);

  do $$
  declare n bigint;
  begin
    if current_setting('ember_test.roast_id') = '' then
      perform set_config('ember_test.result', 'SKIP', true);
      perform set_config('ember_test.detail', current_setting('ember_test.roast_source'), true);
      return;
    end if;
    select count(*) into n from public.get_roast_for_og(current_setting('ember_test.roast_id')::uuid);
    perform set_config('ember_test.result', case when n = 1 then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail', format('anon got %s row(s) for %s (%s)', n, current_setting('ember_test.roast_id'), current_setting('ember_test.roast_source')), true);
  exception when others then
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 7: anon can still call get_roast_for_og(uuid)' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 8: policy inventory on public.roasts (run as postgres, read-only)
-- =============================================================================
begin;
  select 'RLS is enabled on roasts' as check_name,
         case when (select relrowsecurity from pg_class where oid = 'public.roasts'::regclass) then 'PASS' else 'FAIL' end as result
  union all
  select 'old "allow select roasts" / "allow insert roasts" are gone',
         case when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roasts'
                               and policyname in ('allow select roasts', 'allow insert roasts')) then 'PASS' else 'FAIL' end
  union all
  select '"Users can read own roasts": SELECT, authenticated, auth.uid() = user_id',
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roasts'
                           and policyname = 'Users can read own roasts' and cmd = 'SELECT'
                           and roles = '{authenticated}' and qual ilike '%auth.uid()%user_id%') then 'PASS' else 'FAIL' end
  union all
  select '"Users can insert own roasts": INSERT, authenticated, WITH CHECK auth.uid() = user_id',
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roasts'
                           and policyname = 'Users can insert own roasts' and cmd = 'INSERT'
                           and roles = '{authenticated}' and with_check ilike '%auth.uid()%user_id%') then 'PASS' else 'FAIL' end
  union all
  select '"Users can update own roasts" is still there (UPDATE, auth.uid() = user_id)',
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roasts'
                           and policyname = 'Users can update own roasts' and cmd = 'UPDATE'
                           and qual ilike '%auth.uid()%user_id%') then 'PASS' else 'FAIL' end
  union all
  select 'no other open (true) SELECT/INSERT policy',
         case when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roasts'
                               and ((cmd in ('SELECT', 'ALL') and btrim(coalesce(qual, ''), '() ') = 'true')
                                 or (cmd in ('INSERT', 'ALL') and btrim(coalesce(with_check, ''), '() ') = 'true'))) then 'PASS' else 'FAIL' end;
rollback;
