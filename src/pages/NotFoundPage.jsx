import { Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";
import Button from "../components/ui/Button";
import { useOutletContext } from "react-router-dom";

export default function NotFoundPage() {
  const { openShare } = useOutletContext();

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-brand/25 bg-brand/10 text-brand-soft">
        <Compass size={28} aria-hidden="true" />
      </div>
      <p className="font-hand text-3xl font-bold text-note-yellow">404</p>
      <h1 className="mt-2 text-3xl font-extrabold text-fg">This page isn't on the wall.</h1>
      <p className="mt-3 text-[0.9375rem] text-muted">
        The link you followed doesn't exist. Head back and read what other students have pinned.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button as={Link} to="/wall" variant="primary" size="lg">
          Go to the Kindness Wall
        </Button>
        <Button variant="secondary" size="lg" onClick={openShare}>
          <Plus size={16} aria-hidden="true" />
          Write a Note
        </Button>
      </div>
    </div>
  );
}