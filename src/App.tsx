import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Dial from "./dial.tsx";
import SetupScreen from "./setup.tsx";
import { defaultDeckSources, loadDeck } from "./deck-source.ts";
import { DIWALI_BACKGROUND } from "./diwali.ts";
import { playSfx, setSoundEnabled } from "./audio.ts";
import {
  buildMatch,
  formatClock,
  reducer,
  scoreFor,
  shuffle,
  toScale,
  totalTurns,
} from "./game.ts";
import type { Match, SetupConfig } from "./types.ts";

const MATCH_KEY = "wavelength.match.v1";
const SOUND_KEY = "wavelength.sound.v1";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage disabled (private mode, file:// sandbox) - the game still works
  }
}

function loadMatch(): Match | null {
  try {
    const raw = safeGet(MATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Match & { turnSeconds?: number };
    if (!parsed?.teams?.length || !parsed.deck?.length) return null;
    return {
      ...parsed,
      // matches saved before the two timers existed
      psychicSeconds: parsed.psychicSeconds ?? parsed.turnSeconds ?? 60,
      guessSeconds: parsed.guessSeconds ?? parsed.turnSeconds ?? 45,
    };
  } catch {
    return null;
  }
}

const POINTS_LABEL: Record<number, string> = {
  5: "Bullseye!",
  3: "Close!",
  1: "Near miss",
  0: "Miss",
};

const POINTS_COLOR: Record<number, string> = {
  5: "var(--zone-5)",
  3: "var(--zone-3)",
  1: "var(--zone-1)",
  0: "var(--zone-0)",
};

export default function App() {
  const [match, dispatch] = useReducer(reducer, null, loadMatch);
  const [soundOn, setSoundOn] = useState(() => safeGet(SOUND_KEY) !== "off");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remaining, setRemaining] = useState(60_000);
  const [paused, setPaused] = useState(false);
  const deadlineRef = useRef(0);
  const [lastConfig, setLastConfig] = useState<SetupConfig | null>(null);
  const lastTick = useRef<number | null>(null);
  const lastTickSecond = useRef<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const sources = useMemo(() => defaultDeckSources(), []);

  const turnIndex = match?.turnIndex ?? 0;

  useEffect(() => {
    setSoundEnabled(soundOn);
    safeSet(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    if (!match) {
      try {
        localStorage.removeItem(MATCH_KEY);
      } catch {
        // storage disabled
      }
      return;
    }
    safeSet(MATCH_KEY, JSON.stringify(match));
  }, [match]);

  const inMatch = match !== null;
  useEffect(() => {
    if (!inMatch || paused) return;
    const id = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemaining(left);
      // tick once per second in the last ten seconds
      const seconds = Math.ceil(left / 1000);
      if (seconds >= 1 && seconds <= 10 && lastTickSecond.current !== seconds) {
        lastTickSecond.current = seconds;
        playSfx("tick");
      }
    }, 200);
    return () => clearInterval(id);
  }, [inMatch, paused]);

  const resetTimer = (seconds: number) => {
    const ms = seconds * 1000;
    deadlineRef.current = Date.now() + ms;
    setRemaining(ms);
    setPaused(false);
    lastTick.current = null;
    lastTickSecond.current = null;
  };

  const togglePause = () => {
    if (paused) {
      deadlineRef.current = Date.now() + remaining;
      setPaused(false);
    } else {
      setRemaining(Math.max(0, deadlineRef.current - Date.now()));
      setPaused(true);
    }
  };

  const handleStart = async (config: SetupConfig) => {
    setStarting(true);
    setStartError(null);
    try {
      const spectra = await loadDeck(sources, config.decks);
      if (spectra.length === 0) throw new Error("No questions available");
      setLastConfig(config);
      playSfx("lock");
      dispatch({ type: "start", match: buildMatch(config, spectra) });
      resetTimer(config.psychicSeconds);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Could not load the questions");
    } finally {
      setStarting(false);
    }
  };

  const handleNeedle = (angle: number) => {
    dispatch({ type: "needle", angle });
    const tick = Math.round(toScale(angle));
    if (lastTick.current !== null && tick !== lastTick.current) playSfx("click");
    lastTick.current = tick;
  };

  const handleReveal = () => {
    if (!match) return;
    const points = scoreFor(match.needleAngle, match.targetAngle);
    dispatch({ type: "reveal", points });
    playSfx(points === 0 ? "miss" : "reveal");
    resetTimer(match.psychicSeconds);
  };

  const handleNext = () => {
    if (!match) return;
    const nextIndex = match.turnIndex + 1;
    const reshuffle = match.deck.length > 0 && nextIndex % match.deck.length === 0;
    dispatch({ type: "next", deck: reshuffle ? shuffle(match.deck) : undefined });
    playSfx("click");
    resetTimer(match.psychicSeconds);
  };

  const chips = useMemo(() => {
    if (!match || match.lastPoints === null || match.phase !== "reveal") return [];
    const points = match.lastPoints;
    const count = Math.min(12, points * 3);
    return Array.from({ length: count }, (_, index) => {
      const seed = points * 37 + match.turnIndex * 91 + index * 53;
      return {
        left: `${8 + (seed % 78)}%`,
        top: `${15 + ((seed * 7) % 45)}%`,
        delay: ((seed % 60) / 100).toFixed(2),
        key: index,
      };
    });
  }, [match]);

  if (!match) {
    return (
      <div className="paper-texture min-h-dvh bg-paper text-ink">
        <div
          className="diwali-bg"
          aria-hidden="true"
          data-testid="diwali-bg"
          style={{ backgroundImage: DIWALI_BACKGROUND }}
        />
        <SetupScreen
          onStart={handleStart}
          sources={sources}
          busy={starting}
          error={startError}
        />
      </div>
    );
  }

  const teamIndex = turnIndex % match.teams.length;
  const team = match.teams[teamIndex];
  const card = match.deck[turnIndex % match.deck.length] ?? { left: "—", right: "—" };
  const turns = totalTurns(match.teams.length, match.rounds);
  const timedOut = remaining <= 0 && !paused;
  const needleVisible = match.phase === "guess" || match.phase === "reveal";
  const targetVisible = match.phase === "psychic" || match.phase === "reveal";

  return (
    <div className="paper-texture min-h-dvh bg-paper text-ink">
      <div
        className="diwali-bg"
        aria-hidden="true"
        data-testid="diwali-bg"
        style={{ backgroundImage: DIWALI_BACKGROUND }}
      />
      <header className="sticky top-0 z-30 border-b-2 border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-line"
              style={{ background: team.color }}
            />
            <span className="truncate text-sm font-black uppercase">{team.name}</span>
            <span className="mono-num shrink-0 text-xs opacity-60">
              {turnIndex + 1}/{turns}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`mono-num rounded-md border-2 border-line px-2 py-0.5 text-sm font-bold ${
                timedOut ? "timer-urgent" : ""
              }`}
            >
              {formatClock(remaining)}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              data-testid="toggle-timer"
              onClick={togglePause}
              aria-label={paused ? "Resume timer" : "Pause timer"}
            >
              {paused ? "▶" : "❚❚"}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              data-testid="settings"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        {match.phase === "psychic_pass" ? (
          <div className="card p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">
              Pass the device to
            </p>
            <h2 className="title text-4xl" style={{ color: team.color }}>
              {team.name}
            </h2>
            <p className="mt-1 text-lg font-black uppercase">Psychic</p>
            <p className="mx-auto mt-3 max-w-xs text-sm opacity-70">
              Only the psychic may look at the target. Everyone else, look away.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg mt-5 w-full max-w-xs"
              data-testid="psychic"
              onClick={() => {
                playSfx("click");
                dispatch({ type: "pass" });
                if (match) resetTimer(match.psychicSeconds);
              }}
            >
              I&apos;m the psychic — show the card
            </button>
          </div>
        ) : (
          <>
            <section className="card mb-3 p-4">
              <div className="flex items-center gap-3">
                <p className="flex-1 text-center text-base font-black uppercase leading-tight sm:text-xl">
                  {card.left}
                </p>
                <svg viewBox="0 0 120 12" className="h-3 w-24 shrink-0 sm:w-40" aria-hidden="true">
                  <line x1="6" y1="6" x2="114" y2="6" stroke="currentColor" strokeWidth="2" />
                  <path d="M6 1 L16 6 L6 11 Z" fill="currentColor" />
                  <path d="M114 1 L104 6 L114 11 Z" fill="currentColor" />
                </svg>
                <p className="flex-1 text-center text-base font-black uppercase leading-tight sm:text-xl">
                  {card.right}
                </p>
              </div>
              {match.phase === "psychic" && (
                <p className="mono-num mt-3 text-center text-sm font-bold opacity-80">
                  Target sits at {(toScale(match.targetAngle)).toFixed(1)} / 10
                </p>
              )}
              {match.phase === "guess" && (
                <p className="mono-num mt-3 text-center text-sm font-bold opacity-80">
                  Needle at {toScale(match.needleAngle).toFixed(1)} / 10
                </p>
              )}
            </section>

            <section className="card relative mb-3 p-3">
              <Dial
                needle={needleVisible ? match.needleAngle : null}
                target={targetVisible ? match.targetAngle : null}
                plainFace={match.phase === "psychic"}
                interactive={match.phase === "guess" && !timedOut}
                onChange={handleNeedle}
              />
              {chips.length > 0 &&
                chips.map((chip) => (
                  <span
                    key={chip.key}
                    className="points-chip text-2xl"
                    style={{
                      left: chip.left,
                      top: chip.top,
                      color: POINTS_COLOR[match.lastPoints ?? 0],
                      animationDelay: `${chip.delay}s`,
                    }}
                  >
                    +{match.lastPoints}
                  </span>
                ))}
            </section>

            <section className="card mb-3 p-4 text-center">
              {match.phase === "psychic" && (
                <>
                  <p className="text-sm font-bold uppercase tracking-wide opacity-70">
                    Give your team a clue
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg mt-3 w-full"
                    data-testid="hide-target"
                    onClick={() => {
                      playSfx("lock");
                      dispatch({ type: "guess" });
                      if (match) resetTimer(match.guessSeconds);
                    }}
                  >
                    Hide target — pass to guessers
                  </button>
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
                    onClick={handleReveal}
                  >
                    Lock in &amp; reveal
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
                    Target was at {(toScale(match.targetAngle)).toFixed(1)} / 10
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg mt-3 w-full"
                    data-testid="next"
                    onClick={handleNext}
                  >
                    {match.winner || turnIndex + 1 >= turns ? "See results" : "Next round"}
                  </button>
                </>
              )}

              {match.phase === "gameover" && (
                <>
                  <h2 className="title text-3xl">
                    {match.winner ? `${match.winner} wins!` : "Game over"}
                  </h2>
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
                      <button
                        type="button"
                        className="btn btn-primary"
                        data-testid="play-again"
                        onClick={() => handleStart(lastConfig)}
                      >
                        Play again
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn ${lastConfig ? "" : "btn-primary"}`}
                      data-testid="new-setup"
                      onClick={() => dispatch({ type: "abort" })}
                    >
                      New setup
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="card p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">
                Scoreboard
              </h2>
              <div className="flex flex-col gap-1 lg:flex-row lg:gap-2">
                {match.teams.map((entry, index) => (
                  <div
                    key={entry.name}
                    className={`flex flex-1 items-center justify-between rounded-md px-2 py-1.5 ${
                      index === teamIndex ? "border-2 border-line" : "border-2 border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <span
                        className="h-3 w-3 rounded-full border border-line"
                        style={{ background: entry.color }}
                      />
                      {entry.name}
                    </span>
                    <span className="mono-num font-black">{entry.score}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="card w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-wide">Settings</h2>
              <button
                type="button"
                className="btn btn-sm"
                data-testid="close-settings"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Sound</h3>
            <button
              type="button"
              className={`btn btn-sm w-full ${soundOn ? "btn-primary" : ""}`}
              onClick={() => setSoundOn((value) => !value)}
            >
              {soundOn ? "✓ Sound on" : "Sound off"}
            </button>

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
                <dt className="opacity-70">Custom spectra</dt>
                <dd>{match.customCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-70">In this match</dt>
                <dd>{match.deck.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-70">Played / left</dt>
                <dd>
                  {Math.min(turnIndex + 1, match.deck.length)} /{" "}
                  {Math.max(0, match.deck.length - turnIndex - 1)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              className="btn btn-danger mt-5 w-full"
              data-testid="abort"
              onClick={() => {
                setSettingsOpen(false);
                dispatch({ type: "abort" });
              }}
            >
              Abort match
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
