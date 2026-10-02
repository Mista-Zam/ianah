export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
      <div className="mb-2 h-3 w-1/4 rounded bg-neutral-700/50" />
      <div className="mb-1 h-3 w-3/4 rounded bg-neutral-700/50" />
      <div className="mb-1 h-3 w-2/3 rounded bg-neutral-700/50" />
      <div className="mb-3 h-3 w-1/2 rounded bg-neutral-700/50" />
      <div className="flex gap-4">
        <div className="h-3 w-12 rounded bg-neutral-700/50" />
        <div className="h-3 w-16 rounded bg-neutral-700/50" />
        <div className="h-3 w-10 rounded bg-neutral-700/50" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 3, cols = 5 }) {
  return (
    <div className="animate-pulse rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-neutral-700/30 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 rounded bg-neutral-700/50" />
          ))}
        </div>
      ))}
    </div>
  );
}