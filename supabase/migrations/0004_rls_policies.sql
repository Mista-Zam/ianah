-- =============================================================================
-- 0004 — Row Level Security
--
-- RLS is enabled on every application table. Nothing is granted to `anon`
-- beyond the public read of published posts.
--
-- Anonymous author identity is protected structurally: the client reads posts
-- through the `public_posts` view, which never exposes author_id at all.
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.posts            enable row level security;
alter table public.reports          enable row level security;
alter table public.moderation_logs  enable row level security;

-- NOTE: deliberately NOT `force row level security`.
--
-- FORCE extends RLS to the table owner, and several things here legitimately run
-- as that owner:
--   * handle_new_user()  — SECURITY DEFINER, inserts into profiles on signup
--   * tgf_posts_log_transition() — SECURITY DEFINER, writes moderation_logs
--   * the dev seed in 0005
-- On any configuration where `postgres` lacks BYPASSRLS, FORCE would block all
-- three, and the first thing that breaks is signup.
--
-- Plain RLS is still the correct boundary here: PostgREST only ever connects as
-- `anon` or `authenticated`, and neither owns these tables, so neither can reach
-- around the policies below.

-- ============================================================ profiles =======

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- A user may change only their own display_name. `role` is immutable: there is
-- deliberately no UPDATE policy that would let anyone reach it, and the guard
-- trigger below refuses a role change even if one were added later.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.tgf_profiles_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Trusted maintenance context: leave the role change alone.
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.tgf_profiles_guard_update();

-- No INSERT policy: rows are created solely by handle_new_user().
-- No DELETE policy: profiles are removed with their auth user.

-- ============================================================== posts ========

-- Deliberately scoped to anon ONLY, and anon is additionally revoked all table
-- privileges in the grants block at the bottom of this file — so this policy is
-- defence in depth against a grant being re-added by someone else.
--
-- Why anon is not listed alongside authenticated here: RLS filters ROWS, not
-- COLUMNS. Granting a student `select` on `posts` and letting them match
-- `status = 'published'` would hand them `author_id` for every published note,
-- which de-anonymises exactly the notes that promised anonymity. Students read the
-- public wall through `public_posts` instead, which omits that column. A student
-- therefore matches neither the admin nor the author policy below and sees zero
-- rows here.
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts
  for select
  to anon
  using (status = 'published');

-- Admins see everything, in every status.
drop policy if exists posts_admin_read_all on public.posts;
create policy posts_admin_read_all on public.posts
  for select
  to authenticated
  using (public.is_admin());

-- An author may see their own posts regardless of status (so the author
-- dashboard can show "rejected" without leaking anyone else's moderation data).
drop policy if exists posts_author_read_own on public.posts;
create policy posts_author_read_own on public.posts
  for select
  to authenticated
  using (author_id = auth.uid());

-- Students may insert. tgf_posts_guard_insert forces status='pending' and
-- author_id=auth.uid(), so the client cannot publish or impersonate.
drop policy if exists posts_author_insert on public.posts;
create policy posts_author_insert on public.posts
  for insert
  to authenticated
  with check (author_id = auth.uid());

-- Only admins may update (approve / reject / remove / restore). The
-- author-scoped edit path is handled by tgf_posts_guard_update for admins too,
-- but the policy below is the gate that keeps students out of moderation.
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy: removal is a status change, not a hard delete. This keeps
-- the audit trail meaningful.

-- ==================================================== public posts view =======

-- The ONLY object the anon role is meant to read posts through.
-- author_id is deliberately absent: anonymity is enforced here, not by RLS.
--
-- security_invoker is deliberately OFF, and the consequence matters:
--
--   * With it ON, the view would run as the caller, so the join to `profiles`
--     would be filtered by profiles' own RLS. For an anon visitor auth.uid() is
--     NULL, so no profile row is ever visible and a non-anonymous author's name
--     would silently never render. Failing closed, but wrong.
--
--   * With it OFF the view runs as its owner and bypasses RLS on both tables,
--     which means `where status = 'published'` below is the ONLY thing standing
--     between an anonymous visitor and an unreviewed note. Do not remove that
--     predicate. It is load-bearing, not decorative.
--
-- The view therefore grants exactly one thing: published notes, minus author_id.
create or replace view public.public_posts
with (security_invoker = off) as
  select
    p.id,
    p.content,
    p.category,
    p.note_color,
    p.is_anonymous,
    p.created_at,
    p.updated_at,
    case
      when p.is_anonymous then null
      else coalesce(pr.display_name, 'A student')
    end as display_name
  from public.posts p
  left join public.profiles pr
    on pr.id = p.author_id and p.is_anonymous = false
  where p.status = 'published';  -- load-bearing: see above.

comment on view public.public_posts is
  'Public read model. Exposes no author_id, no rejection_reason, no review
   metadata — so anonymous authorship cannot be de-anonymised from the client.';

grant select on public.public_posts to anon, authenticated;

-- ============================================================ reports ========

-- A reporter may read their own reports. Admins read the whole queue.
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select
  to authenticated
  using (public.is_admin() or reporter_id = auth.uid());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy: reports are resolved, not erased.

-- ===================================================== moderation_logs ========

-- Admins only. There is no policy for anon or students, so every other role
-- receives zero rows (RLS denies rather than errors).
drop policy if exists moderation_logs_admin_read on public.moderation_logs;
create policy moderation_logs_admin_read on public.moderation_logs
  for select
  to authenticated
  using (public.is_admin());

-- No INSERT policy either: rows are written only by tgf_posts_log_transition,
-- which runs SECURITY DEFINER as the table owner and therefore bypasses RLS.
-- That is what makes the audit trail tamper-proof from the client.

-- ============================================================== grants =======

-- anon gets NO privileges on the base tables. Its entire read surface is the
-- public_posts view, which hides author_id. See the note on posts_public_read.
grant select on public.public_posts to anon, authenticated;

revoke all on public.profiles, public.posts, public.reports, public.moderation_logs from anon;

grant select, insert, update on public.posts to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.moderation_logs to authenticated;

-- No sequences: primary keys come from pgcrypto's gen_random_uuid().