-- =============================================================================
-- 0003 — Functions and triggers
--
-- Security-critical pieces live here:
--   * handle_new_user            — creates the profile row on signup
--   * is_admin()                 — the single source of truth for authorisation
--   * tgf_posts_guard_post_insert — forces status='pending' for non-admins
--   * tgf_posts_guard_moderation — blocks students from writing moderation fields
-- =============================================================================

-- ---------------------------------------------------------------- helpers ----

-- SECURITY DEFINER so the function can read profiles without recursing through
-- RLS. Wrapped in a SELECT that cannot be hijacked: the search_path is pinned.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin(uuid) is
  'Authorisation source of truth. Used by every admin-only RLS policy so that a
   client cannot escalate by forging claims.';

-- True when the caller is an admin OR is the given row owner.
create or replace function public.is_admin_or_owner(row_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin() or (auth.uid() is not null and auth.uid() = row_author_id);
$$;

-- ------------------------------------------------------- profile bootstrap ---

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role public.user_role;
begin
  -- Defence in depth: even though the column default is 'student' and no UPDATE
  -- policy lets a user touch `role`, we explicitly refuse an admin role arriving
  -- from the signup metadata. Admin accounts are provisioned out of band.
  begin
    requested_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    requested_role := null;
  end;

  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    case when requested_role = 'admin' then 'student'::public.user_role
         else coalesce(requested_role, 'student'::public.user_role) end,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------- timestamp upkeep ---

create or replace function public.tgf_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tgf_set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.tgf_set_updated_at();

-- --------------------------------------------------- posts: insert guarding ---

-- A student submission is ALWAYS pending. An admin may insert directly as
-- published (used by seeding), but a client-supplied status is otherwise ignored.
create or replace function public.tgf_posts_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() IS NULL means we are not inside a PostgREST request: this is a
  -- trusted maintenance context (migrations, seed scripts, service-role jobs).
  -- RLS does not apply to those callers, so leave the supplied values intact.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    if new.status <> 'pending' then
      new.reviewed_at := coalesce(new.reviewed_at, now());
    end if;
  else
    new.status         := 'pending';
    new.reviewed_at    := null;
    new.reviewed_by    := null;
    new.rejection_reason := null;
    -- A student cannot post on behalf of somebody else.
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_insert on public.posts;
create trigger posts_guard_insert
  before insert on public.posts
  for each row execute function public.tgf_posts_guard_insert();

-- ---------------------------------------------- posts: update/moderation gate ---

-- A student may edit only the body of their own *pending* post and may never
-- touch status, review metadata or the author link. Everyone else (admins) is
-- permitted, with moderation_logs handled separately.
create or replace function public.tgf_posts_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Trusted maintenance context (seed/migrations/service role): RLS is bypassed
  -- by the caller anyway, so do not second-guess the values.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    -- Normalise review metadata so it can never drift out of sync with status.
    if new.status = 'pending' then
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.rejection_reason := null;
    else
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
    return new;
  end if;

  if auth.uid() is null or auth.uid() <> old.author_id then
    raise exception 'You may only edit your own posts.' using errcode = '42501';
  end if;

  if old.status <> 'pending' then
    raise exception 'This post has already been reviewed and can no longer be edited.'
      using errcode = '42501';
  end if;

  -- Force every moderation-owned column back to its previous value.
  new.author_id        := old.author_id;
  new.status           := old.status;
  new.is_anonymous     := old.is_anonymous;
  new.reviewed_at      := old.reviewed_at;
  new.reviewed_by      := old.reviewed_by;
  new.rejection_reason := old.rejection_reason;

  return new;
end;
$$;

drop trigger if exists posts_guard_update on public.posts;
create trigger posts_guard_update
  before update on public.posts
  for each row execute function public.tgf_posts_guard_update();

-- ---------------------------------------------- automatic moderation logging ---

-- Keeps the audit trail honest regardless of whether the caller remembered to
-- write a log row: any real status transition emits one automatically.
create or replace function public.tgf_posts_log_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_action public.moderation_action;
begin
  if new.status = old.status then
    return new;
  end if;

  resolved_action := case new.status
    when 'published' then 'approve'::public.moderation_action
    when 'rejected'  then 'reject'::public.moderation_action
    when 'removed'   then 'remove'::public.moderation_action
    else null
  end;

  -- 'restore' is a published-from-removed transition.
  if old.status = 'removed' and new.status = 'published' then
    resolved_action := 'restore'::public.moderation_action;
  end if;

  if resolved_action is not null then
    insert into public.moderation_logs
      (post_id, moderator_id, action, reason, previous_status, new_status)
    values
      (new.id, coalesce(new.reviewed_by, auth.uid()), resolved_action,
       new.rejection_reason, old.status, new.status);
  end if;

  return new;
end;
$$;

drop trigger if exists posts_log_transition on public.posts;
create trigger posts_log_transition
  after update of status on public.posts
  for each row execute function public.tgf_posts_log_transition();

-- ------------------------------------------------------- report housekeeping ---

-- Clear a report's resolution metadata whenever it returns to 'pending'.
create or replace function public.tgf_reports_normalise()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pending' then
    new.resolved_at := null;
    new.resolved_by := null;
  elsif new.resolved_at is null then
    new.resolved_at := now();
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists reports_normalise on public.reports;
create trigger reports_normalise
  before update on public.reports
  for each row execute function public.tgf_reports_normalise();

-- Students must not be able to move a report out of the pending queue.
create or replace function public.tgf_reports_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only reports out of the pending queue, and only from a real request context.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only moderators can change a report.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_guard_update on public.reports;
create trigger reports_guard_update
  before update on public.reports
  for each row execute function public.tgf_reports_guard_update();

-- Only pending, published posts can be reported on.
create or replace function public.tgf_reports_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status public.post_status;
begin
  select status into target_status from public.posts where id = new.post_id;

  if target_status is distinct from 'published' then
    raise exception 'Only published posts can be reported.' using errcode = '42501';
  end if;

  if auth.uid() is not null then
    new.reporter_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists reports_guard_insert on public.reports;
create trigger reports_guard_insert
  before insert on public.reports
  for each row execute function public.tgf_reports_guard_insert();