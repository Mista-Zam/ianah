-- =============================================================================
-- 0006 — Admin dashboard aggregate
--
-- The console's dashboard needs six numbers at once. Fetching them from the client
-- would mean six round trips and, worse, six separate chances to compute a total
-- the RLS filters would have hidden. This function returns them in one call, is
-- restricted to admins, and SECURITY DEFINER so it can count across every status.
-- =============================================================================

create or replace function public.admin_dashboard_stats()
returns table (
  pending            bigint,
  published          bigint,
  rejected           bigint,
  removed            bigint,
  open_reports       bigint,
  todays_submissions bigint,
  total_students     bigint,
  anonymous_share    numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Refuse non-admins explicitly rather than leaking zero rows that look like
  -- "no data yet" — a distinct error is far easier to debug.
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.posts where status = 'pending'),
    (select count(*) from public.posts where status = 'published'),
    (select count(*) from public.posts where status = 'rejected'),
    (select count(*) from public.posts where status = 'removed'),
    (select count(*) from public.reports where status = 'pending'),
    (select count(*) from public.posts where created_at >= date_trunc('day', now())),
    (select count(*) from public.profiles where role = 'student'),
    (select coalesce(round(100.0 * count(*) filter (where is_anonymous) / nullif(count(*), 0), 1), 0)
       from public.posts where status = 'published');
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;