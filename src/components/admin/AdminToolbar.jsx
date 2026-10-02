import { Search, SlidersHorizontal, X } from "lucide-react";

/**
 * Shared console toolbar: keyword search, filter selects, active-filter reset
 * and an optional action slot (bulk moderation controls live here).
 */
export default function AdminToolbar({
  search,
  onSearch,
  searchPlaceholder = "Search posts...",
  selects = [],
  resultCount,
  total,
  onReset,
  filtersActive = false,
  actions,
}) {
  return (
    <div className="panel mb-5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="admin-search" className="sr-only">
            Search posts
          </label>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
          />
          <input
            id="admin-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 pr-10 pl-10 text-sm text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-faint transition hover:text-fg"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {selects.map((select) => (
            <div key={select.id} className="shrink-0">
              <label htmlFor={`filter-${select.id}`} className="sr-only">
                {select.label}
              </label>
              <select
                id={`filter-${select.id}`}
                value={select.value}
                onChange={(event) => select.onChange(event.target.value)}
                className="h-11 appearance-none rounded-xl border border-line bg-surface-2 px-3.5 pr-8 text-sm font-medium text-fg-soft focus:border-brand/60 focus:outline-none"
              >
                {select.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {filtersActive && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-xs font-semibold text-muted transition hover:border-surface-4 hover:text-fg"
            >
              <X size={13} aria-hidden="true" />
              Reset
            </button>
          )}
          {typeof resultCount === "number" && (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-faint" aria-live="polite">
              <SlidersHorizontal size={13} aria-hidden="true" />
              {resultCount === total ? `${total} total` : `${resultCount} of ${total}`}
            </p>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}