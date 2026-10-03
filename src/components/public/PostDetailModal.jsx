import { Flag, ShieldCheck, CalendarDays, HeartHandshake, UserRound } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import StickyNote from "./StickyNote";
import { formatLongDate } from "../../lib/format";

const META = [
  { icon: UserRound, label: "Author" },
  { icon: HeartHandshake, label: "For" },
  { icon: CalendarDays, label: "Shared" },
];

/**
 * Public post detail. Deliberately exposes nothing beyond the thought itself —
 * no names, no account identifiers, no moderation notes.
 */
export default function PostDetailModal({ post, open, onClose, onReport }) {
  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="A Note for a Teacher"
      eyebrow="Kindness Wall"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="quietDanger" size="md" onClick={() => onReport(post)}>
            <Flag size={15} aria-hidden="true" />
            Report
          </Button>
          <Button variant="primary" size="md" onClick={onClose} data-autofocus>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        <StickyNote post={post} interactive={false} />

        <blockquote className="text-[1.0625rem] leading-relaxed text-fg-soft">
          “{post.content}”
        </blockquote>

        <dl className="grid gap-3 sm:grid-cols-3">
          {META.map(({ icon: Icon, label }) => {
            const value =
              label === "Author"
                ? post.anonymous
                  ? "Posted anonymously"
                  : // public_posts only returns display_name for posts whose author
                    // chose not to post anonymously, so there is nothing to show
                    // here when it is absent.
                    (post.displayName ?? "Shared by a student")
                : label === "For"
                  ? (post.recipient ?? "Everyone")
                  : formatLongDate(post.publishedAt ?? post.submittedAt);
            return (
              <div key={label} className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.12em] text-faint uppercase">
                  <Icon size={12} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-fg-soft">{value}</dd>
              </div>
            );
          })}
        </dl>

        <p className="flex items-start gap-2 rounded-xl border border-line-soft bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-faint">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          Students on this wall can choose to post anonymously. Identities, account details and
          moderator decisions are never shown publicly.
        </p>
      </div>
    </Modal>
  );
}