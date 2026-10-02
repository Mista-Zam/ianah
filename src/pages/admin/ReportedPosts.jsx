import { useMemo, useState } from "react";
import { Flag, SearchX, ShieldCheck, Trash2 } from "lucide-react";
import AdminToolbar from "../../components/admin/AdminToolbar";
import ModerationCard from "../../components/admin/ModerationCard";
import ModerationDetailSheet from "../../components/admin/ModerationDetailSheet";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { useWall } from "../../store/wallContext";
import { REPORT_REASONS } from "../../lib/constants";
import { formatDateTime, pluralize } from "../../lib/format";

export default function ReportedPosts() {
  const { byStatus, actions } = useWall();
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const posts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return byStatus.reported
      .filter((post) => (reason === "all" ? true : post.reportReason === reason))
      .filter((post) => (query ? post.content.toLowerCase().includes(query) : true))
      .sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0));
  }, [byStatus.reported, reason, search]);

  const detailPost = byStatus.reported.find((p) => p.id === detailId) ?? null;
  const filtersActive = search.trim().length > 0 || reason !== "all";

  // The store raises its own toast; these only manage the dialogs.
  const keep = (post) => {
    actions.keepPublished([post.id]);
    setDetailId(null);
  };

  const remove = (ids) => {
    actions.remove(ids);
    setRemoveTarget(null);
    setDetailId(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Reported Posts</h2>
        <p className="mt-1 text-sm text-muted">
          Published notes that students or teachers flagged. Reporters stay anonymous, and the author is never
          told who reported them.
        </p>
      </div>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search reported posts..."
        selects={[
          {
            id: "reason",
            label: "Filter by report reason",
            value: reason,
            onChange: setReason,
            options: [
              { value: "all", label: "All reasons" },
              ...REPORT_REASONS.map((r) => ({ value: r, label: r })),
            ],
          },
        ]}
        resultCount={posts.length}
        total={byStatus.reported.length}
        filtersActive={filtersActive}
        onReset={() => {
          setSearch("");
          setReason("all");
        }}
      />

      {posts.length === 0 ? (
        <EmptyState
          tone="ok"
          icon={filtersActive ? <SearchX size={26} /> : <ShieldCheck size={26} />}
          title={filtersActive ? "Nothing found." : "No open reports."}
          body={
            filtersActive
              ? "Try searching for something else."
              : "Nothing on the wall has been flagged. Every reported post has been reviewed."
          }
          action={
            filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setReason("all");
                }}
              >
                Reset filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 px-1 text-xs text-faint">
            <Flag size={13} aria-hidden="true" />
            {pluralize(posts.reduce((sum, p) => sum + (p.reportCount ?? 0), 0), "report")} across{" "}
            {pluralize(posts.length, "post")} awaiting a decision
          </div>

          <div className="space-y-3">
            {posts.map((post) => (
              <ModerationCard
                key={post.id}
                post={post}
                detail={
                  <span className="text-[0.6875rem] text-faint">
                    {post.reportReason} &middot; reported {formatDateTime(post.reportedAt)}
                  </span>
                }
                actions={
                  <>
                    <Button variant="secondary" size="sm" onClick={() => setDetailId(post.id)}>
                      View Details
                    </Button>
                    <Button variant="success" size="sm" onClick={() => keep(post)}>
                      <ShieldCheck size={15} aria-hidden="true" />
                      Keep Published
                    </Button>
                    <Button variant="quietDanger" size="sm" onClick={() => setRemoveTarget([post.id])}>
                      <Trash2 size={15} aria-hidden="true" />
                      Remove Post
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}

      <ModerationDetailSheet
        post={detailPost}
        open={Boolean(detailPost)}
        onClose={() => setDetailId(null)}
        onReject={(post) => setRemoveTarget([post.id])}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => remove(removeTarget ?? [])}
        title="Remove this post?"
        body="It disappears from the public wall immediately and the report is marked as resolved."
        confirmLabel="Remove Post"
        tone="danger"
        icon={<Trash2 size={18} aria-hidden="true" />}
      />
    </div>
  );
}