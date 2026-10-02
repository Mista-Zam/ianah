import { supabase, unwrap, isConfigured } from "../supabase.js";
import { mapReport } from "../mappers.js";
import { friendlyPostError, assertRowsChanged } from "./posts.js";

/** File a report. The unique (post_id, reporter_id) constraint stops duplicates. */
export async function insertReport(postId, reason, details = null) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const { error } = await supabase
    .from("reports")
    .insert({ post_id: postId, reason, details: details?.trim() || null });

  if (error) throw new Error(friendlyPostError(error.message));
}

/**
 * The admin report queue. Reports are joined to their posts in a separate step
 * because the two tables have different select policies — this keeps the query
 * simple and lets a failure in one degrade gracefully rather than blanking the
 * page.
 */
export async function fetchReports({ status = "pending" } = {}) {
  if (!isConfigured) return { reports: [], postsById: new Map() };

  const rows = unwrap(
    await supabase
      .from("reports")
      .select("id, post_id, reporter_id, reason, details, status, created_at, resolved_at, resolved_by")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(300),
    "Could not load reports"
  );

  const postIds = [...new Set(rows.map((r) => r.post_id))];
  const postsById = new Map();
  if (postIds.length) {
    const { data: postRows, error } = await supabase
      .from("posts")
      .select("id, content, category, note_color, is_anonymous, status, created_at, updated_at, reviewed_at, reviewed_by, rejection_reason")
      .in("id", postIds);
    if (!error) {
      postRows.forEach((row) => postsById.set(row.id, row));
    }
  }

  return { reports: rows.map((r) => mapReport(r, postsById.get(r.post_id) ?? null)), postsById };
}

export async function setReportStatus(reportIds, status) {
  if (!isConfigured) throw new Error("Supabase is not configured.");

  const target = Array.isArray(reportIds) ? reportIds : [reportIds];
  if (target.length === 0) return;

  const { data, error } = await supabase
    .from("reports")
    .update({ status })
    .in("id", target)
    .select("id");

  if (error) throw new Error(friendlyPostError(error.message));
  assertRowsChanged(data, target.length);
}

/**
 * Every report ever filed against a post — used when a moderator keeps it live.
 *
 * Deliberately NOT row-count asserted. Unlike setReportStatus this targets
 * "every pending report on these posts", so zero matches is a legitimate outcome
 * (a note can reach the queue already cleared) rather than a permission failure.
 */
export async function dismissReportsForPosts(postIds) {
  const target = Array.isArray(postIds) ? postIds : [postIds];
  if (target.length === 0) return;

  const { error } = await supabase
    .from("reports")
    .update({ status: "dismissed" })
    .in("post_id", target)
    .eq("status", "pending");

  if (error) throw new Error(friendlyPostError(error.message));
}