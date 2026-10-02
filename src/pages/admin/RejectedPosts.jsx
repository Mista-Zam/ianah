import { useMemo, useState } from "react";
import { EyeOff, SearchX } from "lucide-react";
import AdminToolbar from "../../components/admin/AdminToolbar";
import ModerationCard from "../../components/admin/ModerationCard";
import ModerationDetailSheet from "../../components/admin/ModerationDetailSheet";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { useWall } from "../../store/wallContext";
import { REJECTION_REASONS, POST_CATEGORIES } from "../../lib/constants";
import { formatDateTime } from "../../lib/format";

export default function RejectedPosts() {
  const { byStatus } = useWall();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [reason, setReason] = useState("all");
  const [detailId, setDetailId] = useState(null);

  const posts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return byStatus.rejected
      .filter((post) => (category === "all" ? true : post.category === category))
      .filter((post) => (reason === "all" ? true : post.rejectionReason === reason))
      .filter((post) => (query ? post.content.toLowerCase().includes(query) : true))
      .sort((a, b) => new Date(b.reviewedAt ?? 0) - new Date(a.reviewedAt ?? 0));
  }, [byStatus.rejected, category, reason, search]);

  const detailPost = byStatus.rejected.find((p) => p.id === detailId) ?? null;
  const filtersActive = search.trim().length > 0 || category !== "all" || reason !== "all";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Rejected Posts</h2>
        <p className="mt-1 text-sm text-muted">
          Kept private and never shown on the wall. Rejection reasons are visible to moderators
          only. Total rejected all time: 86.
        </p>
      </div>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search rejected posts..."
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
            id: "reason",
            label: "Filter by reason",
            value: reason,
            onChange: setReason,
            options: [
              { value: "all", label: "All reasons" },
              ...REJECTION_REASONS.map((r) => ({ value: r, label: r })),
            ],
          },
        ]}
        resultCount={posts.length}
        total={byStatus.rejected.length}
        filtersActive={filtersActive}
        onReset={() => {
          setSearch("");
          setCategory("all");
          setReason("all");
        }}
      />

      {posts.length === 0 ? (
        <EmptyState
          tone="brand"
          icon={filtersActive ? <SearchX size={26} /> : <EyeOff size={26} />}
          title={filtersActive ? "Nothing found." : "No rejected posts."}
          body={
            filtersActive
              ? "Try searching for something else."
              : "Nothing has been rejected yet."
          }
          action={
            filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setReason("all");
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
                  Moderator: {post.moderator ?? "Admin"} &middot; {formatDateTime(post.reviewedAt)}
                </span>
              }
              actions={
                <Button variant="secondary" size="sm" onClick={() => setDetailId(post.id)}>
                  View details
                </Button>
              }
            />
          ))}
        </div>
      )}

      <ModerationDetailSheet
        post={detailPost}
        open={Boolean(detailPost)}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}