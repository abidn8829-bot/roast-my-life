-- 029_safety_flags.sql
--
-- Safety layer: remembers THAT a user was flagged, never WHAT they wrote.
--
--   public.safety_flags
--     id          uuid         primary key
--     user_id     uuid         the flagged user (deleted with the account)
--     level       smallint     1 = sadness / heavy stress, 2 = risk
--     created_at  timestamptz  when
--   There is NO text column. The app writes one row when the safety check finds Level 1 or
--   Level 2, and reads the newest row to decide whether "gentle mode" (72 hours) is on.
--
--   public.safety_flag_monthly_totals (optional, anonymous counts only: month + level + total,
--   no user id). Filled by the purge function below before old flags are deleted.
--
-- Who can do what (explicit, so nothing is silently blocked or silently open):
--   anon           nothing at all
--   authenticated  SELECT their OWN flag rows only (RLS policy). No insert / update / delete,
--                  so a browser can never write or change a flag.
--   service_role   SELECT, INSERT, DELETE on safety_flags (the server writes flags with the
--                  service-role key; the 30-day purge deletes). SELECT, INSERT, UPDATE on the
--                  monthly totals.
--
-- Retention: public.purge_old_safety_flags() rolls flags older than 30 days into the monthly
-- totals and deletes them. It is NOT scheduled by this file. See the optional pg_cron line at
-- the bottom (a comment). Gentle mode works without it; retention is only privacy hygiene.
--
-- One transaction: if any step fails, nothing changes.
-- Rollback: supabase/rollbacks/029_safety_flags_rollback.sql
-- Tests:    supabase/tests/029_safety_flags_test.sql
-- Apply by hand in the Supabase SQL editor. It has NOT been run against the live database.

begin;

-- Step 1 (safety check): the flag table points at auth users, so that table must exist.
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'Migration 029 aborted: auth.users was not found. Nothing was changed.';
  end if;
end
$$;

-- Step 2: the flag table. No text columns, by design.
create table if not exists public.safety_flags (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  level      smallint    not null check (level in (1, 2)),
  created_at timestamptz not null default now()
);

-- Step 3: indexes. The app asks "newest flag for this user in the last 72 hours"; the purge
-- and the cron skip-list ask "flags since / before a time".
create index if not exists safety_flags_user_created_idx on public.safety_flags (user_id, created_at desc);
create index if not exists safety_flags_created_idx      on public.safety_flags (created_at);

-- Step 4: row level security on.
alter table public.safety_flags enable row level security;

-- Step 5: explicit grants. Supabase hands new tables to anon / authenticated / service_role by
-- default, so take everything away from all of them first, then give back exactly what the app does.
revoke all on table public.safety_flags from public, anon, authenticated, service_role;
grant select                 on table public.safety_flags to authenticated;
grant select, insert, delete on table public.safety_flags to service_role;

-- Step 6: a logged-in user can read only their own flag rows. There is deliberately NO insert,
-- update or delete policy, so the browser cannot write flags (the server uses service_role,
-- which bypasses RLS).
drop policy if exists "Users can read own safety flags" on public.safety_flags;
create policy "Users can read own safety flags"
  on public.safety_flags
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Step 7: anonymous monthly totals (counts only, no user id).
create table if not exists public.safety_flag_monthly_totals (
  month date     not null,
  level smallint not null check (level in (1, 2)),
  total integer  not null default 0 check (total >= 0),
  primary key (month, level)
);

alter table public.safety_flag_monthly_totals enable row level security;
revoke all on table public.safety_flag_monthly_totals from public, anon, authenticated, service_role;
grant select, insert, update on table public.safety_flag_monthly_totals to service_role;
-- No policies on purpose: with RLS on and no policies, only service_role / the owner can touch it.

-- Step 8: the 30-day purge. One call = one transaction: old flags are counted into the monthly
-- totals first, then deleted. Returns how many flags were deleted.
create or replace function public.purge_old_safety_flags()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  insert into public.safety_flag_monthly_totals (month, level, total)
  select date_trunc('month', created_at)::date, level, count(*)
  from public.safety_flags
  where created_at < now() - interval '30 days'
  group by 1, 2
  on conflict (month, level)
  do update set total = public.safety_flag_monthly_totals.total + excluded.total;

  delete from public.safety_flags
  where created_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

revoke execute on function public.purge_old_safety_flags() from public, anon, authenticated;
grant  execute on function public.purge_old_safety_flags() to service_role;

-- Step 9 (final check): confirm the end state before committing. Any surprise rolls back everything.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.safety_flags'::regclass) then
    raise exception 'Migration 029 aborted: row level security is not enabled on public.safety_flags.';
  end if;

  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'safety_flags') <> 4 then
    raise exception 'Migration 029 aborted: public.safety_flags must have exactly 4 columns (id, user_id, level, created_at).';
  end if;

  if has_table_privilege('anon', 'public.safety_flags', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.safety_flags', 'INSERT, UPDATE, DELETE') then
    raise exception 'Migration 029 aborted: anon / authenticated still have write access (or anon has read access) on public.safety_flags.';
  end if;

  if not has_table_privilege('authenticated', 'public.safety_flags', 'SELECT') then
    raise exception 'Migration 029 aborted: authenticated cannot read public.safety_flags (the app could not see its own flags).';
  end if;

  if not has_table_privilege('service_role', 'public.safety_flags', 'SELECT, INSERT, DELETE') then
    raise exception 'Migration 029 aborted: service_role lacks SELECT / INSERT / DELETE on public.safety_flags.';
  end if;

  if has_table_privilege('service_role', 'public.safety_flags', 'UPDATE') then
    raise exception 'Migration 029 aborted: service_role can UPDATE public.safety_flags (flags are never edited).';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'safety_flags' and cmd <> 'SELECT'
  ) then
    raise exception 'Migration 029 aborted: unexpected non-SELECT policy on public.safety_flags.';
  end if;

  if has_function_privilege('anon', 'public.purge_old_safety_flags()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.purge_old_safety_flags()', 'EXECUTE') then
    raise exception 'Migration 029 aborted: anon / authenticated can run purge_old_safety_flags().';
  end if;

  if has_table_privilege('anon', 'public.safety_flag_monthly_totals', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.safety_flag_monthly_totals', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'Migration 029 aborted: anon / authenticated can touch public.safety_flag_monthly_totals.';
  end if;
end
$$;

commit;

-- OPTIONAL, separate step (not part of the transaction above): schedule the 30-day purge with
-- Supabase pg_cron. Enable it first in the dashboard (Database -> Extensions -> pg_cron), then run:
--
--   select cron.schedule('purge-safety-flags', '17 3 * * *', $$select public.purge_old_safety_flags()$$);
--
-- This costs no Vercel cron slot (Vercel Hobby cron jobs are already used by vercel.json).
-- To stop it later:  select cron.unschedule('purge-safety-flags');
