import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import Button from "../../components/ui/Button";
import { useWall } from "../../store/wallContext";
import { BRAND } from "../../lib/constants";

/**
 * Real Supabase password authentication, shared by students and moderators.
 *
 * There is no local credential check left — Supabase verifies the password and
 * Postgres decides what the account may do via profiles.role. Both roles land
 * where they belong: moderators in the console, students back on the wall.
 *
 * This page used to sign non-admins out again. That was wrong, because it is not
 * an admin-only page: the header, the share modal, the report modal, the footer
 * and the sign-up page all point students here. Signing a student out meant a
 * registered student could never hold a session, so they could never post a note
 * or file a report.
 */
export default function AdminLogin() {
  const { isAdmin, session, authReady, signIn, isConfigured } = useWall();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Sign in · Kindness Wall";
  }, []);

  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;

  // Already signed in as a student: there is nothing to do here.
  if (authReady && session && !isAdmin) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email address and password to continue.");
      return;
    }

    setBusy(true);
    try {
      const profile = await signIn(email, password);
      // A student keeps their session; only the destination differs.
      navigate(profile?.role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="app-atmosphere" aria-hidden="true" />

      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the Kindness Wall
      </Link>

      <div className="panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-surface-3"
          >
            <span className="absolute top-[9px] left-[8px] h-4 w-5 -rotate-6 rounded-[2px] bg-note-yellow" />
            <span className="absolute right-[8px] bottom-[9px] h-4 w-5 rotate-6 rounded-[2px] bg-note-lavender" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-fg">Sign in</h1>
            <p className="flex items-center gap-1.5 text-xs text-faint">
              <ShieldCheck size={12} aria-hidden="true" />
              {BRAND.name}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold text-fg-soft">
              Email address
            </label>
            <div className="relative">
              <Mail
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
              />
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@school.org"
                aria-invalid={Boolean(error) || undefined}
                className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-4 pl-11 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-fg-soft">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                aria-invalid={Boolean(error) || undefined}
                className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-12 pl-4 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 text-faint transition hover:text-fg"
              >
                {showPassword ? (
                  <EyeOff size={16} aria-hidden="true" />
                ) : (
                  <Eye size={16} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-danger">Unable to sign in.</p>
                <p className="mt-0.5 text-xs text-muted">{error}</p>
              </div>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !isConfigured}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin-slow" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn size={15} aria-hidden="true" />
                Sign In
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <Link to="/admin/signup" className="inline-flex items-center gap-1.5 font-semibold text-brand-soft transition hover:text-brand">
              <UserPlus size={13} aria-hidden="true" />
              Create an account
            </Link>
            <Link to="/" className="text-faint transition hover:text-fg-soft">
              Public wall
            </Link>
          </div>
        </form>
      </div>

      <p className="mt-5 w-full max-w-md rounded-xl border border-line-soft bg-surface-2/70 px-4 py-3 text-xs leading-relaxed text-faint">
        Students can sign in to post notes and report content. Moderator access to the console is granted by an
        existing administrator. Your email and password are verified by Supabase Auth — nothing is stored in this
        browser.
      </p>
    </div>
  );
}