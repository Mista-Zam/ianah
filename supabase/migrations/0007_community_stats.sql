-- =============================================================================
-- 0007 — Public community counters
--
-- The home page shows four headline numbers before anyone signs in. anon cannot
-- read `profiles` at all, so counting distinct authors has to happen here.
--
-- This function is SECURITY DEFINER and callable by anon, so it is the one place
-- that crosses the privacy boundary — it therefore returns *counts only*, never
-- names, emails or ids, and always filters to status = 'published' so nothing
-- pending, rejected or removed can be inferred from it.
-- =============================================================================

create or replace function public.community_stats()
returns table (
  published       bigint,
  students        bigint,
  today           bigint,
  anonymous_share numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.posts where status = 'published'),
    (select count(distinct p.author_id) from public.posts p where p.status = 'published'),
    (select count(*) from public.posts
      where status = 'published' and created_at >= now() - interval '24 hours'),
    (select coalesce(round(100.0 * count(*) filter (where is_anonymous) / nullif(count(*), 0), 1), 0)
       from public.posts where status = 'published');
$$;

revoke all on function public.community_stats() from public;
grant execute on function public.community_stats() to anon, authenticated;