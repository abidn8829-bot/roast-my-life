-- Per-roast Gen Z punchline printed on the shareable card (replaces the card's
-- use of top_5_roasts[0], which check-ins used to copy forward unchanged).
alter table public.roasts
  add column if not exists card_punchline text;

-- The return shape changes, and CREATE OR REPLACE can't do that, so drop first.
-- Dropping also drops the grants, so they're re-applied below.
drop function if exists public.get_roast_for_og(uuid);

create function public.get_roast_for_og(p_id uuid)
returns table (
  id uuid,
  life_score integer,
  funny_title text,
  top_5_roasts jsonb,
  category_scores jsonb,
  card_punchline text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    coalesce(r.life_score, 50) as life_score,
    coalesce(r.funny_title, 'Your Life') as funny_title,
    coalesce(r.top_5_roasts, '["You need to do better."]'::jsonb) as top_5_roasts,
    coalesce(r.category_scores, '{}'::jsonb) as category_scores,
    r.card_punchline
  from public.roasts r
  where r.id = p_id
  limit 1;
$$;

grant execute on function public.get_roast_for_og(uuid) to anon, authenticated;
