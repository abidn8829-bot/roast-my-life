alter table public.users
  add column if not exists current_streak integer default 0,
  add column if not exists longest_streak integer default 0;
