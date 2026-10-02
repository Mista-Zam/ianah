import { useState } from "react";
import { Database, Info, RefreshCw, ShieldCheck, Sliders } from "lucide-react";
import Button from "../../components/ui/Button";
import { useWall } from "../../store/wallContext";
import { CATEGORIES, NOTE_COLORS } from "../../lib/constants";

/**
 * This page describes how the platform is actually configured rather than
 * pretending to offer switches it cannot actually throw. Pre-moderation, for
 * instance, is enforced by a BEFORE INSERT trigger in Postgres
 * (supabase/migrations/0003_functions_triggers.sql) — it is not something the
 * browser can turn off, so presenting it as a toggle would be a lie.
 */

function Rule({ label, value, detail }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg-soft">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-faint">{detail}</span>
      </span>
      <span className="shrink-0 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[0.6875rem] font-bold text-ok">
        {value}
      </span>
    </div>
  );
}

export default function AdminSettings() {
  const { actions, isConfigured, error } = useWall();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await actions.refresh();
    setRefreshing(false);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Settings</h2>
        <p className="mt-1 text-sm text-muted">
          Moderation rules are enforced in the database, not in this browser. What follows is the state of
          the rules this console runs against.
        </p>
      </div>

      <section className="panel mb-5 p-5 sm:p-6" aria-label="Moderation rules">
        <h3 className="flex items-center gap-2 text-base font-bold text-fg">
          <ShieldCheck size={16} className="text-brand-soft" aria-hidden="true" />
          Moderation rules
        </h3>
        <div className="mt-4 space-y-2.5">
          <Rule
            label="Require moderator approval before publishing"
            value="Always on"
            detail="A BEFORE INSERT trigger forces every non-admin submission to 'pending', so a student cannot publish their own note even by tampering with the request."
          />
          <Rule
            label="Reports stay private"
            value="Always on"
            detail="Reporters and reporters' reasons are visible only to admins. The author of a post is never told who reported them."
          />
          <Rule
            label="Anonymous notes stay anonymous"
            value="Always on"
            detail="Public reads go through the public_posts view, which does not expose author_id at all. There is no query an anonymous visitor can run to recover it."
          />
          <Rule
            label="Moderation actions are logged"
            value="Always on"
            detail="Any status change writes an immutable moderation_logs row from a database trigger. There is no client-side path to edit or delete one."
          />
        </div>
      </section>

      <section className="panel mb-5 p-5 sm:p-6" aria-label="Wall configuration">
        <h3 className="flex items-center gap-2 text-base font-bold text-fg">
          <Sliders size={16} className="text-brand-soft" aria-hidden="true" />
          Wall configuration
        </h3>
        <p className="mt-1.5 text-xs text-faint">
          Defined as enums in <code className="text-muted">supabase/migrations/0001_initial_schema.sql</code>.
          Changing them requires a migration.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-sm font-semibold text-fg-soft">Active categories</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                <li
                  key={c.id}
                  className="rounded-full border border-line bg-surface-3 px-2.5 py-1 text-[0.6875rem] font-semibold text-muted"
                >
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-sm font-semibold text-fg-soft">Note colours</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {NOTE_COLORS.map((color) => (
                <li key={color.id} className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
                  <span
                    className="h-5 w-5 rounded border border-black/25"
                    style={{ background: color.hex }}
                    aria-hidden="true"
                  />
                  {color.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel p-5 sm:p-6" aria-label="Connection">
        <h3 className="flex items-center gap-2 text-base font-bold text-fg">
          <Database size={16} className="text-brand-soft" aria-hidden="true" />
          Connection
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {isConfigured
            ? "This console is connected to Supabase. Reloading re-reads the moderation queue, reports and logs straight from the database."
            : "This console is not connected. Add your publishable key to .env and apply the migrations in supabase/migrations."}
        </p>
        {error && isConfigured && (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs text-muted">
            <Info size={13} className="mr-1.5 -mt-0.5 inline text-warn" aria-hidden="true" />
            Last read reported: {error}
          </p>
        )}
        <div className="mt-4">
          <Button variant="secondary" size="md" onClick={refresh} disabled={refreshing || !isConfigured}>
            <RefreshCw size={15} className={refreshing ? "animate-spin-slow" : ""} aria-hidden="true" />
            {refreshing ? "Reloading…" : "Reload data"}
          </Button>
        </div>
      </section>
    </div>
  );
}