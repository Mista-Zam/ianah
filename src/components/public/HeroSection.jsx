import { ArrowDown, Plus, ShieldCheck } from "lucide-react";
import { BRAND } from "../../lib/constants";
import Button from "../ui/Button";

export default function HeroSection({ onShare }) {
  const scrollToWall = () => {
    document.getElementById("wall")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative overflow-hidden px-4 pt-12 pb-10 sm:px-6 sm:pt-16 sm:pb-14 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[30rem] bg-[radial-gradient(45rem_20rem_at_50%_0%,rgba(167,139,250,0.22),transparent_70%)] blur-[2px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-6 -left-24 hidden h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,143,179,0.16),transparent_65%)] blur-2xl lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 -right-24 hidden h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(112,207,255,0.14),transparent_65%)] blur-2xl lg:block"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/80 px-3.5 py-1.5 text-[0.6875rem] font-bold tracking-[0.14em] text-muted uppercase">
          <ShieldCheck size={13} className="text-brand-soft" aria-hidden="true" />
          Moderated · Anonymous · For Teachers
        </span>

        <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-fg sm:text-5xl lg:text-6xl">
          Every Student&apos;s Message,{" "}
          <span className="relative inline-block">
            <span className="relative z-10">For Their Teachers.</span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-1 z-0 h-3 -rotate-1 rounded-sm bg-brand/35"
            />
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
          Write an anonymous note to a teacher. Say thanks, share a win, or tell them the thing you
          never got to say out loud.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="primary" size="lg" onClick={onShare} className="w-full sm:w-auto">
            <Plus size={17} aria-hidden="true" />
            Write a Note
          </Button>
          <Button variant="secondary" size="lg" onClick={scrollToWall} className="w-full sm:w-auto">
            Explore the Wall
            <ArrowDown size={16} aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-5 text-xs text-faint">
          Nothing appears instantly — every note is read by a moderator first. {BRAND.supporting}
        </p>
      </div>
    </section>
  );
}