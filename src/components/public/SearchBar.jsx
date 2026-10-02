import { Search, X } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder = "Search students' notes...", className = "" }) {
  return (
    <div className={`relative w-full ${className}`}>
      <label htmlFor="wall-search" className="sr-only">
        Search students&apos; notes
      </label>
      <Search
        size={17}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
      />
      <input
        id="wall-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-11 pl-11 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-faint transition hover:bg-surface-3 hover:text-fg"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}