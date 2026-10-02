import { CATEGORIES } from "../../lib/constants";
import { pluralize } from "../../lib/format";
import SearchBar from "./SearchBar";

export default function CategoryFilter({ active, onChange, counts = {} }) {
  return (
    <div
      className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      role="tablist"
      aria-label="Filter thoughts by category"
    >
      {CATEGORIES.map((category) => {
        const isActive = active === category.id;
        const count = counts[category.id];
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(category.id)}
            className={`shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition duration-200 ${
              isActive
                ? "border-brand bg-brand text-canvas shadow-[0_8px_24px_-10px_rgba(167,139,250,0.9)]"
                : "border-line bg-surface-2 text-muted hover:border-surface-4 hover:bg-surface-3 hover:text-fg"
            }`}
          >
            {category.label}
            {count != null && (
              <span className={`ml-1.5 text-xs font-bold ${isActive ? "text-canvas/70" : "text-faint"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function WallToolbar({ search, onSearch, active, onCategory, counts, resultCount, total }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <CategoryFilter active={active} onChange={onCategory} counts={counts} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBar value={search} onChange={onSearch} className="sm:w-80" />
        <p className="text-xs font-semibold tracking-wide text-faint sm:w-44" aria-live="polite">
          {resultCount === total
            ? pluralize(total, "thought")
            : `${pluralize(resultCount, "thought")} of ${total}`}
        </p>
      </div>
    </div>
  );
}