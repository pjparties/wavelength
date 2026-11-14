import { GearIcon } from "../icons.tsx";
import { BUTTON_ARIA } from "../ui-copy.ts";

/** The clock and the team on turn. The title yields space so the team name stays readable. */
export function MatchHeader({
  teamName,
  teamColor,
  turnLabel,
  clock,
  urgent,
  paused,
  onHome,
  onTogglePause,
  onOpenSettings,
}: {
  teamName: string;
  teamColor: string;
  turnLabel: string;
  clock: string;
  urgent: boolean;
  paused: boolean;
  onHome: () => void;
  onTogglePause: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-paper/95 backdrop-blur">
      <div className="match-shell mx-auto flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="title shrink-0 text-sm leading-none tracking-tight sm:text-lg sm:tracking-wide"
          data-testid="home"
          aria-label={BUTTON_ARIA.home}
          onClick={onHome}
        >
          WAVELENGTH
        </button>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: teamColor }} />
          <span className="min-w-0 truncate text-sm font-black uppercase">{teamName}</span>
          <span className="mono-num hidden shrink-0 text-xs opacity-60 sm:inline">{turnLabel}</span>
          <span
            className={`mono-num shrink-0 rounded-md border-2 border-line px-2 py-0.5 text-sm font-bold ${
              urgent ? "timer-urgent" : ""
            }`}
          >
            {clock}
          </span>
          <button
            type="button"
            className="btn grid h-11 w-11 shrink-0 place-items-center p-0 text-xl leading-none"
            data-testid="toggle-timer"
            onClick={onTogglePause}
            aria-label={paused ? BUTTON_ARIA.resumeTimer : BUTTON_ARIA.pauseTimer}
          >
            {paused ? "▶" : "❚❚"}
          </button>
          <button
            type="button"
            className="btn grid h-11 w-11 shrink-0 place-items-center p-0"
            data-testid="settings"
            onClick={onOpenSettings}
            aria-label={BUTTON_ARIA.settings}
          >
            <GearIcon className="h-7 w-7" />
          </button>
        </div>
      </div>
    </header>
  );
}
