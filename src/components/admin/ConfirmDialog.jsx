import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  icon,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="md" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone} size="md" onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3.5 pt-1">
        {icon && (
          <span className="mt-0.5 shrink-0 rounded-xl border border-line bg-surface-2 p-2.5 text-brand-soft">
            {icon}
          </span>
        )}
        <p className="text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </Modal>
  );
}