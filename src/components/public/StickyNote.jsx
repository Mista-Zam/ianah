import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { colorById } from "../../lib/constants";
import { truncate } from "../../lib/format";

const SIZE_CLASS = {
  short: "note--short",
  tall: "note--tall",
  xtall: "note--xtall",
  "": "",
};

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    if (!onClose) return undefined;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose]);
}

/**
 * A single note on the Kindness Wall.
 *
 * The whole note is one click target (an overlay button, so the note stays a
 * real button for keyboards and screen readers) and the "•••" menu sits above
 * it. Handwriting is reserved for short notes, which read like scribbles.
 */
export default function StickyNote({ post, onOpen, onReport, className = "", interactive = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClose(menuRef, menuOpen ? () => setMenuOpen(false) : null);

  const note = colorById(post.color);
  const handwritten = post.content.length <= 62;

  return (
    <article
      className={`note ${SIZE_CLASS[post.size] ?? ""} ${interactive ? "" : "note-static"} ${className}`}
      style={{
        "--note-color": note.hex,
        "--note-ink": note.ink,
        "--note-rot": `${post.rotation ?? 0}deg`,
      }}
    >
      <p className={`note-ink ${handwritten ? "font-hand text-[1.35rem] leading-snug" : ""}`}>
        {post.content}
      </p>

      <div className="note-meta">
        {post.recipient && (
          <span className="note-tag" title={`For ${post.recipient}`}>
            For {post.recipient}
          </span>
        )}
        {interactive && (
          <div className="relative z-20" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`More actions for this note: ${truncate(post.content, 60)}`}
              className="-mr-2 -mt-2 min-h-8 rounded-md px-2 py-1.5 text-[0.9rem] leading-none tracking-[0.2em] transition hover:bg-black/10"
            >
              •••
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="panel animate-panel-rise absolute right-0 bottom-full z-30 mb-2 w-52 overflow-hidden p-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onReport?.(post);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-fg-soft transition hover:bg-surface-3 hover:text-fg"
                >
                  <Flag size={15} className="text-faint" aria-hidden="true" />
                  Report Post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {interactive && (
        <button
          type="button"
          onClick={() => onOpen?.(post)}
          aria-label={`Open note: ${truncate(post.content, 90)}`}
          className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-offset-4"
        />
      )}
    </article>
  );
}