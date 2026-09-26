-- READ-ONLY. Paste into the Supabase SQL editor BEFORE running
-- migrations/020_score_history_and_arc_daily.sql. Nothing here writes.
-- Returns one result set; the `section` column says what each row is.

select 'score_history column' as section,
       c.column_name::text as name,
       c.data_type || case when c.is_nullable = 'NO' then ' not null' else '' end
         || coalesce(' default ' || c.column_default, '') as detail
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'score_history'

union all

select 'rls enabled',
       cls.relname::text,
       case when cls.relrowsecurity then 'RLS ON' else 'RLS OFF' end
         || case when cls.relforcerowsecurity then ' (forced)' else '' end
from pg_class cls
join pg_namespace n on n.oid = cls.relnamespace
where n.nspname = 'public' and cls.relname in ('score_history', 'arc_percentile_snapshots')

union all

select 'policy',
       p.tablename || '.' || p.policyname,
       p.cmd || ' roles=' || array_to_string(p.roles, ',')
         || ' using=' || coalesce(p.qual, '-')
         || ' check=' || coalesce(p.with_check, '-')
from pg_policies p
where p.schemaname = 'public' and p.tablename in ('score_history', 'arc_percentile_snapshots')

union all

select 'constraint',
       con.conrelid::regclass::text || '.' || con.conname::text,
       con.contype::text || ': ' || pg_get_constraintdef(con.oid)
from pg_constraint con
where con.conrelid in ('public.score_history'::regclass, 'public.arc_percentile_snapshots'::regclass)

union all

select 'index',
       i.tablename || '.' || i.indexname,
       i.indexdef
from pg_indexes i
where i.schemaname = 'public' and i.tablename in ('score_history', 'arc_percentile_snapshots')

order by 1, 2;
