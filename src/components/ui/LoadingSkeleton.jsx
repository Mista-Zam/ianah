export default function LoadingSkeleton({ count = 8, className = "" }) {
  const items = Array.from({ length: count });

  return (
    <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}>
      {items.map((_, i) => (
        <div
          key={i}
          className="relative h-52 rounded-lg border border-line/70 bg-surface-3/70 p-5 shadow-sm sm:h-56"
          style={{ transform: `rotate(${(i % 7) - 3.5}deg)` }}
        >
          <div className="h-3 w-16 animate-pulse rounded bg-surface-4/80" />
          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-full animate-pulse rounded bg-surface-4/90" />
            <div className="h-2.5 w-[94%] animate-pulse rounded bg-surface-4/90" />
            <div className="h-2.5 w-[86%] animate-pulse rounded bg-surface-4/90" />
          </div>
          <div className="absolute bottom-4 left-5 right-5 flex justify-between">
            <div className="h-2.5 w-14 animate-pulse rounded bg-surface-4/90" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-surface-4/90" />
          </div>
        </div>
      ))}
    </div>
  );
}