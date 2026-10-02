import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useWall } from "../../store/wallContext";
import { MAX_THOUGHT_LENGTH, NOTE_COLORS, POST_CATEGORIES, CATEGORY_LABEL } from "../../lib/constants";

/**
 * Share flow: write → choose colour + category → submit for review.
 * Submissions never appear on the wall directly; a moderator approves them first.
 *
 * The status column is never sent — the database forces `pending` for any non-admin
 * insert, so a tampered request cannot publish its own note.
 */
export default function ShareModal({ open, onClose, onDone }) {
  const { actions, user, isConfigured } = useWall();
  const [step, setStep] = useState("form");
  const [text, setText] = useState("");
  const [color, setColor] = useState(NOTE_COLORS[0].id);
  const [category, setCategory] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) {
      /* reset for the next open */
      const timer = window.setTimeout(() => {
        setStep("form");
        setText("");
        setColor(NOTE_COLORS[0].id);
        setCategory("");
        setAnonymous(true);
        setError("");
      }, 250);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!text.trim()) {
      setError("Please write a note before submitting.");
      textareaRef.current?.focus();
      return;
    }
    if (!category) {
      setError("Please choose a category so the right teachers can find this.");
      return;
    }

    setStep("submitting");
    const result = await actions.submitThought({
      content: text.trim(),
      category,
      color,
      anonymous,
    });

    // The store already raised a toast; repeat the reason inline so it is obvious
    // which attempt failed and why.
    if (!result.ok) {
      setError(result.error);
      setStep("error");
      return;
    }
    setStep("success");
  };

  /* ------------------------------ footer ---------------------------------- */

  let footer;
  if (!user) {
    footer = (
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onClose}
          className="order-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-3 hover:text-fg sm:order-1"
        >
          Cancel
        </button>
        <Button as={Link} to="/admin/signup" variant="primary" size="md" className="order-1 w-full sm:order-2 sm:w-auto">
          Create an account
        </Button>
      </div>
    );
  } else if (step === "success") {
    footer = (
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="md" onClick={onClose}>
          Keep Browsing
        </Button>
        <Button variant="primary" size="md" onClick={onDone ?? onClose} data-autofocus>
          Back to the Wall
        </Button>
      </div>
    );
  } else {
    footer = (
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onClose}
          className="order-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-3 hover:text-fg sm:order-1"
        >
          Cancel
        </button>
        <Button
          variant="primary"
          size="md"
          type="submit"
          form="share-note-form"
          disabled={step === "submitting" || !isConfigured}
          className="order-1 w-full sm:order-2 sm:w-auto"
        >
          {step === "submitting" ? (
            <>
              <Loader2 size={15} className="animate-spin-slow" aria-hidden="true" />
              Submitting…
            </>
          ) : step === "error" ? (
            <>
              <RefreshCw size={15} aria-hidden="true" />
              Try Again
            </>
          ) : (
            <>
              <Plus size={15} aria-hidden="true" />
              Submit for Review
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "success" ? "Note Submitted" : "Write a Note"}
      subtitle={
        step === "success"
          ? undefined
          : step === "error"
            ? "Your draft is still here."
            : user
              ? "What would you like your teacher to know?"
              : "Sign in to write a note."
      }
      eyebrow={step === "success" ? undefined : "Anonymous expression"}
size="md"
      footer={footer}
    >
      {step === "success" ? (
        <div className="flex flex-col items-center px-1 py-6 text-center">
          <div className="relative mb-6">
            <span
              className="absolute inset-0 rounded-xl opacity-80 blur-md"
              style={{ background: NOTE_COLORS.find((c) => c.id === color)?.hex }}
              aria-hidden="true"
            />
            <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface-2">
              <Check size={28} className="text-ok" aria-hidden="true" />
            </span>
          </div>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted">
            Your note has been submitted for review. Thank you for writing to your teachers.
          </p>
          <ol className="mt-6 w-full space-y-2 rounded-xl border border-line bg-surface-2 p-4 text-left text-xs">
            {[
              "Submitted for review",
              "A moderator reads it",
              "Approved notes appear on the Kindness Wall",
            ].map((stepLabel, index) => (
              <li key={stepLabel} className="flex items-center gap-2.5">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold ${
                    index === 0
                      ? "bg-ok/20 text-ok"
                      : index === 1
                        ? "bg-brand/20 text-brand-soft"
                        : "bg-surface-4 text-faint"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={index === 0 ? "font-semibold text-fg-soft" : "text-faint"}>
                  {stepLabel}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : !user ? (
        /* Signed out: explain why an account is needed instead of showing a form
           that would fail at submit time. */
        <div className="flex flex-col items-center px-1 py-6 text-center">
          <span
            aria-hidden="true"
            className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-2 text-brand-soft"
          >
            <Lock size={22} />
          </span>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted">
            Writing a note needs an account, so a moderator can review it and so the community can report
            anything that should not be there.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-xs leading-relaxed text-faint">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
            <span>
              You can post anonymously once you are signed in — your name is never shown publicly unless you
              choose otherwise.
            </span>
          </p>
          <p className="mt-4 text-xs text-faint">
            Already have an account?{" "}
            <Link to="/admin/login" className="font-semibold text-brand-soft transition hover:text-brand">
              Sign in
            </Link>
          </p>
        </div>
      ) : (
        <form id="share-note-form" onSubmit={handleSubmit} className="space-y-6 pt-1">
          <div>
            <label htmlFor="note-text" className="mb-2 block text-sm font-semibold text-fg-soft">
              Your note
            </label>
            <div className="relative">
              <textarea
                id="note-text"
                ref={textareaRef}
                data-autofocus
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, MAX_THOUGHT_LENGTH))}
                rows={5}
                placeholder="Write a note to a teacher..."
                aria-describedby="note-counter"
                aria-invalid={error.includes("note") || undefined}
                className="w-full resize-y rounded-xl border border-line bg-surface-2 px-4 py-3.5 pb-9 text-[0.9375rem] leading-relaxed text-fg placeholder:text-faint focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
              />
              <span
                id="note-counter"
                className="absolute right-3 bottom-2.5 text-[0.6875rem] font-semibold text-faint"
                aria-live="polite"
              >
                {text.length} / {MAX_THOUGHT_LENGTH}
              </span>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2.5 text-sm font-semibold text-fg-soft">Choose your note color</legend>
            <div className="flex flex-wrap gap-2.5">
              {NOTE_COLORS.map((option) => {
                const isSelected = color === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setColor(option.id)}
                    aria-pressed={isSelected}
                    aria-label={`${option.name} note`}
                    className={`relative h-11 w-11 rounded-lg border-2 transition duration-200 ${
                      isSelected
                        ? "border-white shadow-[0_0_0_3px_rgba(255,255,255,0.18)]"
                        : "border-black/20 hover:scale-105"
                    }`}
                    style={{ backgroundColor: option.hex }}
                  >
                    {isSelected && (
                      <Check
                        size={18}
                        className="absolute inset-0 m-auto"
                        style={{ color: option.ink }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="note-category" className="mb-2 block text-sm font-semibold text-fg-soft">
              Category
            </label>
            <select
              id="note-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-invalid={error.includes("category") || undefined}
              className="h-12 w-full appearance-none rounded-xl border border-line bg-surface-2 px-4 pr-10 text-[0.9375rem] text-fg focus:border-brand/60 focus:bg-surface-3 focus:outline-none"
            >
              <option value="">Select a category</option>
              {POST_CATEGORIES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3.5 transition hover:border-surface-4">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
              className="mt-0.5 h-4.5 w-4.5 accent-brand"
            />
            <span>
              <span className="block text-sm font-semibold text-fg-soft">Post anonymously</span>
              <span className="mt-0.5 block text-xs text-faint">
                Your identity will not be displayed publicly.
              </span>
            </span>
          </label>

          <p className="flex items-start gap-2.5 rounded-xl border border-brand/25 bg-brand/8 px-4 py-3 text-xs leading-relaxed text-muted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
            <span>
              Your note will be reviewed by a moderator before appearing on the Kindness Wall.
              {category && (
                <span className="mt-1 block text-faint">
                  Filing under <strong className="text-fg-soft">{CATEGORY_LABEL[category]}</strong> as{" "}
                  {anonymous ? "an anonymous note" : "a named student"}.
                </span>
              )}
            </span>
          </p>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-danger">Unable to submit your note.</p>
                <p className="mt-0.5 text-xs text-muted">{error}</p>
              </div>
            </div>
          )}
        </form>
      )}

      {step === "success" && (
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setText("");
          }}
          className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-faint transition hover:text-fg-soft"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Write another note
        </button>
      )}

      {step === "error" && (
        <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-faint">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          If this keeps happening, your draft stays on this device and nothing has been published.
        </p>
      )}
    </Modal>
  );
}