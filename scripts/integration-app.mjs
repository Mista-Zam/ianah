/**
 * Integration test of the REAL application data layer.
 *
 * The modules under src/ are loaded through Vite's SSR transform, so this
 * exercises the exact code the browser runs -- import.meta.env included -- rather
 * than a re-implementation of it against raw fetch.
 *
 * Most of this file runs with NO session at all, because that is now the normal
 * way the wall is used. The admin half signs in at the end, which is the only
 * part that needs a credential.
 *
 * Point it at the local stack by exporting SB_TEST_URL / SB_TEST_ANON_KEY.
 */
import { createServer } from "vite";

const URL_ = process.env.SB_TEST_URL;
const ANON = process.env.SB_TEST_ANON_KEY;
if (!URL_ || !ANON) {
  console.error("Set SB_TEST_URL and SB_TEST_ANON_KEY");
  process.exit(1);
}
process.env.VITE_SUPABASE_URL = URL_;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = ANON;

// The app is a browser SPA and a couple of modules read window.location.origin for
// auth redirect URLs. Provide just enough of it to import them under Node.
globalThis.window ??= {
  location: { origin: "http://localhost:5173", href: "http://localhost:5173/" },
};

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

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const db = {
  auth: await vite.ssrLoadModule("/src/lib/db/auth.js"),
  posts: await vite.ssrLoadModule("/src/lib/db/posts.js"),
  reports: await vite.ssrLoadModule("/src/lib/db/reports.js"),
  moderation: await vite.ssrLoadModule("/src/lib/db/moderation.js"),
  stats: await vite.ssrLoadModule("/src/lib/db/stats.js"),
};
const mappers = await vite.ssrLoadModule("/src/lib/mappers.js");
const constants = await vite.ssrLoadModule("/src/lib/constants.js");

