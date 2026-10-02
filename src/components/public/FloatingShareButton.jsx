import { Plus } from "lucide-react";

/** Fixed share action for small screens; never overlaps content thanks to the
 *  extra bottom padding on the public layout. */
export default function FloatingShareButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Write a note"
      className="animate-pulse-ring fixed right-4 bottom-5 z-40 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-3.5 text-sm font-bold text-canvas shadow-[0_18px_40px_-14px_rgba(167,139,250,0.95)] transition active:scale-95 sm:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Plus size={16} aria-hidden="true" />
      Share
    </button>
  );
}