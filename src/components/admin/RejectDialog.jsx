import { useEffect, useState } from "react";
import { EyeOff, Lock } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { REJECTION_REASONS } from "../../lib/constants";

/**
 * Rejection dialog. The chosen reason is stored privately for the moderation
 * log — it is never surfaced to the author or the public wall.
 */
export default function RejectDialog({
  open,
  onClose,
  onConfirm,
  post,
  count = 1,
  title,
  body,
  confirmLabel = "Reject Post",
}) {
  const [reason, setReason] = useState(REJECTION_REASONS[0]);

  useEffect(() => {
    if (open) setReason(REJECTION_REASONS[0]);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? (count > 1 ? "Reject these submissions?" : "Reject this submission?")}
      subtitle={count > 1 ? `${count} posts will be kept private.` : undefined}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={() => onConfirm(reason)} data-autofocus>
            <EyeOff size={15} aria-hidden="true" />
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        {body && <p className="text-sm leading-relaxed text-muted">{body}</p>}

        {post && (
          <p className="line-clamp-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
            “{post.content}”
          </p>
        )}

        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold text-fg-soft">Reason (private)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REJECTION_REASONS.map((option) => {
              const isSelected = reason === option;
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] transition ${
                    isSelected
                      ? "border-danger/50 bg-danger/10 font-semibold text-fg"
                      : "border-line bg-surface-2 text-muted hover:border-surface-4 hover:text-fg-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="rejection-reason"
                    value={option}
                    checked={isSelected}
                    onChange={() => setReason(option)}
                    className="h-3.5 w-3.5 accent-danger"
                  />
                  {option}
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-faint">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          This reason is recorded in the moderation log for accountability and is never shown to the
          student or on the public wall.
        </p>
      </div>
    </Modal>
  );
}