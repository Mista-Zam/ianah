-- =============================================================================
-- 0009 — Anonymous submissions
--
-- The wall is now open to everyone. No account is required to read it, submit a
-- note, or report one. Only moderators authenticate.
--
-- What this migration changes, and why each part is load-bearing:
--
--   1. posts.author_id and reports.reporter_id become NULLABLE, because an
--      anonymous visitor has no account to point at. Everything else about the
--      moderation model is unchanged: submissions are still forced to 'pending',
--      still land in the queue, and are still audited.
--
--   2. tgf_posts_guard_insert previously treated "no auth.uid()" as a TRUSTED
--      MAINTENANCE context and returned the row untouched:
--
--          if auth.uid() is null then return new; end if;
--
--      That was safe only because anon could not insert at all. The moment anon
--      is allowed to insert, that branch hands an anonymous caller the right to
--      choose their own author_id, set status='published', and forge
--      reviewed_by. In other words, granting the insert policy below without
--      rewriting this trigger would have been a complete compromise of the
--      moderation model. is_trusted_write_context() now makes the distinction
--      explicitly: no uid AND a JWT role that is neither 'anon' nor
--      'authenticated', i.e. psql, a migration, or the service role.
--
--   3. A non-admin submission is forced anonymous. There is no identity behind
--      it to attribute, so none is claimed. This is deliberate: allowing a
--      visitor to type a display name would let anyone claim to be a named
--      student or teacher with no account behind it.
--
--   4. reports_one_per_reporter had to be rebuilt. Postgres treats NULLs as
--      distinct in a unique index, so the moment reporter_id can be NULL the
--      dedupe stops applying to anonymous reports entirely and one visitor could
--      report the same note forever. The replacement keeps one report per
--      (post, account) and additionally caps anonymous reporting at one per post.
--
-- Reads are untouched: anon still has NO grant on the base tables and still reads
-- only through public_posts, which never exposes author_id.
-- =============================================================================

-- ------------------------------------------------------------- nullable ids ----

alter table public.posts   alter column author_id   drop not null;
alter table public.reports alter column reporter_id drop not null;

comment on column public.posts.author_id is
  'NULL for an anonymous submission. Retained internally for moderation and abuse
   handling when an account does exist. Never exposed publicly — see public_posts.';
comment on column public.reports.reporter_id is
  'NULL when reported by an anonymous visitor. Withheld from admins so an
   anonymous reporter cannot be traced.';

-- ------------------------------------------------- one report per anonymous ---

alter table public.reports drop constraint if exists reports_one_per_reporter;

create unique index if not exists reports_one_per_reporter_account
  on public.reports (post_id, reporter_id)
  where reporter_id is not null;

create unique index if not exists reports_one_per_reporter_anon
  on public.reports (post_id)
  where reporter_id is null;

-- ------------------------------------------------------ trusted context test --

-- True only for callers that are not PostgREST end users: psql, a migration, the
-- seed script, and the service role. Notably FALSE for anon, which is the entire
-- point -- 0003 used a bare `auth.uid() is null` test that anon also satisfied.
--
-- The role must be read from `request.jwt.claims`, the JSONB claim set that
-- PostgREST v12+ actually populates. Reading the legacy `request.jwt.claim.role`
-- GUC instead looks like it works and silently does not: on current PostgREST that
-- GUC is unset for every request, so the value comes back NULL, NULL is "not
-- anon", and every anonymous caller is classified as trusted maintenance --
-- which is precisely the privilege escalation this function exists to prevent.
-- The legacy name is still consulted as a fallback for older deployments.
create or replace function public.is_trusted_write_context()
returns boolean
language sql
stable
as $$
  select auth.uid() is null
     and coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           nullif(current_setting('request.jwt.claim.role', true), ''),
           ''
         ) not in ('anon', 'authenticated');
$$;

comment on function public.is_trusted_write_context() is
  'True for maintenance callers only (psql, migrations, seed, service_role).
   False for anon and authenticated, so a client can never reach a code path
   that trusts client-supplied moderation fields.';

revoke all on function public.is_trusted_write_context() from public, anon;
grant execute on function public.is_trusted_write_context() to authenticated;

-- ------------------------------------------------- posts: insert guard v2 -----

create or replace function public.tgf_posts_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Maintenance callers keep full control of the row, so the seed can create
  -- published demo notes attributed to the demo accounts.
  if public.is_trusted_write_context() then
    return new;
  end if;

  if public.is_admin() then
    -- A moderator may submit straight to published, and the note is attributed
    -- to them. coalesce keeps an explicit author_id if one was supplied.
    new.author_id     := coalesce(new.author_id, auth.uid());
    new.reviewed_by   := coalesce(new.reviewed_by, auth.uid());
    if new.status <> 'pending' then
      new.reviewed_at := coalesce(new.reviewed_at, now());
    end if;
  else
    -- Everyone else: an unreviewed, unattributed note. auth.uid() is NULL for an
    -- anonymous visitor and their own id if an old account session is still
    -- alive, so neither can attribute the note to anybody else.
    new.status           := 'pending';
    new.reviewed_at      := null;
    new.reviewed_by      := null;
    new.rejection_reason := null;
    new.is_anonymous     := true;
    new.author_id        := auth.uid();
  end if;

  return new;
end;
$$;

-- ----------------------------------------------- reports: insert guard v2 ----

