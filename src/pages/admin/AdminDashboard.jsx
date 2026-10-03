import { Link } from "react-router-dom";
import {
  CheckCheck,
  Clock3,
  EyeOff,
  Flag,
  ScrollText,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Users,
} from "lucide-react";
import StatCard from "../../components/admin/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import { useWall } from "../../store/wallContext";
import { colorById } from "../../lib/constants";
import { formatDateTime, pluralize, timeAgo, truncate } from "../../lib/format";

export default function AdminDashboard() {
  const { counts, byStatus, logs, publicWall, stats, loading } = useWall();

  const queue = byStatus.pending
    .slice()
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    .slice(0, 4);

  const latestNotes = publicWall.slice(0, 3);
  const recentLogs = logs.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl">
      {loading && (
        <p
          className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-faint"
          role="status"
          aria-live="polite"
        >
          <RefreshCw size={13} className="animate-spin-slow" aria-hidden="true" />
          Reading the moderation queue from the database&hellip;
        </p>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Clock3}
          label="Pending Review"
          value={counts.pending}
          hint="Waiting for a moderator decision"
          tone="warn"
          emphasis
          to="/admin/pending"
        />
        <StatCard
          icon={CheckCheck}
          label="Published"
          value={counts.publishedTotal.toLocaleString("en-GB")}
          hint="Approved and visible on the public wall"
          tone="ok"
          to="/admin/published"
        />
        <StatCard
          icon={EyeOff}
          label="Rejected"
          value={counts.rejectedTotal.toLocaleString("en-GB")}
          hint="Kept private, with a reason on record"
          tone="default"
          to="/admin/rejected"
        />
        <StatCard
          icon={Flag}
          label="Reported"
          value={counts.reportedTotal.toLocaleString("en-GB")}
          hint={`${counts.reported} note${counts.reported === 1 ? "" : "s"} awaiting a decision · ${pluralize(counts.openReports, "unresolved report")}`}
          tone="brand"
          to="/admin/reported"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={TrendingUp}
          label="Today's Submissions"
          value={counts.todaysSubmissions}
          hint="Arrived since midnight"
          tone="muted"
        />
        <StatCard
          icon={Users}
          label="Students Registered"
          value={stats.live ? stats.totalStudents.toLocaleString("en-GB") : "—"}
          hint="Accounts with a student profile"
          tone="muted"
        />
        <StatCard
          icon={Sparkles}
          label="Live on the wall"
          value={counts.publishedLive}
          hint="Approved notes visible right now"
          tone="muted"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2" aria-label="Needs review">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-fg">Needs review</h2>
              <p className="text-xs text-faint">Oldest submissions first</p>
            </div>
            <Link
              to="/admin/pending"
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted transition hover:border-surface-4 hover:text-fg"
            >
              Review all {counts.pending}
            </Link>
          </div>

          <ul className="space-y-3">
            {queue.length === 0 && (
              <li className="rounded-xl border border-line bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                All caught up.
              </li>
            )}
            {queue.map((post) => (
              <li
                key={post.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-center"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-full shrink-0 rounded-full sm:h-12 sm:w-1.5"
                  style={{ background: colorById(post.color).hex }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="pending" size="sm" />
                    <span className="text-[0.6875rem] font-bold tracking-[0.1em] text-faint uppercase">
                      {post.recipient ? `For ${truncate(post.recipient, 24)}` : "For everyone"}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-fg-soft">&ldquo;{post.content}&rdquo;</p>
                  <p className="mt-1 text-xs text-faint">Submitted {timeAgo(post.submittedAt)}</p>
                </div>
                <Link
                  to="/admin/pending"
                  className="shrink-0 rounded-lg bg-brand px-4 py-2 text-center text-xs font-bold text-canvas transition hover:bg-brand-soft"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-5">
          <section className="panel p-5" aria-label="Recently published">
            <h2 className="text-base font-bold text-fg">Recently published</h2>
            <p className="mt-1 text-xs text-faint">Live on the public wall</p>
            <ul className="mt-4 space-y-2.5">
              {latestNotes.map((post) => (
                <li
                  key={post.id}
                  className="rounded-xl border border-line bg-surface-2 px-3.5 py-3"
                >
                  <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-fg-soft">
                    &ldquo;{truncate(post.content, 90)}&rdquo;
                  </p>
                  <p className="mt-1.5 text-[0.6875rem] text-faint">
                    {post.recipient ? `For ${post.recipient}` : "For everyone"} &middot;{" "}
                    {timeAgo(post.publishedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5" aria-label="Recent moderation activity">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-fg">Recent activity</h2>
              <ScrollText size={16} className="text-faint" aria-hidden="true" />
            </div>
            <ul className="space-y-3">
              {recentLogs.map((log) => (
                <li key={log.id} className="text-xs">
                  <p className="font-semibold text-fg-soft">{log.action}</p>
                  <p className="mt-0.5 line-clamp-1 text-faint">&ldquo;{truncate(log.excerpt, 58)}&rdquo;</p>
                  <p className="mt-0.5 text-faint">
                    {log.moderator} &middot; {formatDateTime(log.at)}
                  </p>
                </li>
              ))}
            </ul>
            <Link
              to="/admin/logs"
              className="mt-4 inline-block text-xs font-semibold text-brand-soft transition hover:text-brand"
            >
              View moderation logs &rarr;
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}