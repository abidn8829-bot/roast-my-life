-- 028: the live database has public.roasts.user_reaction, but the app (and
-- migration 002_reactions_and_og.sql) use `reaction`. Rename the column so the
-- database matches the code. Safe to run more than once: it only renames when
-- user_reaction exists AND reaction does not. No drops, no data changes, no
-- policy or grant changes (a rename keeps the existing ones).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'roasts'
      and column_name = 'user_reaction'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'roasts'
      and column_name = 'reaction'
  ) then
    alter table public.roasts rename column user_reaction to reaction;
  end if;
end
$$;
