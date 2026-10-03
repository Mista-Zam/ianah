import { supabase, unwrap, isConfigured } from "../supabase.js";
import { mapPublicPost, mapModerationPost } from "../mappers.js";

/**
 * The public wall reads through the `public_posts` view rather than the `posts`
 * table, because RLS operates on rows and cannot hide a column. The view is what
 * guarantees an anonymous note's author_id never reaches the browser.
 */
export async function fetchPublicPosts({ search, limit = 200 } = {}) {
  if (!isConfigured) return [];

  let query = supabase
    .from("public_posts")
    .select("id, content, recipient, note_color, is_anonymous, created_at, updated_at, display_name");

  if (search?.trim()) {
    // The trigram index on posts.content supports this ilike.
    query = query.ilike("content", `%${search.trim()}%`);
  }

  query = query.order("created_at", { ascending: false }).limit(limit);
  const rows = unwrap(await query, "Could not load the wall");
  return rows.map(mapPublicPost);
}

/**
 * Admin/author read of the posts table. Requires an authenticated admin session;
 * RLS decides what actually comes back.
 */
export async function fetchPostsForModeration(statuses) {
  if (!isConfigured) return [];

  let query = supabase
    .from("posts")
    .select("id, content, recipient, note_color, is_anonymous, status, created_at, updated_at, reviewed_at, reviewed_by, rejection_reason");

  if (statuses?.length) query = query.in("status", statuses);

  const rows = unwrap(
    await query.order("created_at", { ascending: false }).limit(500),
    "Could not load posts"
  );

  const counts = await fetchReportCounts(rows.map((r) => r.id));
  const reasons = await fetchReportReasons(rows.map((r) => r.id));

  return rows.map((row) =>
    mapModerationPost(row, {
      reportCount: counts.get(row.id) ?? 0,
      reportReasons: reasons.get(row.id) ?? [],
    })
  );
}

/** Count of *pending* reports per post — the only reports that need surfacing. */
async function fetchReportCounts(postIds) {
  const map = new Map();
  if (!isConfigured || postIds.length === 0) return map;

  const { data, error } = await supabase
    .from("reports")
    .select("post_id")
    .in("post_id", postIds)
    .eq("status", "pending");

  // A non-admin viewer simply cannot see reports; that is not an error worth
  // surfacing, so fall back to zero rather than failing the whole page.
  if (error) return map;
  data.forEach((row) => map.set(row.post_id, (map.get(row.post_id) ?? 0) + 1));
  return map;
}

async function fetchReportReasons(postIds) {
  const map = new Map();
  if (!isConfigured || postIds.length === 0) return map;

  const { data, error } = await supabase
    .from("reports")
    .select("post_id, reason")
    .in("post_id", postIds)
    .eq("status", "pending");

  if (error) return map;
  data.forEach((row) => {
    if (!map.has(row.post_id)) map.set(row.post_id, []);
    map.get(row.post_id).push(row.reason);
  });
  return map;
}

/**
 * Submit a note. No account is required.
 *
 * Goes through the `submit_note` RPC rather than a table insert, for two reasons.
 * First, anon has no INSERT privilege on `posts` at all. Second, returning the
 * inserted row would mean either granting anon SELECT — which would expose
 * author_id and de-anonymise every note — or using `.insert().select()`, which
 * makes PostgREST run exactly that SELECT. So the RPC returns only the new id.
 *
 * Nothing identifying is sent, because nothing identifying is accepted. The
 * database hardcodes is_anonymous true and author_id NULL inside the function, and
 * the status is set by a trigger, so a tampered request cannot publish its own
 * note or attach a name to it.
 *
 * @returns {Promise<string>} the new note id
 */
export async function insertPost({ content, recipient, color }) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("submit_note", {
    p_content: content.trim(),
    p_recipient: recipient?.trim() || null,
    p_note_color: color,
  });

  if (error) throw new Error(friendlyPostError(error.message));
  return data;
}

/** Edit your own note. Only allowed while it is still pending (enforced in SQL). */
export async function updatePostContent(postId, content) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("posts")
    .update({ content: content.trim() })
    .eq("id", postId)
    .select("id, content, recipient, note_color, is_anonymous, status, created_at, updated_at, reviewed_at, reviewed_by, rejection_reason")
    .single();

  if (error) throw new Error(error.message);
  return mapModerationPost(data);
}

/**
 * PostgREST does not report a permission failure on a write. When RLS filters
 * every matched row out of an UPDATE it still returns HTTP 200 with an empty
 * result set -- no error, zero rows. Checking `error` alone therefore lets the
 * console announce "Approved" for a write that changed nothing, and leaves the
 * failure invisible until someone notices the queue did not move.
 *
 * Every write that targets specific rows asserts it got them back.
 */
function assertRowsChanged(rows, expected) {
  if (!Array.isArray(rows) || rows.length !== expected) {
    throw new Error("You do not have permission to do that.");
  }
}

/**
 * Move posts to a new status. Only admins are permitted by RLS; the database also
 * writes the matching moderation_logs row automatically.
 */
export async function setPostStatus(ids, status, reason = null) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const target = Array.isArray(ids) ? ids : [ids];
  if (target.length === 0) return;

  const patch = { status };
  if (status === "rejected") patch.rejection_reason = reason || "Other";

  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .in("id", target)
    .select("id");

  if (error) throw new Error(friendlyPostError(error.message));
  assertRowsChanged(data, target.length);
}

/**
 * Turn PostgREST's generic messages into something a student can act on. The raw
 * text is preserved in the cause for debugging.
 */
function friendlyPostError(message = "") {
  const text = message.toLowerCase();
  if (text.includes("violates row level security")) return "You do not have permission to do that.";
  if (text.includes("violates check constraint") && text.includes("content")) {
    return "That note is empty or longer than 600 characters.";
  }
  if (text.includes("violates check constraint") && text.includes("recipient")) {
    return "That recipient name is too long.";
  }
  if (text.includes("already been reviewed")) {
    return "A moderator has already reviewed this note.";
  }
  if (text.includes("own posts")) return "You can only change your own notes.";
  if (text.includes("duplicate key") || text.includes("reports_one_per_reporter")) {
    return "You have already reported this note.";
  }
  return message || "Something went wrong. Please try again.";
}

export { friendlyPostError, assertRowsChanged };