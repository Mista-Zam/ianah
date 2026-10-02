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
const CAT = "Thank You";
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
console.log("\n=== posts: students cannot self-publish or impersonate ===");
const hostile = await req("/rest/v1/posts?select=id,status,author_id", {
  method: "POST", token: sT,
  body: {
    content: "Hostile insert: claims to be published and owned by an admin.",
    category: CAT, note_color: "yellow", is_anonymous: true,
    status: "published", author_id: admin.user.id,
  },
});
check("hostile insert is forced to status=pending",
  hostile.status === 201 && hostile.data?.[0]?.status === "pending",
  `status=${hostile.status} ${hostile.raw.slice(0, 120)}`);
check("hostile author_id overwritten with auth.uid()",
  hostile.data?.[0]?.author_id === student.user.id, `got ${hostile.data?.[0]?.author_id}`);

const tooLong = await req("/rest/v1/posts", {
  method: "POST", token: sT,
  body: { content: "x".repeat(601), category: CAT, note_color: "yellow" },
});
check("note over 600 chars is rejected", denied(tooLong.status), `status=${tooLong.status}`);

// ------------------------------------------------------------ RLS: reading ---
console.log("\n=== RLS: who can read what ===");
const stPublished = await req("/rest/v1/posts?status=eq.published&select=id,author_id", { token: sT });
check("student sees ZERO published base-table rows (author_id leak)",
  stPublished.status === 200 && stPublished.data.length === 0,
  `${stPublished.data?.length} rows`);

const stAll = await req("/rest/v1/posts?select=id,author_id", { token: sT });
check("student sees only their OWN posts in the base table",
  stAll.status === 200 && stAll.data.length > 0 && stAll.data.every((p) => p.author_id === student.user.id),
  `${stAll.data?.length} rows`);

const stLogs = await req("/rest/v1/moderation_logs?select=id", { token: sT });
check("student cannot read the audit log",
  stLogs.status === 200 && stLogs.data.length === 0, `${stLogs.data?.length} rows`);

const stReports = await req("/rest/v1/reports?select=id", { token: oT });
check("student cannot read another student's reports",
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

// -------------------------------------------------------------- moderation ---
console.log("\n=== moderation + audit trail ===");
const id = hostile.data?.[0]?.id;

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
console.log("\n=== reporting ===");
const r1 = await req("/rest/v1/reports?select=id", {
  method: "POST", token: sT, body: { post_id: id, reason: REASON, details: "test report" },
});
check("student can report a published note", r1.status === 201, r1.raw.slice(0, 120));

const r2 = await req("/rest/v1/reports?select=id", {
  method: "POST", token: sT, body: { post_id: id, reason: REASON },
});
check("duplicate report from the same user is rejected", denied(r2.status), `status=${r2.status}`);

const hidden = await req(`/rest/v1/reports?post_id=eq.${id}&select=reporter_id`, { token: oT });
check("another student cannot see the reporter identity",
  hidden.status === 200 && hidden.data.length === 0, `${hidden.data?.length} rows`);

const asAdmin = await req(`/rest/v1/reports?post_id=eq.${id}&select=id,status`, { token: aT });
check("admin can read the report queue", asAdmin.status === 200 && asAdmin.data.length === 1);

const stResolve = await req(`/rest/v1/reports?id=eq.${r1.data[0].id}&select=status`, {
  method: "PATCH", token: oT, body: { status: "dismissed" },
});
const reportUnchanged = await req(`/rest/v1/reports?id=eq.${r1.data[0].id}&select=status`, { token: aT });
check("a student CANNOT resolve a report (row unchanged)",
  reportUnchanged.data?.[0]?.status === "pending",
  `http=${stResolve.status} status=${reportUnchanged.data?.[0]?.status} rows=${stResolve.data?.length}`);

const adResolve = await req(`/rest/v1/reports?id=eq.${r1.data[0].id}`, {
  method: "PATCH", token: aT, body: { status: "dismissed" },
});
check("admin can resolve a report", adResolve.status === 200, adResolve.raw.slice(0, 120));

const hiddenPost = await req("/rest/v1/posts", {
  method: "POST", token: sT, body: { content: "x", category: CAT, note_color: "yellow" },
});
check("1-char note is valid (min length is 1)", !denied(hiddenPost.status), `status=${hiddenPost.status}`);

// ---------------------------------------------------------------- summary ---
console.log(`\n${"=".repeat(54)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\n  Failures:");
  for (const f of failures) console.log(`   - ${f}`);
}
console.log(`${"=".repeat(54)}\n`);
process.exit(fail === 0 ? 0 : 1);