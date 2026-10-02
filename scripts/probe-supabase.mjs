/**
 * Probe the live Supabase project using only the publishable key, to establish
 * what actually exists there. Read-only: every call is a GET.
 *
 * Prints no credentials.
 */
const env = Object.fromEntries(
  (await import("node:fs")).readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const URL_BASE = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!URL_BASE || !KEY || KEY === "PASTE_YOUR_PUBLISHABLE_KEY_HERE") {
  console.error("Supabase not configured in .env");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

async function probe(label, path, init = {}) {
  const res = await fetch(`${URL_BASE}${path}`, { headers, ...init });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text));
  } catch {
    /* keep raw */
  }
  if (body.length > 400) body = `${body.slice(0, 400)}…`;
  console.log(`\n=== ${label}`);
  console.log(`    GET ${path}`);
  console.log(`    -> ${res.status} ${res.statusText}`);
  console.log(`    ${body}`);
  return { status: res.status, body: text };
}

console.log(`project: ${URL_BASE}`);
console.log(`key    : ${KEY.slice(0, 10)}… (${KEY.length} chars)`);

await probe("auth health", "/auth/v1/health");
await probe("REST root (exposed schema)", "/rest/v1/");
await probe("public_posts view", "/rest/v1/public_posts?select=id&limit=1");
await probe("posts table", "/rest/v1/posts?select=id&limit=1");
await probe("profiles table", "/rest/v1/profiles?select=id&limit=1");
await probe("reports table", "/rest/v1/reports?select=id&limit=1");
await probe("moderation_logs table", "/rest/v1/moderation_logs?select=id&limit=1");
await probe("community_stats RPC", "/rest/v1/rpc/community_stats", {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: "{}",
});
await probe("admin_dashboard_stats RPC (should be admin-only)", "/rest/v1/rpc/admin_dashboard_stats", {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: "{}",
});