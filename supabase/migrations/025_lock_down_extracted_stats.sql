-- 025_lock_down_extracted_stats.sql
--
-- PROBLEM: public.extracted_stats has two hand-made policies open to every
-- logged-in user ("allow select extracted_stats" / "allow insert extracted_stats",
-- both for authenticated with USING/WITH CHECK true). The table holds personal
-- phone/health/spending stats (screen time, sleep, steps, spending).
-- The table currently has 0 rows and nothing in src/ uses it.
--
-- FIX: lock it completely. Row level security stays ON, NO policies are added,
-- and anon/authenticated lose all table privileges. Only the service role (which
-- bypasses RLS) and the database owner can touch it. If a feature ever needs it,
-- add narrow own-row policies in a new migration at that time.
--
-- NOT TOUCHED: any other table (data_uploads is already locked), FORCE ROW LEVEL
-- SECURITY (stays off).
--
-- One transaction: if any step fails, nothing changes.
-- Rollback: supabase/rollbacks/025_lock_down_extracted_stats_rollback.sql
-- Tests:    supabase/tests/025_lock_down_extracted_stats_tests.sql

begin;

-- Step 1 (safety check): make sure the table exists so we fail with a clear
-- message instead of a confusing one.
do $$
begin
  if to_regclass('public.extracted_stats') is null then
    raise exception 'Migration 025 aborted: table public.extracted_stats does not exist. Nothing was changed.';
  end if;
end
$$;

-- Step 2: make sure row level security is switched on (a no-op if already on).
alter table public.extracted_stats enable row level security;

-- Step 3: remove the two wide-open policies. No new policy is created on
-- purpose: with RLS on and no policies, nobody except the service role / owner
-- can read or write rows.
drop policy if exists "allow select extracted_stats" on public.extracted_stats;
drop policy if exists "allow insert extracted_stats" on public.extracted_stats;

-- Step 4: belt and braces. Even if someone adds a policy later by mistake, the
-- public API roles have no table privileges at all.
revoke all privileges on table public.extracted_stats from anon, authenticated;

-- Step 5 (final check): confirm the end state before committing.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.extracted_stats'::regclass) then
    raise exception 'Migration 025 aborted: row level security is not enabled on public.extracted_stats.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'extracted_stats'
  ) then
    raise exception 'Migration 025 aborted: a policy still exists on public.extracted_stats (expected none). Nothing was changed. List with: select policyname, cmd, roles from pg_policies where tablename = ''extracted_stats'';';
  end if;

  if has_table_privilege('anon', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_any_column_privilege('anon', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, REFERENCES')
     or has_table_privilege('authenticated', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_any_column_privilege('authenticated', 'public.extracted_stats', 'SELECT, INSERT, UPDATE, REFERENCES')
  then
    raise exception 'Migration 025 aborted: anon or authenticated still holds a privilege on public.extracted_stats (possibly via a column-level grant or a PUBLIC grant). Nothing was changed.';
  end if;
end
$$;

commit;
