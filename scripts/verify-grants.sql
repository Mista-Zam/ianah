\pset pager off
\echo == TABLE GRANTS (anon / authenticated) ==
select table_name,
       coalesce(has_table_privilege('anon', c.oid, 'select'),false) as anon_sel,
       coalesce(has_table_privilege('authenticated', c.oid, 'select'),false) as auth_sel,
       coalesce(has_table_privilege('authenticated', c.oid, 'insert'),false) as auth_ins,
       coalesce(has_table_privilege('authenticated', c.oid, 'update'),false) as auth_upd
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v')
  and c.relname in ('posts','profiles','reports','moderation_logs','public_posts')
order by 1;
\echo
\echo == FUNCTION EXECUTE GRANTS ==
select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as fn,
       has_function_privilege('anon',p.oid,'execute')      as anon_exec,
       has_function_privilege('authenticated',p.oid,'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('is_admin','is_admin_or_owner','handle_new_user','community_stats','admin_dashboard_stats','tgf_posts_normalise')
order by 1;
\echo
\echo == POSTS POLICIES ==
select policyname, cmd, roles::text, qual, with_check from pg_policies where tablename='posts' order by policyname;
\echo
\echo == REPORTS POLICIES ==
select policyname, cmd, roles::text from pg_policies where tablename='reports' order by policyname;
\echo
\echo == PROFILES POLICIES ==
select policyname, cmd, roles::text from pg_policies where tablename='profiles' order by policyname;
\echo
\echo == REALTIME PUBLICATION ==
select pubname, tablename from pg_publication_tables order by pubname, tablename;