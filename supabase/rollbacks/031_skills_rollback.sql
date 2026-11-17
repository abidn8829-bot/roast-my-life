-- 031_skills_rollback.sql
--
-- !!! WARNING: THIS DELETES ALL SKILL PROGRESS AND NOTEBOOK ENTRIES. !!!
--
-- Undoes migration 031: drops all 11 skill tables. That PERMANENTLY DELETES
--   * every enrollment, step progress row, review item and test result,
--   * every notebook entry users wrote,
--   * all skill content (packs, months, weeks, sources, steps, test items).
-- There is no undo. Only run this BEFORE launch, or after you have exported the user tables
-- (skill_enrollments, skill_step_progress, skill_review_items, skill_notebook_entries,
-- skill_test_results). The content can be reloaded from your week files with
-- scripts/pack-to-sql.mjs; user data cannot be recreated.
--
-- Not touched: any other table, function, policy or grant (nothing outside the skill_* tables).
-- Run it in the Supabase SQL editor. One transaction: all or nothing.
-- There is no CASCADE on purpose: if anything unexpected depends on these tables, the drop fails
-- loudly and nothing is changed.

begin;

-- Step 1: user tables first (they point at the content tables).
drop table if exists public.skill_test_results;
drop table if exists public.skill_notebook_entries;
drop table if exists public.skill_review_items;
drop table if exists public.skill_step_progress;
drop table if exists public.skill_enrollments;

-- Step 2: content tables, children before parents. Their policies (none on content tables;
-- one SELECT policy per user table) are dropped together with the tables above.
drop table if exists public.skill_test_items;
drop table if exists public.skill_steps;
drop table if exists public.skill_sources;
drop table if exists public.skill_weeks;
drop table if exists public.skill_months;
drop table if exists public.skill_packs;

-- Step 3 (final check): everything is gone.
do $$
declare
  t text;
begin
  foreach t in array array[
    'skill_test_results', 'skill_notebook_entries', 'skill_review_items', 'skill_step_progress',
    'skill_enrollments', 'skill_test_items', 'skill_steps', 'skill_sources', 'skill_weeks',
    'skill_months', 'skill_packs'] loop
    if to_regclass('public.' || t) is not null then
      raise exception 'Rollback of 031 aborted: public.% is still there. Nothing was changed.', t;
    end if;
  end loop;
end
$$;

commit;
