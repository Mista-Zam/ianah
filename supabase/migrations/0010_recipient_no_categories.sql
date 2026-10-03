-- ============================================================= 0010 =========
-- Drop categories, add a recipient
--
-- Categories were a filing system: pick one of four buckets, then a moderator
-- sorted by it. Nothing actually needed them. The wall has one audience and one
-- queue, the filter bar in the UI was the only consumer, and asking a student to
-- categorise a kind thing before sending it made the smallest possible act feel
-- like a form to fill in.
--
-- What replaces it is a recipient: free text naming who the note is for. It sits
-- above the message box and is optional, so the floor is now "type and send".
--
-- This migration is destructive for the column but not for the notes. `content`
-- and `note_color` are untouched; nothing about a published note changes except
-- that it no longer carries a bucket. recipient is additive and nullable.
--
-- Nothing reads the enum after this point, so the type goes too rather than
-- lingering as an orphan that a future migration might resurrect by accident.

-- =============================================================== recipient ====

alter table public.posts
  add column if not exists recipient text;

comment on column public.posts.recipient is
  'Free-text name of who the note is addressed to. Supplied by the writer; optional.
   Unrelated to authorship -- author_id stays NULL and is_anonymous stays true, so
   naming a recipient never reveals who wrote the note.';

-- Bound the field at the database rather than trusting the client. 60 characters
-- is roughly the length of a full name plus a title; MAX_RECIPIENT_LENGTH in
-- lib/constants.js enforces the same number in the UI.
--
-- blank <> '' so that a note nobody addressed is NULL, not an empty string. That
-- keeps "no recipient given" and "recipient given as an empty box" the same thing
-- everywhere downstream instead of leaving one code path to special-case.
alter table public.posts
  drop constraint if exists posts_recipient_length_chk;

alter table public.posts
  add constraint posts_recipient_length_chk
  check (
    recipient is null
    or (char_length(btrim(recipient)) between 1 and 60)
  );

-- ========================================================== drop category =====

-- The view has to be dropped first, before the column underneath it.
--
-- Two options and only one of them works: `create or replace view` can add
-- columns at the end but cannot remove one from the middle of an existing column
-- list, so recreating the view without category against the old view raises
-- "cannot drop column category from view". And you cannot drop the column first
-- either, because public_posts depends on it -- which is exactly the error the
-- first run of this migration hit.
--
-- So: drop the view, drop the column, recreate the view further down. Dropping
-- the view takes its anon/authenticated grants with it, which is why the grant is
-- reissued at the end of this file.
--
-- No `cascade`: grants do not block dropping a view, so if this ever needs
-- cascade something real is depending on it and that should fail loudly rather
-- than get silently dropped.
drop view if exists public.public_posts;

-- The enum hits the same ordering problem, one level down: the old submit_note
-- takes a post_category argument, and an argument type is a dependency of the
-- function, so the type cannot be dropped while the function still exists.
--
-- This is also the only way to change a function's arguments in Postgres.
-- `create or replace` refuses to alter an existing argument list outright, so a
-- signature change is always drop-then-create rather than replace. The old
-- overload is dropped rather than kept alongside the new one on purpose: a second
-- submit_note still taking a category would be unreachable from the app and
-- reachable only by hand.

drop function if exists public.submit_note(text, public.post_category, public.note_color, boolean);

-- Dropping the column takes posts_category_created_at_idx with it -- Postgres drops
-- any index that references a dropped column -- so there is nothing left to clean
-- up separately.

alter table public.posts
  drop column if exists category;

drop type if exists public.post_category;

-- ============================================================ submit_note =====

-- Same function, new arguments: category is gone, recipient is in its place.
-- The old signature was dropped with the type it depended on, above.

create or replace function public.submit_note(
  p_content       text,
  p_recipient     text default null,
  p_note_color    public.note_color default 'yellow'
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  -- is_anonymous is hardcoded true and author_id is hardcoded NULL. There is no
  -- parameter for either, on purpose.
  --
  -- An earlier version of this function wrote auth.uid() into author_id and took
  -- a p_is_anonymous flag. That is wrong for this application now: there are no
  -- student accounts to sign up with, so any session reaching this function is
  -- either a moderator or a leftover. Writing auth.uid() meant a stray session
  -- silently attached a note to an account internally while displaying it as
  -- anonymous -- true on screen, not true in the database. Removing the
  -- parameters makes the guarantee structural instead of a matter of what the
  -- caller passes.
  --
  -- btrim + nullif normalises "   " to NULL so the check constraint sees what the
  -- UI meant. Nothing here carries a status or any review field: those belong to
  -- tgf_posts_guard_insert, and it refuses to trust a client that supplies them.
  insert into public.posts (content, recipient, note_color, is_anonymous, author_id)
  values (
    p_content,
    nullif(btrim(p_recipient), ''),
    coalesce(p_note_color, 'yellow'::public.note_color),
    true,
    null
  )
  returning id into new_id;

  -- The row itself stays pending in the queue; only the id is returned, so a
  -- caller learns nothing about the moderation fields.
  return new_id;
end;
$$;

comment on function public.submit_note(text, text, public.note_color) is
  'Public note submission. Always anonymous: is_anonymous is true and author_id is
   NULL, with no argument able to change that. Returns only the new id; status and
   review metadata are normalised by tgf_posts_guard_insert and never exposed.';

grant execute on function public.submit_note(text, text, public.note_color)
  to anon, authenticated;

-- ========================================================= public_posts view ===

-- Recreated for the new shape: recipient in, category out. Everything else about
-- this view is load-bearing and unchanged -- security_invoker stays OFF, and the
-- where status = 'published' predicate is still the only thing between an
-- anonymous visitor and an unreviewed note. See the note in 0004 before touching
-- either of those.

create or replace view public.public_posts
with (security_invoker = off) as
  select
    p.id,
    p.content,
    p.recipient,
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
  where p.status = 'published';  -- load-bearing: see 0004.

comment on view public.public_posts is
  'Public read model. Exposes no author_id, no rejection_reason, no review
   metadata — so anonymous authorship cannot be de-anonymised from the client.
   recipient is what the note is addressed to, not who wrote it.';

-- create or replace view cannot change the column list of an existing view, so the
-- grant has to be reissued explicitly. Without this anon would keep the old grant
-- on a view that no longer exists and every read would start failing 404.
grant select on public.public_posts to anon, authenticated;