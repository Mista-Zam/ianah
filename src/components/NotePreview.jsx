import { colorById } from "../lib/constants";

/**
 * Compact, non-interactive rendering of a thought as a sticky note — used in
 * the moderation console so moderators see the real note, not a paraphrase.
 */
export default function NotePreview({ post, className = "", showTag = true }) {
  const note = colorById(post.color);
  const short = post.content.length <= 62;

  return (
    <div
      className={`note note-static flex gap-2.5 p-3.5 ${className}`}
      style={{
        "--note-color": note.hex,
        "--note-ink": note.ink,
        "--note-rot": `${post.rotation ?? 0}deg`,
      }}
    >
      <p className={`note-ink text-[0.8125rem] leading-snug ${short ? "font-hand text-[1.05rem]" : ""}`}>
        {post.content}
      </p>
      {showTag && (
        <span className="note-meta mt-auto justify-end">
          <span className="note-tag !text-[0.5625rem]">{post.anonymous ? "Anonymous" : "Named"}</span>
        </span>
      )}
    </div>
  );
}