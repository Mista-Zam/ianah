import { Link } from "react-router-dom";
import { BRAND } from "../../lib/constants";

const PILLARS = [
  { title: "Anonymity first", body: "Your name is never shown. Choose to post anonymously and your identity stays private." },
  { title: "Moderated with care", body: "Every note is read by a human moderator before it reaches the wall." },
  { title: "Written for teachers", body: "No engagement games, no follower counts — just students telling teachers what actually mattered." },
];

export default function SiteFooter({ onShare }) {
  return (
    <footer className="mt-16 border-t border-line-soft bg-surface/60 px-4 pt-12 pb-28 sm:px-6 sm:pb-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-hand text-2xl font-bold text-fg">{BRAND.name}</p>
            <p className="mt-2 text-sm text-muted">{BRAND.tagline}</p>
            <p className="mt-4 text-xs leading-relaxed text-faint">
              A space where students can write to their teachers anonymously. Thank you.
              Appreciate. Speak. Content is reviewed before publication and rejection reasons are
              never shared publicly.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 sm:gap-12">
            <div>
              <h3 className="mb-3 text-xs font-bold tracking-[0.14em] text-fg uppercase">Wall</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  <Link to="/" className="transition hover:text-fg">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/wall" className="transition hover:text-fg">
                    Kindness Wall
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="transition hover:text-fg">
                    About
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold tracking-[0.14em] text-fg uppercase">Community</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  <button type="button" onClick={onShare} className="transition hover:text-fg">
                    Write a Note
                  </button>
                </li>
                <li>
                  <span className="text-faint">Community guidelines</span>
                </li>
                <li>
                  <span className="text-faint">Privacy &amp; anonymity</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold tracking-[0.14em] text-fg uppercase">For staff</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  <Link to="/admin/login" className="transition hover:text-fg">
                    Moderator sign-in
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-t border-line-soft pt-8 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title}>
              <p className="text-sm font-semibold text-fg-soft">{pillar.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-faint">{pillar.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line-soft pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 {BRAND.name}. Every note is reviewed by a moderator before it is published.
          </p>
          <p>Expression · Community · Empathy · Anonymity · Respect</p>
        </div>
      </div>
    </footer>
  );
}