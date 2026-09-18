-- Weekly snapshot of each Pro user's percentile standing per category, so
-- "Your Arc So Far" can show a persisted trend instead of only a live
-- recompute. Populated only by the weekly-arc-snapshot cron
-- (src/app/api/cron/weekly-arc-snapshot/route.ts) via the service-role
-- client, which bypasses RLS — there is intentionally no insert/update
-- policy for `authenticated` below, only a read policy.
create table if not exists public.arc_percentile_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  week_start date not null,
  user_score numeric not null,
  avg_score numeric,
  percentile numeric,
  sample_size integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, category, week_start)
);

create index if not exists arc_percentile_snapshots_user_category_week_idx
  on public.arc_percentile_snapshots (user_id, category, week_start desc);

alter table public.arc_percentile_snapshots enable row level security;

create policy "Users can view their own arc snapshots"
  on public.arc_percentile_snapshots for select
  using (auth.uid() = user_id);
