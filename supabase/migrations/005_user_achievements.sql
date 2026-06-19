alter table public.users
  add column if not exists achievements jsonb not null default '{}'::jsonb;
