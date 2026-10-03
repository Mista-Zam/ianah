-- =============================================================================
-- 0011_moderator_accounts.sql — let a moderator add another moderator
-- =============================================================================
--
-- Until now, minting an admin meant opening the Supabase SQL editor. This adds
-- that ability to the console itself, so a second moderator can be onboarded
-- without anyone holding database credentials.
--
-- Creating an auth user is not something the publishable (anon) key can do: it is
-- an admin-only GoTrue operation. Doing it from the browser would mean shipping
-- service_role in a bundle, which must never happen. So the work lives in a
-- SECURITY DEFINER function: the database already holds the authority, and the
-- client only ever gets a uuid back.
--
-- Scope warning, stated plainly. This deliberately widens what a moderator can
-- do. Previously a compromised moderator session could approve and reject notes
-- but could not mint a new account; now it can leave a persistent backdoor that
-- survives the original session being closed. That is the requested feature
-- behaving correctly, not a defect. The only thing standing between an attacker
-- and unlimited admin creation is the is_admin() check below, which runs
-- server-side on every call and cannot be influenced by the client.
--
-- The moderation_logs table deliberately has no INSERT policy, so account
-- creation cannot be recorded in the existing audit trail. It is logged with
-- RAISE WARNING instead, which lands in the Postgres server log.
-- =============================================================================

-- ---------------------------------------------------------------- create ----

create or replace function public.admin_create_moderator(
  p_email        text,
  p_password     text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email   text;
  v_name    text;
  v_user_id uuid := gen_random_uuid();
begin
  -- The whole feature is this one line. A caller who is not already a moderator
  -- gets nothing: no row, no uuid, and no information about whether the address
  -- exists.
  if not public.is_admin() then
    raise exception 'Only moderators can create moderator accounts.'
      using errcode = '42501';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  v_name  := nullif(trim(coalesce(p_display_name, '')), '');

  -- Reject the seeded demo domain. A moderator typing admin@kindnesswall.test
  -- here would create an account that looks like the local fixture but is not,
  -- which is a confusing thing to discover during an incident.
  if v_email like '%@kindnesswall.test' then
    raise exception 'That is a reserved demo address. Use a real email.'
      using errcode = '22023';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.'
      using errcode = '22023';
  end if;

  if v_email !~* '^[^@]+@[^@]+\.[a-z]{2,}$' then
    raise exception 'Enter a valid email address.'
      using errcode = '22023';
  end if;

  if coalesce(p_password, '') = '' then
    raise exception 'Choose a password.'
      using errcode = '22023';
  end if;

  -- Stricter than GoTrue's own default of 6. This account can delete and publish
  -- every note in the app, so the floor is higher than for a normal sign-up.
  if length(p_password) < 10 then
    raise exception 'Use a password of at least 10 characters.'
      using errcode = '22023';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An account with that email already exists.'
      using errcode = '23505';
  end if;

  -- extensions.crypt/gen_salt are schema-qualified on purpose. Supabase installs
  -- pgcrypto into the `extensions` schema, so with search_path pinned to
  -- public,pg_temp an unqualified crypt() would not resolve. Qualifying beats
  -- adding `extensions` to the search path, which would widen what an attacker
  -- could shadow.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated', 'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    -- Confirmed immediately: a moderator is choosing this address, so there is
    -- nobody to receive a confirmation mail and no reason to require one.
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    case
      when v_name is null then '{}'::jsonb
      else jsonb_build_object('display_name', v_name)
    end,
    now(), now(), '', '', '', ''
  );

  -- The seed creates its demo accounts without an identity row and sign-in still
  -- works locally, but GoTrue's own signup always writes one and older versions
  -- have no fallback. Insert it rather than depend on that.
  --
  -- `email` is deliberately absent from the column list. In this GoTrue version it
  -- is `generated always as lower(identity_data ->> 'email')`, so naming it here
  -- fails outright with 428C9 ("column email is a generated column"). identity_data
  -- carries the address, and the generated column derives from it.
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  );

  -- handle_new_user() fires on the auth.users insert above and creates the
  -- profile as a student, deliberately: signup metadata must never be a route to
  -- admin. Promotion is therefore a separate, explicit step.
  update public.profiles
     set role = 'admin'
   where id = v_user_id;

  -- Defensive: if the trigger is disabled on a managed project, make the row
  -- rather than leaving an auth user that can sign in but owns nothing.
  if not found then
    insert into public.profiles (id, role, display_name)
    values (v_user_id, 'admin', v_name)
    on conflict (id) do update set role = 'admin';
  end if;

  raise warning 'moderator created: %', v_email;

  return v_user_id;
end;
$$;

comment on function public.admin_create_moderator(text, text, text) is
  'Create a moderator account and promote it to admin. Moderators only.';

-- ------------------------------------------------------------------ list ----

create or replace function public.admin_list_moderators()
returns table (
  id             uuid,
  email          text,
  display_name   text,
  created_at     timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only moderators can list moderator accounts.'
      using errcode = '42501';
  end if;

  -- SECURITY DEFINER is required to read auth.users at all; profiles is RLS'd to
  -- moderators already, but it holds no email addresses.
  --
  -- email is cast to text on purpose. auth.users.email is `character varying`
  -- here, and Postgres rejects a RETURN QUERY whose column types differ from the
  -- declared OUT types ("structure of query does not match function result
  -- type"). Casting keeps the client-facing contract as text even if GoTrue
  -- changes its internal type.
  return query
    select u.id, u.email::text, p.display_name, p.created_at, u.last_sign_in_at
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.role = 'admin'
     order by p.created_at asc;
end;
$$;

comment on function public.admin_list_moderators() is
  'List moderator accounts with their email addresses. Moderators only.';

-- ---------------------------------------------------------------- grants ----

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Both functions
-- are guarded by is_admin() internally, but leaving them executable by `anon`
-- would let anyone probe the error messages, so take it away explicitly.
revoke all on function public.admin_create_moderator(text, text, text) from public, anon;
revoke all on function public.admin_list_moderators()                    from public, anon;

grant execute on function public.admin_create_moderator(text, text, text) to authenticated;
grant execute on function public.admin_list_moderators()                    to authenticated;