// --------------------------------------------------------------- mappers ---
console.log("\n=== mapper: recipient, and the category maps that no longer exist ===");
const row = {
  content: "hello",
  recipient: "  Ms Okafor  ",
  note_color: "lavender",
  is_anonymous: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const withName = mappers.mapPublicPost({ id: "00000000-0000-4000-8000-000000000001", ...row });
check("recipient is trimmed on the way in", withName.recipient === "Ms Okafor", String(withName.recipient));
check("no category field survives in the mapped shape",
  !("category" in withName) && !("categoryLabel" in withName), Object.keys(withName).join(","));

const blank = mappers.mapPublicPost({
  id: "00000000-0000-4000-8000-000000000002", ...row, recipient: null,
});
check("a null recipient maps to null, not an empty string", blank.recipient === null, JSON.stringify(blank.recipient));

const whitespace = mappers.mapPublicPost({
  id: "00000000-0000-4000-8000-000000000003", ...row, recipient: "   ",
});
check("a whitespace-only recipient maps to null", whitespace.recipient === null, JSON.stringify(whitespace.recipient));

console.log("\n=== constants: categories are gone, recipient bound is present ===");
check("CATEGORIES is no longer exported", constants.CATEGORIES === undefined);
check("POST_CATEGORIES is no longer exported", constants.POST_CATEGORIES === undefined);
check("CATEGORY_LABEL is no longer exported", constants.CATEGORY_LABEL === undefined);
check("MAX_RECIPIENT_LENGTH is 60", constants.MAX_RECIPIENT_LENGTH === 60, String(constants.MAX_RECIPIENT_LENGTH));

// ----------------------------------------------------- anonymous public read ---
console.log("\n=== anonymous public read, with no session at all ===");
const wall = await db.posts.fetchPublicPosts();
check("fetchPublicPosts returns an array", Array.isArray(wall), `${wall?.length}`);
check("public wall is non-empty (seed data visible)", wall.length > 0, `${wall.length} notes`);
check(
  "no mapped note carries authorId/author_id",
  wall.every((p) => !("authorId" in p) && !("author_id" in p)),
  Object.keys(wall[0] ?? {}).join(","),
);
check(
  "no mapped note carries a category",
  wall.every((p) => !("category" in p) && !("categoryLabel" in p)),
  Object.keys(wall[0] ?? {}).join(","),
);
check(
  "seeded recipients survive the round trip",
  wall.some((p) => p.recipient === "Ms Okafor"),
  [...new Set(wall.map((p) => p.recipient))].join(","),
);
check(
  "every note maps to a real palette colour",
  wall.every((p) => constants.NOTE_COLORS.some((c) => c.id === p.color)),
  [...new Set(wall.map((p) => p.color))].join(","),
);
check("anonymous notes expose no displayName",
  wall.filter((p) => p.anonymous).every((p) => p.displayName === null));

// Search has to reach the recipient, not just the note text -- that is what the
// category chips used to be for.
const byRecipient = await db.posts.fetchPublicPosts({ search: "Okafor" });
check("searching a recipient name finds their notes",
  byRecipient.length > 0 && byRecipient.length < wall.length,
  `${byRecipient.length} of ${wall.length}`);
check("every search hit actually mentions the term",
  byRecipient.every((p) =>
    p.content.toLowerCase().includes("okafor") || (p.recipient ?? "").toLowerCase().includes("okafor")),
  byRecipient.map((p) => p.recipient).join(","));

// -------------------------------------------------------------- anon stats ---
console.log("\n=== community stats (anon) ===");
const stats = await db.stats.fetchCommunityStats();
check("communityStats returns 4 counters", stats.length === 4, `${stats.length}`);
check("counter values are non-empty strings",
  stats.every((s) => typeof s.value === "string" && s.value.length > 0),
  JSON.stringify(stats.map((s) => s.value)));

// ------------------------------------------------------ account-free submit ---
console.log("\n=== submit a note with no account ===");
const createdId = await db.posts.insertPost({
  content: "Submitted through the real insertPost() module during integration testing.",
  recipient: "  Ms Lindqvist  ",
  color: "lavender",
});
check("insertPost returns a bare uuid string",
  typeof createdId === "string" && /^[0-9a-f-]{36}$/i.test(createdId),
  JSON.stringify(createdId)?.slice(0, 120));

const stillQueued = await db.posts.fetchPublicPosts();
check("the new note is not on the public wall yet",
  !stillQueued.some((p) => p.id === createdId), "already visible");

let blankThrew = null;
try {
  await db.posts.insertPost({ content: "", color: "yellow" });
} catch (err) {
  blankThrew = err;
}
check("an empty note is rejected", Boolean(blankThrew), "no error raised");

// --------------------------------------------------------- anon reporting ---
console.log("\n=== report a published note with no account ===");
const publishedId = wall[0]?.id;
await db.reports.insertReport(publishedId, "Spam", "integration test report");
check("insertReport completed without error", true);

let dupThrew = null;
try {
  await db.reports.insertReport(publishedId, "Spam");
} catch (err) {
  dupThrew = err;
}
check("a second anonymous report on the same note is rejected", Boolean(dupThrew), "no error");
check("duplicate message mentions already reported",
  /already reported/i.test(dupThrew?.message ?? ""), dupThrew?.message);

// ---------------------------------------------- moderation needs a moderator ---
console.log("\n=== moderation is refused without a moderator session ===");
let threw = null;
try {
  // RLS filters every row, so PostgREST returns 200 with zero rows and NO error --
  // setPostStatus must still throw rather than silently report success.
  await db.posts.setPostStatus(createdId, "published");
} catch (err) {
  threw = err;
}
check("setPostStatus without a moderator session throws", Boolean(threw), threw ? "" : "no error raised");
check("the thrown message is a permission message",
  /permission|row-level|row level/i.test(threw?.message ?? ""), threw?.message);

// ------------------------------------------------------------------- admin ---
console.log("\n=== admin sign-in ===");
const adminSession = await db.auth.signInWithPassword("admin@kindnesswall.test", "demo-password-123");
const adminToken = adminSession?.session?.access_token ?? adminSession?.access_token;
check("seeded admin can sign in through the app's auth module", Boolean(adminToken));

console.log("\n=== admin console reads ===");
// No argument: exercises the session-derived path. This is the call the store makes
// on sign-in, and the one that used to fail with PGRST116 for any admin.
const adminProfile = await db.auth.getCurrentProfile();
check("admin profile resolves role=admin (session-derived)",
  adminProfile?.role === "admin", `role=${adminProfile?.role}`);
check("admin isAdmin gate is now reachable", adminProfile?.role === "admin");

const dashboard = await db.stats.fetchDashboardStats();
check("fetchDashboardStats is live", dashboard.live === true, JSON.stringify(dashboard));
check("dashboard counts the new pending note", dashboard.pending >= 1, `pending=${dashboard.pending}`);

const modPosts = await db.posts.fetchPostsForModeration();
check("fetchPostsForModeration returns posts",
  Array.isArray(modPosts) && modPosts.length > 0, `${modPosts?.length}`);
check("moderation view includes the pending note", modPosts.some((p) => p.id === createdId));
check("moderation view carries the recipient",
  modPosts.some((p) => p.recipient === "Ms Lindqvist"),
  [...new Set(modPosts.map((p) => p.recipient))].join(","));
check("moderation view has no category field",
  modPosts.every((p) => !("category" in p)), Object.keys(modPosts[0] ?? {}).join(","));

const logs = await db.moderation.fetchModerationLogs();
check("fetchModerationLogs returns rows", Array.isArray(logs) && logs.length > 0, `${logs?.length}`);
check("log rows are mapped to readable verbs",
  logs.every((l) => typeof l.action === "string"), JSON.stringify(logs[0]));

console.log("\n=== admin moderation through the app's module ===");
await db.posts.setPostStatus(createdId, "published");
const approved = (await db.posts.fetchPostsForModeration()).find((p) => p.id === createdId);
check("setPostStatus published the note", approved?.status === "published", `status=${approved?.status}`);

const wall2 = await db.posts.fetchPublicPosts();
check("the note now appears on the public wall", wall2.some((p) => p.id === createdId));
check("the published note carries its recipient through to the wall",
  wall2.find((p) => p.id === createdId)?.recipient === "Ms Lindqvist");

const newLogs = (await db.moderation.fetchModerationLogs()).filter((l) => l.postId === createdId);
check("an audit entry was written for the approval", newLogs.length === 1, `${newLogs.length}`);
check("audit entry maps previous -> new status",
  newLogs[0]?.from === "pending" && newLogs[0]?.to === "published",
  `${newLogs[0]?.from} -> ${newLogs[0]?.to}`);

console.log("\n=== report queue ===");
const queue = await db.reports.fetchReports({ status: "pending" });
check("fetchReports returns the queue with joined posts", queue.reports.length > 0, `${queue.reports.length}`);
check("report rows map state=open",
  queue.reports.every((r) => r.state === "open"), JSON.stringify(queue.reports.map((r) => r.state)));
check("queue reports carry their post", queue.reports.every((r) => Boolean(r.post)), "missing post");

// ------------------------------------------------------------ round trip ---
console.log("\n=== restore + remove round trip ===");
await db.posts.setPostStatus(createdId, "removed");
check("removed note leaves the public wall",
  !(await db.posts.fetchPublicPosts()).some((p) => p.id === createdId));
await db.posts.setPostStatus(createdId, "published");
check("restore puts it back", (await db.posts.fetchPublicPosts()).some((p) => p.id === createdId));

await db.auth.signOut();
await vite.close();

console.log(`\n${"=".repeat(54)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\n  Failures:");
  for (const f of failures) console.log(`   - ${f}`);
}
console.log(`${"=".repeat(54)}\n`);
process.exit(fail === 0 ? 0 : 1);