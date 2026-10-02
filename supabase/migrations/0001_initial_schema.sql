-- =============================================================================
-- 0001 — Initial schema
-- Kindness Wall for Teachers (a.k.a. Teachers' Freedom Wall)
--
-- Notes on naming:
--   The brief specified roles 'teacher' and 'admin'. The product decision is that
--   *students* are the authors, so the author role is named 'student'. Renaming is
--   a one-line change here plus the enum reference in 0002/0004 if you ever flip it.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums ---

do $$ begin
  create type public.user_role as enum ('student', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_status as enum ('pending', 'published', 'rejected', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_category as enum (
    'Classroom', 'School Life', 'Honest Thoughts', 'Wins',
    'Advice', 'Thank You', 'Funny', 'Motivation', 'Random'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.note_color as enum (
    'yellow', 'pink', 'blue', 'green', 'lavender', 'orange', 'purple'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_reason as enum (
    'Offensive content', 'Harassment', 'Spam', 'Personal information', 'Other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('pending', 'reviewed', 'dismissed', 'action_taken');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.moderation_action as enum (
    'approve', 'reject', 'remove', 'restore',
    'review_report', 'dismiss_report', 'resolve_report'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- profiles ---

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role   not null default 'student',
  display_name text,
  created_at   timestamptz       not null default now(),
  updated_at   timestamptz       not null default now(),

  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 60
  )
);

comment on table public.profiles is
  'One row per authenticated user. role is authoritative for authorisation and is
   never writable by the client — see RLS + the handle_new_user trigger.';

-- ------------------------------------------------------------------- posts ---

create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references public.profiles (id) on delete cascade,
  content          text not null,
  category         public.post_category not null,
  note_color       public.note_color     not null default 'yellow',
  is_anonymous     boolean              not null default true,
  status           public.post_status   not null default 'pending',
  created_at       timestamptz          not null default now(),
  updated_at       timestamptz          not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  rejection_reason text,

  -- a post is "reviewed" iff it carries reviewer + timestamp
  constraint posts_review_pairing check (
    (reviewed_at is null and reviewed_by is null)
    or (reviewed_at is not null and reviewed_by is not null)
  ),
  -- a rejection must always carry a reason
  constraint posts_rejected_needs_reason check (
    status <> 'rejected' or (rejection_reason is not null and length(trim(rejection_reason)) > 0)
  ),
  -- A decision that counted must name who made it and when.
  --
  -- The name of this constraint predates its body and is misleading: it does NOT
  -- mean "pending rows must have no reviewer" -- that is the opposite of what it
  -- does. Read it as "rows in a decided-terminal state must carry reviewer
  -- metadata": rejected and removed fall outside the exempt list, so they require
  -- reviewed_at. Pending is exempt (nothing has decided it yet) and published is
  -- exempt too, because approval writes that metadata through
  -- tgf_posts_guard_update rather than at the constraint level.
  --
  -- Verified against a live database: the seed inserts 5 pending rows with
  -- reviewed_at null and 2 rejected + 1 removed rows with it populated.
  constraint posts_unreviewed_has_no_reviewer check (
    status in ('pending', 'published') or reviewed_at is not null
  )
);

comment on column public.posts.author_id is
  'Retained internally for moderation and abuse handling. Never exposed publicly
   when is_anonymous is true — see the public read view in 0004.';
comment on column public.posts.status is
  'Forced to ''pending'' for all non-admin inserts. See 0003 enforce_* triggers.';

-- ----------------------------------------------------------------- reports ---

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      public.report_reason not null,
  details     text,
  status      public.report_status not null default 'pending',
  created_at  timestamptz          not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,

  constraint reports_details_length check (
    details is null or char_length(details) <= 1000
  ),
  constraint reports_resolved_pairing check (
    (resolved_at is null and resolved_by is null)
    or (resolved_at is not null and resolved_by is not null)
  ),
  -- one report per person per post: the practical anti-spam guard
  constraint reports_one_per_reporter unique (post_id, reporter_id)
);

-- -------------------------------------------------------- moderation_logs ---

create table if not exists public.moderation_logs (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.posts (id) on delete set null,
  moderator_id    uuid not null references public.profiles (id) on delete restrict,
  action          public.moderation_action not null,
  reason          text,
  previous_status public.post_status,
  new_status      public.post_status,
  created_at      timestamptz not null default now(),

  constraint moderation_logs_reason_length check (
    reason is null or char_length(reason) <= 500
  )
);

comment on table public.moderation_logs is
  'Append-only audit trail. No UPDATE or DELETE policies are defined, so rows are
   effectively immutable once written.';