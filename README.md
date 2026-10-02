# Kindness Wall for Teachers

A place for students to write notes to their teachers. Notes are reviewed by a
moderator before they appear on the public wall, and anyone with an account can
report something that should not be there.

Built with React 19 + Vite 8 + Tailwind v4 and Supabase (Postgres + Auth +
Realtime). The visual layer is a dark sticky-note wall; everything behind it is
enforced by database policies rather than by the browser.

---

## Status

**Verified against a real database.** All seven migrations apply cleanly from an
empty database, and 81 automated assertions pass against a live Supabase stack
with real sessions and real RLS — 42 exercising the HTTP/RLS boundary directly,
39 driving the actual `src/lib/db/*` modules through Vite's SSR transform.

Four real bugs were found by running things rather than reading them. See
[Verified behaviour](#verified-behaviour) and
[Bugs found by testing](#bugs-found-by-testing).

**The schema is live on the hosted project** `xccvbblyrwbyjlstaukn`. All seven
migrations were applied via the connection pooler and then re-verified over the
public Data API: `public_posts` and `community_stats` return `200`, while
`posts`, `profiles`, `reports`, `moderation_logs` and `admin_dashboard_stats`
all return `42501` to `anon`. The demo seed was deliberately excluded, so the
wall is legitimately empty until real submissions arrive.

**No moderator exists yet.** Promote one after signing up — see
[Apply the schema to production](#apply-the-schema-to-production).

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Supabase publishable key

Copy the example and fill in the blank:

```bash
cp .env.example .env
```

Then edit `.env`:

```dotenv
VITE_SUPABASE_URL=https://xccvbblyrwbyjlstaukn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
```

Get the publishable key from **Supabase Dashboard → Project Settings → API**.
Use the **publishable** (`anon`) key. The `service_role` / secret key must never
appear in `.env` or anywhere in `src/` — it bypasses RLS entirely.

> Until a real key is present the app still runs, and shows an explicit
> "not connected" state rather than firing requests that cannot succeed.

### 3. Apply the database schema

```bash
# Locally — runs every migration from scratch, including the seed.
npm run db:start
npm run db:reset
```

Then apply the same migrations to the hosted project — see
[Apply the schema to production](#apply-the-schema-to-production).

`supabase db push` applies `supabase/migrations/*.sql` in filename order:

| File | What it does |
| --- | --- |
| `0001_initial_schema.sql` | Tables, enums, constraints |
| `0002_constraints_indexes.sql` | Content length limits, trigram + status indexes |
| `0003_functions_triggers.sql` | `is_admin()`, profile bootstrap, **the guards that stop a student self-publishing** |
| `0004_rls_policies.sql` | Row Level Security on every table, plus the `public_posts` view |
| `0006_dashboard_stats.sql` | Admin-only aggregate used by the dashboard |
| `0007_community_stats.sql` | Public aggregate used by the home page |
| `0008_hardening.sql` | Parameterless `is_admin()`, Realtime publication, grant hygiene |

Note the gap at `0005`. That file used to be `0005_seed.sql` and was moved out to
`supabase/seed.sql`; nothing was applied from the old numbering on any hosted
project, so removing it left no hole in anyone's migration history.

### The demo seed, and why it is not a migration

`supabase/seed.sql` creates `admin@kindnesswall.test` and
`student@kindnesswall.test`, both with the password `demo-password-123`, plus
sample notes and reports.

It is **not** in `supabase/migrations/`, and the reason matters. It was there
originally, behind a `do $$ ... return; $$` guard that was meant to stop it
running on a real database. That guard did not work, for two independent
reasons:

1. It allowed any database named like `%dev%`, `%local%` **or `%postgres%`** —
   and the hosted project calls its database `postgres` too, so production would
   have passed the check.
2. `return` inside a standalone `DO` block exits only that block. Every `insert`
   below it is a separate top-level statement and ran anyway.

File location is the control that actually works. `supabase db reset` applies
`seed.sql` after the migrations, so local development still gets demo data.
`supabase db push` only ever applies `supabase/migrations/*.sql`, and sends this
file solely if someone passes `--include-seed` deliberately.

### Apply the schema to production

Done — all seven migrations are live. This is the command that did it:

```bash
# The direct hostname db.<ref>.supabase.co is IPv6-only, which fails on
# machines without real IPv6. The pooler is IPv4 and works everywhere.
npx supabase db push --db-url \
  "postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres"
```

`--db-url` needs no `supabase login`. Prefer `npx supabase login` + `link` when
you have a working token. Note the seed is **not** applied — production should
start empty.

If you re-run this on a machine that does have IPv6:

```bash
npx supabase login
npx supabase link --project-ref xccvbblyrwbyjlstaukn
npx supabase db push
```

Then confirm the result:

```bash
npm run db:probe   # read-only GETs against whatever project .env points at
```

The probe is read-only. On the hosted project it should now print:

| Request | Expected |
| --- | --- |
| `GET /auth/v1/health` | `200` |
| `GET /rest/v1/public_posts` | `200` — `[]` on production, since the seed is excluded |
| `GET /rest/v1/posts` | `42501` permission denied |
| `GET /rest/v1/profiles` | `42501` permission denied |
| `GET /rest/v1/reports` | `42501` permission denied |
| `GET /rest/v1/moderation_logs` | `42501` permission denied |
| `GET /rest/v1/rpc/community_stats` | `200` with zeroed counters |
| `GET /rest/v1/rpc/admin_dashboard_stats` | `42501` permission denied |

Those `42501`s are the point, not a failure. `anon` being unable to touch the
base tables is what forces all public reads through `public_posts`. If
`public_posts` still reports `PGRST205 Could not find the table`, the migrations
did not land.

### 4. Create the first moderator

There is no registration path to admin — by design. Sign up normally through the
app, then promote the account once from the SQL editor:

```sql
update public.profiles
   set role = 'admin'
 where id = (
   select id from auth.users where email = 'you@school.org'
 );
```

`handle_new_user()` refuses an `admin` role arriving from signup metadata, so
this promotion is the only way in.

### 5. Run it

```bash
npm run dev
```

```bash
npm run build      # production bundle
npm run lint       # oxlint
npm run preview    # serve the production build
```

---

## How access control works

Every authorisation decision lives in Postgres. The browser never decides what a
user may do — it only reflects what the database already allowed.

| Actor | Can read | Can write |
| --- | --- | --- |
| Visitor (anon) | Published notes only, via the `public_posts` view | Nothing |
| Student | Published notes; their own posts in any status; their own reports | Submit notes, file one report per note |
| Admin | Everything | Approve, reject, remove, restore, resolve reports |

Four defence layers are worth knowing about:

1. **RLS on every table**, with `anon` holding no privileges on the base tables at
   all. `FORCE ROW LEVEL SECURITY` is deliberately *not* used — it would also apply
   RLS to the table owner and break the `SECURITY DEFINER` triggers that create
   profiles and write the audit trail. PostgREST only connects as `anon` or
   `authenticated`, neither of which owns these tables, so plain RLS is the right
   boundary.
2. **`is_admin()` is `SECURITY DEFINER`** with a pinned `search_path`. RLS
   policies call it rather than trusting a role claim from the client. It takes
   **no arguments** on purpose: it can only ever answer "is *the caller* an
   admin?", so a caller cannot point it at another user to discover who holds the
   role.
3. **A `BEFORE INSERT` trigger forces `status = 'pending'`** and
   `author_id = auth.uid()` for any non-admin. A student who tampers with the
   request to publish their own note is silently corrected by the database.
4. **Public reads go through a view, not the table.** RLS filters rows; it cannot
   hide a column — so a student granted `select` on `posts` and allowed to match
   `status = 'published'` would receive `author_id` for every published note and
   quietly de-anonymise exactly the notes that promised anonymity. Instead,
   `public_posts` omits `author_id`, and a signed-in student matches neither the
   admin nor the author policy on `posts`, so the table returns them nothing.

The audit trail is tamper-proof from the client by construction:
`moderation_logs` has a `SELECT` policy for admins and **no** `INSERT`, `UPDATE`
or `DELETE` policy. Rows are written only by a `SECURITY DEFINER` trigger, which
means the history records status changes even if a caller forgets to.

---

## Data model

```
profiles         1 ──── * posts          (author, role: student | admin)
posts            1 ──── * reports        (one per reporter per post)
posts            1 ──── * moderation_logs (append-only)
```

`posts.status` is `pending | published | rejected | removed`. There is no
`archived` and no `reported` status: a note with an open report is still
`published` and is surfaced in the console by joining its pending reports, which
is what `byStatus.reported` in the store derives. Hiding a note is `removed`, and
`actions.restore` puts it back.

---

## Layout

```
supabase/migrations/   Schema, functions, RLS policies, hardening
supabase/seed.sql      Demo accounts and sample notes — local only, never pushed
scripts/               Verification suites (see Verified behaviour)
src/lib/supabase.js    Client construction + isConfigured guard
src/lib/db/            One module per resource: posts, reports, moderation, stats, auth
src/lib/mappers.js     Row → UI shape, and the UI-slug ↔ DB-label category maps
src/store/WallStore.jsx  Session, data loading, Realtime, actions, toasts
```

`WallStore` keeps the same context shape the components consumed when this was a
localStorage demo (`posts`, `byStatus`, `publicWall`, `reports`, `logs`,
`counts`, `actions`), which is why the visual layer needed almost no
restructuring. It now also exposes `session`, `user`, `profile`, `isAdmin`,
`loading`, `error` and `isConfigured`.

Actions return `{ ok: true, data }` or `{ ok: false, error }` and raise their own
toast, so callers check `.ok` rather than handling rejections.

---

## Verified behaviour

Two suites run against a live Supabase stack. They need the local stack running
and a database reset, and they are repeatable:

```bash
npm run db:start
npm run db:reset
npm run test:security   # 42 assertions, HTTP + RLS boundary
npm run test:app        # 39 assertions, the real src/lib/db/* modules
```

`test:security` drives PostgREST and GoTrue exactly as the browser does, with real
JWTs, so it exercises RLS, triggers and privileges rather than a simulation.
`test:app` loads the application's own modules through Vite's SSR transform, so it
tests the code that actually ships.

Confirmed against a live database:

- All seven migrations apply from empty, in order, with no errors.
- Signup creates a `profiles` row with `role = 'student'`, via the trigger.
- A student posting `status: "published"` **and** someone else's `author_id` gets
  a row that is silently rewritten to `pending` / `auth.uid()`.
- A student patching their own role to `admin` is refused by the guard trigger.
- A student sees **zero** rows of `posts` in `published` status — the row-level
  filter that would otherwise hand out `author_id`.
- `anon` receives `42501` on `posts`, `profiles` and `moderation_logs` directly,
  and reads published notes only through `public_posts`, which has no `author_id`
  column at all.
- An admin approve writes exactly one `moderation_logs` row with
  `previous_status → new_status` and the moderator's id; the note then appears on
  the public wall; removing hides it; restoring brings it back.
- Rejecting without a reason is refused by the check constraint.
- A report on a published note succeeds, the same reporter reporting again is
  refused, one student cannot see another's report, and only an admin can resolve.
- `community_stats` is callable by `anon`; `admin_dashboard_stats` is not callable
  by `anon` or by a student, only by an admin.

### Bugs found by testing

These were all invisible to review and only appeared on execution:

1. **Admins were locked out of the whole console.** `getCurrentProfile()` called
   `.maybeSingle()` with no filter. `profiles_select_own` is
   `id = auth.uid() or is_admin()`, so an admin can read *every* profile — the
   query returned N rows, `maybeSingle()` failed with `PGRST116 "The result
   contains N rows"`, and the `if (error) return null` branch turned that into
   `isAdmin === false` forever. Students worked, which is exactly why it would
   have shipped. Fixed by filtering on the session user's id.
2. **Anyone could enumerate who is an administrator.** `is_admin` was declared
   `is_admin(check_user_id uuid default auth.uid())`, and Postgres grants `EXECUTE`
   to `anon` by default — so `POST /rest/v1/rpc/is_admin {"check_user_id": "…"}`
   answered "is this user a moderator?" for any id. The parameter was never used by
   any of the eight internal call sites. Fixed by making the function take no
   arguments at all, so the query is not expressible.
3. **Live updates never fired.** `WallStore` subscribes to `postgres_changes` on
   `posts` and `reports`, but `supabase_realtime` contained **no tables** — it
   failed closed with no error, so the wall only refreshed on navigation. Fixed in
   `0008`.
4. **Moderation actions could report success while doing nothing.** PostgREST does
   not error when RLS filters every row out of an `UPDATE`; it returns `200` with
   an empty result set. `setPostStatus` only checked `error`, so a write that
   changed nothing would have shown "Approved". `setPostStatus` and
   `setReportStatus` now assert they got back the rows they asked for.

Two smaller issues fixed alongside: `AdminLayout` redirected on `isAdmin` alone,
which bounced signed-in admins to the login page on any refresh because the role
resolves asynchronously; and `/admin/login`, which the header, share modal, report
modal, footer and sign-up page all send students to, signed non-admins straight
back out — so a registered student could never hold a session and could never post
or report. It now routes by role instead.

## Still outstanding

- **No moderator account exists.** Sign up through `/admin/signup`, then promote the
  profile. Until then `/admin/login` works but has nothing to log into:

  ```sql
  update public.profiles set role = 'admin' where id = (
    select id from auth.users where email = 'you@school.org'
  );
  ```

  Run it in the hosted project's Dashboard → SQL Editor. Do not promote by
  inserting into `auth.users` by hand.
- **Rotate the database password.** It was shared in a chat transcript while
  deploying, so treat it as exposed. Settings → Database in the hosted dashboard.
- **No browser-rendered check.** Everything above exercises the data layer. The
  React components have been verified by `npm run build` and by reading, not by
  driving a real browser, so layout and interaction are unproven.
- **Students cannot edit a pending note in the UI.** `updatePostContent` and the
  guard trigger permit it while a note is pending, but there is no student `UPDATE`
  policy on `posts` and no editor surface. Treat it as unavailable until both exist.
- `npm run build` reports one chunk-size warning (the JS bundle exceeds 500 kB).
  It is a warning only, not an error.