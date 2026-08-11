-- The "Users can update own roasts" policy from 002_reactions_and_og.sql was
-- missing from the live database (the check-in flow's continuity_memory
-- stash update was silently affecting zero rows under RLS). Applied directly
-- via the Supabase SQL editor; captured here so it's tracked in migrations.
-- Written as drop-then-create so it's safe to run regardless of whether the
-- original migration 002 policy is present.
drop policy if exists "Users can update own roasts" on public.roasts;

create policy "Users can update own roasts"
  on public.roasts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
