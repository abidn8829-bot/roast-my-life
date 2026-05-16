alter table public.roasts
  add column if not exists answers jsonb;
