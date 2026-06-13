alter table public.roasts
  add column if not exists life_score integer,
  add column if not exists funny_title text,
  add column if not exists top_5_roasts jsonb,
  add column if not exists category_scores jsonb;
