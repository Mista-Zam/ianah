import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useWall } from "../../store/wallContext";

const TONES = {
  success: { icon: CheckCircle2, ring: "border-ok/40", text: "text-ok" },
  error: { icon: AlertTriangle, ring: "border-danger/45", text: "text-danger" },
  info: { icon: Info, ring: "border-brand/40", text: "text-brand-soft" },
};

/** Lightweight, screen-reader friendly confirmation messages. */
export default function Toaster() {
  const { toasts, dismissToast } = useWall();
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex flex-col items-center gap-2 px-4 sm:bottom-8"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] ?? TONES.info;
        const Icon = tone.icon;
        return (
          <div
            key={toast.id}
            className={`animate-toast-in panel pointer-events-auto flex max-w-md items-start gap-2.5 px-4 py-3 ${tone.ring}`}
          >
            <Icon size={17} className={`mt-0.5 shrink-0 ${tone.text}`} aria-hidden="true" />
            <p className="text-sm font-medium text-fg-soft">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="-mr-1 ml-1 shrink-0 rounded p-1 text-faint transition hover:text-fg"
              aria-label="Dismiss message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}