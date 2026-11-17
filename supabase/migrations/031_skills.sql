-- 031_skills.sql
--
-- DRAFT, NOT APPLIED. Nothing in this file has been run against any database.
--
-- "Learn a skill" feature: 6 CONTENT tables (what a skill pack teaches) and 5 USER tables (what
-- each user has done with it).
--
-- CONTENT TABLES (the browser can NOT read them, on purpose)
--   skill_packs, skill_months, skill_weeks, skill_sources, skill_steps, skill_test_items
--   Why: if a browser (the public anon key) could read them, free users could open locked months
--   and anyone could read every correct answer. So: row level security ON, all rights taken from
--   anon and authenticated, NO policies, and only the server (service_role) may SELECT.
--   Nobody can write them through the API either. Content is loaded by hand in the Supabase SQL
--   editor (as the database owner) with the SQL produced by scripts/pack-to-sql.mjs.
--
-- USER TABLES
--   skill_enrollments, skill_step_progress, skill_review_items, skill_notebook_entries,
--   skill_test_results
--   Row level security ON. A logged-in user can SELECT only their OWN rows (user_id = auth.uid()).
--   INSERT / UPDATE / DELETE: service_role only (the server writes with the service-role key).
--   There is no write policy for authenticated, so a browser can never write progress.
--   anon: nothing at all. Every user_id references auth.users and is deleted with the account.
--
-- Who can do what, in one table:
--                         anon     authenticated      service_role
--   content tables (6)    nothing  nothing            SELECT
--   user tables (5)       nothing  SELECT own rows    SELECT, INSERT, UPDATE, DELETE
--
-- One transaction: if any step fails, nothing changes. The last step re-checks every grant and
-- policy and aborts (rolls back everything) on any surprise.
-- Rollback: supabase/rollbacks/031_skills_rollback.sql  (DELETES ALL SKILL PROGRESS)
-- Tests:    supabase/tests/031_skills_test.sql
-- Apply by hand in the Supabase SQL editor. It has NOT been run against the live database.

begin;

-- Step 1 (safety check): the user tables point at auth users, so that table must exist.
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'Migration 031 aborted: auth.users was not found. Nothing was changed.';
  end if;
end
$$;

-- =====================================================================
-- CONTENT TABLES
-- =====================================================================

