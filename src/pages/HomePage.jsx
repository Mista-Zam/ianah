import { useOutletContext } from "react-router-dom";
import HeroSection from "../components/public/HeroSection";
import CommunityStats from "../components/public/CommunityStats";
import FreedomWall from "../components/public/FreedomWall";

export default function HomePage() {
  const { openShare, openPost, openReport } = useOutletContext();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <HeroSection onShare={openShare} />
      <CommunityStats />
      <div className="mt-12 sm:mt-16">
        <FreedomWall onOpenPost={openPost} onReport={openReport} onShare={openShare} />
      </div>
    </div>
  );
}