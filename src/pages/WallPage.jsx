import { useOutletContext } from "react-router-dom";
import FreedomWall from "../components/public/FreedomWall";
import CommunityStats from "../components/public/CommunityStats";

export default function WallPage() {
  const { openShare, openPost, openReport } = useOutletContext();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pt-2">
        <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-brand-soft uppercase">
          Kindness Wall
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-fg sm:text-4xl">
          Every approved note, in one place.
        </h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] text-muted">
          Notes here have already passed moderation. Nothing on this wall is published automatically —
          and no student is identified unless they chose to be.
        </p>
      </div>

      <div className="mt-8">
        <CommunityStats />
      </div>

      <div className="mt-10 sm:mt-12">
        <FreedomWall onOpenPost={openPost} onReport={openReport} onShare={openShare} />
      </div>
    </div>
  );
}