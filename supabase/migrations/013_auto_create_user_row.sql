-- No signup path (email or OAuth) was creating a public.users row — there
-- was no trigger and no application-code insert anywhere in the repo, so
-- brand-new signups could complete onboarding and even generate a real
-- roast while public.users had zero matching row. Applied directly via the
-- Supabase SQL editor; captured here so it's tracked in migrations,
-- mirroring 011_add_roasts_update_policy.sql and
-- 012_add_users_update_policy.sql's pattern for the same class of bug.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
