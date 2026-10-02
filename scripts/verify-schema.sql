\pset pager off
\echo == TABLES ==
select table_name from information_schema.tables where table_schema='public' order by 1;
\echo == RLS FLAGS ==
select c.relname as obj, c.relrowsecurity as rls, c.relforcerowsecurity as forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v')
  and c.relname in ('posts','profiles','reports','moderation_logs','public_posts')
order by 1;
\echo == POLICY COUNTS ==
select tablename, count(*) as policies from pg_policies where schemaname='public' group by 1 order by 1;
\echo == FUNCTIONS ==
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as secdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname not like 'pg_%' order by 1;
\echo == VIEW OPTIONS + COLUMNS ==
select c.relname, c.reloptions from pg_class c where c.relname='public_posts';
select column_name from information_schema.columns where table_schema='public' and table_name='public_posts' order by ordinal_position;
\echo == SEED COUNTS ==
select 'profiles' t, count(*) from profiles
union all select 'posts', count(*) from posts
union all select 'reports', count(*) from reports
union all select 'moderation_logs', count(*) from moderation_logs;
\echo == SEED POST STATUS x REVIEWER ==
select status, count(*), count(reviewed_at) as with_reviewer from posts group by 1 order by 1;
\echo == ROLES ==
select role, count(*) from profiles group by 1 order by 1;
\echo == POST CONSTRAINTS ==
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.posts'::regclass order by conname;