-- 025_lock_down_extracted_stats_rollback.sql
--
-- Restores the state BEFORE migration 025: the two open policies on
-- public.extracted_stats (same names, role authenticated) and the table
-- privileges for anon and authenticated.
--
-- WARNING: this re-opens the table to every logged-in user. The table has 0 rows
-- and no code uses it, so there should be no reason to need this.
--
-- ASSUMPTION: Supabase's default is "all privileges" for anon and authenticated
-- on tables in the public schema, so that is what is restored. If you want the
-- exact original list, run this read-only query BEFORE applying 025 and adjust
-- Step 1 to match:
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'extracted_stats'
--     and grantee in ('anon', 'authenticated')
--   order by grantee, privilege_type;
--
-- Not touched: RLS (stays on). One transaction: all or nothing.

begin;

-- Step 1: give anon and authenticated their table privileges back.
grant all privileges on table public.extracted_stats to anon, authenticated;

-- Step 2: recreate the old open policies (drop first so this can be re-run).
drop policy if exists "allow select extracted_stats" on public.extracted_stats;
create policy "allow select extracted_stats"
  on public.extracted_stats
  for select
  to authenticated
  using (true);

drop policy if exists "allow insert extracted_stats" on public.extracted_stats;
create policy "allow insert extracted_stats"
  on public.extracted_stats
  for insert
  to authenticated
  with check (true);

-- Step 3: make sure RLS is on (it was on before 025 as well).
alter table public.extracted_stats enable row level security;

commit;
