import { useMemo, useState } from "react";
import { ArrowRight, ScrollText, SearchX } from "lucide-react";
import AdminToolbar from "../../components/admin/AdminToolbar";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { useWall } from "../../store/wallContext";
import { formatDateTime } from "../../lib/format";

const ACTIONS = ["All actions", "Submitted", "Approved", "Rejected", "Removed", "Kept Published", "Archived", "Reported", "Bulk Approved", "Bulk Rejected"];

const ACTION_TONE = {
  Approved: "text-ok",
  "Bulk Approved": "text-ok",
  "Kept Published": "text-ok",
  Rejected: "text-danger",
  "Bulk Rejected": "text-danger",
  Removed: "text-muted",
  Archived: "text-muted",
  Reported: "text-brand-soft",
  Submitted: "text-warn",
};

export default function ModerationLogs() {
  const { logs } = useWall();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("All actions");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs
      .filter((log) => (action === "All actions" ? true : log.action === action))
      .filter((log) =>
        query
          ? log.excerpt.toLowerCase().includes(query) ||
            log.moderator.toLowerCase().includes(query) ||
            (log.note ?? "").toLowerCase().includes(query)
          : true
      );
  }, [logs, action, search]);

  const filtersActive = search.trim().length > 0 || action !== "All actions";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Moderation Logs</h2>
        <p className="mt-1 text-sm text-muted">
          Every moderation action, with the moderator, timestamp and status change &rdquo;” for
          accountability.
        </p>
      </div>

      <AdminToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search posts, moderators, reasons..."
        selects={[
          {
            id: "action",
            label: "Filter by action",
            value: action,
            onChange: setAction,
            options: ACTIONS.map((a) => ({ value: a, label: a })),
          },
        ]}
        resultCount={rows.length}
        total={logs.length}
        filtersActive={filtersActive}
        onReset={() => {
          setSearch("");
          setAction("All actions");
        }}
      />

      {rows.length === 0 ? (
        <EmptyState
          tone="brand"
          icon={filtersActive ? <SearchX size={26} /> : <ScrollText size={26} />}
          title={filtersActive ? "Nothing found." : "No moderation activity yet."}
          body={
            filtersActive
              ? "Try searching for something else."
              : "Approving or rejecting a post will create the first entry here."
          }
          action={
            filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setAction("All actions");
                }}
              >
                Reset filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel hidden overflow-hidden lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Moderation action history</caption>
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[0.6875rem] tracking-[0.12em] text-faint uppercase">
                  <th scope="col" className="px-5 py-3 font-bold">Action</th>
                  <th scope="col" className="px-5 py-3 font-bold">Post</th>
                  <th scope="col" className="px-5 py-3 font-bold">Moderator</th>
                  <th scope="col" className="px-5 py-3 font-bold">Status change</th>
                  <th scope="col" className="px-5 py-3 font-bold">Date &amp; time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id} className="border-b border-line-soft last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-4">
                      <span className={`font-bold ${ACTION_TONE[log.action] ?? "text-fg-soft"}`}>
                        {log.action}
                      </span>
                      {log.note && <p className="mt-1 text-xs text-faint">Note: {log.note}</p>}
                    </td>
                    <td className="max-w-sm px-5 py-4 text-muted">
                      <span className="line-clamp-2">&ldquo;{log.excerpt}&rdquo;</span>
                    </td>
                    <td className="px-5 py-4 text-fg-soft">{log.moderator}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-2 text-xs text-faint">
                        <span>{log.from}</span>
                        <ArrowRight size={12} aria-hidden="true" />
                        <StatusBadge status={log.to === "reported" ? "reported" : log.to} size="sm" />
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs whitespace-nowrap text-faint">
                      {formatDateTime(log.at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((log) => (
              <li key={log.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${ACTION_TONE[log.action] ?? "text-fg-soft"}`}>
                    {log.action}
                  </span>
                  <span className="text-[0.6875rem] text-faint">{formatDateTime(log.at)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">&ldquo;{log.excerpt}&rdquo;</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-faint">
                  <span className="font-semibold text-fg-soft">{log.moderator}</span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span>{log.from}</span>
                  <StatusBadge status={log.to === "reported" ? "reported" : log.to} size="sm" />
                </div>
                {log.note && <p className="mt-2 text-xs text-faint">Note: {log.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}