import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isConfigured, logFailure } from "../lib/supabase.js";
import { WallContext } from "./wallContext.js";
import * as postsDb from "../lib/db/posts.js";
import * as reportsDb from "../lib/db/reports.js";
import * as moderationDb from "../lib/db/moderation.js";
import * as authDb from "../lib/db/auth.js";
import { fetchDashboardStats } from "../lib/db/stats.js";

/**
 * The store keeps the exact shape the components already consumed when this app
 * was a localStorage demo — posts / byStatus / publicWall / reports / logs /
 * counts / actions — so the visual layer needed almost no restructuring. What
 * changed is where the data comes from and who is allowed to see it.
 *
 * Authorisation is never decided here. `isAdmin` is a mirror of
 * profiles.role read back from Postgres; every write still has to pass the RLS
 * policies in supabase/migrations/0004_rls_policies.sql.
 */

const ALL_STATUSES = ["pending", "published", "rejected", "removed"];

const EMPTY_COUNTS = {
  pending: 0,
  publishedLive: 0,
  publishedTotal: 0,
  rejectedLive: 0,
  rejectedTotal: 0,
  reported: 0,
  reportedTotal: 0,
  removed: 0,
  archived: 0,
  todaysSubmissions: 0,
  openReports: 0,
};

export function WallProvider({ children }) {
  /* ------------------------------ session -------------------------------- */
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // `sessionReady` means Supabase has answered whether anyone is signed in.
  // `roleReady` additionally means we have read that user's profiles.role.
  //
  // These are two different moments, and treating them as one locks real
  // moderators out of their own console. On a hard refresh or a direct link the
  // session resolves first, so for a few milliseconds we hold
  // { session: admin, profile: null } -> isAdmin === false. A guard that trusts
  // the session flag alone reads that gap as "signed in, not a moderator" and
  // redirects to the login page, which then bounces to "/" as a non-moderator.
  // The role lands a moment later, on a page the moderator is no longer on.
  //
  // Authorisation is exported as `authReady`, and it stays false until the role
  // is actually known. Nothing may decide access before that.
  const [sessionReady, setSessionReady] = useState(!isConfigured);
  const [roleReady, setRoleReady] = useState(!isConfigured);

  /* -------------------------------- data --------------------------------- */
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = profile?.role === "admin";

  // Mirrors `isAdmin` so the loaders below can decide who owns `posts` without
  // taking it as a dependency — which would refetch on every privilege change and
  // make the public wall flicker when someone signs in.
  const isAdminRef = useRef(false);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  /* ------------------------------ toasts --------------------------------- */
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message, tone = "info") => {
    const id = (toastId.current += 1);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  /* ------------------------------ loading -------------------------------- */

  const loadPublic = useCallback(async () => {
    if (!isConfigured) {
      setPosts([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await postsDb.fetchPublicPosts();
      setPosts((current) => (isAdminRef.current ? current : rows));
      setError(null);
    } catch (err) {
      logFailure("public-posts", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdmin = useCallback(async () => {
    try {
      const [rows, reportData, logRows, statRow] = await Promise.all([
        postsDb.fetchPostsForModeration(ALL_STATUSES),
        reportsDb.fetchReports({ status: "pending" }),
        moderationDb.fetchModerationLogs(),
        fetchDashboardStats(),
      ]);
      setPosts(rows);
      setReports(reportData.reports);
      setLogs(logRows);
      setStats(statRow);
      setError(null);
    } catch (err) {
      logFailure("admin-data", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (isAdminRef.current) await loadAdmin();
    else await loadPublic();
  }, [loadAdmin, loadPublic]);

  /* --------------------------- auth lifecycle ---------------------------- */

  useEffect(() => {
    if (!isConfigured) return undefined;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next ?? null);
      setSessionReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Role lives in Postgres, so re-read the profile whenever the session changes.
  // `roleReady` is cleared for the duration of the read: a moderator must never
  // be judged as "not an admin" while their own role is still in flight.
  useEffect(() => {
    let active = true;
    // Wait for Supabase to tell us whether anyone is signed in at all. Without this
    // guard the `!session` branch below runs on the very first render -- when the
    // session has not loaded yet, not when there is no session -- and marks the
    // role as resolved while it is still unknown. The guard then reads
    // "resolved, not an admin" and redirects a real moderator to the login page.
    if (!sessionReady) return undefined;
    if (!session) {
      setProfile(null);
      setRoleReady(true);
      return undefined;
    }
    setRoleReady(false);
    authDb.getCurrentProfile().then((next) => {
      if (!active) return;
      setProfile(next);
      setRoleReady(true);
    });
    return () => {
      active = false;
    };
  }, [session, sessionReady]);

  /* ------------------------- data on auth change ------------------------- */

  useEffect(() => {
    if (!roleReady) return;
    refresh();
  }, [roleReady, isAdmin, refresh]);

  /* ------------------------------ realtime ------------------------------- */

  useEffect(() => {
    if (!isConfigured) return undefined;

    // Coalesce bursts of inserts/updates into a single refetch.
    let timer = null;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => refresh(), 400);
    };

    const channel = supabase
      .channel("wall-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, schedule)
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  /* ---------------------------- selectors -------------------------------- */

  const byStatus = useMemo(() => {
    const groups = { pending: [], published: [], rejected: [], removed: [], reported: [] };

    posts.forEach((post) => {
      if (groups[post.status]) groups[post.status].push(post);
    });

    // A post is "reported" while it still carries at least one pending report —
    // it stays published, which is why this is derived rather than a status.
    if (reports.length) {
      const byPostId = new Map();
      reports.forEach((report) => {
        const list = byPostId.get(report.postId) ?? [];
        list.push(report);
        byPostId.set(report.postId, list);
      });

      byPostId.forEach((list, postId) => {
        const post = posts.find((p) => p.id === postId);
        if (!post) return;
        groups.reported.push({
          ...post,
          status: "published",
          reportCount: list.length,
          reportReason: list[0]?.reason ?? null,
          reportReasons: list.map((r) => r.reason),
          reportedAt: list.at(-1)?.at ?? list[0]?.at,
        });
      });
    }

    return groups;
  }, [posts, reports]);

  const publicWall = useMemo(
    () =>
      byStatus.published
        .slice()
        .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0)),
    [byStatus.published]
  );

  const counts = useMemo(() => {
    // While the aggregate RPC has not answered yet, fall back to counting what we
    // already hold so the sidebar never flashes a misleading zero.
    const derived = {
      pending: byStatus.pending.length,
      publishedLive: byStatus.published.length,
      rejectedLive: byStatus.rejected.length,
      removed: byStatus.removed.length,
      openReports: reports.filter((r) => r.status === "pending").length,
      todaysSubmissions: posts.filter((p) => new Date(p.submittedAt) >= startOfToday()).length,
    };

    return {
      ...EMPTY_COUNTS,
      ...derived,
      publishedTotal: stats.live ? stats.published : derived.publishedLive,
      rejectedTotal: stats.live ? stats.rejected : derived.rejectedLive,
      reportedTotal: stats.live ? stats.openReports : derived.openReports,
      reported: byStatus.reported.length,
      archived: 0,
    };
  }, [byStatus, posts, reports, stats]);

  /* ------------------------------ actions -------------------------------- */

  /**
   * Every action resolves to a discriminated result — `{ ok: true, data }` or
   * `{ ok: false, error }` — and raises its own toast. Components check `.ok`
   * rather than inspecting thrown errors, so nothing surfaces as an unhandled
   * rejection the user cannot act on, and the message shown inline always matches
   * the one in the toast.
   */
  const run = useCallback(
    async (task, { success, failure } = {}) => {
      try {
        const data = await task();
        if (success) notify(success, "success");
        await refresh();
        return { ok: true, data };
      } catch (err) {
        logFailure("action", err);
        const message = err.message || failure || "Something went wrong. Please try again.";
        notify(message, "danger");
        return { ok: false, error: message };
      }
    },
    [notify, refresh]
  );

  const actions = useMemo(
    () => ({
      async submitThought(payload) {
        return run(() => postsDb.insertPost(payload), {
          success: "Note submitted for review",
        });
      },

      async updatePost(id, content) {
        return run(() => postsDb.updatePostContent(id, content), {
          success: "Note updated",
        });
      },

      async approve(ids) {
        const target = Array.isArray(ids) ? ids : [ids];
        return run(() => postsDb.setPostStatus(target, "published"), {
          success:
            target.length > 1 ? `${target.length} notes approved` : "Note approved and published",
        });
      },

      async reject(ids, reason) {
        const target = Array.isArray(ids) ? ids : [ids];
        return run(() => postsDb.setPostStatus(target, "rejected", reason), {
          success:
            target.length > 1 ? `${target.length} notes rejected` : "Note rejected and kept private",
        });
      },

      async remove(ids) {
        const target = Array.isArray(ids) ? ids : [ids];
        return run(() => postsDb.setPostStatus(target, "removed"), {
          success: target.length > 1 ? `${target.length} notes removed` : "Note removed from the wall",
        });
      },

      /** Restore a removed note to the published wall. */
      async restore(ids) {
        const target = Array.isArray(ids) ? ids : [ids];
        return run(() => postsDb.setPostStatus(target, "published"), {
          success: "Note restored to the wall",
        });
      },

      /** Dismiss the open reports against a note and leave it published. */
      async keepPublished(ids) {
        const target = Array.isArray(ids) ? ids : [ids];
        return run(() => reportsDb.dismissReportsForPosts(target), {
          success: "Note kept published and reports dismissed",
        });
      },

      async report(postId, reason, details) {
        return run(() => reportsDb.insertReport(postId, reason, details), {
          success: "Thanks — a moderator will take a look",
        });
      },

      async setReportStatus(reportIds, status) {
        return run(() => reportsDb.setReportStatus(reportIds, status), {
          success: "Report updated",
        });
      },

      async refreshStats() {
        try {
          setStats(await fetchDashboardStats());
        } catch (err) {
          logFailure("stats", err);
        }
      },

      /** Re-reads everything. Exposed for the manual refresh affordances. */
      async refresh() {
        await refresh();
      },
    }),
    [run, refresh]
  );

  /* -------------------------------- auth --------------------------------- */

  const signIn = useCallback(
    async (email, password) => {
      const { user } = await authDb.signInWithPassword(email, password);
      const nextProfile = await authDb.getCurrentProfile();
      setProfile(nextProfile);
      notify(`Signed in as ${user.email}`, "success");
      return nextProfile;
    },
    [notify]
  );

  const signOut = useCallback(async () => {
    await authDb.signOut();
    setProfile(null);
    notify("Signed out", "info");
  }, [notify]);

  /* -------------------------------- value -------------------------------- */

  const value = useMemo(
    () => ({
      // data
      posts,
      byStatus,
      publicWall,
      reports,
      logs,
      counts,
      stats,
      loading,
      error,
      actions,
      // toasts
      toasts,
      notify,
      dismissToast,
      // auth
      session,
      user: session?.user ?? null,
      profile,
      isAdmin,
      isConfigured,
      // Deliberately the ROLE-aware flag, not the session one. Any component that
      // gates on `authReady` is asking "may this visitor use the console?", and
      // that is only answerable once profiles.role has been read.
      authReady: roleReady,
      sessionReady,
      signIn,
      signOut,
    }),
    [
      posts,
      byStatus,
      publicWall,
      reports,
      logs,
      counts,
      stats,
      loading,
      error,
      actions,
      toasts,
      notify,
      dismissToast,
      session,
      profile,
      isAdmin,
      roleReady,
      sessionReady,
      signIn,
      signOut,
    ]
  );

  return <WallContext.Provider value={value}>{children}</WallContext.Provider>;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
