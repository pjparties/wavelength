import { BUTTON_TEXT } from "../ui-copy.ts";
import { toScale } from "../game.ts";
import type { Match, SetupConfig, Team } from "../types.ts";

const POINTS_LABEL: Record<number, string> = {
  4: "Bullseye!",
  3: "Close!",
  2: "Near miss",
  0: "Miss",
};

const POINTS_COLOR: Record<number, string> = {
  4: "var(--zone-5)",
  3: "var(--zone-3)",
  2: "var(--zone-1)",
  0: "var(--zone-0)",
};

/** The one control for the current phase. A new phase is a branch here, not a change to the shell. */
export function PlayPanel({
  match,
  team,
  skipsLeft,
  timedOut,
  turns,
  turnIndex,
  lastConfig,
  onHideTarget,
  onSkip,
  onReveal,
  onNext,
  onPlayAgain,
  onNewSetup,
}: {
  match: Match;
  team: Team;
  skipsLeft: number;
  timedOut: boolean;
  turns: number;
  turnIndex: number;
  lastConfig: SetupConfig | null;
  onHideTarget: () => void;
  onSkip: () => void;
  onReveal: () => void;
  onNext: () => void;
  onPlayAgain: () => void;
  onNewSetup: () => void;
}) {
  return (
    <section className="card mb-3 p-4 text-center" data-testid="play">
      {match.phase === "psychic" && (
        <>
          <p className="text-sm font-bold uppercase tracking-wide opacity-70">Give your team a clue</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-lg flex-1"
              data-testid="hide-target"
              onClick={onHideTarget}
            >
              {BUTTON_TEXT.hideTarget}
            </button>
            {match.maxSkipsPerTeam > 0 && (
              <button
                type="button"
                className="btn btn-lg shrink-0"
                data-testid="skip"
                disabled={skipsLeft <= 0}
                onClick={onSkip}
                aria-label={`Skip this card, ${skipsLeft} left for ${team.name}`}
              >
                {BUTTON_TEXT.skip} ({skipsLeft})
              </button>
            )}
          </div>
        </>
      )}

      {match.phase === "guess" && (
        <>
          <p className="text-sm font-bold uppercase tracking-wide opacity-70">
            {timedOut ? "Time! Lock in your guess" : "Drag the needle to your guess"}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg mt-3 w-full"
            data-testid="reveal"
            onClick={onReveal}
          >
            {BUTTON_TEXT.lockIn}
          </button>
        </>
      )}

      {match.phase === "reveal" && (
        <>
          <p
            className={`text-5xl font-black ${match.lastPoints === 0 ? "wobble" : ""}`}
            style={{ color: POINTS_COLOR[match.lastPoints ?? 0] }}
          >
            +{match.lastPoints}
          </p>
          <p className="mt-1 text-lg font-black uppercase">{POINTS_LABEL[match.lastPoints ?? 0]}</p>
          <p className="mt-1 text-sm opacity-70">
            Target was at {toScale(match.targetAngle).toFixed(1)} / 10
          </p>
          <button type="button" className="btn btn-primary btn-lg mt-3 w-full" data-testid="next" onClick={onNext}>
            {match.winner || turnIndex + 1 >= turns ? BUTTON_TEXT.seeResults : BUTTON_TEXT.nextRound}
          </button>
        </>
      )}

      {match.phase === "gameover" && (
        <>
          <h2 className="title text-3xl">{match.winner ? `${match.winner} wins!` : "Game over"}</h2>
          <div className="mt-4 flex flex-col gap-2">
            {[...match.teams]
              .sort((a, b) => b.score - a.score)
              .map((entry, rank) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between rounded-md border-2 border-line px-3 py-2"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span
                      className="h-3 w-3 rounded-full border border-line"
                      style={{ background: entry.color }}
                    />
                    {rank + 1}. {entry.name}
                  </span>
                  <span className="mono-num font-black">{entry.score}</span>
                </div>
              ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {lastConfig && (
              <button type="button" className="btn btn-primary" data-testid="play-again" onClick={onPlayAgain}>
                {BUTTON_TEXT.playAgain}
              </button>
            )}
            <button
              type="button"
              className={`btn ${lastConfig ? "" : "btn-primary"}`}
              data-testid="new-setup"
              onClick={onNewSetup}
            >
              {BUTTON_TEXT.newSetup}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
