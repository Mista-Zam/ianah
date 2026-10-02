import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, Plus, ShieldCheck, X } from "lucide-react";
import { BRAND } from "../../lib/constants";
import { useWall } from "../../store/wallContext";
import Button from "../ui/Button";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/wall", label: "Kindness Wall" },
  { to: "/about", label: "About" },
];

function BrandMark({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] border border-white/10 bg-surface-3 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.9)] ${className}`}
    >
      <span className="absolute top-[7px] left-[6px] h-3.5 w-4 -rotate-6 rounded-[2px] bg-note-yellow" />
      <span className="absolute right-[6px] bottom-[7px] h-3.5 w-4 rotate-6 rounded-[2px] bg-note-lavender" />
    </span>
  );
}

export default function SiteHeader({ onShare }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useWall();

  const initial = (profile?.display_name || user?.email || "?").charAt(0).toUpperCase();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-3 rounded-lg py-1 pr-2"
          aria-label={`${BRAND.name} — home`}
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate font-hand text-[1.05rem] leading-tight font-bold tracking-tight text-fg sm:text-[1.2rem]">
              Kindness Wall for Teachers
            </span>
            <span className="hidden text-[0.6875rem] font-semibold tracking-[0.14em] text-faint uppercase sm:block">
              {BRAND.tagline}
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-4">
          <Button variant="primary" size="sm" onClick={onShare} className="hidden sm:inline-flex">
            <Plus size={15} aria-hidden="true" />
            Write a Note
          </Button>
          <Button variant="primary" size="sm" onClick={onShare} className="sm:hidden">
            <Plus size={15} aria-hidden="true" />
            Post
          </Button>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="rounded-lg border border-line bg-surface-2 p-2.5 text-fg-soft transition hover:bg-surface-3 md:hidden"
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>

          {/* Session-aware account control. Signed out, the primary path into the app is
              sign-in; signed in, it reflects the real auth state rather than
              linking to an unrelated page. */}
          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted transition hover:border-surface-4 hover:text-fg"
                >
                  <ShieldCheck size={13} aria-hidden="true" />
                  Console
                </Link>
              )}
              <span
                title={profile?.display_name || user.email}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 text-xs font-bold text-brand-soft"
              >
                {initial}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted transition hover:border-surface-4 hover:text-fg"
              >
                <LogOut size={13} aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/admin/login"
              className="hidden rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted transition hover:border-surface-4 hover:text-fg lg:block"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="animate-fade-in border-t border-line-soft bg-surface/95 px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[0.9375rem] font-semibold transition ${
                      isActive ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            size="md"
            className="mt-3 w-full"
            onClick={() => {
              setMenuOpen(false);
              onShare?.();
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Write a Note
          </Button>

          <div className="mt-3 border-t border-line-soft pt-3">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-xs font-bold text-brand-soft">
                    {initial}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg-soft">
                      {profile?.display_name || user.email}
                    </span>
                    <span className="block text-[0.6875rem] text-faint">
                      {isAdmin ? "Moderator" : "Student"}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-muted"
                >
                  <LogOut size={13} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/admin/login"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg border border-line bg-surface-2 px-4 py-3 text-center text-sm font-semibold text-muted"
              >
                Sign in or create an account
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}