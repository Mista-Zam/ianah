const VARIANTS = {
  primary:
    "bg-brand text-canvas hover:bg-brand-soft active:bg-brand shadow-[0_10px_30px_-12px_rgba(167,139,250,0.8)]",
  secondary:
    "bg-surface-3 text-fg border border-line hover:bg-surface-4 hover:border-surface-4",
  ghost: "text-muted hover:text-fg hover:bg-surface-3",
  outline: "border border-brand/45 text-brand-soft hover:bg-brand/12 hover:border-brand/70",
  success:
    "bg-ok/90 text-canvas hover:bg-ok active:bg-ok shadow-[0_10px_30px_-12px_rgba(123,224,178,0.7)]",
  danger: "bg-danger/90 text-canvas hover:bg-danger active:bg-danger",
  quietDanger: "border border-danger/40 text-danger hover:bg-danger/12",
};

const SIZES = {
  xs: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export default function Button({
  as: Component = "button",
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  return (
    <Component
      className={`inline-flex shrink-0 items-center justify-center font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}