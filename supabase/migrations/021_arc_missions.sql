-- Pro "Missions": a 7-day tracked mission on one weak category, with a
-- root cause and one AI step per day. Written by /api/missions* using the
-- user-session client, so the insert AND update policies below are required
-- (missing policies have silently dropped writes before — see 011/012).
create table if not exists public.arc_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('sleep', 'fitness', 'discipline', 'focus', 'spending')),
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'abandoned')),
  start_date date not null,
  end_date date not null,
  baseline_score numeric not null,
  target_score numeric not null,
  target_label text not null,
  root_cause text,
  -- [{day:1..7, date:'YYYY-MM-DD', step, why, status:'pending'|'done'|'missed'}]
  days jsonb not null default '[]'::jsonb,
  outcome_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active mission per user.
create unique index if not exists arc_missions_one_active_per_user
  on public.arc_missions (user_id)
  where status = 'active';

create index if not exists arc_missions_user_created_idx
  on public.arc_missions (user_id, created_at desc);

create or replace function public.arc_missions_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arc_missions_touch_updated_at on public.arc_missions;
create trigger arc_missions_touch_updated_at
  before update on public.arc_missions
  for each row execute function public.arc_missions_touch_updated_at();

alter table public.arc_missions enable row level security;

drop policy if exists "Users can view own missions" on public.arc_missions;
create policy "Users can view own missions"
  on public.arc_missions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own missions" on public.arc_missions;
create policy "Users can insert own missions"
  on public.arc_missions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own missions" on public.arc_missions;
create policy "Users can update own missions"
  on public.arc_missions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
