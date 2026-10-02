import { supabase, unwrap, isConfigured } from "../supabase.js";

/** Headline counters for the admin dashboard, in one round trip. */
export async function fetchDashboardStats() {
  const empty = {
    pending: 0,
    published: 0,
    rejected: 0,
    removed: 0,
    openReports: 0,
    todaysSubmissions: 0,
    totalStudents: 0,
    anonymousShare: 0,
    live: false,
  };

  if (!isConfigured) return empty;

  const rows = unwrap(
    await supabase.rpc("admin_dashboard_stats"),
    "Could not load dashboard stats"
  );

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return empty;

  return {
    pending: Number(row.pending ?? 0),
    published: Number(row.published ?? 0),
    rejected: Number(row.rejected ?? 0),
    removed: Number(row.removed ?? 0),
    openReports: Number(row.open_reports ?? 0),
    todaysSubmissions: Number(row.todays_submissions ?? 0),
    totalStudents: Number(row.total_students ?? 0),
    anonymousShare: Number(row.anonymous_share ?? 0),
    live: true,
  };
}

/**
 * Public counters shown on the community stats strip. These are aggregate-only —
 * no content, no author information — and the view deliberately grants them to
 * anon so the marketing surface works before anyone signs up.
 */
export async function fetchCommunityStats() {
  const fallback = [
    { id: "thoughts", value: "0", label: "Notes Shared", hint: "Approved and live on the wall" },
    { id: "teachers", value: "0", label: "Students", hint: "Students taking part" },
    { id: "today", value: "0", label: "Notes Today", hint: "Published in the last 24 hours" },
    { id: "anonymous", value: "0%", label: "Anonymous Notes", hint: "Written without a name" },
  ];
  if (!isConfigured) return fallback;

  const { data, error } = await supabase.rpc("community_stats");
  if (error || !data?.length) return fallback;

  const row = data[0];
  return [
    { id: "thoughts", value: formatNumber(row.published), label: "Notes Shared", hint: "Approved and live on the wall" },
    { id: "teachers", value: formatNumber(row.students), label: "Students", hint: "Students taking part" },
    { id: "today", value: formatNumber(row.today), label: "Notes Today", hint: "Published in the last 24 hours" },
    { id: "anonymous", value: `${Math.round(Number(row.anonymous_share ?? 0))}%`, label: "Anonymous Notes", hint: "Written without a name" },
  ];
}

const formatNumber = (value) => Number(value ?? 0).toLocaleString("en-GB");