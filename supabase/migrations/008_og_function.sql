-- Create function to get roast data for OG image generation (bypasses RLS)
create or replace function public.get_roast_for_og(p_id uuid)
returns table (
  id uuid,
  life_score integer,
  funny_title text,
  top_5_roasts jsonb,
  category_scores jsonb
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
    coalesce(r.category_scores, '{}'::jsonb) as category_scores
  from public.roasts r
  where r.id = p_id
  limit 1;
$$;

grant execute on function public.get_roast_for_og(uuid) to anon, authenticated;
