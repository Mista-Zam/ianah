import { pluralize } from "../../lib/format";
import SearchBar from "./SearchBar";

/**
 * The wall's search row.
 *
 * This used to sit next to a row of category chips. Those are gone: notes are no
 * longer filed into buckets, so there is nothing to filter by except the words.
 * What is left matches both the note text and the recipient's name, which means
 * typing a teacher's name finds every note addressed to them — the thing the
 * category chips were presumably being asked to do, but actually works.
 */
export function WallToolbar({ search, onSearch, resultCount, total }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <SearchBar value={search} onChange={onSearch} className="sm:w-80" />
      <p className="text-xs font-semibold tracking-wide text-faint sm:w-44" aria-live="polite">
        {resultCount === total
          ? pluralize(total, "thought")
          : `${pluralize(resultCount, "thought")} of ${total}`}
      </p>
    </div>
  );
}

export default WallToolbar;