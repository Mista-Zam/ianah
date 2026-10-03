import { useMemo, useState } from "react";
import { Loader2, MessagesSquare, NotebookPen, Plus, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { useWall } from "../../store/wallContext";
import StickyNote from "./StickyNote";
import { WallToolbar } from "./WallToolbar";
import EmptyState from "../ui/EmptyState";
import Button from "../ui/Button";

/**
 * The Kindness Wall: keyword search and an organically arranged board of sticky
 * notes (CSS multi-column so every note keeps its own height, rotation and
 * colour).
 *
 * Filtering happens here rather than in the query because the payload is already
 * bounded (fetchPublicPosts caps at 200) and every keystroke should feel instant.
 */
export default function FreedomWall({ onOpenPost, onReport, onShare }) {
  const { publicWall, loading, error, actions, isConfigured } = useWall();
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return publicWall;
    return publicWall.filter(
      (post) =>
        post.content.toLowerCase().includes(query) ||
        (post.recipient ?? "").toLowerCase().includes(query)
    );
  }, [publicWall, search]);

  const filtersActive = search.trim().length > 0;

  return (
    <section id="wall" className="scroll-mt-24" aria-labelledby="wall-heading">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="wall-heading" className="text-2xl font-extrabold text-fg sm:text-3xl">
            What would you like your teacher to know?
          </h2>
          <p className="mt-2 text-[0.9375rem] text-muted">
            Your experiences matter. Share something with the community.
          </p>
        </div>
        {/* max-sm:hidden, not hidden sm:inline-flex — Button injects `inline-flex`,
            and a base display utility beats `hidden` regardless of class order. */}
        {onShare && (
          <Button variant="primary" size="md" onClick={onShare} className="max-sm:hidden">
            <Plus size={16} aria-hidden="true" />
            Write a Note
          </Button>
        )}
      </div>

      <div className="panel mb-8 p-4 sm:p-5">
        <WallToolbar
          search={search}
          onSearch={setSearch}
          resultCount={results.length}
          total={publicWall.length}
        />
      </div>

      {loading && publicWall.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-line-soft bg-surface-2/50 px-6 py-20 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={24} className="animate-spin-slow text-brand-soft" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold text-fg-soft">Loading the Kindness Wall…</p>
          <p className="mt-1 text-xs text-faint">Fetching the notes teachers have approved.</p>
        </div>
      ) : error && publicWall.length === 0 ? (
        <EmptyState
          tone="danger"
          icon={<WifiOff size={26} />}
          title="The wall could not be loaded."
          body={error}
          action={
            <Button
              variant="secondary"
              onClick={() => actions.refresh()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </Button>
          }
        />
      ) : !isConfigured ? (
        <EmptyState
          icon={<WifiOff size={26} />}
          title="The wall is not connected yet."
          body="Add your Supabase publishable key to .env, then apply the migrations in supabase/migrations to bring the wall online."
        />
      ) : results.length === 0 ? (
        filtersActive ? (
          <EmptyState
            tone="warm"
            icon={<SearchX size={26} />}
            title="Nothing found."
            body="Try searching for something else."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<NotebookPen size={26} />}
            title="The wall is waiting."
            body="Be the first student to write a note."
            action={
              onShare && (
                <Button variant="primary" onClick={onShare}>
                  <Plus size={16} aria-hidden="true" />
                  Write a Note
                </Button>
              )
            }
          />
        )
      ) : (
        <>
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
            {results.map((post, index) => (
              <div
                key={post.id}
                className="animate-note-drop mb-5 break-inside-avoid"
                style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}
              >
                <StickyNote post={post} onOpen={onOpenPost} onReport={onReport} />
              </div>
            ))}
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-faint">
            <MessagesSquare size={14} aria-hidden="true" />
            Every note here was reviewed by a moderator before it was pinned to the wall.
          </p>
        </>
      )}
    </section>
  );
}