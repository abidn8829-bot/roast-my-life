create table if not exists pro_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

create index if not exists pro_waitlist_email_idx on public.pro_waitlist(email);
