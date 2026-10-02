-- =============================================================================
-- 0002 — Constraints and indexes
--
-- Indexes are chosen from the queries the app actually issues:
--   * public wall:    select ... where status = 'published' order by created_at desc
--   * category filter: adds  and category = $1
--   * admin queue:     select ... where status = 'pending' order by created_at
--   * my posts:        select ... where author_id = $1
--   * report queue:    select ... where status = 'pending'
--   * audit trail:     select ... order by created_at desc
--
-- Deliberately NOT indexed: reviewed_by, note_color, updated_at — no query in the
-- codebase filters or sorts on them, so indexes there would only add write cost.
-- =============================================================================

-- --------------------------------------------------------------- post length ---

alter table public.posts
  drop constraint if exists posts_content_length;
alter table public.posts
  add constraint posts_content_length check (
    char_length(content) between 1 and 600
  );

-- Trim on write so downstream comparisons and search are predictable.
create or replace function public.tgf_posts_normalise() returns trigger
language plpgsql as $$
begin
  new.content := btrim(new.content);
  return new;
end;
$$;

drop trigger if exists posts_normalise on public.posts;
create trigger posts_normalise
  before insert or update of content on public.posts
  for each row execute function public.tgf_posts_normalise();

-- ------------------------------------------------------------------ indexes ---

-- Serves the public wall (status = 'published') and every admin status view.
create index if not exists posts_status_created_at_idx
  on public.posts (status, created_at desc);

-- Serves the category filter on the public wall. Kept as a separate index from
-- posts_status_created_at_idx because category is always the *second* predicate.
create index if not exists posts_category_created_at_idx
  on public.posts (category, created_at desc)
  where status = 'published';

-- Serves "my posts" in the author dashboard and RLS author-scoped reads.
create index if not exists posts_author_created_at_idx
  on public.posts (author_id, created_at desc);

-- Serves the admin review queue ordering and the "today's submissions" stat.
create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

-- Supports the keyword search on the public wall. GIN + pg_trgm gives
-- substring/ILIKE matching without needing a tsvector column.
create extension if not exists "pg_trgm";

create index if not exists posts_content_trgm_idx
  on public.posts using gin (content gin_trgm_ops)
  where status = 'published';

-- ------------------------------------------------------------------ reports ---

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

create index if not exists reports_post_id_idx
  on public.reports (post_id);

-- ------------------------------------------------------------ moderation logs ---

create index if not exists moderation_logs_post_id_idx
  on public.moderation_logs (post_id);

create index if not exists moderation_logs_created_at_idx
  on public.moderation_logs (created_at desc);

-- ---------------------------------------------------------------- profiles ----

-- Supports "is this user an admin" lookups without scanning every profile.
create index if not exists profiles_role_idx
  on public.profiles (role)
  where role = 'admin';