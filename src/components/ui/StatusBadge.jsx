import { CheckCircle2, Clock3, EyeOff, Flag, Layers, ShieldCheck } from "lucide-react";
import { STATUS } from "../../lib/constants";

const ICONS = {
  pending: Clock3,
  published: ShieldCheck,
  rejected: EyeOff,
  reported: Flag,
  removed: Layers,
};

/**
 * Status badge: always icon + text, never colour alone (accessibility).
 */
export default function StatusBadge({ status, size = "md", className = "" }) {
  const meta = STATUS[status] ?? STATUS.pending;
  const Icon = ICONS[status] ?? CheckCircle2;
  const pad = size === "sm" ? "px-2 py-0.5 text-[0.625rem] gap-1" : "px-2.5 py-1 text-[0.6875rem] gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-[0.08em] ${meta.chip} ${pad} ${className}`}
    >
      <Icon size={size === "sm" ? 11 : 12} aria-hidden="true" />
      {meta.label}
    </span>
  );
}