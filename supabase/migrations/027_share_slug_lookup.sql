-- 027: public lookup of a shared roast by its share code (public fields only)
create or replace function public.get_roast_by_share_slug(p_slug text)
returns table(
  life_score integer,
  funny_title text,
  top_5_roasts jsonb,
  category_scores jsonb,
  card_punchline text,
  roast_text text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(r.life_score, 50),
    coalesce(r.funny_title, 'Your Life'),
    coalesce(r.top_5_roasts, '[]'::jsonb),
    coalesce(r.category_scores, '{}'::jsonb),
    r.card_punchline,
    r.roast_text
  from public.roasts r
  where r.share_slug = p_slug
  limit 1;
$$;

revoke all on function public.get_roast_by_share_slug(text) from public;
grant execute on function public.get_roast_by_share_slug(text) to anon, authenticated;
