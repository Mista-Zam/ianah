import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Flag, Loader2, Lock, ShieldCheck } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import StickyNote from "./StickyNote";
import { useWall } from "../../store/wallContext";
import { REPORT_REASONS } from "../../lib/constants";

/**
 * Reporting requires an account. That is not bureaucracy — it is what makes the
 * one-report-per-person constraint in the database enforceable, and it stops the
 * queue being flooded from a single connection. Reporter identity is never exposed
 * to the post's author; the console only ever sees "Community member".
 */
export default function ReportModal({ post, open, onClose }) {
  const { actions, user } = useWall();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setReason(REPORT_REASONS[0]);
        setDetails("");
        setSent(false);
        setError("");
        setBusy(false);
      }, 250);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError("");
    const result = await actions.report(post.id, reason, details);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sent ? "Report received" : "Report this post"}
      subtitle={
        sent
          ? "Thank you. This post has been submitted for review."
          : "Reports are private. A moderator will look at this note."
      }
      eyebrow="Community care"
      size="sm"
      footer={
        sent ? (
          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={onClose} data-autofocus>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onClose}
              className="order-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-3 hover:text-fg sm:order-1"
            >
              Cancel
            </button>
            {user ? (
              <Button
                variant="primary"
                size="md"
                onClick={submit}
                disabled={busy}
                className="order-1 w-full sm:order-2 sm:w-auto"
              >
                {busy ? (
                  <>
                    <Loader2 size={15} className="animate-spin-slow" aria-hidden="true" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Flag size={15} aria-hidden="true" />
                    Submit Report
                  </>
                )}
              </Button>
            ) : (
              <Button
                as={Link}
                to="/admin/login"
                variant="primary"
                size="md"
                className="order-1 w-full sm:order-2 sm:w-auto"
              >
                Sign in to report
              </Button>
            )}
          </div>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-ok/30 bg-ok/10">
            <Check size={24} className="text-ok" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted">
            Thanks for looking after the wall. Your report is now with the moderation team.
          </p>
        </div>
      ) : (
        <div className="space-y-5 pt-1">
          <div className="flex items-start gap-4">
            <div className="w-28 shrink-0">
              <StickyNote post={post} interactive={false} className="!min-h-0 !p-3 text-[0.75rem]" />
            </div>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted">&ldquo;{post.content}&rdquo;</p>
          </div>

          {!user && (
            <p className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
              <Lock size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
              <span>
                You need an account to report a note. That is how we keep one person from flooding the queue —{" "}
                <Link to="/admin/login" className="font-semibold text-brand-soft transition hover:text-brand">
                  sign in
                </Link>{" "}
                or{" "}
                <Link to="/admin/signup" className="font-semibold text-brand-soft transition hover:text-brand">
                  create one
                </Link>
                .
              </span>
            </p>
          )}

          <fieldset>
            <legend className="mb-2.5 text-sm font-semibold text-fg-soft">Reason for reporting</legend>
            <div className="space-y-2">
              {REPORT_REASONS.map((option) => {
                const isSelected = reason === option;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      isSelected
                        ? "border-brand/60 bg-brand/10 font-semibold text-fg"
                        : "border-line bg-surface-2 text-muted hover:border-surface-4 hover:text-fg-soft"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={option}
                      checked={isSelected}
                      onChange={() => setReason(option)}
                      className="h-4 w-4 accent-brand"
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="report-details" className="mb-2 block text-sm font-semibold text-fg-soft">
              Anything else? <span className="font-normal text-faint">(optional)</span>
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Add context for the moderator..."
              className="w-full resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 text-[0.875rem] leading-relaxed text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-xs text-muted">{error}</p>
            </div>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
            The student who wrote this is never told who reported them.
          </p>
        </div>
      )}
    </Modal>
  );
}