import { CATEGORIES, CATEGORY_LABEL, NOTE_COLORS } from "./constants.js";

/**
 * The UI addresses categories by a lowercase slug ("appreciation") because that
 * is what the existing filters and seeds use. The database stores the human label
 * ("Thank You") because the brief specified labels rather than slugs. These two
 * maps are the only place that translation lives.
 */
export const CATEGORY_ID_BY_LABEL = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== "all").map((c) => [c.label, c.id])
);

export const CATEGORY_LABEL_BY_ID = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== "all").map((c) => [c.id, c.label])
);

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/** Convert a UI category slug into the value the posts.category enum expects. */
export const toDbCategory = (slug) => {
  const label = CATEGORY_LABEL_BY_ID[slug];
  if (!label) throw new Error(`Unknown category: ${slug}`);
  return label;
};

/** Convert a posts.category enum value back into the UI slug. */
export const fromDbCategory = (label) => CATEGORY_ID_BY_LABEL[label] ?? "random";

const VALID_COLOR_IDS = new Set(NOTE_COLORS.map((c) => c.id));

const ROTATIONS = [-3.1, 2.4, -1.7, 1.2, -2.6, 3.2, -0.8, 2.1];
const SIZES = ["", "tall", "short", "xtall", "", "tall"];

/**
 * Sticky-note tilt and height are presentation, not data, so they are not stored.
 * Hashing the id keeps a given note looking identical on every render and every
 * device without adding columns for something the database should not care about.
 */
function decorate(id) {
  let hash = 0;
  const key = String(id);
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return {
    rotation: ROTATIONS[hash % ROTATIONS.length],
    size: SIZES[hash % SIZES.length],
  };
}

const clean = (value) => (typeof value === "string" ? value.trim() : value);

/**
 * Turn a row from `public_posts` (the anonymous-safe view) into the post shape
 * the components already expect.
 */
export function mapPublicPost(row) {
  const anonymous = Boolean(row.is_anonymous);
  return {
    id: row.id,
    content: row.content,
    category: fromDbCategory(row.category),
    categoryLabel: clean(row.category) ?? CATEGORY_LABEL[fromDbCategory(row.category)],
    color: VALID_COLOR_IDS.has(row.note_color) ? row.note_color : NOTE_COLORS[0].id,
    anonymous,
    displayName: anonymous ? null : (row.display_name ?? "A student"),
    status: "published",
    reportCount: row.report_count ?? 0,
    submittedAt: row.created_at,
    publishedAt: row.updated_at ?? row.created_at,
    ...decorate(row.id),
  };
}

/**
 * Turn a row from `posts` (admin / author view) into the same UI shape, plus the
 * moderation-only fields the console renders.
 */
export function mapModerationPost(row, { reportCount = 0, reportReasons = [] } = {}) {
  const anonymous = Boolean(row.is_anonymous);
  return {
    id: row.id,
    content: row.content,
    category: fromDbCategory(row.category),
    categoryLabel: clean(row.category) ?? CATEGORY_LABEL[fromDbCategory(row.category)],
    color: VALID_COLOR_IDS.has(row.note_color) ? row.note_color : NOTE_COLORS[0].id,
    anonymous,
    displayName: anonymous ? null : "Named student",
    status: row.status,
    reportCount,
    reportReasons,
    reportReason: reportReasons[0] ?? null,
    rejectionReason: row.rejection_reason ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    moderator: row.reviewed_by ? "Moderator" : undefined,
    submittedAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.status === "published" ? (row.reviewed_at ?? row.updated_at) : undefined,
    rejectedAt: row.status === "rejected" ? row.reviewed_at : undefined,
    removedAt: row.status === "removed" ? row.reviewed_at : undefined,
    ...decorate(row.id),
  };
}

/** Turn a `reports` row into the shape the console and log views expect. */
export function mapReport(row, post = null) {
  return {
    id: row.id,
    postId: row.post_id,
    reason: row.reason,
    details: row.details ?? null,
    state: row.status === "pending" ? "open" : row.status === "dismissed" ? "dismissed" : "resolved",
    status: row.status,
    at: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    reporter: row.reporter_id ? "Community member" : "Community member",
    post,
  };
}

/** Turn a `moderation_logs` row into the shape ModerationLogs renders. */
export function mapLog(row, postContent = "") {
  const verb = {
    approve: "Approved",
    reject: "Rejected",
    remove: "Removed",
    restore: "Restored",
    review_report: "Reviewed report",
    dismiss_report: "Dismissed report",
    resolve_report: "Resolved report",
  }[row.action] ?? row.action;

  return {
    id: row.id,
    postId: row.post_id ?? "",
    action: row.action === "approve" ? "Approved" : verb,
    moderator: "Admin",
    at: row.created_at,
    excerpt: postContent ? postContent.slice(0, 64) : "",
    from: row.previous_status ?? "—",
    to: row.new_status ?? row.previous_status ?? "—",
    note: row.reason ?? undefined,
  };
}