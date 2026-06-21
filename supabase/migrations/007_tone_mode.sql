alter table public.roasts
  add column if not exists tone text default 'normal',
  add column if not exists mode text default 'roast';
