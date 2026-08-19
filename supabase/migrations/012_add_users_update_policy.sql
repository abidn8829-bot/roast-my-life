-- unlockAchievements() writes to public.users.achievements but no UPDATE
-- policy existed on public.users at all (only SELECT worked), so the write
-- silently affected zero rows under RLS. Applied directly via the Supabase
-- SQL editor; captured here so it's tracked in migrations, mirroring
-- 011_add_roasts_update_policy.sql's pattern for the same class of bug.
create policy "Users can update own record"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