-- Step 2: skill_packs. title and summary are set by hand later (the converter only inserts the id).
create table if not exists public.skill_packs (
  id           text        primary key,
  title        text,
  summary      text,
  is_published boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- Step 3: skill_months. is_free = the free month (month 1 only, set by the converter).
create table if not exists public.skill_months (
  pack_id     text     not null references public.skill_packs (id),
  month_no    smallint not null check (month_no between 1 and 6),
  title       text,
  teaser_line text,
  is_free     boolean  not null default false,
  primary key (pack_id, month_no)
);

-- Step 4: skill_weeks. Weeks 1..24, four per month: month_no must equal ceil(week_no / 4).
create table if not exists public.skill_weeks (
  id         uuid     primary key default gen_random_uuid(),
  pack_id    text     not null,
  month_no   smallint not null,
  week_no    smallint not null check (week_no between 1 and 24),
  title      text     not null,
  goal_line  text     not null,
  handout_md text     not null,
  unique (pack_id, week_no),
  check (month_no = ceil(week_no / 4.0)),
  foreign key (pack_id, month_no) references public.skill_months (pack_id, month_no)
);

-- Step 5: skill_sources. ref is the short label used in the week file (S1, S2, ...), unique per week.
create table if not exists public.skill_sources (
  id                  uuid     primary key default gen_random_uuid(),
  week_id             uuid     not null references public.skill_weeks (id),
  ref                 text     not null,
  title               text     not null,
  author_or_publisher text,
  year                smallint,
  url                 text     not null,
  verified_on         date     not null,
  verified_how        text     not null,
  unique (week_id, ref)
);

-- Step 6: skill_steps. Five per week (day_no 1..5, unique per week).
-- prove_options is a JSON array of 2 to 5 strings WITHOUT the A/B/C letters; prove_correct is the
-- 0-based position of the right one and must be smaller than the number of options.
create table if not exists public.skill_steps (
  id                  uuid     primary key default gen_random_uuid(),
  week_id             uuid     not null references public.skill_weeks (id),
  day_no              smallint not null check (day_no between 1 and 5),
  learn_title         text     not null,
  learn_body          text     not null,
  fact_line           text     not null,
  source_id           uuid     not null references public.skill_sources (id),
  do_prompt           text     not null,
  prove_question      text     not null,
  prove_options       jsonb    not null,
  prove_correct       smallint not null,
  prove_explanation   text     not null,
  hint                text     not null,
  unique (week_id, day_no),
  check (jsonb_typeof(prove_options) = 'array'),
  check (jsonb_array_length(prove_options) between 2 and 5),
  check (not jsonb_path_exists(prove_options, '$[*] ? (@.type() != "string")')),
  check (prove_correct >= 0 and prove_correct < jsonb_array_length(prove_options))
);

-- Step 7: skill_test_items. Up to 8 per week. covers_day must be a day that exists for that same
-- week: the composite foreign key to skill_steps (week_id, day_no) enforces that. Load the steps
-- before the test items (the converter does).
create table if not exists public.skill_test_items (
  id          uuid     primary key default gen_random_uuid(),
  week_id     uuid     not null references public.skill_weeks (id),
  "position"  smallint not null check ("position" between 1 and 8),
  covers_day  smallint not null check (covers_day between 1 and 5),
  question    text     not null,
  options     jsonb    not null,
  correct     smallint not null,
  explanation text     not null,
  unique (week_id, "position"),
  foreign key (week_id, covers_day) references public.skill_steps (week_id, day_no),
  check (jsonb_typeof(options) = 'array'),
  check (jsonb_array_length(options) between 2 and 5),
  check (not jsonb_path_exists(options, '$[*] ? (@.type() != "string")')),
  check (correct >= 0 and correct < jsonb_array_length(options))
);

-- =====================================================================
-- USER TABLES
-- =====================================================================

-- Step 8: skill_enrollments. One row per user per pack.
create table if not exists public.skill_enrollments (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  pack_id          text        not null references public.skill_packs (id),
  started_at       timestamptz not null default now(),
  last_new_step_at timestamptz,
  primary key (user_id, pack_id)
);

-- Step 9: skill_step_progress. One row per user per step.
create table if not exists public.skill_step_progress (
  user_id        uuid        not null references auth.users (id) on delete cascade,
  step_id        uuid        not null references public.skill_steps (id),
  do_done        boolean     not null default false,
  prove_correct  boolean     not null default false,
  prove_attempts smallint    not null default 0,
  completed_at   timestamptz,
  primary key (user_id, step_id)
);

-- Step 10: skill_review_items. stage 0 = due 1 day later, 1 = 3 days, 2 = 7 days, 3 = 14 days.
create table if not exists public.skill_review_items (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  step_id      uuid        not null references public.skill_steps (id),
  stage        smallint    not null check (stage between 0 and 3),
  due_at       timestamptz not null,
  last_correct boolean,
  retired      boolean     not null default false,
  primary key (user_id, step_id)
);

-- Step 11: skill_notebook_entries. One note per user per step, 1 to 600 characters.
-- updated_at has no trigger: whoever updates the row (the server) sets it.
create table if not exists public.skill_notebook_entries (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  step_id    uuid        not null references public.skill_steps (id),
  body       text        not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, step_id)
);

-- Step 12: skill_test_results. One row per attempt at a week test. weak_days = the day numbers
-- the user got wrong.
create table if not exists public.skill_test_results (
  id        uuid        primary key default gen_random_uuid(),
  user_id   uuid        not null references auth.users (id) on delete cascade,
  week_id   uuid        not null references public.skill_weeks (id),
  score     smallint    not null,
  total     smallint    not null,
  passed    boolean     not null,
  weak_days smallint[],
  taken_at  timestamptz not null default now()
);

