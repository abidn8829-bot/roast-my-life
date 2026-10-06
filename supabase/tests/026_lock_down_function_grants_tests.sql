-- 026_lock_down_function_grants_tests.sql
--
-- Tests for migration 026_lock_down_function_grants.sql. Run AFTER applying 026.
-- (Run before 026, blocks 1-3 are expected to FAIL: that is the exposure.)
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
-- BLOCK 1: as A (logged in), get_category_averages() is refused
-- =============================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  begin
    perform public.get_category_averages();
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'A could call get_category_averages()', true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'refused with: ' || sqlerrm, true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 1: A cannot call get_category_averages()' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 2: as A (logged in), handle_new_user() is refused
--   Before 026 the call gets past the permission check and only fails with
--   "trigger functions can only be called as triggers" - that counts as FAIL
--   here, because the function was still reachable.
-- =============================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"8fa3da2d-51a0-4fc1-96cc-573ca6f47ebe","role":"authenticated"}', true);

  do $$
  begin
    perform public.handle_new_user();
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'A could call handle_new_user()', true);
  exception
    when insufficient_privilege then
      perform set_config('ember_test.result', 'PASS', true);
      perform set_config('ember_test.detail', 'refused with: ' || sqlerrm, true);
    when others then
      perform set_config('ember_test.result', 'FAIL', true);
      perform set_config('ember_test.detail', 'reachable (got past the permission check): ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 2: A cannot call handle_new_user()' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 3: as anon (logged out), both functions are refused
-- =============================================================================
begin;
  set local role anon;
  select set_config('request.jwt.claims', '{"role":"anon"}', true);

  do $$
  declare
    avg_res text;
    new_res text;
  begin
    begin
      perform public.get_category_averages();
      avg_res := 'FAIL (callable)';
    exception
      when insufficient_privilege then avg_res := 'PASS (denied)';
      when others then avg_res := 'FAIL (' || sqlstate || ': ' || sqlerrm || ')';
    end;

    begin
      perform public.handle_new_user();
      new_res := 'FAIL (callable)';
    exception
      when insufficient_privilege then new_res := 'PASS (denied)';
      when others then new_res := 'FAIL (reachable: ' || sqlstate || ': ' || sqlerrm || ')';
    end;

    perform set_config('ember_test.result', case when avg_res like 'PASS%' and new_res like 'PASS%' then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail', 'get_category_averages: ' || avg_res || '; handle_new_user: ' || new_res, true);
  end
  $$;

  reset role;
  select 'BLOCK 3: anon cannot call either function' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 4: as service_role, get_category_averages() still works
--   (this is what Pro comparisons and the daily snapshot cron use)
-- =============================================================================
begin;
  set local role service_role;
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);

  do $$
  declare n bigint;
  begin
    select count(*) into n from public.get_category_averages();
    perform set_config('ember_test.result', 'PASS', true);
    perform set_config('ember_test.detail', format('service_role got %s category row(s) (0 is fine if nobody has a roast yet)', n), true);
  exception when others then
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm, true);
  end
  $$;

  reset role;
  select 'BLOCK 4: service_role can still call get_category_averages()' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;


-- =============================================================================
-- BLOCK 5: grants inventory (run as postgres, read-only)
--   get_roast_for_og(uuid) untouched; the two locked functions have no PUBLIC
--   grant; the sign-up trigger is still in place
-- =============================================================================
begin;
  select 'get_roast_for_og(uuid) executable by anon' as check_name,
         case when has_function_privilege('anon', 'public.get_roast_for_og(uuid)', 'EXECUTE') then 'PASS' else 'FAIL' end as result
  union all
  select 'get_roast_for_og(uuid) executable by authenticated',
         case when has_function_privilege('authenticated', 'public.get_roast_for_og(uuid)', 'EXECUTE') then 'PASS' else 'FAIL' end
  union all
  select 'handle_new_user(): no PUBLIC grant',
         case when not exists (
           select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
           where p.oid = 'public.handle_new_user()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
         ) then 'PASS' else 'FAIL' end
  union all
  select 'get_category_averages(): no PUBLIC grant',
         case when not exists (
           select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
           where p.oid = 'public.get_category_averages()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
         ) then 'PASS' else 'FAIL' end
  union all
  select 'handle_new_user(): anon and authenticated cannot execute',
         case when not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
                and not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then 'PASS' else 'FAIL' end
  union all
  select 'get_category_averages(): anon and authenticated cannot execute, service_role can',
         case when not has_function_privilege('anon', 'public.get_category_averages()', 'EXECUTE')
                and not has_function_privilege('authenticated', 'public.get_category_averages()', 'EXECUTE')
                and has_function_privilege('service_role', 'public.get_category_averages()', 'EXECUTE') then 'PASS' else 'FAIL' end
  union all
  select 'trigger on_auth_user_created still exists on auth.users',
         case when exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass and not tgisinternal) then 'PASS' else 'FAIL' end;
rollback;


-- =============================================================================
-- BLOCK 6: the sign-up trigger STILL fires after the revoke
--   Inserts a throw-away user into auth.users (as supabase_auth_admin, the role
--   the auth service uses, if postgres is allowed to switch to it; otherwise as
--   postgres) and checks that a public.users row appears. Everything is rolled
--   back. As a second check, also create a real test sign-up in the app.
-- =============================================================================
begin;
  do $$
  declare
    v_id uuid := gen_random_uuid();
    n bigint;
    acting_as text := 'supabase_auth_admin';
  begin
    begin
      execute 'set local role supabase_auth_admin';
    exception when others then
      acting_as := 'postgres (could not switch to supabase_auth_admin: ' || sqlerrm || ')';
    end;

    insert into auth.users (id, email)
    values (v_id, 'rls-test-' || v_id || '@example.invalid');

    execute 'reset role';
    select count(*) into n from public.users where id = v_id;

    perform set_config('ember_test.result', case when n = 1 then 'PASS' else 'FAIL' end, true);
    perform set_config('ember_test.detail',
      format('inserted a throw-away auth user as %s; matching public.users rows: %s (rolled back)', acting_as, n), true);
  exception when others then
    perform set_config('ember_test.result', 'FAIL', true);
    perform set_config('ember_test.detail', 'unexpected error ' || sqlstate || ': ' || sqlerrm || ' (if this is about a required column on auth.users, test with a real sign-up instead)', true);
  end
  $$;

  reset role;
  select 'BLOCK 6: sign-up trigger still creates the public.users row' as test,
         current_setting('ember_test.result') as result,
         current_setting('ember_test.detail') as detail;
rollback;
