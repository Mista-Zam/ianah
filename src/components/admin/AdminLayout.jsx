import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ExternalLink, Menu, ShieldCheck } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import { useWall } from "../../store/wallContext";

const TITLES = {
  "/admin/dashboard": { title: "Dashboard", sub: "Moderation at a glance" },
  "/admin/pending": { title: "Posts Awaiting Review", sub: "Nothing is published without a decision" },
  "/admin/published": { title: "Published Notes", sub: "What students and teachers can see right now" },
  "/admin/rejected": { title: "Rejected Posts", sub: "Kept private, with a reason on record" },
  "/admin/reported": { title: "Reported Posts", sub: "Flagged by community members" },
  "/admin/logs": { title: "Moderation Logs", sub: "Every action, with moderator and timestamp" },
  "/admin/settings": { title: "Settings", sub: "Moderation preferences" },
};

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isAdmin, authReady, isConfigured, counts } = useWall();
  const location = useLocation();
  const navigate = useNavigate();

  // Guard on authReady, not just isAdmin. On a hard refresh or a direct link the
  // store starts with isAdmin=false and only resolves the profile asynchronously,
  // so redirecting on isAdmin alone bounced signed-in admins back to the login page
  // before their role had been read. When Supabase is not configured there is no
  // session that will ever arrive, so redirect immediately and let the login screen
  // explain why.
  useEffect(() => {
    if (!isConfigured) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (authReady && !isAdmin) navigate("/admin/login", { replace: true });
  }, [authReady, isAdmin, isConfigured, navigate]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (!isConfigured || !authReady || !isAdmin) return null;

  const heading = TITLES[location.pathname] ?? TITLES["/admin/dashboard"];

  return (
    <div className="relative min-h-dvh bg-canvas">
      <div className="app-atmosphere" aria-hidden="true" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden border-r border-line-soft lg:block">
        <AdminSidebar variant="full" />
      </aside>

      {/* Tablet rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden border-r border-line-soft md:block lg:hidden">
        <AdminSidebar variant="rail" />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="animate-panel-rise absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] shadow-2xl">
            <AdminSidebar variant="drawer" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="md:pl-[4.5rem] lg:pl-[16.5rem]">
        <header className="sticky top-0 z-30 border-b border-line-soft bg-canvas/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg border border-line bg-surface-2 p-2.5 text-fg-soft transition hover:bg-surface-3 md:hidden"
            >
              <Menu size={17} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-fg sm:text-lg">{heading.title}</h1>
              <p className="hidden truncate text-xs text-faint sm:block">{heading.sub}</p>
            </div>

            <Link
              to="/wall"
              className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted transition hover:border-surface-4 hover:text-fg sm:inline-flex"
            >
              <ExternalLink size={13} aria-hidden="true" />
              Public wall
            </Link>

            <span className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1.5 pr-3 pl-1.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/20 text-[0.6875rem] font-bold text-brand-soft">
                AD
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-xs font-bold text-fg-soft">Admin</span>
                <span className="block text-[0.625rem] text-faint">{counts.pending} pending</span>
              </span>
              <ShieldCheck size={14} className="text-ok sm:hidden" aria-hidden="true" />
            </span>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}