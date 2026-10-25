-- 030_safety_flags_from_contact.sql
--
-- Safety layer, stage 2: tells a flag written by the contact form apart from a flag written by a
-- roast or a check-in.
--
--   public.safety_flags.from_contact   boolean   not null   default false
--
-- Why: the pause rule says a SECOND Level 1 flag (at least 60 minutes after the first, within 72
-- hours) earns the longer 72-hour pause. A contact-form flag must never count as that second (or
-- first) Level 1, but it still starts a normal pause on its own. Until now the two kinds of rows
-- looked identical (id, user_id, level, created_at), so the app could not tell them apart.
--
-- There is still NO text anywhere. A yes/no column cannot hold a message, and this migration keeps
-- the "no text-like column" rule that supabase/tests/029_safety_flags_test.sql (block 4) checks.
--
-- What changes for the app:
--   * Rows that already exist get from_contact = false (they are treated as roast / check-in flags).
--     Contact-form flags written BEFORE this migration cannot be recognised afterwards; they will
--     simply count like any other flag until they are older than 9 days (the longest the pause rule
--     ever looks back).
--   * Code from before this stage never sends the column, so the default applies and nothing breaks.
--   * Code from this stage sends from_contact = true only from the contact form, and falls back to
--     the old behaviour (and logs a code) if this migration has not been applied yet. Either order of
--     "apply the migration" and "deploy the code" is safe; applying the migration first is cleaner.
--
-- Not touched: the table's grants (they are table-level, so authenticated can still only SELECT and
-- service_role can still only SELECT / INSERT / DELETE), the row level security policy, the indexes,
-- the 30-day purge function, public.safety_flag_monthly_totals.
--
-- One transaction: if any step fails, nothing changes.
-- Tests: supabase/tests/030_safety_flags_from_contact_test.sql
-- Apply by hand in the Supabase SQL editor. It has NOT been run against any database.
--
-- To undo it later (optional; leaving the column in place is harmless):
--   alter table public.safety_flags drop column from_contact;
-- (not provided as a rollback file on purpose: this stage's rule is "no DROP in new migration files")

begin;

-- Step 1 (safety check): the flag table must exist (migration 029).
do $$
begin
  if to_regclass('public.safety_flags') is null then
    raise exception 'Migration 030 aborted: public.safety_flags was not found (apply migration 029 first). Nothing was changed.';
  end if;
end
$$;

-- Step 2: the column. A constant default, so Postgres adds it without rewriting the table.
alter table public.safety_flags
  add column if not exists from_contact boolean not null default false;

-- Step 3 (final check): confirm the end state before committing. Any surprise rolls back everything.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'safety_flags'
      and column_name = 'from_contact' and data_type = 'boolean' and is_nullable = 'NO'
  ) then
    raise exception 'Migration 030 aborted: public.safety_flags.from_contact must exist as a NOT NULL boolean.';
  end if;

  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'safety_flags') <> 5 then
    raise exception 'Migration 030 aborted: public.safety_flags must have exactly 5 columns (id, user_id, level, created_at, from_contact).';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.safety_flags'::regclass) then
    raise exception 'Migration 030 aborted: row level security is not enabled on public.safety_flags.';
  end if;

  if has_table_privilege('anon', 'public.safety_flags', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.safety_flags', 'INSERT, UPDATE, DELETE') then
    raise exception 'Migration 030 aborted: anon / authenticated have more access on public.safety_flags than they should.';
  end if;

  if not has_table_privilege('authenticated', 'public.safety_flags', 'SELECT') then
    raise exception 'Migration 030 aborted: authenticated cannot read public.safety_flags (the app could not see its own flags).';
  end if;

  if not has_table_privilege('service_role', 'public.safety_flags', 'SELECT, INSERT, DELETE') then
    raise exception 'Migration 030 aborted: service_role lacks SELECT / INSERT / DELETE on public.safety_flags.';
  end if;

  if has_table_privilege('service_role', 'public.safety_flags', 'UPDATE') then
    raise exception 'Migration 030 aborted: service_role can UPDATE public.safety_flags (flags are never edited).';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'safety_flags' and cmd <> 'SELECT'
  ) then
    raise exception 'Migration 030 aborted: unexpected non-SELECT policy on public.safety_flags.';
  end if;
end
$$;

commit;
