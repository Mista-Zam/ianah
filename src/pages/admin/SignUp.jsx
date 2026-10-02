import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import Button from "../../components/ui/Button";
import { useWall } from "../../store/wallContext";
import { BRAND, MAX_THOUGHT_LENGTH } from "../../lib/constants";

/**
 * Student registration. Writing a note or reporting one requires a signed-in
 * account, and this is where a student gets one.
 *
 * Sign-up metadata carries only a display name. `handle_new_user` in the database
 * explicitly discards any `role` in that payload, so nobody can self-register as
 * an admin by tampering with the request.
 */
export default function SignUp() {
  const { signUp, user } = useWall();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Create an account · Kindness Wall";
  }, []);

  useEffect(() => {
    if (user) navigate("/wall", { replace: true });
  }, [user, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email address and a password.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const profile = await signUp({ email, password, displayName });
      if (profile) navigate("/wall", { replace: true });
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
        <div className="mb-7">
          <h1 className="text-lg font-bold text-fg">Join the Kindness Wall</h1>
          <p className="mt-1 text-xs text-faint">
            {BRAND.name} &middot; an account lets you write notes and report anything that should not be there
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="signup-name" className="mb-2 block text-sm font-semibold text-fg-soft">
              Display name <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 60))}
              placeholder="Shown only if you choose to post with your name"
              className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="mb-2 block text-sm font-semibold text-fg-soft">
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.org"
              aria-invalid={Boolean(error) || undefined}
              className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="mb-2 block text-sm font-semibold text-fg-soft">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                aria-invalid={Boolean(error) || undefined}
                className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-12 pl-4 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 text-faint transition hover:text-fg"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="signup-confirm" className="mb-2 block text-sm font-semibold text-fg-soft">
              Confirm password
            </label>
            <input
              id="signup-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={Boolean(error) || undefined}
              className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-[0.9375rem] text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-danger">Unable to create your account.</p>
                <p className="mt-0.5 text-xs text-muted">{error}</p>
              </div>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin-slow" aria-hidden="true" />
                Creating your account…
              </>
            ) : (
              <>
                <UserPlus size={15} aria-hidden="true" />
                Create Account
              </>
            )}
          </Button>

          <p className="text-center text-xs text-faint">
            Already have an account?{" "}
            <Link to="/admin/login" className="font-semibold text-brand-soft transition hover:text-brand">
              Sign in
            </Link>
          </p>
        </form>
      </div>

      <p className="mt-5 w-full max-w-md rounded-xl border border-line-soft bg-surface-2/70 px-4 py-3 text-xs leading-relaxed text-faint">
        Notes are limited to {MAX_THOUGHT_LENGTH} characters. You can post anonymously, and your identity is never
        shown publicly unless you choose otherwise.
      </p>
    </div>
  );
}