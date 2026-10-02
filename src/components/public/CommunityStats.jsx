import { useEffect, useState } from "react";
import { fetchCommunityStats } from "../../lib/db/stats";
import { COMMUNITY_STATS } from "../../lib/constants";

/**
 * Headline counters, read live from the database through the anon-safe
 * `community_stats()` function. Falls back to the static copy in constants so the
 * page still reads sensibly when Supabase is not configured or unreachable — but
 * the placeholder numbers are then visibly placeholders (all zeros), never
 * presented as if they were real figures.
 */
export default function CommunityStats({ stats }) {
  const [live, setLive] = useState(stats ?? null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (stats) return undefined;
    let active = true;
    fetchCommunityStats().then((next) => {
      if (!active) return;
      setLive(next);
      setIsLive(next.some((s) => s.value !== "0" && s.value !== "0%"));
    });
    return () => {
      active = false;
    };
  }, [stats]);

  const shown = stats ?? live ?? COMMUNITY_STATS;

  return (
    <section aria-label="Community statistics" className="px-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((stat) => (
          <div
            key={stat.id}
            className="panel group px-4 py-5 transition duration-300 hover:border-surface-4 sm:px-6 sm:py-6"
          >
            <p className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[0.8125rem] font-semibold text-fg-soft sm:text-sm">{stat.label}</p>
            <p className="mt-1 hidden text-xs text-faint sm:block">{stat.hint}</p>
          </div>
        ))}
      </div>

      {!stats && !isLive && (
        <p className="mt-3 text-center text-[0.6875rem] text-faint">
          Community totals appear once the database is connected.
        </p>
      )}
    </section>
  );
}