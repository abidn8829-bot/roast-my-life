alter table public.roasts
  add column if not exists reaction text;

create policy "Users can update own roasts"
  on public.roasts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_roast_for_og(p_identifier text)
returns table (
  id uuid,
  roast_text text,
  report_card jsonb,
  share_slug text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.roast_text, r.report_card, r.share_slug
  from public.roasts r
  where r.share_slug = p_identifier
     or r.id::text = p_identifier
  limit 1;
$$;

grant execute on function public.get_roast_for_og(text) to anon, authenticated;
