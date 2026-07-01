create table if not exists pro_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

create index if not exists pro_waitlist_email_idx on public.pro_waitlist(email);

-- Enable RLS
alter table pro_waitlist enable row level security;

-- Allow anyone to insert into waitlist
create policy "allow waitlist insert" on pro_waitlist
  for insert to anon, authenticated
  with check (true);
