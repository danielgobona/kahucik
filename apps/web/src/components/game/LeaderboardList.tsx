import type { RankedParticipant } from "@/lib/types";
import { cn } from "@/lib/cn";

export function LeaderboardList({
  entries,
  highlightId,
  className,
}: {
  entries: RankedParticipant[];
  highlightId?: string;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-2", className)}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "flex items-center justify-between rounded-xl px-4 py-3",
            highlightId === entry.id
              ? "bg-coral-100 font-semibold ring-2 ring-coral-400"
              : "bg-white/80",
          )}
        >
          <span>
            <span className="mr-2 text-coral-500">#{entry.rank}</span>
            {entry.nickname}
            {entry.is_guest ? (
              <span className="ml-2 text-xs text-slate-400">guest</span>
            ) : null}
          </span>
          <span className="font-bold text-slate-800">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}
