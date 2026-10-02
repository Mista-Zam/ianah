import { useEffect, useRef } from "react";

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog that behaves like a centred modal on desktop and a bottom sheet on
 * mobile, with focus trapping, Escape-to-close and scroll locking.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  size = "md",
  closeLabel = "Close",
  hideHeader = false,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const focusTimer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector("[data-autofocus]") ??
        panelRef.current?.querySelector(FOCUSABLE);
      first?.focus?.({ preventScroll: true });
    }, 40);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (restoreRef.current instanceof HTMLElement) {
        restoreRef.current.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="animate-fade-in absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-sheet-rise panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none rounded-t-2xl border-b-0 pb-[env(safe-area-inset-bottom)] sm:animate-panel-rise sm:max-h-[86dvh] sm:rounded-2xl sm:border-b ${SIZES[size]}`}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-surface-4 sm:hidden" aria-hidden="true" />

        {!hideHeader && (
          <div className="flex items-start gap-4 px-5 pt-4 pb-3 sm:px-6 sm:pt-6">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-soft">
                  {eyebrow}
                </p>
              )}
              {title && <h2 className="text-xl font-bold text-fg sm:text-2xl">{title}</h2>}
              {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-faint transition hover:bg-surface-3 hover:text-fg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line-soft bg-surface/70 px-5 py-4 sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  );
}