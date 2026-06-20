alter table public.roasts
  add column if not exists persona text default 'default';
