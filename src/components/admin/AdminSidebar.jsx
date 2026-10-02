import { NavLink } from "react-router-dom";
import {
  Flag,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldX,
  Clock3,
  LogOut,
  X,
} from "lucide-react";
import { useWall } from "../../store/wallContext";

const LINKS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null },
  { to: "/admin/pending", label: "Pending Posts", icon: Clock3, badge: "pending" },
  { to: "/admin/published", label: "Published", icon: ShieldCheck, badge: null },
  { to: "/admin/rejected", label: "Rejected", icon: ShieldX, badge: null },
  { to: "/admin/reported", label: "Reported", icon: Flag, badge: "reported" },
  { to: "/admin/logs", label: "Moderation Logs", icon: ScrollText, badge: null },
  { to: "/admin/settings", label: "Settings", icon: Settings, badge: null },
];

export default function AdminSidebar({ variant = "full", onNavigate }) {
  const { counts, signOut } = useWall();
  const isRail = variant === "rail";
  const isDrawer = variant === "drawer";

  return (
    <div
      className={`flex h-full flex-col bg-surface/95 ${
        isRail ? "w-[4.5rem] px-2.5 py-4" : "w-full px-3 py-4"
      } ${isDrawer ? "border-r border-line" : ""}`}
    >
      <div className={`mb-6 flex items-center gap-2.5 ${isRail ? "justify-center" : "px-2"}`}>
        <span
          aria-hidden="true"
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] border border-white/10 bg-surface-3"
        >
          <span className="absolute top-[7px] left-[6px] h-3.5 w-4 -rotate-6 rounded-[2px] bg-note-yellow" />
          <span className="absolute right-[6px] bottom-[7px] h-3.5 w-4 rotate-6 rounded-[2px] bg-note-lavender" />
        </span>
        {!isRail && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-fg">Kindness Wall</span>
            <span className="block text-[0.625rem] font-bold tracking-[0.14em] text-faint uppercase">
              Moderation console
            </span>
          </span>
        )}
        {isDrawer && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-2 text-faint transition hover:bg-surface-3 hover:text-fg"
          >
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Admin sections" className="flex-1 space-y-1">
        {LINKS.map(({ to, label, icon: Icon, badge }) => {
          const count = badge ? counts[badge] : 0;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              title={isRail ? label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isRail ? "justify-center px-0" : ""
                } ${
                  isActive
                    ? "bg-brand/15 text-brand-soft"
                    : "text-muted hover:bg-surface-3 hover:text-fg-soft"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} aria-hidden="true" className="shrink-0" />
                  {!isRail && (
                    <>
                      <span className="flex-1 truncate">{label}</span>
                      {count > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.625rem] font-bold ${
                            isActive ? "bg-brand/25 text-brand-soft" : "bg-surface-4 text-faint"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}
                  {isRail && count > 0 && (
                    <span className="sr-only">
                      {label}: {count} waiting
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className={`mt-4 border-t border-line-soft pt-3 ${isRail ? "" : ""}`}>
        <NavLink
          to="/admin/login"
          onClick={signOut}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-danger/10 hover:text-danger ${
            isRail ? "justify-center px-0" : ""
          }`}
          title={isRail ? "Logout" : undefined}
        >
          <LogOut size={17} aria-hidden="true" className="shrink-0" />
          {!isRail && <span>Logout</span>}
        </NavLink>
      </div>
    </div>
  );
}