-- Step 13: the only extra index. "My test results" is read by user_id and skill_test_results has
-- no key that starts with user_id. (The other user tables already have one: their primary key or
-- unique key starts with user_id.)
create index if not exists skill_test_results_user_taken_idx
  on public.skill_test_results (user_id, taken_at desc);

-- =====================================================================
-- ROW LEVEL SECURITY, GRANTS, POLICIES
-- =====================================================================

-- Step 14: row level security on, for all 11 tables.
alter table public.skill_packs           enable row level security;
alter table public.skill_months          enable row level security;
alter table public.skill_weeks           enable row level security;
alter table public.skill_sources         enable row level security;
alter table public.skill_steps           enable row level security;
alter table public.skill_test_items      enable row level security;
alter table public.skill_enrollments     enable row level security;
alter table public.skill_step_progress   enable row level security;
alter table public.skill_review_items    enable row level security;
alter table public.skill_notebook_entries enable row level security;
alter table public.skill_test_results    enable row level security;

-- Step 15: explicit grants. Supabase hands new tables to anon / authenticated / service_role by
-- default, so take EVERYTHING away from all of them first, then give back exactly what the app needs.
revoke all on table public.skill_packs            from public, anon, authenticated, service_role;
revoke all on table public.skill_months           from public, anon, authenticated, service_role;
revoke all on table public.skill_weeks            from public, anon, authenticated, service_role;
revoke all on table public.skill_sources          from public, anon, authenticated, service_role;
revoke all on table public.skill_steps            from public, anon, authenticated, service_role;
revoke all on table public.skill_test_items       from public, anon, authenticated, service_role;
revoke all on table public.skill_enrollments      from public, anon, authenticated, service_role;
revoke all on table public.skill_step_progress    from public, anon, authenticated, service_role;
revoke all on table public.skill_review_items     from public, anon, authenticated, service_role;
revoke all on table public.skill_notebook_entries from public, anon, authenticated, service_role;
revoke all on table public.skill_test_results     from public, anon, authenticated, service_role;

-- Content tables: the server may read, nobody else may do anything. No policies on purpose
-- (with RLS on and no policies, anon / authenticated see and change nothing).
grant select on table public.skill_packs      to service_role;
grant select on table public.skill_months     to service_role;
grant select on table public.skill_weeks      to service_role;
grant select on table public.skill_sources    to service_role;
grant select on table public.skill_steps      to service_role;
grant select on table public.skill_test_items to service_role;

-- User tables: a logged-in user may read (their own rows, see the policies below); only the
-- server may write.
grant select                         on table public.skill_enrollments      to authenticated;
grant select                         on table public.skill_step_progress    to authenticated;
grant select                         on table public.skill_review_items     to authenticated;
grant select                         on table public.skill_notebook_entries to authenticated;
grant select                         on table public.skill_test_results     to authenticated;

grant select, insert, update, delete on table public.skill_enrollments      to service_role;
grant select, insert, update, delete on table public.skill_step_progress    to service_role;
grant select, insert, update, delete on table public.skill_review_items     to service_role;
grant select, insert, update, delete on table public.skill_notebook_entries to service_role;
grant select, insert, update, delete on table public.skill_test_results     to service_role;

-- Step 16: the ONLY policies in this file: a logged-in user reads their own rows. There is
-- deliberately no insert / update / delete policy for authenticated, and no policy at all on the
-- content tables. (service_role bypasses row level security.)
drop policy if exists "Users can read own skill enrollments" on public.skill_enrollments;
create policy "Users can read own skill enrollments"
  on public.skill_enrollments for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own skill step progress" on public.skill_step_progress;
create policy "Users can read own skill step progress"
  on public.skill_step_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own skill review items" on public.skill_review_items;
create policy "Users can read own skill review items"
  on public.skill_review_items for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own skill notebook entries" on public.skill_notebook_entries;
