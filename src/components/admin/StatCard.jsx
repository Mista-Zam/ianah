export default function StatCard({ icon: Icon, label, value, hint, tone = "default", emphasis = false, to }) {
  const tones = {
    default: "border-line bg-surface-2",
    brand: "border-brand/35 bg-brand/10",
    ok: "border-ok/30 bg-ok/8",
    warn: "border-warn/35 bg-warn/8",
    danger: "border-danger/30 bg-danger/8",
    muted: "border-line bg-surface",
  };
  const iconTones = {
    default: "bg-surface-4 text-fg-soft",
    brand: "bg-brand/20 text-brand-soft",
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    muted: "bg-surface-4 text-muted",
  };

  const Wrapper = to ? "a" : "div";

  return (
    <Wrapper
      href={to}
      className={`group relative overflow-hidden rounded-2xl border p-5 transition duration-300 ${
        tones[tone]
      } ${emphasis ? "ring-1 ring-warn/25" : ""} ${
        to ? "hover:border-surface-4" : ""
      }`}
    >
      {emphasis && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warn/60 to-transparent"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-bold tracking-[0.14em] text-faint uppercase">
          {label}
        </p>
        {Icon && (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconTones[tone]}`}>
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-fg sm:text-[2.1rem]">{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-faint">{hint}</p>}
    </Wrapper>
  );
}