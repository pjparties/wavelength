import Sheet from "../sheet.tsx";
import { BUTTON_ARIA, BUTTON_TEXT } from "../ui-copy.ts";
import type { DeckSource, Match } from "../types.ts";

export function LeaveMatchSheet({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <Sheet onClose={onStay}>
      <div className="card w-full p-5">
        <h2 className="title text-2xl">Leave the match?</h2>
        <p className="mt-2 text-sm opacity-70">
          The match ends here and the scores are lost. You can start a new one from the
          home screen.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn" data-testid="home-cancel" onClick={onStay}>
            {BUTTON_TEXT.keepPlaying}
          </button>
          <button type="button" className="btn btn-danger" data-testid="home-confirm" onClick={onLeave}>
            {BUTTON_TEXT.leaveMatch}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function SettingsSheet({
  match,
  sources,
  cardNo,
  soundOn,
  easyMode,
  onClose,
  onToggleSound,
  onToggleEasy,
  onAbort,
}: {
  match: Match;
  sources: DeckSource[];
  cardNo: number;
  soundOn: boolean;
  easyMode: boolean;
  onClose: () => void;
  onToggleSound: () => void;
  onToggleEasy: () => void;
  onAbort: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="card w-full p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-wide">Settings</h2>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="close-settings"
            onClick={onClose}
            aria-label={BUTTON_ARIA.closeSettings}
          >
            ✕
          </button>
        </div>

        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Sound</h3>
        <button
          type="button"
          className={`btn btn-sm w-full ${soundOn ? "btn-primary" : ""}`}
          data-testid="toggle-sound"
          onClick={onToggleSound}
        >
          {soundOn ? `✓ ${BUTTON_TEXT.soundOn}` : BUTTON_TEXT.soundOff}
        </button>

        <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-widest opacity-60">
          Difficulty
        </h3>
        <button
          type="button"
          className={`btn btn-sm w-full ${easyMode ? "btn-primary" : ""}`}
          data-testid="toggle-easy"
          onClick={onToggleEasy}
        >
          {easyMode ? `✓ ${BUTTON_TEXT.easyMode}` : BUTTON_TEXT.hardMode}
        </button>
        <p className="mt-1 text-xs opacity-60">
          Easy mode puts the 0-10 scale back on the dial and shows where the needle and
          the target sit.
        </p>

        <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-widest opacity-60">
          Card pool
        </h3>
        <dl className="mono-num flex flex-col gap-1 text-sm">
          {sources.map((source) => (
            <div key={source.id} className="flex justify-between">
              <dt className="opacity-70">{source.label} deck</dt>
              <dd>{source.size ?? "remote"}</dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="opacity-70">Decks in this match</dt>
            <dd>
              {match.deckIds
                .map((id) => sources.find((source) => source.id === id)?.label ?? id)
                .join(" + ") || "none"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">Custom spectra</dt>
            <dd>{match.customCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">In this match</dt>
            <dd>{match.deck.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-70">Card</dt>
            <dd>
              {cardNo} / {match.deck.length}
            </dd>
          </div>
        </dl>

        <button type="button" className="btn btn-danger mt-5 w-full" data-testid="abort" onClick={onAbort}>
          {BUTTON_TEXT.abortMatch}
        </button>
      </div>
    </Sheet>
  );
}
