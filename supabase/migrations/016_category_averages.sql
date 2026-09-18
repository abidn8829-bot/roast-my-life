-- Cross-user category averages for the "Your Arc So Far" Pro comparison.
-- RLS restricts roasts to auth.uid() = user_id, so this needs security
-- definer to aggregate across all users. Uses each user's MOST RECENT
-- roast only (not every historical roast), so someone who's checked in
-- 50 times doesn't skew the average vs someone who's checked in twice.
create or replace function public.get_category_averages()
returns table (category text, avg_score numeric, sample_size bigint)
language sql
security definer
set search_path = public
as $$
  with latest_roast as (
    select distinct on (user_id) user_id, category_scores
    from public.roasts
    where category_scores is not null
    order by user_id, created_at desc
  )
  select
    cat.key as category,
    avg((cat.value->>'score')::numeric) as avg_score,
    count(*) as sample_size
  from latest_roast, jsonb_each(latest_roast.category_scores) as cat
  group by cat.key;
$$;

grant execute on function public.get_category_averages() to authenticated;
