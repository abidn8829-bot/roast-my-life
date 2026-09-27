-- Waitlist for the upcoming Elite plan. Pro is now sold through Gumroad, so the
-- old pro_waitlist table is left as-is (historical signups) and no longer written to.
create table if not exists public.elite_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

create index if not exists elite_waitlist_email_idx on public.elite_waitlist(email);

alter table public.elite_waitlist enable row level security;

-- Anyone can join (the route uses the anon key); nobody can read it back from the client.
drop policy if exists "allow elite waitlist insert" on public.elite_waitlist;
create policy "allow elite waitlist insert" on public.elite_waitlist
  for insert to anon, authenticated
  with check (true);
