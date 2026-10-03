import { useCallback, useEffect, useState } from "react";
import { Info, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import Button from "../../components/ui/Button";
import { useWall } from "../../store/wallContext";
import { createModerator, fetchModerators } from "../../lib/db/moderators.js";
import {
  EMAIL_PATTERN,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_MODERATOR_PASSWORD_LENGTH,
} from "../../lib/constants";
import { formatDateTime } from "../../lib/format";

/**
 * Add another moderator.
 *
 * Read this before using it: a moderator can do everything a student can plus
 * publish, reject, delete, read reports and read the audit log. Before this page
 * existed, minting one required database credentials. Now it takes a moderator
 * session, so a hijacked moderator session can create a backdoor that outlives
 * it. That is the feature working as designed; the guard against it is the
 * server-side is_admin() check inside the RPC, which the client cannot influence.
 *
 * The password is sent once to Postgres and never stored, echoed back, or logged
 * here. After a successful create the field is cleared and the new account is
 * confirmed already, so share the password out of band.
 */

function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-fg-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-faint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg placeholder:text-faint focus:border-brand/60 focus:outline-none";

export default function ModeratorAccounts() {
  const { notify, isConfigured } = useWall();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [moderators, setModerators] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      setModerators(await fetchModerators());
      setListError("");
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    load();
  }, [load]);

  function validate() {
    const errors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) errors.email = "Enter an email address.";
    else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = "That does not look like an email address.";
    else if (trimmedEmail.toLowerCase().endsWith("@kindnesswall.test"))
      errors.email = "That is a reserved demo address. Use a real email.";

    if (!password) errors.password = "Choose a password.";
    else if (password.length < MIN_MODERATOR_PASSWORD_LENGTH)
      errors.password = `Use at least ${MIN_MODERATOR_PASSWORD_LENGTH} characters.`;

    if (displayName.trim().length > MAX_DISPLAY_NAME_LENGTH)
      errors.displayName = `Keep it under ${MAX_DISPLAY_NAME_LENGTH} characters.`;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);
    try {
      await createModerator({ email, password, displayName: displayName.trim() || null });
      notify(`Moderator account created for ${email.trim().toLowerCase()}`, "success");
      // The password is never retrievable again, so clear it rather than leaving
      // it sitting in the DOM.
      setPassword("");
      setEmail("");
      setDisplayName("");
      setFieldErrors({});
      await load();
    } catch (err) {
      notify(err.message, "danger");
      // The database is the authority on duplicates; reflect that here so the
      // field looks wrong rather than only the toast being wrong.
      if (/already exists/i.test(err.message)) setFieldErrors({ email: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    isConfigured && !submitting && email.trim().length > 0 && password.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-fg sm:text-2xl">Moderators</h2>
        <p className="mt-1 text-sm text-muted">
          Add another member of staff who can review, publish and delete notes.
        </p>
      </div>

      <section className="panel mb-5 p-5 sm:p-6" aria-label="Add a moderator">
        <h3 className="flex items-center gap-2 text-base font-bold text-fg">
          <UserPlus size={16} className="text-brand-soft" aria-hidden="true" />
          Add a moderator
        </h3>

        {!isConfigured ? (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-muted">
            <Info size={13} className="mr-1.5 -mt-0.5 inline text-warn" aria-hidden="true" />
            Not connected to Supabase, so accounts cannot be created.
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="mod-email" label="Email address" error={fieldErrors.email}>
                <input
                  id="mod-email"
                  type="email"
                  autoComplete="off"
                  className={inputClass}
                  placeholder="name@school.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "mod-email-error" : undefined}
                />
              </Field>

              <Field
                id="mod-name"
                label="Display name"
                hint="Optional. Shown on moderation actions in the audit log."
                error={fieldErrors.displayName}
              >
                <input
                  id="mod-name"
                  type="text"
                  autoComplete="off"
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  className={inputClass}
                  placeholder="Ms Okafor"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                />
              </Field>
            </div>

            <Field
              id="mod-password"
              label="Temporary password"
              hint={`At least ${MIN_MODERATOR_PASSWORD_LENGTH} characters. Share it with them directly — it is never shown again.`}
              error={fieldErrors.password}
            >
              <div className="relative">
                <input
                  id="mod-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  className={`${inputClass} pr-12`}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "mod-password-error" : "mod-password-hint"}
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-faint transition hover:text-fg"
                >
                  <KeyRound size={15} aria-hidden="true" />
                </button>
              </div>
            </Field>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
                {submitting ? "Creating…" : "Create moderator account"}
              </Button>
              {submitting && <span className="text-xs text-faint">Creating the account…</span>}
            </div>
          </form>
        )}
      </section>

      <section className="panel p-5 sm:p-6" aria-label="Existing moderators">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-fg">
            <ShieldCheck size={16} className="text-brand-soft" aria-hidden="true" />
            Current moderators
          </h3>
          <Button variant="ghost" size="xs" onClick={load} disabled={loadingList || !isConfigured}>
            {loadingList ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {listError ? (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-muted">
            {listError}
          </p>
        ) : loadingList ? (
          <p className="text-sm text-faint">Loading moderator accounts…</p>
        ) : moderators.length === 0 ? (
          <p className="text-sm text-faint">No moderator accounts found.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {moderators.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg-soft">
                    {m.display_name || m.email}
                  </span>
                  {m.display_name && (
                    <span className="block truncate text-xs text-muted">{m.email}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-faint">
                  {m.last_sign_in_at ? `Last seen ${formatDateTime(m.last_sign_in_at)}` : "Never signed in"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}