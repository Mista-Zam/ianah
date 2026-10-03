import { useMemo, useState } from "react";
import { RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import AdminToolbar from "../../components/admin/AdminToolbar";
import ModerationCard from "../../components/admin/ModerationCard";
import ModerationDetailSheet from "../../components/admin/ModerationDetailSheet";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { useWall } from "../../store/wallContext";

/* "Archived" is gone: hiding a note is `removed`, and restoring it is a single
   action rather than a third bucket. See the post_status enum in 0001. */
const VIEWS = [
  { id: "published", label: "Published" },
  { id: "removed", label: "Removed" },
];

export default function PublishedPosts() {
  const { byStatus, actions, counts } = useWall();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("published");
  const [detailId, setDetailId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const source = useMemo(
    () => [...byStatus.published, ...byStatus.removed],
    [byStatus.published, byStatus.removed]
  );

  const posts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return source
      .filter((post) => post.status === view)
      .filter((post) =>
        query
          ? post.content.toLowerCase().includes(query) ||
            (post.recipient ?? "").toLowerCase().includes(query)
          : true
      )
      .sort((a, b) => new Date(b.publishedAt ?? b.removedAt ?? 0) - new Date(a.publishedAt ?? a.removedAt ?? 0));
  }, [source, view, search]);

  const detailPost = source.find((p) => p.id === detailId) ?? null;
  const filtersActive = search.trim().length > 0 || view !== "published";

  // Actions report their own outcome through the store's toasts, so these stay
  // silent here — otherwise every moderation click logs the message twice.
  const remove = (ids) => {
    actions.remove(ids);
    setRemoveTarget(null);
    setDetailId(null);
  };

  const restore = (post) => {
    actions.restore(post.id);
    setDetailId(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Published Notes</h2>
        <p className="mt-1 text-sm text-muted">
          Everything currently visible on the wall, plus anything that has been removed. Total published all
          time: {counts.publishedTotal.toLocaleString("en-GB")}.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Post state">
        {VIEWS.map((option) => {
          const isActive = view === option.id;
          const count = byStatus[option.id].length;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setView(option.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-brand bg-brand text-canvas"
                  : "border-line bg-surface-2 text-muted hover:border-surface-4 hover:text-fg"
              }`}
            >
              {option.label}
              <span className={`ml-1.5 text-xs font-bold ${isActive ? "text-canvas/70" : "text-faint"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search notes or a recipient..."
        selects={[]}
        resultCount={posts.length}
        total={source.length}
        filtersActive={filtersActive}
        onReset={() => {
          setSearch("");
          setView("published");
        }}
      />

      {posts.length === 0 ? (
        <EmptyState
          tone={view === "published" ? "ok" : "brand"}
          icon={view === "published" ? <ShieldCheck size={26} /> : <Trash2 size={26} />}
          title={filtersActive ? "Nothing found." : `No ${view} posts.`}
          body={
            filtersActive
              ? "Try searching for something else."
              : view === "published"
                ? "Approved notes will appear here as soon as they are published."
                : "Nothing has been removed yet."
          }
          action={
            filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setView("published");
                }}
              >
                Reset filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <ModerationCard
              key={post.id}
              post={post}
              detail={
                <span className="text-[0.6875rem] text-faint">
                  {post.recipient ? `For ${post.recipient}` : "For everyone"} &middot;{" "}
                  {post.anonymous ? "Anonymous" : "Named"}
                </span>
              }
              actions={
                <>
                  <Button variant="secondary" size="sm" onClick={() => setDetailId(post.id)}>
                    View
                  </Button>
                  {post.status === "published" ? (
                    <Button variant="quietDanger" size="sm" onClick={() => setRemoveTarget([post.id])}>
                      <Trash2 size={15} aria-hidden="true" />
                      Remove
                    </Button>
                  ) : (
                    <Button variant="success" size="sm" onClick={() => restore(post)}>
                      <RotateCcw size={15} aria-hidden="true" />
                      Restore
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}

      <ModerationDetailSheet
        post={detailPost}
        open={Boolean(detailPost)}
        onClose={() => setDetailId(null)}
        onReject={
          detailPost?.status === "published" ? (post) => setRemoveTarget([post.id]) : undefined
        }
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => remove(removeTarget ?? [])}
        title={removeTarget?.length > 1 ? "Remove these posts?" : "Remove this post?"}
        body="It disappears from the public wall immediately. The action is recorded in the moderation log."
        confirmLabel="Remove Post"
        tone="danger"
        icon={<Trash2 size={18} aria-hidden="true" />}
      />
    </div>
  );
}