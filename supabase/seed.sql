-- =============================================================================
-- seed.sql — Development seed data  ⚠️  DEV ONLY
--
-- DO NOT run this against a production project. It creates demo accounts with
-- known passwords and inserts posts that look like real submissions:
--
--     admin@kindnesswall.test    -> role admin
--     student@kindnesswall.test  -> role student
--     password for both: demo-password-123
--
-- -----------------------------------------------------------------------------
-- Why this file is NOT in supabase/migrations/
--
-- This used to be 0005_seed.sql, guarded by a `do $$ ... if not local then
-- return; end if; $$` block. That guard did not work, in two independent ways:
--
--   1. It could not tell the environments apart. It allowed any database whose
--      name matched %dev%, %local% or %postgres% -- and both the local stack AND
--      the hosted project call their database `postgres`. A hosted project would
--      have sailed straight through the "is this local?" check.
--
--   2. `return` inside a standalone DO block exits only that block. Every insert
--      below it is a separate top-level statement and still ran. So even on a
--      database the guard rejected, the seed still happened.
--
-- File placement is the real control. `supabase db reset` applies this file
-- automatically after the migrations; `supabase db push` applies ONLY
-- supabase/migrations/*.sql, and will send this one solely if someone passes
-- --include-seed by hand. Nothing in the normal deploy path can run it.
-- -----------------------------------------------------------------------------
--
-- To seed a local database:
--     supabase start
--     supabase db reset        # applies migrations, then this file
--
-- This file writes to auth.users, so it needs an owner context. That is fine
-- locally. On a hosted project, do not run it at all -- provision a real
-- moderator by signing up through the app and promoting that account once:
--
--     update public.profiles set role = 'admin' where id = (
--       select id from auth.users where email = 'you@school.org'
--     );
--
-- Seed posts are flagged in the log as bulk actions so they are distinguishable
-- from real submissions in the audit trail.
-- =============================================================================

-- ------------------------------------------------------------ demo accounts ---

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated',
    'admin@kindnesswall.test',
    crypt('demo-password-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Moderator"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated',
    'student@kindnesswall.test',
    crypt('demo-password-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Student"}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

-- handle_new_user should have created these; insert defensively in case the
-- trigger is disabled on a managed project.
insert into public.profiles (id, role, display_name)
values
  ('11111111-1111-4111-8111-111111111111', 'admin',  'Demo Moderator'),
  ('22222222-2222-4222-8222-222222222222', 'student', 'Demo Student')
on conflict (id) do nothing;

-- Promote the demo admin explicitly (handle_new_user deliberately downgrades
-- any admin role arriving from signup metadata).
update public.profiles
   set role = 'admin'
 where id = '11111111-1111-4111-8111-111111111111';

-- ------------------------------------------------------------------- posts ----
-- Student-authored notes, matching the categories in lib/constants.js.
-- `published` rows get reviewed_by/reviewed_at so the pairing constraint holds.

insert into public.posts
  (id, author_id, content, category, note_color, is_anonymous, status, created_at, reviewed_at, reviewed_by, rejection_reason)
values
  -- ---- published -----------------------------------------------------------
  ('a0000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'I failed this subject last term and you did not give up on me. I just want you to know it actually worked.',
   'Thank You', 'yellow', true, 'published', now() - interval '9 days', now() - interval '9 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'You asked me a question today and then actually waited for my answer. Nobody does that.',
   'Classroom', 'blue', true, 'published', now() - interval '8 days', now() - interval '8 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'The bell rang and you were still talking. We really did not want it to stop.',
   'Funny', 'pink', true, 'published', now() - interval '7 days', now() - interval '7 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   'To every teacher marking work on a Sunday, you probably do not hear this enough, and you should.',
   'Motivation', 'lavender', true, 'published', now() - interval '6 days', now() - interval '6 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   'I wish people understood how much work goes into a lesson we take for granted.',
   'Honest Thoughts', 'orange', true, 'published', now() - interval '5 days', now() - interval '5 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222',
   'I finally finished all my homework before dinner. Freedom!',
   'Wins', 'green', false, 'published', now() - interval '4 days', now() - interval '4 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222',
   'Stop labelling the reading group. Start reading with them.',
   'Advice', 'purple', true, 'published', now() - interval '3 days', now() - interval '3 days', '11111111-1111-4111-8111-111111111111', null),

  ('a0000001-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222',
   'You remembered I was absent last week and asked if I was okay. Small thing. Meant a lot.',
   'School Life', 'yellow', false, 'published', now() - interval '2 days', now() - interval '2 days', '11111111-1111-4111-8111-111111111111', null),

  -- ---- pending -------------------------------------------------------------
  ('a0000002-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'There is a lot going on at home this term and school is the only place it does not follow me. Thank you for that.',
   'Honest Thoughts', 'blue', true, 'pending', now() - interval '5 hours', null, null, null),

  ('a0000002-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'If you are having a hard week, the students notice even when you think they do not. Just so you know.',
   'Thank You', 'lavender', true, 'pending', now() - interval '3 hours', null, null, null),

  ('a0000002-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'Whoever invented the phrase it is just a job has never survived a double period with thirty-one teenagers.',
   'Honest Thoughts', 'orange', true, 'pending', now() - interval '2 hours', null, null, null),

  ('a0000002-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   'Twelve exit tickets last week, ten saying I understood. Two said confused. Those two are why you bother, right?',
   'Wins', 'green', true, 'pending', now() - interval '1 hour', null, null, null),

  ('a0000002-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   'My locker: chaos. My folder: alphabetised by colour. Priorities are clear.',
   'Random', 'pink', true, 'pending', now() - interval '20 minutes', null, null, null),

  -- ---- rejected ------------------------------------------------------------
  ('a0000003-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'Anyone else secretly hate the teachers? lol jk, mostly.',
   'Honest Thoughts', 'pink', true, 'rejected', now() - interval '3 days',
   now() - interval '3 days', '11111111-1111-4111-8111-111111111111', 'Offensive language'),

  ('a0000003-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Selling cheap notes and past papers, message me, bulk orders available.',
   'Random', 'orange', true, 'rejected', now() - interval '5 days',
   now() - interval '5 days', '11111111-1111-4111-8111-111111111111', 'Advertising'),

  -- ---- removed -------------------------------------------------------------
  ('a0000004-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'My neighbour''s kid got held back again. Everyone in the group chat knows exactly why.',
   'Honest Thoughts', 'purple', true, 'removed', now() - interval '6 days',
   now() - interval '2 days', '11111111-1111-4111-8111-111111111111', 'Personal information')
on conflict (id) do nothing;

-- ----------------------------------------------------------------- reports ----

insert into public.reports (id, post_id, reporter_id, reason, details, status, created_at)
values
  ('b0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000005',
   '22222222-2222-4222-8222-222222222222', 'Personal information', null,
   'pending', now() - interval '2 hours')
on conflict (id) do nothing;

-- ------------------------------------------------------------------- logs -----

insert into public.moderation_logs (post_id, moderator_id, action, reason, previous_status, new_status, created_at)
values
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'approve', null, 'pending', 'published', now() - interval '9 days'),
  ('a0000003-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'reject', 'Offensive language', 'pending', 'rejected', now() - interval '3 days'),
  ('a0000004-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'remove', 'Personal information', 'published', 'removed', now() - interval '2 days')
on conflict do nothing;