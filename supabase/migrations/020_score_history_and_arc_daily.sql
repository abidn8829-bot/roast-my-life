-- Part A: capture score_history in migrations.
-- The table was created by hand in the Supabase dashboard and never tracked.
-- `create table if not exists` is a no-op against the live table, so it only
-- matters for fresh environments. Columns are the ones the app reads/writes:
-- /api/check-in inserts (user_id, roast_id, life_score, category_grades) and
-- the dashboard + /api/user/arc read (life_score, category_grades, recorded_at).
-- Run supabase/preflight/020_inspect_live_schema.sql first to compare.
create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roast_id uuid references public.roasts(id) on delete cascade,
  life_score integer not null,
  category_grades jsonb not null,
  recorded_at timestamptz not null default now()
);

create index if not exists score_history_user_recorded_idx
  on public.score_history (user_id, recorded_at desc);

-- /api/check-in inserts with the user-session (anon key) client, so RLS
-- applies to it: an insert + select policy MUST exist whenever RLS is on, or
-- the check-in insert silently fails (same bug class as 011/012).
-- The live table already has these (created by hand as "allow insert
-- score_history" / "allow select score_history"), so policies are only
-- created when no policy for that command exists — never duplicated, never
-- dropped. They're created before RLS is enabled so there's no locked window.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'score_history' and cmd in ('SELECT', 'ALL')
  ) then
    create policy "Users can view own score history"
      on public.score_history for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'score_history' and cmd in ('INSERT', 'ALL')
  ) then
    create policy "Users can insert own score history"
      on public.score_history for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.score_history enable row level security;

-- Part B: arc_percentile_snapshots goes from weekly (week_start) to daily
-- (snapshot_date). Old weekly rows are kept and backfilled so they stay
-- readable; week_start becomes nullable and is no longer part of the key.
alter table public.arc_percentile_snapshots
  add column if not exists snapshot_date date;

update public.arc_percentile_snapshots
  set snapshot_date = week_start
  where snapshot_date is null;

alter table public.arc_percentile_snapshots
  alter column snapshot_date set not null,
  alter column week_start drop not null;

-- Drop whichever unique constraint covers week_start, whatever it's named
-- (default name is arc_percentile_snapshots_user_id_category_week_start_key).
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.arc_percentile_snapshots'::regclass
      and c.contype = 'u'
      and a.attname = 'week_start'
  loop
    execute format('alter table public.arc_percentile_snapshots drop constraint %I', con.conname);
  end loop;
end $$;

-- The daily cron upserts on (user_id, category, snapshot_date).
create unique index if not exists arc_percentile_snapshots_user_category_date_key
  on public.arc_percentile_snapshots (user_id, category, snapshot_date);

drop index if exists public.arc_percentile_snapshots_user_category_week_idx;
