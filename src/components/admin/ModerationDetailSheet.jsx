import { CalendarClock, Flag, ShieldCheck, Tag, UserRound } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import NotePreview from "../NotePreview";
import StatusBadge from "../ui/StatusBadge";
import { CATEGORY_LABEL, STATUS } from "../../lib/constants";
import { formatDateTime, formatLongDate } from "../../lib/format";

const FIELDS = [
  { key: "category", label: "Category", icon: Tag },
  { key: "author", label: "Author", icon: UserRound },
  { key: "submitted", label: "Submitted", icon: CalendarClock },
  { key: "status", label: "Status", icon: ShieldCheck },
];

function fieldValue(post, key) {
  switch (key) {
    case "category":
      return CATEGORY_LABEL[post.category] ?? "Random";
    case "author":
      return post.anonymous ? "Anonymous" : "Named student";
    case "submitted":
      return formatLongDate(post.submittedAt);
    case "status":
      return STATUS[post.status]?.label ?? post.status;
    default:
      return "—";
  }
}

/**
 * Detail view for a single submission. Renders as a bottom sheet on mobile and
 * a centred dialog on larger screens.
 */
export default function ModerationDetailSheet({ post, open, onClose, onApprove, onReject, extraFields = [] }) {
  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Moderation detail"
      eyebrow={CATEGORY_LABEL[post.category] ?? "Random"}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onReject && (
            <Button variant="quietDanger" size="md" onClick={() => onReject(post)}>
              Reject
            </Button>
          )}
          {onApprove && (
            <Button variant="success" size="md" onClick={() => onApprove(post)} data-autofocus>
              <ShieldCheck size={15} aria-hidden="true" />
              Approve &amp; Publish
            </Button>
          )}
          {!onApprove && (
            <Button variant="primary" size="md" onClick={onClose} data-autofocus>
              Close
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6 pt-1">
        <section aria-label="Post preview">
          <h3 className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.14em] text-faint uppercase">
            Post Preview
          </h3>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-start">
            <NotePreview post={post} className="mx-auto w-full max-w-[15rem] sm:mx-0" showTag />
            <div className="min-w-0">
              <p className="text-[1.0625rem] leading-relaxed text-fg">“{post.content}”</p>
              <p className="mt-3 text-xs leading-relaxed text-faint">
                This is exactly how the note will appear on the public Kindness Wall.
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Submission details">
          <h3 className="mb-2.5 text-[0.6875rem] font-bold tracking-[0.14em] text-faint uppercase">
            Details
          </h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[...FIELDS, ...extraFields].map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.12em] text-faint uppercase">
                  <Icon size={12} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-fg-soft">{fieldValue(post, key)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {post.status === "reported" && (
          <section
            aria-label="Report details"
            className="rounded-xl border border-brand/30 bg-brand/8 px-4 py-3.5"
          >
            <h3 className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.14em] text-brand-soft uppercase">
              <Flag size={12} aria-hidden="true" />
              Report
            </h3>
            <p className="mt-1.5 text-sm text-fg-soft">
              {post.reportCount} {post.reportCount === 1 ? "report" : "reports"} · {post.reportReason}
            </p>
            <p className="mt-1 text-xs text-faint">
              Reported {formatDateTime(post.reportedAt)} · Reporter identity is never stored or shown.
            </p>
          </section>
        )}

        {post.status === "rejected" && post.rejectionReason && (
          <section aria-label="Rejection details" className="rounded-xl border border-line bg-surface-2 px-4 py-3.5">
            <h3 className="text-[0.6875rem] font-bold tracking-[0.14em] text-faint uppercase">
              Rejection reason (private)
            </h3>
            <p className="mt-1.5 text-sm text-fg-soft">{post.rejectionReason}</p>
            <p className="mt-1 text-xs text-faint">
              Moderator: {post.moderator ?? "Admin"} · {formatDateTime(post.reviewedAt)}
            </p>
          </section>
        )}

        {post.publishedAt && (
          <p className="text-xs text-faint">
            <StatusBadge status={post.status} size="sm" className="mr-2" />
            Published {formatDateTime(post.publishedAt)}
          </p>
        )}
      </div>
    </Modal>
  );
}