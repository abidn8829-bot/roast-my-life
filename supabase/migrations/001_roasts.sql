create table if not exists public.roasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  roast_text text not null,
  report_card jsonb not null,
  week_start_date date not null,
  model_used text not null,
  share_slug text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists roasts_user_id_idx on public.roasts (user_id);
create index if not exists roasts_share_slug_idx on public.roasts (share_slug);

alter table public.roasts enable row level security;

create policy "Users can read own roasts"
  on public.roasts for select
  using (auth.uid() = user_id);

create policy "Users can insert own roasts"
  on public.roasts for insert
  with check (auth.uid() = user_id);

create or replace function public.get_roast_by_share_slug(p_slug text)
returns table (
  id uuid,
  roast_text text,
  report_card jsonb,
  share_slug text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.roast_text, r.report_card, r.share_slug
  from public.roasts r
  where r.share_slug = p_slug
  limit 1;
$$;

grant execute on function public.get_roast_by_share_slug(text) to anon, authenticated;