create or replace function public.tgf_reports_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status public.post_status;
begin
  -- Forced unconditionally now. 0003 only overwrote reporter_id when a uid was
  -- present, which is safe while anon cannot insert; once it can, leaving the
  -- field alone would let a visitor file a report in someone else's name.
  new.reporter_id := case
    when public.is_trusted_write_context() then new.reporter_id
    else auth.uid()
  end;

  select p.status into target_status from public.posts p where p.id = new.post_id;

  if target_status is distinct from 'published' then
    raise exception 'Only published posts can be reported.' using errcode = '42501';
  end if;

  -- A report is an accusation, never a moderation decision. Resolution metadata
  -- belongs to the moderator queue alone.
  new.status      := 'pending';
  new.resolved_at := null;
  new.resolved_by := null;

  return new;
end;
$$;

-- ----------------------------------------------- posts: update guard v2 ------

-- Same trusted-context correction. Non-admins cannot reach an UPDATE on posts
-- today (no grant to anon, admin-only policy for authenticated), so the raise
-- below is defence in depth against a future grant turning into an exploit.
create or replace function public.tgf_posts_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_trusted_write_context() then
    return new;
  end if;

  if public.is_admin() then
    if new.status = 'pending' then
      new.reviewed_at      := null;
      new.reviewed_by      := null;
      new.rejection_reason := null;
    else
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
    return new;
  end if;

  -- Nobody but a moderator may edit a note. Anonymous submitters have no
  -- account to prove ownership with, so "edit your own" is not available here.
  raise exception 'Only moderators can edit notes.' using errcode = '42501';
end;
$$;

-- ================================================================== submit RPCs =
--
-- These two functions, not the table, are how the public writes.
--
-- Why not simply `grant insert on posts to anon`? Because the client needs the
-- new row's id back, and the obvious way to get it is PostgREST's
-- `Prefer: return=representation` (what `.insert().select().single()` emits).
-- That makes PostgREST run a SELECT after the INSERT -- and anon has no SELECT on
-- posts, deliberately, because reading author_id would de-anonymise every note.
-- Granting SELECT to close that gap would undo the entire design.
--
-- So the insert happens behind a SECURITY DEFINER function that returns only the
-- new uuid. anon needs no privilege on the base table at all, and no column of
-- the inserted row is ever echoed back to an unauthenticated caller.
--
-- The BEFORE INSERT triggers still fire inside the function, so everything above
-- about normalisation applies unchanged: is_trusted_write_context() is false for
-- both anon and authenticated, so a caller can never reach the branch that
-- trusts client-supplied moderation fields.

create or replace function public.submit_note(
  p_content       text,
  p_category      public.post_category,
  p_note_color    public.note_color,
  p_is_anonymous  boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  insert into public.posts (content, category, note_color, is_anonymous, author_id)
  values (
    p_content,
    p_category,
    p_note_color,
    coalesce(p_is_anonymous, true),
    auth.uid()   -- NULL for an anonymous visitor, their own id otherwise
  )
  returning id into new_id;

  -- The row itself stays pending in the queue; only the id is returned, so a
  -- caller learns nothing about the moderation fields.
  return new_id;
end;
$$;

comment on function public.submit_note(text, public.post_category, public.note_color, boolean) is
  'Public note submission. Returns only the new id; status, author and review
   metadata are normalised by tgf_posts_guard_insert and never exposed.';

create or replace function public.submit_report(
  p_post_id  uuid,
  p_reason   public.report_reason,
  p_details  text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  insert into public.reports (post_id, reporter_id, reason, details)
  values (p_post_id, auth.uid(), p_reason, p_details)
  returning id into new_id;

  return new_id;
end;
$$;

comment on function public.submit_report(uuid, public.report_reason, text) is
  'Public report submission, anonymous by default. Returns only the new id.';

grant execute on function public.submit_note(text, public.post_category, public.note_color, boolean)
  to anon, authenticated;
grant execute on function public.submit_report(uuid, public.report_reason, text)
  to anon, authenticated;

-- ========================================================= direct table writes ==

-- Direct table inserts are moderator-only. Everyone else -- anonymous visitors
-- and any surviving account -- goes through the two functions above.
--
-- This is narrower than it looks at first: with signup removed there are no
-- student accounts to write with, and an authenticated caller who somehow did
-- hold a session has no reason to be trusted with a raw insert. Keeping the raw
-- path closed means the reachable surface for a non-moderator is exactly two
-- audited functions whose every argument is validated in SQL.
drop policy if exists posts_author_insert on public.posts;
drop policy if exists posts_public_insert on public.posts;
drop policy if exists posts_submit_insert on public.posts;

create policy posts_admin_insert on public.posts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists reports_insert on public.reports;
drop policy if exists reports_submit_insert on public.reports;

create policy reports_admin_insert on public.reports
  for insert
  to authenticated
  with check (public.is_admin());

-- A reporter may no longer read back their own report: with no account there is
-- nothing to match on, and the moderation queue is not public information.
drop policy if exists reports_select on public.reports;
create policy reports_admin_select on public.reports
  for select
  to authenticated
  using (public.is_admin());

-- =================================================================== grants ====

-- anon: read the view, call the two submit functions, nothing else.
revoke all on public.profiles, public.posts, public.reports, public.moderation_logs from anon;

grant select on public.public_posts to anon;
grant execute on function public.submit_note(text, public.post_category, public.note_color, boolean) to anon;
grant execute on function public.submit_report(uuid, public.report_reason, text) to anon;

grant select, insert, update on public.posts   to authenticated;
grant select, update          on public.reports to authenticated;
grant select, update on public.profiles        to authenticated;
grant select        on public.moderation_logs  to authenticated;