/**
 * Integration test of the REAL application data layer.
 *
 * The modules under src/ are loaded through Vite's SSR transform, so this
 * exercises the exact code the browser runs -- import.meta.env included -- rather
 * than a re-implementation of it against raw fetch.
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

const PASSWORD = "Test-Passw0rd!";
const now = Date.now();

console.log("\n=== mapper: category translation round-trip ===");
const dbLabels = ["Classroom", "School Life", "Honest Thoughts", "Wins", "Advice", "Thank You", "Funny", "Motivation", "Random"];
const uiSlugs = dbLabels.map((l) => mappers.fromDbCategory(l));
check("every DB category label maps to a UI slug", uiSlugs.every(Boolean), uiSlugs.join(","));
check(
  "every UI slug maps back to its DB label",
  uiSlugs.every((s) => dbLabels.includes(mappers.toDbCategory(s))),
  uiSlugs.map((s) => mappers.toDbCategory(s)).join(","),
);
check("mappers cover all 9 DB enum values", new Set(uiSlugs).size === 9, `${new Set(uiSlugs).size} distinct`);

console.log("\n=== anonymous public read ===");
const wall = await db.posts.fetchPublicPosts();
check("fetchPublicPosts returns an array", Array.isArray(wall), `${wall?.length}`);
check("public wall is non-empty (seed data visible)", wall.length > 0, `${wall.length} notes`);
check(
  "no mapped note carries authorId/author_id",
  wall.every((p) => !("authorId" in p) && !("author_id" in p)),
  Object.keys(wall[0] ?? {}).join(","),
);
check(
  "every note maps to a known UI category slug",
  wall.every((p) => constants.POST_CATEGORIES.some((c) => c.id === p.category)),
  [...new Set(wall.map((p) => p.category))].join(","),
);
check(
  "every note maps to a real palette colour",
  wall.every((p) => constants.NOTE_COLORS.some((c) => c.id === p.color)),
  [...new Set(wall.map((p) => p.color))].join(","),
);
check("anonymous notes expose no displayName", wall.filter((p) => p.anonymous).every((p) => p.displayName === null));

console.log("\n=== community stats (anon) ===");
const stats = await db.stats.fetchCommunityStats();
check("communityStats returns 4 counters", stats.length === 4, `${stats.length}`);
check("counter values are non-empty strings", stats.every((s) => typeof s.value === "string" && s.value.length > 0), JSON.stringify(stats.map((s) => s.value)));

console.log("\n=== student session through the app's own auth module ===");
const student = await db.auth.signUpWithPassword({
  email: `int.${now}@test.local`,
  password: PASSWORD,
  displayName: "Integration Student",
});
check("signUpWithPassword returns a session", Boolean(student?.session?.access_token ?? student?.access_token), Object.keys(student ?? {}).join(","));
// Explicit-id path.
const profile = await db.auth.getCurrentProfile(student.user.id);
check("getCurrentProfile resolves role=student", profile?.role === "student", `role=${profile?.role}`);

console.log("\n=== submit a note through the app's insertPost ===");
const created = await db.posts.insertPost({
  content: "Submitted through the real insertPost() module during integration testing.",
  category: "appreciation",
  color: "lavender",
  anonymous: true,
});
check("insertPost returns the created post", Boolean(created?.id), JSON.stringify(created)?.slice(0, 120));
check("insertPost result is status=pending (DB forced it)", created?.status === "pending", `status=${created?.status}`);
check("insertPost maps the DB label back to the UI slug", created?.category === "appreciation", `category=${created?.category}`);

console.log("\n=== the assertRowsChanged fix, through the real module ===");
let threw = null;
try {
  // Student calling a moderation action. RLS filters every row, so PostgREST
  // returns 200 with zero rows and NO error -- setPostStatus must still throw.
  await db.posts.setPostStatus(created.id, "published");
} catch (err) {
  threw = err;
}
check("student setPostStatus throws instead of silently 'succeeding'", Boolean(threw), threw ? "" : "no error raised");
check("the thrown message is a permission message", /permission/i.test(threw?.message ?? ""), threw?.message);

const adminSession = await db.auth.signInWithPassword("admin@kindnesswall.test", "demo-password-123");
const adminToken = adminSession?.session?.access_token ?? adminSession?.access_token;
check("seeded admin can sign in through the app's auth module", Boolean(adminToken));

console.log("\n=== admin console reads ===");
// No argument: exercises the session-derived path. This is the call the store makes
// on sign-in, and the one that used to fail with PGRST116 for any admin.
const adminProfile = await db.auth.getCurrentProfile();
check("admin profile resolves role=admin (session-derived)", adminProfile?.role === "admin", `role=${adminProfile?.role}`);
check("admin isAdmin gate is now reachable", adminProfile?.role === "admin");

const dashboard = await db.stats.fetchDashboardStats();
check("fetchDashboardStats is live", dashboard.live === true, JSON.stringify(dashboard));
check("dashboard counts the new pending note", dashboard.pending >= 1, `pending=${dashboard.pending}`);

const modPosts = await db.posts.fetchPostsForModeration();
check("fetchPostsForModeration returns posts", Array.isArray(modPosts) && modPosts.length > 0, `${modPosts?.length}`);
check("moderation view includes the pending note", modPosts.some((p) => p.id === created.id));

const logs = await db.moderation.fetchModerationLogs();
check("fetchModerationLogs returns rows", Array.isArray(logs) && logs.length > 0, `${logs?.length}`);
check("log rows are mapped to readable verbs", logs.every((l) => typeof l.action === "string"), JSON.stringify(logs[0]));

console.log("\n=== admin moderation through the app's module ===");
await db.posts.setPostStatus(created.id, "published");
const approved = (await db.posts.fetchPostsForModeration()).find((p) => p.id === created.id);
check("setPostStatus published the note", approved?.status === "published", `status=${approved?.status}`);

const wall2 = await db.posts.fetchPublicPosts();
check("the note now appears on the public wall", wall2.some((p) => p.id === created.id));

const newLogs = (await db.moderation.fetchModerationLogs()).filter((l) => l.postId === created.id);
check("an audit entry was written for the approval", newLogs.length === 1, `${newLogs.length}`);
check("audit entry maps previous -> new status",
  newLogs[0]?.from === "pending" && newLogs[0]?.to === "published",
  `${newLogs[0]?.from} -> ${newLogs[0]?.to}`);

console.log("\n=== reporting through the app's module ===");
await db.reports.insertReport(created.id, "Spam", "integration test report");
check("insertReport completed without error", true);
let dupThrew = null;
try {
  await db.reports.insertReport(created.id, "Spam");
} catch (err) {
  dupThrew = err;
}
check("duplicate report is rejected with a friendly message", Boolean(dupThrew), "no error");
check("duplicate message mentions already reported", /already reported/i.test(dupThrew?.message ?? ""), dupThrew?.message);

const queue = await db.reports.fetchReports({ status: "pending" });
check("fetchReports returns the queue with joined posts", queue.reports.length > 0, `${queue.reports.length}`);
check("report rows map state=open", queue.reports.every((r) => r.state === "open"), JSON.stringify(queue.reports.map((r) => r.state)));
check("queue reports carry their post", queue.reports.every((r) => Boolean(r.post)), "missing post");

console.log("\n=== restore + remove round trip ===");
await db.posts.setPostStatus(created.id, "removed");
check("removed note leaves the public wall",
  !(await db.posts.fetchPublicPosts()).some((p) => p.id === created.id));
await db.posts.setPostStatus(created.id, "published");
check("restore puts it back", (await db.posts.fetchPublicPosts()).some((p) => p.id === created.id));

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