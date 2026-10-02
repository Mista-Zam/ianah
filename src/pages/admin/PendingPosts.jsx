import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Eye, EyeOff, Inbox } from "lucide-react";
import AdminToolbar from "../../components/admin/AdminToolbar";
import ModerationCard from "../../components/admin/ModerationCard";
import ModerationDetailSheet from "../../components/admin/ModerationDetailSheet";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import RejectDialog from "../../components/admin/RejectDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { useWall } from "../../store/wallContext";
import { POST_CATEGORIES } from "../../lib/constants";
import { pluralize } from "../../lib/format";

export default function PendingPosts() {
  const { byStatus, actions } = useWall();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [order, setOrder] = useState("oldest");
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const pending = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = byStatus.pending.filter((post) => {
      const matchesCategory = category === "all" || post.category === category;
      const matchesQuery = !query || post.content.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
    return filtered.sort((a, b) =>
      order === "oldest"
        ? new Date(a.submittedAt) - new Date(b.submittedAt)
        : new Date(b.submittedAt) - new Date(a.submittedAt)
    );
  }, [byStatus.pending, search, category, order]);

  const detailPost = byStatus.pending.find((p) => p.id === detailId) ?? null;
  const allSelected = pending.length > 0 && pending.every((p) => selected.includes(p.id));
  const filtersActive = search.trim().length > 0 || category !== "all";

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const toggleAll = () =>
    setSelected(allSelected ? [] : pending.map((p) => p.id));

  const clearSelection = () => setSelected([]);

  // The store raises its own toast for the outcome, so these only manage the
  // dialogs and selection.
  const approve = (ids) => {
    actions.approve(ids);
    clearSelection();
    setApproveTarget(null);
    setDetailId(null);
  };

  const reject = (ids, reason) => {
    actions.reject(ids, reason);
    clearSelection();
    setRejectTarget(null);
    setDetailId(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Posts Awaiting Review</h2>
          <p className="mt-1 text-sm text-muted">
            Nothing here is public yet. Approve a note to publish it, or reject it to keep it
            private.
          </p>
        </div>
        <p className="text-sm font-semibold text-faint">{pluralize(byStatus.pending.length, "post")} pending</p>
      </div>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search pending posts..."
        selects={[
          {
            id: "category",
            label: "Filter by category",
            value: category,
            onChange: setCategory,
            options: [
              { value: "all", label: "All categories" },
              ...POST_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
            ],
          },
          {
            id: "order",
            label: "Sort order",
            value: order,
            onChange: setOrder,
            options: [
              { value: "oldest", label: "Oldest first" },
              { value: "newest", label: "Newest first" },
            ],
          },
        ]}
        resultCount={pending.length}
        total={byStatus.pending.length}
        filtersActive={filtersActive}
        onReset={() => {
          setSearch("");
          setCategory("all");
        }}
        actions={
          selected.length > 0 ? (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() => setApproveTarget([...selected])}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                Approve Selected ({selected.length})
              </Button>
              <Button
                variant="quietDanger"
                size="sm"
                onClick={() => setRejectTarget([...selected])}
              >
                <EyeOff size={15} aria-hidden="true" />
                Reject Selected ({selected.length})
              </Button>
            </>
          ) : null
        }
      />

      {pending.length === 0 ? (
        <EmptyState
          tone="ok"
          icon={byStatus.pending.length === 0 ? <CheckCircle2 size={26} /> : <Inbox size={26} />}
          title={byStatus.pending.length === 0 ? "All caught up." : "Nothing found."}
          body={
            byStatus.pending.length === 0
              ? "There are no student submissions waiting for review."
              : "Try searching for something else."
          }
          action={
            filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
              >
                Reset filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 px-1">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4.5 w-4.5 accent-brand"
              />
              Select All
            </label>
            {selected.length > 0 && (
              <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-soft">
                {selected.length} selected
              </span>
            )}
          </div>

          <div className="space-y-3">
            {pending.map((post) => (
              <ModerationCard
                key={post.id}
                post={post}
                selectable
                selected={selected.includes(post.id)}
                onSelect={toggle}
                actions={
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setDetailId(post.id)}>
                      <Eye size={15} aria-hidden="true" />
                      View
                    </Button>
                    <Button variant="success" size="sm" onClick={() => setApproveTarget([post.id])}>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      Approve
                    </Button>
                    <Button variant="quietDanger" size="sm" onClick={() => setRejectTarget([post.id])}>
                      <EyeOff size={15} aria-hidden="true" />
                      Reject
                    </Button>
                  </>
                }
              />
            ))}
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-faint">
            <Clock3 size={13} aria-hidden="true" />
            Approval timestamps and moderator names are recorded automatically.
          </p>
        </>
      )}

      <ModerationDetailSheet
        post={detailPost}
        open={Boolean(detailPost)}
        onClose={() => setDetailId(null)}
        onApprove={(post) => setApproveTarget([post.id])}
        onReject={(post) => setRejectTarget([post.id])}
      />

      <ConfirmDialog
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => approve(approveTarget ?? [], (approveTarget?.length ?? 0) > 1)}
        title={approveTarget?.length > 1 ? "Approve these submissions?" : "Publish this note?"}
        body={
          approveTarget?.length > 1
            ? `${approveTarget.length} posts will become visible on the public Kindness Wall.`
            : "This post will become visible on the public Kindness Wall."
        }
        confirmLabel="Approve & Publish"
        tone="success"
        icon={<CheckCircle2 size={18} aria-hidden="true" />}
      />

      <RejectDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        post={
          rejectTarget?.length === 1
            ? byStatus.pending.find((p) => p.id === rejectTarget[0]) ?? null
            : null
        }
        count={rejectTarget?.length ?? 0}
        body={
          rejectTarget?.length > 1
            ? `${rejectTarget.length} submissions will be kept private and never appear on the wall.`
            : "This submission will be kept private. The student will never see your reason."
        }
        onConfirm={(reason) => reject(rejectTarget ?? [], reason, (rejectTarget?.length ?? 0) > 1)}
      />

      <p className="sr-only" aria-live="polite">
        {selected.length} posts selected for bulk moderation.
      </p>
    </div>
  );
}