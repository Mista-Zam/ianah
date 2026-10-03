/**
 * End-to-end security/behaviour test against the LOCAL Supabase stack.
 *
 * Every assertion goes through PostgREST/GoTrue exactly as the browser would, so
 * it exercises real RLS, real triggers and real JWTs -- not a simulation.
 *
 * Enum labels, RPC output keys and column names below were read off the live
 * schema rather than assumed.
 */
const API = "http://127.0.0.1:54321";
const ANON_KEY = process.env.SB_ANON_KEY ?? "";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token ?? ANON_KEY}`,
      "Content-Type": "application/json",
      // PostgREST only returns rows for writes when this is set. The supabase-js
      // client adds it automatically when you chain .select(); raw fetch does not.
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data, raw: text };
}

// 404 counts as denied: it is how PostgREST reports "this function does not exist".
const denied = (s) => [400, 401, 403, 404, 409].includes(s);

async function signUp(email, password, displayName) {
  const r = await req("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: { display_name: displayName } },
  });
  if (!r.data?.access_token) throw new Error(`signup failed: ${r.raw}`);
  return r.data;
}

async function signIn(email, password) {
  const r = await req("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  if (!r.data?.access_token) throw new Error(`signin failed: ${r.raw}`);
  return r.data;
}

const now = Date.now();
const PASSWORD = "Test-Passw0rd!";

// Enum values, verbatim from pg_enum.
const REASON = "Spam";

console.log("\n=== SETUP ===");
const student = await signUp(`student.${now}@test.local`, PASSWORD, "Test Student");
const other = await signUp(`other.${now}@test.local`, PASSWORD, "Other Student");
const admin = await signIn("admin@kindnesswall.test", "demo-password-123");
const sT = student.access_token;
const oT = other.access_token;
const aT = admin.access_token;
console.log("  2 students signed up, seeded admin signed in");

// ---------------------------------------------------------------- profiles ---
console.log("\n=== profiles: bootstrap + role immutability ===");
const me = await req("/rest/v1/profiles?select=id,role,display_name", { token: sT });
check("signup trigger created a profile with role=student",
  me.status === 200 && me.data?.[0]?.role === "student", `status=${me.status}`);
check("display_name from metadata stored", me.data?.[0]?.display_name === "Test Student");
check("profile id === auth.uid()", me.data?.[0]?.id === student.user.id);

await req("/rest/v1/profiles?id=eq." + student.user.id, {
  method: "PATCH", token: sT, body: { role: "admin" },
});
const after = await req("/rest/v1/profiles?select=role", { token: sT });
check("student cannot self-promote to admin", after.data?.[0]?.role === "student",
  `role is now ${after.data?.[0]?.role}`);

const renamed = await req("/rest/v1/profiles?id=eq." + student.user.id + "&select=display_name", {
  method: "PATCH", token: sT, body: { display_name: "Renamed" },
});
check("student CAN update own display_name",
  renamed.data?.[0]?.display_name === "Renamed", JSON.stringify(renamed.data));

// ------------------------------------------------------------------- posts ---
console.log("\n=== posts: the only write path is submit_note ===");

// Anon has no INSERT privilege on the table at all.
const anonDirect = await req("/rest/v1/posts", {
  method: "POST",
  body: { content: "anon direct insert", note_color: "yellow" },
});
check("anon cannot insert into posts directly", denied(anonDirect.status), `status=${anonDirect.status}`);

// A leftover account has a session but no business writing rows either.
const stDirect = await req("/rest/v1/posts", {
  method: "POST", token: sT,
  body: { content: "student direct insert", note_color: "yellow" },
});
check("an authenticated non-moderator cannot insert into posts directly",
  denied(stDirect.status), `status=${stDirect.status}`);

// The RPC is the whole public surface. It takes no status, no author_id and no
// anonymity flag, so those cannot be tampered with -- there is nowhere to put them.
const hostileArgs = await req("/rest/v1/rpc/submit_note", {
  method: "POST",
  body: {
    p_content: "RPC with extra arguments trying to publish and claim authorship.",
    p_note_color: "yellow",
    p_is_anonymous: false,
    p_status: "published",
    p_author_id: admin.user.id,
  },
});
// PostgREST resolves a function call by exact argument list, so extra keys do not
// get quietly dropped -- the call fails to match any overload and 404s. The
// tampering is refused at the routing layer, before the function is ever entered.
check("submit_note refuses a call carrying status/author_id/anonymity flags",
  denied(hostileArgs.status), `status=${hostileArgs.status} ${hostileArgs.raw.slice(0, 130)}`);

const created = await req("/rest/v1/rpc/submit_note", {
  method: "POST",
  body: {
    p_content: "A kind note submitted with no account at all.",
    p_recipient: "Ms Okafor",
    p_note_color: "yellow",
  },
});
check("anon can submit a note via submit_note",
  typeof created.data === "string", `status=${created.status} ${created.raw.slice(0, 110)}`);

const id = created.data;
check("submit_note returns a bare uuid", /^[0-9a-f-]{36}$/i.test(String(id)), String(id));

// Nothing identifying comes back, and nothing identifying was stored.
const hiddenPending = await req(`/rest/v1/posts?id=eq.${id}&select=status,author_id,is_anonymous,recipient`, { token: aT });
check("the new note is pending, not published",
  hiddenPending.data?.[0]?.status === "pending", JSON.stringify(hiddenPending.data));
check("author_id is NULL -- the anonymous write path stores no identity",
  hiddenPending.data?.[0]?.author_id === null, JSON.stringify(hiddenPending.data));
check("is_anonymous is true", hiddenPending.data?.[0]?.is_anonymous === true);
check("the recipient is stored verbatim",
  hiddenPending.data?.[0]?.recipient === "Ms Okafor", JSON.stringify(hiddenPending.data));

// A blank recipient must land as NULL, not "".
const blankRecipient = await req("/rest/v1/rpc/submit_note", {
  method: "POST", body: { p_content: "A note addressed to nobody in particular.", p_recipient: "   " },
});
const blankRow = await req(`/rest/v1/posts?id=eq.${blankRecipient.data}&select=recipient`, { token: aT });
check("a whitespace-only recipient is normalised to NULL",
  blankRow.data?.[0]?.recipient === null, JSON.stringify(blankRow.data));

const longRecipient = await req("/rest/v1/rpc/submit_note", {
  method: "POST", body: { p_content: "A note with an absurdly long recipient.", p_recipient: "x".repeat(61) },
});
check("a recipient over 60 chars is rejected at the database",
  denied(longRecipient.status), `status=${longRecipient.status}`);

const notYetPublic = await req(`/rest/v1/public_posts?id=eq.${id}&select=id`);
check("a pending note is NOT on the public wall", notYetPublic.status === 200 && notYetPublic.data.length === 0);

const tooLong = await req("/rest/v1/rpc/submit_note", {
  method: "POST", body: { p_content: "x".repeat(601), p_note_color: "yellow" },
});
check("note over 600 chars is rejected", denied(tooLong.status), `status=${tooLong.status}`);

const blankNote = await req("/rest/v1/rpc/submit_note", {
  method: "POST", body: { p_content: "x", p_note_color: "yellow" },
});
check("1-char note is valid (min length is 1)", typeof blankNote.data === "string",
  `status=${blankNote.status} ${blankNote.raw.slice(0, 90)}`);

// ------------------------------------------------------------ RLS: reading ---
console.log("\n=== RLS: who can read what ===");
const stPublished = await req("/rest/v1/posts?status=eq.published&select=id,author_id", { token: sT });
check("non-moderator sees ZERO published base-table rows (author_id leak)",
  stPublished.status === 200 && stPublished.data.length === 0,
  `${stPublished.data?.length} rows`);

const stLogs = await req("/rest/v1/moderation_logs?select=id", { token: sT });
check("non-moderator cannot read the audit log",
  stLogs.status === 200 && stLogs.data.length === 0, `${stLogs.data?.length} rows`);

const stReports = await req("/rest/v1/reports?select=id", { token: oT });
check("non-moderator cannot read any reports",
  stReports.status === 200 && stReports.data.length === 0, `${stReports.data?.length} rows`);

// ------------------------------------------------------------ public view ---
console.log("\n=== public view: anonymity boundary ===");
const pv = await req("/rest/v1/public_posts?select=*&limit=50");
check("anon can read public_posts", pv.status === 200, `status=${pv.status}`);
check("public_posts returns rows", Array.isArray(pv.data) && pv.data.length > 0, `${pv.data?.length}`);
const keys = Object.keys(pv.data?.[0] ?? {});
check("public_posts has NO author_id column", !keys.includes("author_id"), keys.join(","));
check("public_posts exposes no rejection/review metadata",
  !keys.some((k) => k.includes("reject") || k.includes("review")), keys.join(","));
check("public_posts exposes the recipient", keys.includes("recipient"), keys.join(","));
check("public_posts has NO category column (dropped in 0010)",
  !keys.includes("category"), keys.join(","));

const anonPosts = await req("/rest/v1/posts?select=author_id&status=eq.published");
check("anon CANNOT read posts.author_id (no table grant)", denied(anonPosts.status), `status=${anonPosts.status}`);
const anonProfiles = await req("/rest/v1/profiles?select=id");
check("anon CANNOT read the profiles table", denied(anonProfiles.status), `status=${anonProfiles.status}`);
const anonLogs = await req("/rest/v1/moderation_logs?select=id");
check("anon CANNOT read moderation_logs", denied(anonLogs.status), `status=${anonLogs.status}`);

// --------------------------------------------------- role-enumeration fix ---
console.log("\n=== hardening: role-enumeration oracle ===");
const probe = await req("/rest/v1/rpc/is_admin", { method: "POST", body: { check_user_id: admin.user.id } });
check("parameterised is_admin(uuid) is gone", denied(probe.status), `status=${probe.status}`);
const noArg = await req("/rest/v1/rpc/is_admin", { method: "POST", body: {} });
check("anon cannot execute is_admin() at all", denied(noArg.status), `status=${noArg.status}`);
const asStudent = await req("/rest/v1/rpc/is_admin", { method: "POST", token: sT, body: {} });
check("authenticated CAN call is_admin() for their own role", asStudent.status === 200,
  `status=${asStudent.status}`);

// ------------------------------------------------------------------- stats ---
console.log("\n=== stats RPCs (real output keys) ===");
const community = await req("/rest/v1/rpc/community_stats", { method: "POST", body: {} });
check("anon can call community_stats",
  community.status === 200 && typeof community.data?.[0]?.published === "number",
  `${community.status} ${community.raw.slice(0, 110)}`);

const dashAnon = await req("/rest/v1/rpc/admin_dashboard_stats", { method: "POST", body: {} });
check("anon cannot call admin_dashboard_stats", denied(dashAnon.status), `status=${dashAnon.status}`);
const dashStudent = await req("/rest/v1/rpc/admin_dashboard_stats", { method: "POST", token: sT, body: {} });
check("student cannot call admin_dashboard_stats", denied(dashStudent.status), `status=${dashStudent.status}`);
const dashAdmin = await req("/rest/v1/rpc/admin_dashboard_stats", { method: "POST", token: aT, body: {} });
check("admin CAN call admin_dashboard_stats",
  dashAdmin.status === 200 && typeof dashAdmin.data?.[0]?.pending === "number",
  `${dashAdmin.status} ${dashAdmin.raw.slice(0, 110)}`);

// ------------------------------------------------- moderator provisioning ---
// admin_create_moderator is the one RPC that can mint an account with full
// privileges, so its guard is the single most security-relevant assertion in this
// file. It must hold for anon and for students, and the account it creates must
// genuinely work.
console.log("\n=== moderator provisioning: guards ===");
const modEmail = `mod.${now}@school.org`;
const modPw = "Provisioned-Pass9";

const anonCreate = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", body: { p_email: modEmail, p_password: modPw },
});
check("anon cannot create a moderator", denied(anonCreate.status), `status=${anonCreate.status}`);

const anonList = await req("/rest/v1/rpc/admin_list_moderators", { method: "POST", body: {} });
check("anon cannot list moderators", denied(anonList.status), `status=${anonList.status}`);

const stCreate = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", token: sT, body: { p_email: `x.${now}@school.org`, p_password: modPw },
});
check("student cannot create a moderator", denied(stCreate.status), `status=${stCreate.status}`);
check("the refusal is 42501 insufficient_privilege", stCreate.raw.includes("42501"),
  stCreate.raw.slice(0, 110));

const stList = await req("/rest/v1/rpc/admin_list_moderators", { method: "POST", token: sT, body: {} });
check("student cannot list moderators", denied(stList.status), `status=${stList.status}`);

const stStillStudent = await req(`/rest/v1/profiles?select=role&id=eq.${student.user.id}`, { token: sT });
check("the student is still a student after trying", stStillStudent.data?.[0]?.role === "student",
  `role=${stStillStudent.data?.[0]?.role}`);

console.log("\n=== moderator provisioning: validation ===");
const shortPw = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", token: aT, body: { p_email: `y.${now}@school.org`, p_password: "short" },
});
check("a password under 10 characters is refused", denied(shortPw.status), `status=${shortPw.status}`);

const badEmail = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", token: aT, body: { p_email: "not-an-email", p_password: modPw },
});
check("a malformed email is refused", denied(badEmail.status), `status=${badEmail.status}`);

const demoDomain = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", token: aT, body: { p_email: `z.${now}@kindnesswall.test`, p_password: modPw },
});
check("the reserved demo domain is refused", denied(demoDomain.status), `status=${demoDomain.status}`);

console.log("\n=== moderator provisioning: the happy path ===");
const madeMod = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", token: aT, body: { p_email: modEmail, p_password: modPw, p_display_name: "New Moderator" },
});
check("admin_create_moderator returns a uuid",
  madeMod.status === 200 && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(String(madeMod.data)),
  `${madeMod.status} ${madeMod.raw.slice(0, 110)}`);

const dupe = await req("/rest/v1/rpc/admin_create_moderator", {
  method: "POST", token: aT, body: { p_email: modEmail, p_password: modPw },
});
check("a duplicate email is refused", denied(dupe.status) && dupe.raw.includes("23505"),
  dupe.raw.slice(0, 110));

const newMod = await signIn(modEmail, modPw);
check("the new moderator can sign in with no email confirmation step",
  Boolean(newMod?.access_token), "sign-in failed");
const mT = newMod?.access_token;

const newModProfile = await req(`/rest/v1/profiles?select=role,display_name&id=eq.${newMod?.user?.id}`,
  { token: mT });
check("the new account really holds role=admin", newModProfile.data?.[0]?.role === "admin",
  `role=${newModProfile.data?.[0]?.role}`);
check("the display name was stored", newModProfile.data?.[0]?.display_name === "New Moderator",
  `name=${newModProfile.data?.[0]?.display_name}`);

const modList = await req("/rest/v1/rpc/admin_list_moderators", { method: "POST", token: mT, body: {} });
check("the new moderator can list moderators",
  modList.status === 200 && Array.isArray(modList.data) && modList.data.length >= 2,
  `${modList.status} n=${modList.data?.length}`);
check("the list includes the new account's email",
  Array.isArray(modList.data) && modList.data.some((m) => m.email === modEmail), "not in list");

const modDash = await req("/rest/v1/rpc/admin_dashboard_stats", { method: "POST", token: mT, body: {} });
check("the new moderator has real console privileges",
  modDash.status === 200 && typeof modDash.data?.[0]?.pending === "number",
  `${modDash.status} ${modDash.raw.slice(0, 110)}`);

// -------------------------------------------------------------- moderation ---
console.log("\n=== moderation + audit trail ===");

const stPublish = await req(`/rest/v1/posts?id=eq.${id}&select=status`, {
  method: "PATCH", token: sT, body: { status: "published" },
});
const stillPending = await req(`/rest/v1/posts?id=eq.${id}&select=status`, { token: aT });
// PostgREST does NOT error when RLS filters every row out of a write -- it returns
// 200 with an empty result set. So the status code proves nothing here; the
// invariant that matters is that the row's state is unchanged.
check("student CANNOT publish their own note (row unchanged)",
  stillPending.data?.[0]?.status === "pending",
  `http=${stPublish.status} status=${stillPending.data?.[0]?.status} rows=${stPublish.data?.length}`);
check("RLS-filtered student write matched 0 rows",
  stPublish.status === 200 && (stPublish.data?.length ?? 0) === 0,
  `http=${stPublish.status} rows=${stPublish.data?.length}`);

const approve = await req(`/rest/v1/posts?id=eq.${id}`, {
  method: "PATCH", token: aT, body: { status: "published" },
});
check("admin approve succeeds", approve.status === 200, approve.raw.slice(0, 120));

const logs = await req(
  `/rest/v1/moderation_logs?post_id=eq.${id}&select=action,previous_status,new_status,moderator_id`,
  { token: aT },
);
check("audit log written with previous_status -> new_status by the admin",
  logs.data?.length === 1 &&
    logs.data[0].previous_status === "pending" &&
    logs.data[0].new_status === "published" &&
    logs.data[0].moderator_id === admin.user.id,
  JSON.stringify(logs.data));

const visible = await req(`/rest/v1/public_posts?id=eq.${id}&select=id,content`);
check("approved note is now publicly visible",
  visible.status === 200 && visible.data.length === 1, `${visible.status}`);

const badReject = await req(`/rest/v1/posts?id=eq.${id}`, {
  method: "PATCH", token: aT, body: { status: "rejected" },
});
check("reject without a reason is blocked", denied(badReject.status), `status=${badReject.status}`);

const removal = await req(`/rest/v1/posts?id=eq.${id}`, {
  method: "PATCH", token: aT, body: { status: "removed" },
});
check("admin can remove", removal.status === 200, removal.raw.slice(0, 100));
const goneFromWall = await req(`/rest/v1/public_posts?id=eq.${id}&select=id`);
check("removed note disappears from the public wall", goneFromWall.data.length === 0);
const restore = await req(`/rest/v1/posts?id=eq.${id}`, {
  method: "PATCH", token: aT, body: { status: "published" },
});
check("admin can restore", restore.status === 200, restore.raw.slice(0, 100));

// ---------------------------------------------------------------- reports ---
console.log("\n=== reporting: submit_report is the only path ===");

// Reporting is account-free, so it goes through the RPC. A direct table insert
// from anyone who is not a moderator is closed.
const anonReportDirect = await req("/rest/v1/reports", {
  method: "POST", body: { post_id: id, reason: REASON, details: "anon direct" },
});
check("anon cannot insert into reports directly",
  denied(anonReportDirect.status), `status=${anonReportDirect.status}`);

const stReportDirect = await req("/rest/v1/reports", {
  method: "POST", token: sT, body: { post_id: id, reason: REASON, details: "student direct" },
});
check("a non-moderator cannot insert into reports directly",
  denied(stReportDirect.status), `status=${stReportDirect.status}`);

const r1 = await req("/rest/v1/rpc/submit_report", {
  method: "POST", body: { p_post_id: id, p_reason: REASON, p_details: "test report" },
});
check("anon can report a published note via submit_report",
  typeof r1.data === "string", `status=${r1.status} ${r1.raw.slice(0, 110)}`);

// One report per note for everyone anonymous. reporter_id is NULL for every
// anonymous caller, so the old unique(reporter_id, post_id) cannot dedupe -- the
// partial index on (post_id) where reporter_id is null does.
const r2 = await req("/rest/v1/rpc/submit_report", {
  method: "POST", body: { p_post_id: id, p_reason: REASON },
});
check("a second anonymous report on the same note is rejected",
  denied(r2.status), `status=${r2.status}`);

const notPublished = await req("/rest/v1/rpc/submit_report", {
  method: "POST", body: { p_post_id: blankNote.data, p_reason: REASON },
});
check("reporting an unpublished note is rejected",
  denied(notPublished.status), `status=${notPublished.status}`);

const hidden = await req(`/rest/v1/reports?post_id=eq.${id}&select=reporter_id`, { token: oT });
check("a non-moderator cannot see the reporter identity",
  hidden.status === 200 && hidden.data.length === 0, `${hidden.data?.length} rows`);

const asAdmin = await req(`/rest/v1/reports?post_id=eq.${id}&select=id,status,reporter_id`, { token: aT });
check("admin can read the report queue", asAdmin.status === 200 && asAdmin.data.length === 1,
  `${asAdmin.status} ${asAdmin.data?.length} rows`);
check("the anonymous report stores reporter_id as NULL",
  asAdmin.data?.[0]?.reporter_id === null, JSON.stringify(asAdmin.data));

const reportId = asAdmin.data?.[0]?.id;

const stResolve = await req(`/rest/v1/reports?id=eq.${reportId}&select=status`, {
  method: "PATCH", token: oT, body: { status: "dismissed" },
});
const reportUnchanged = await req(`/rest/v1/reports?id=eq.${reportId}&select=status`, { token: aT });
check("a non-moderator CANNOT resolve a report (row unchanged)",
  reportUnchanged.data?.[0]?.status === "pending",
  `http=${stResolve.status} status=${reportUnchanged.data?.[0]?.status} rows=${stResolve.data?.length}`);

const adResolve = await req(`/rest/v1/reports?id=eq.${reportId}`, {
  method: "PATCH", token: aT, body: { status: "dismissed" },
});
check("admin can resolve a report", adResolve.status === 200, adResolve.raw.slice(0, 120));

// ---------------------------------------------------------------- summary ---
console.log(`\n${"=".repeat(54)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\n  Failures:");
  for (const f of failures) console.log(`   - ${f}`);
}
console.log(`${"=".repeat(54)}\n`);
process.exit(fail === 0 ? 0 : 1);