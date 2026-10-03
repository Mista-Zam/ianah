import { useOutletContext } from "react-router-dom";
import {
  EyeOff,
  HeartHandshake,
  MessageSquareHeart,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Button from "../components/ui/Button";
import { BRAND } from "../lib/constants";

const VALUES = [
  {
    icon: EyeOff,
    title: "Anonymity by default",
    body: "Students can write without a name attached. Names, email addresses and account identifiers never appear on the wall or in moderation records.",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed before it shows",
    body: "Every submission is read by a moderator first. Approved notes go live; rejected notes stay private and the reason is never shared.",
  },
  {
    icon: HeartHandshake,
    title: "Kindness as a standard",
    body: "This is a space for gratitude, not a stage. Harassment, advertising and personal information are removed quietly.",
  },
  {
    icon: Users,
    title: "Students write, teachers read",
    body: "The wall exists so students can say the thing they could never say in class — to the teacher it was meant for.",
  },
  {
    icon: MessageSquareHeart,
    title: "Expression, not engagement",
    body: "No follower counts, no likes to chase, no algorithms. A note is here because it belongs here.",
  },
  {
    icon: Sparkles,
    title: "Real feelings welcome",
    body: "Thanks, frustrations, funny moments and reflections sit side by side. Not every note has to be sweet.",
  },
];

const STEPS = [
  { step: "01", title: "Name who it is for", body: "Add the teacher's name if you want them to know the note was meant for them. Leave it blank to write to everyone." },
  { step: "02", title: "Write your note", body: "Say the thing you actually want to say — thanks, a win, a frustration or a bit of encouragement." },
  { step: "03", title: "Choose a colour and submit", body: "Pick the note colour that feels right, then send it to the moderation queue." },
  { step: "04", title: "A moderator reads it", body: "A human checks every submission for kindness and relevance. It is not published automatically." },
  { step: "05", title: "Approved notes go live", body: "Once approved, your note appears on the Kindness Wall as 'Posted anonymously'." },
];

export default function AboutPage() {
  const { openShare } = useOutletContext();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="max-w-3xl pt-2">
        <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-brand-soft uppercase">About</p>
        <h1 className="mt-2 text-3xl font-extrabold text-fg sm:text-4xl">
          The place students can say the thing out loud.
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">
          {BRAND.name} is an anonymous note wall where students write to their teachers. It exists
          so that the thanks nobody says out loud, the small victories, the honest doubts and the
          funny moments have somewhere to go — without a name attached, and without an audience
          waiting to judge.
        </p>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">{BRAND.tagline}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" size="lg" onClick={openShare}>
            Write a Note
          </Button>
        </div>
      </section>

      <section aria-label="What this space values" className="mt-14">
        <h2 className="text-2xl font-bold text-fg">What this space values</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="panel p-6">
              <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand-soft">
                <Icon size={19} aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-fg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="How publishing works" className="mt-14">
        <h2 className="text-2xl font-bold text-fg">How a note reaches the wall</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Publishing is a moderated step, never an automatic one.
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((item) => (
            <li key={item.step} className="panel relative p-5">
              <span className="font-hand text-2xl font-bold text-note-yellow">{item.step}</span>
              <h3 className="mt-1 text-sm font-bold text-fg">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Community guidelines" className="mt-14 grid gap-4 lg:grid-cols-2">
        <div className="panel p-6 sm:p-7">
          <h2 className="text-lg font-bold text-fg">What fits on the wall</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            {[
              "Thanks you never got to say out loud",
              "Small wins worth celebrating",
              "Honest frustrations — vent without harming anyone",
              "Classroom stories and funny moments",
              "Practical advice for a teacher having a hard week",
              "Honest reflections on school",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-6 sm:p-7">
          <h2 className="text-lg font-bold text-fg">What does not</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            {[
              "Names, schools or identifying details about other students",
              "Harassment, insults or attacks on teachers or classmates",
              "Advertising, tutoring pitches or promotional content",
              "Spam or repeated copies of another note",
              "Anything that would put a student's identity at risk",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl border border-line-soft bg-surface-2 px-4 py-3 text-xs leading-relaxed text-faint">
            Every student can report a post using the “•••” menu on any note. Reports are private, and
            a moderator decides what happens next.
          </p>
        </div>
      </section>

      <section aria-label="Privacy" className="panel mt-14 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-fg">Privacy, in plain language</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Public notes display 'Posted anonymously'.",
            "Rejection reasons are visible to moderators only.",
            "Reporters are never revealed to the author.",
            "Moderation actions are logged with moderator and timestamp.",
          ].map((item) => (
            <p key={item} className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
              {item}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}