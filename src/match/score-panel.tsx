import type { Team } from "../types.ts";

export function ScorePanel({ teams, activeIndex }: { teams: Team[]; activeIndex: number }) {
  return (
    <section className="card p-4" data-testid="score-panel">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Scoreboard</h2>
      <div className="flex flex-col gap-1 lg:flex-row lg:gap-2">
        {teams.map((entry, index) => (
          <div
            key={entry.name}
            className="flex flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2 font-bold">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-line"
                style={{ background: entry.color }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span
              className={`mono-num shrink-0 font-black ${
                index === activeIndex ? "rounded-full border-2 border-line px-2 py-0.5" : ""
              }`}
            >
              {entry.score}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
