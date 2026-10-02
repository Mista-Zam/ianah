import { supabase, isConfigured } from "../supabase.js";
import { mapLog } from "../mappers.js";

/**
 * The audit trail. moderation_logs has a SELECT policy for admins only and no
 * INSERT/UPDATE/DELETE policy at all, so rows here are written exclusively by the
 * database's own trigger and cannot be tampered with from the client.
 */
export async function fetchModerationLogs(limit = 300) {
  if (!isConfigured) return [];

  const { data, error } = await supabase
    .from("moderation_logs")
    .select("id, post_id, moderator_id, action, reason, previous_status, new_status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  // Attach a content excerpt where the post still exists; posts are hard-deleted
  // only if their author deletes their account, so this is usually non-empty.
  const postIds = [...new Set(data.map((row) => row.post_id).filter(Boolean))];
  const excerpts = new Map();
  if (postIds.length) {
    const { data: postRows } = await supabase
      .from("posts")
      .select("id, content")
      .in("id", postIds);
    if (postRows) postRows.forEach((row) => excerpts.set(row.id, row.content));
  }

  return data.map((row) => mapLog(row, excerpts.get(row.post_id) ?? ""));
}