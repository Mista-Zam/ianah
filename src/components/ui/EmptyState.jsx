/**
 * Shared empty state. `tone` shifts the icon tint so each surface keeps its own
 * personality while staying inside the dark palette.
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "brand",
  compact = false,
}) {
  const tones = {
    brand: "border-brand/25 bg-brand/10 text-brand-soft",
    ok: "border-ok/25 bg-ok/10 text-ok",
    warm: "border-note-yellow/25 bg-note-yellow/10 text-note-yellow",
  };

  return (
    <div
      className={`panel flex flex-col items-center justify-center px-6 text-center ${
        compact ? "py-10" : "py-16"
      }`}
    >
      {icon && (
        <div className={`mb-5 rounded-2xl border p-4 ${tones[tone]}`} aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-fg sm:text-xl">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}