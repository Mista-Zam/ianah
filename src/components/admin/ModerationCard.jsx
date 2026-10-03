import { CalendarClock, Flag, Tag, UserRound } from "lucide-react";
import NotePreview from "../NotePreview";
import StatusBadge from "../ui/StatusBadge";

import { formatDateTime } from "../../lib/format";

/**
 * Moderation card: the public note preview plus the metadata and actions a
 * moderator needs. Stacks cleanly on mobile, selectable for bulk decisions.
 */
export default function ModerationCard({
  post,
  actions,
  selectable = false,
  selected = false,
  onSelect,
  detail,
}) {
  return (
    <article
      className={`panel p-4 transition duration-200 sm:p-5 ${
        selected ? "border-brand/50 ring-1 ring-brand/25" : ""
      }`}
    >
      <div className="flex gap-3.5 sm:gap-5">
        {selectable && (
          <label className="flex shrink-0 cursor-pointer items-start pt-1">
            <span className="sr-only">Select this post for bulk moderation</span>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect?.(post.id)}
              className="h-4.5 w-4.5 accent-brand"
            />
          </label>
        )}

        <div className="w-16 shrink-0 sm:w-28">
          <NotePreview post={post} className="!min-h-0" showTag={false} />
          <p className="mt-2 hidden text-[0.625rem] font-bold tracking-[0.1em] text-faint uppercase sm:block">
            Public preview
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} size="sm" />
            {post.recipient && (
              <span className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-bold text-muted">
                <Tag size={11} aria-hidden="true" />
                <span className="truncate">{post.recipient}</span>
              </span>
            )}
            {post.reportCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 bg-brand/12 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-soft">
                <Flag size={11} aria-hidden="true" />
                {post.reportCount} {post.reportCount === 1 ? "report" : "reports"}
              </span>
            )}
          </div>

          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-fg-soft">“{post.content}”</p>

          <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-faint">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Author</dt>
              <UserRound size={12} aria-hidden="true" />
              <dd>{post.anonymous ? "Anonymous" : "Named student"}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Submitted</dt>
              <CalendarClock size={12} aria-hidden="true" />
              <dd>{formatDateTime(post.submittedAt)}</dd>
            </div>
            {detail && <div className="hidden items-center gap-1.5 sm:flex">{detail}</div>}
          </dl>

          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </article>
  );
}