create policy "Users can read own skill notebook entries"
  on public.skill_notebook_entries for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own skill test results" on public.skill_test_results;
create policy "Users can read own skill test results"
  on public.skill_test_results for select to authenticated
  using (auth.uid() = user_id);

-- Step 17 (final check): confirm the end state before committing. Any surprise rolls back everything.
do $$
declare
  t text;
  p text;
  content_tables text[] := array[
    'skill_packs', 'skill_months', 'skill_weeks', 'skill_sources', 'skill_steps', 'skill_test_items'];
  user_tables text[] := array[
    'skill_enrollments', 'skill_step_progress', 'skill_review_items', 'skill_notebook_entries', 'skill_test_results'];
begin
  -- Every one of the 11 tables: RLS on, and anon / public have no right of any kind
  -- (table level or column level).
  foreach t in array content_tables || user_tables loop
    if to_regclass('public.' || t) is null then
      raise exception 'Migration 031 aborted: public.% was not created.', t;
    end if;

    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'Migration 031 aborted: row level security is not enabled on public.%.', t;
    end if;

    if has_any_column_privilege('anon', 'public.' || t, 'SELECT, INSERT, UPDATE, REFERENCES')
       or has_table_privilege('anon', 'public.' || t, 'DELETE, TRUNCATE, TRIGGER') then
      raise exception 'Migration 031 aborted: anon has some access to public.%.', t;
    end if;

    foreach p in array array['TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('service_role', 'public.' || t, p) then
        raise exception 'Migration 031 aborted: service_role has % on public.% (not wanted).', p, t;
      end if;
    end loop;
  end loop;

  -- Content tables: authenticated has nothing; service_role can SELECT only; no policies at all.
  foreach t in array content_tables loop
    if has_any_column_privilege('authenticated', 'public.' || t, 'SELECT, INSERT, UPDATE, REFERENCES')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE, TRUNCATE, TRIGGER') then
      raise exception 'Migration 031 aborted: authenticated has some access to content table public.% (browsers must not read content).', t;
    end if;

    if not has_table_privilege('service_role', 'public.' || t, 'SELECT') then
      raise exception 'Migration 031 aborted: service_role cannot SELECT public.%.', t;
    end if;

    if has_any_column_privilege('service_role', 'public.' || t, 'INSERT, UPDATE')
       or has_table_privilege('service_role', 'public.' || t, 'DELETE') then
      raise exception 'Migration 031 aborted: service_role can write content table public.% (content is loaded by hand, not by the app).', t;
    end if;

    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'Migration 031 aborted: content table public.% has a policy (it must have none).', t;
    end if;
  end loop;

  -- User tables: authenticated can SELECT only; service_role can SELECT, INSERT, UPDATE, DELETE;
  -- exactly one policy, a SELECT policy for authenticated; user_id deletes with the account.
  foreach t in array user_tables loop
    if not has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      raise exception 'Migration 031 aborted: authenticated cannot read public.% (users could not see their own rows).', t;
    end if;

    if has_any_column_privilege('authenticated', 'public.' || t, 'INSERT, UPDATE, REFERENCES')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE, TRUNCATE, TRIGGER') then
      raise exception 'Migration 031 aborted: authenticated has write access on public.%.', t;
    end if;

    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not has_table_privilege('service_role', 'public.' || t, p) then
        raise exception 'Migration 031 aborted: service_role lacks % on public.%.', p, t;
      end if;
    end loop;

    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 1
       or not exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = t
           and cmd = 'SELECT' and roles = '{authenticated}'
       ) then
      raise exception 'Migration 031 aborted: public.% must have exactly one policy, a SELECT policy for authenticated.', t;
    end if;

    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = ('public.' || t)::regclass
        and c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
        and c.confdeltype = 'c'
    ) then
      raise exception 'Migration 031 aborted: public.% does not delete its rows with the auth user (on delete cascade).', t;
    end if;
  end loop;
end
$$;

commit;
