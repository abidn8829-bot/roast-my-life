-- handle_new_user() (013_auto_create_user_row.sql) is security definer but
-- didn't pin search_path, a known Postgres/Supabase security-definer
-- footgun (search_path hijacking) — flagged when 013 was written but left
-- unaddressed to match what was actually live at the time. get_roast_by_share_slug
-- (001_roasts.sql) already sets search_path for the same reason; this brings
-- handle_new_user() in line. Applied directly via the Supabase SQL editor;
-- captured here so it's tracked in migrations, mirroring
-- 011_add_roasts_update_policy.sql, 012_add_users_update_policy.sql, and
-- 013_auto_create_user_row.sql's pattern for the same class of bug.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
