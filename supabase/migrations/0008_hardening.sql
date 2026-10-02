-- =============================================================================
-- 0008 — Authorisation helper hardening, Realtime wiring, grant hygiene
--
-- Two defects were found by actually executing 0001–0007 against a real
-- Postgres rather than by reading them. Both are recorded here.
-- =============================================================================


-- =============================================================================
-- 1. is_admin(uuid) let anyone enumerate who is an administrator
-- =============================================================================
--
-- `is_admin` was declared as:
--
--     is_admin(check_user_id uuid default auth.uid())
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so *both*
-- anon and authenticated could reach it through PostgREST as:
--
--     POST /rest/v1/rpc/is_admin   {"check_user_id": "<any uuid>"}
--
-- The argument override turns an authorisation helper into a role-enumeration
-- oracle: an anonymous visitor could binary-search a list of user IDs and learn
-- exactly which ones are moderators. Verified before this fix with
-- has_function_privilege('anon', ...) = true.
--
-- The fix is structural rather than a grant change. Every one of the eight
-- internal call sites already used the no-argument form, so the parameter
-- existed only to be abused. The helper now takes no arguments at all, which
-- makes "check somebody else's role" unrepresentable. `is_admin_or_owner(uuid)`
-- was likewise unused dead code and is removed.

-- Policies are dropped first: they are the only objects with a hard dependency
-- on the old signature, and Postgres refuses to drop a referenced function.
drop policy if exists profiles_select_own     on public.profiles;
drop policy if exists posts_admin_read_all     on public.posts;
drop policy if exists posts_admin_update        on public.posts;
drop policy if exists reports_select            on public.reports;
drop policy if exists reports_admin_update      on public.reports;
drop policy if exists moderation_logs_admin_read on public.moderation_logs;

drop function if exists public.is_admin(uuid);
drop function if exists public.is_admin_or_owner(uuid);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the caller (auth.uid()) is an administrator. Takes no arguments on
   purpose: a parameterised version would be callable with an arbitrary user id
   and become a role-enumeration oracle for anonymous callers.';

-- NOTE: revoking `from public` alone is NOT enough on Supabase. The platform sets
-- pg_default_acl so that every function created by `postgres` automatically gets
-- EXECUTE granted to anon, authenticated AND service_role. Those are explicit
-- per-role entries, so they survive a REVOKE ... FROM PUBLIC. The role has to be
-- named. Verified: `revoke ... from public` left anon=X on this function until
-- the explicit revokes below were added.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Re-create the policies verbatim. Their behaviour is unchanged; only the
-- helper they call has a different signature.
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy posts_admin_read_all on public.posts
  for select
  to authenticated
  using (public.is_admin());

create policy posts_admin_update on public.posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy reports_select on public.reports
  for select
  to authenticated
  using (public.is_admin() or reporter_id = auth.uid());

create policy reports_admin_update on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy moderation_logs_admin_read on public.moderation_logs
  for select
  to authenticated
  using (public.is_admin());


-- =============================================================================
-- 2. The Realtime publication contained no tables, so live updates never fired
-- =============================================================================
--
-- WallStore subscribes to postgres_changes on `posts` and `reports`, but
-- `pg_publication_tables` was empty for `supabase_realtime`. PostgREST and the
-- triggers were all working; the subscriptions simply had nothing to listen to
-- and failed closed without an error, so the wall would only ever refresh on
-- navigation. Verified before this fix: 0 rows in pg_publication_tables.
--
-- Rows are still RLS-filtered per subscriber, so a student receives only the
-- events they are entitled to see. This adds no new visibility.

do $$
declare
  target text;
begin
  foreach target in array array['posts', 'reports'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname    = 'supabase_realtime'
        and schemaname = 'public'
        and tablename  = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end;
$$;


-- =============================================================================
-- 3. Grant hygiene
-- =============================================================================
--
-- Postgres grants all privileges on a new view to PUBLIC, so anon arrived with
-- INSERT/UPDATE/DELETE on public_posts as well as SELECT. The view is not
-- auto-updatable (it aggregates a join), so those grants were inert — but they
-- are misleading and would become live if the view definition ever changed.
-- SELECT is the only thing public_posts is for.
revoke insert, update, delete on public.public_posts from anon, authenticated;

-- Trigger functions are fired by the database, not called by clients. They
-- return `trigger`, which PostgREST cannot expose, so the PUBLIC execute grant
-- is inert -- revoked anyway so the reachable surface matches intent. EXECUTE is
-- only checked at CREATE TRIGGER time, never when the trigger fires, so this
-- does not affect signup or any of the guards.
revoke all on function
  public.handle_new_user(),
  public.tgf_posts_normalise(),
  public.tgf_reports_normalise(),
  public.tgf_posts_guard_insert(),
  public.tgf_posts_guard_update(),
  public.tgf_posts_log_transition(),
  public.tgf_profiles_guard_update(),
  public.tgf_reports_guard_insert(),
  public.tgf_reports_guard_update()
from public, anon, authenticated;

-- community_stats must stay callable by anon; it returns aggregates only.
grant execute on function public.community_stats() to anon, authenticated;

-- admin_dashboard_stats stays authenticated-only, and its own body re-checks
-- is_admin() so a leaked GRANT alone would not expose it.
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;