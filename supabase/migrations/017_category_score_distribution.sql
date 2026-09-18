-- Extends get_category_averages() to also return each category's raw score
-- distribution (every user's latest score, not just the mean), so the
-- "Your Arc So Far" Pro panel can show a real percentile ("ahead of X% of
-- Ember users") instead of only an above/below-average label. The
-- avg-only version couldn't answer "top what percent" — this can.
-- Return type is changing, so the old function has to be dropped first;
-- create or replace can't change a function's output columns in place.
drop function if exists public.get_category_averages();

create or replace function public.get_category_averages()
returns table (category text, avg_score numeric, sample_size bigint, scores numeric[])
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
    count(*) as sample_size,
    array_agg((cat.value->>'score')::numeric) as scores
  from latest_roast, jsonb_each(latest_roast.category_scores) as cat
  group by cat.key;
$$;

grant execute on function public.get_category_averages() to authenticated;
