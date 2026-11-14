import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import SetupScreen from "./setup.tsx";
import { apiBaseUrl, defaultDeckSources, loadDeck, loadRemoteDeckSources } from "./deck-source.ts";
import { playSfx, setSoundEnabled } from "./audio.ts";
import { BUTTON_TEXT } from "./ui-copy.ts";
import {
  buildMatch,
  DEFAULT_MAX_SKIPS,
  formatClock,
  reducer,
  scoreFor,
  shuffle,
  toScale,
  totalTurns,
} from "./game.ts";
import { LeaveMatchSheet, SettingsSheet } from "./match/match-sheets.tsx";
import { MatchHeader } from "./match/match-header.tsx";
import { PlayPanel } from "./match/play-panel.tsx";
import { ScorePanel } from "./match/score-panel.tsx";
import { SpectrumBoard } from "./match/spectrum-board.tsx";
import type { DeckSource, Match, SetupConfig } from "./types.ts";

const MATCH_KEY = "wavelength.match.v1";
const CONFIG_KEY = "wavelength.config.v1";
const SOUND_KEY = "wavelength.sound.v1";
const EASY_KEY = "wavelength.easy.v1";

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
    // matches saved before the two timers existed
    const psychicSeconds = parsed.psychicSeconds ?? parsed.turnSeconds ?? 90;
    return {
      ...parsed,
      psychicSeconds,
      guessSeconds: parsed.guessSeconds ?? parsed.turnSeconds ?? 90,
      maxSkipsPerTeam: parsed.maxSkipsPerTeam ?? DEFAULT_MAX_SKIPS,
      skipsUsed: parsed.skipsUsed ?? parsed.teams.map(() => 0),
      cardIndex: parsed.cardIndex ?? parsed.turnIndex,
      targetBag: parsed.targetBag ?? [],
      remainingMs:
        typeof parsed.remainingMs === "number" ? Math.max(0, parsed.remainingMs) : psychicSeconds * 1000,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [match, dispatch] = useReducer(reducer, null, loadMatch);
  const [soundOn, setSoundOn] = useState(() => safeGet(SOUND_KEY) !== "off");
  // Hard mode is the default: no scale markers and no position readouts.
  const [easyMode, setEasyMode] = useState(() => safeGet(EASY_KEY) === "on");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [homePromptOpen, setHomePromptOpen] = useState(false);
  const [remaining, setRemaining] = useState(() => match?.remainingMs ?? 90_000);
  const [paused, setPaused] = useState(false);
  const deadlineRef = useRef(0);
  const leftRef = useRef(remaining);
  const [lastConfig, setLastConfig] = useState<SetupConfig | null>(() => {
    try {
      return JSON.parse(safeGet(CONFIG_KEY) ?? "null") as SetupConfig | null;
    } catch {
      return null;
    }
  });
  const lastTick = useRef<number | null>(null);
  const lastTickSecond = useRef<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const sources = useMemo(() => defaultDeckSources(), []);
  const [remoteSources, setRemoteSources] = useState<DeckSource[]>([]);

  // A configured backend adds its decks next to the built-in ones.
  useEffect(() => {
    const api = apiBaseUrl();
    if (!api) return;
    let live = true;
    loadRemoteDeckSources(api).then((loaded) => {
      if (live) setRemoteSources(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  const allSources = useMemo(
    () => (remoteSources.length > 0 ? [...sources, ...remoteSources] : sources),
    [sources, remoteSources],
  );

  const turnIndex = match?.turnIndex ?? 0;

  useEffect(() => {
    setSoundEnabled(soundOn);
    safeSet(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    safeSet(EASY_KEY, easyMode ? "on" : "off");
  }, [easyMode]);

  // Restore the clock where the last save left it, instead of restarting at zero.
  useEffect(() => {
    deadlineRef.current = Date.now() + leftRef.current;
  }, []);

  // A needle drag commits many times a second, so a move that changes nothing
  // but the needle is written after a short pause. Everything else is written at
  // once. The clock saves its own time left, and a hidden tab flushes it.
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (!match) {
      try {
        localStorage.removeItem(MATCH_KEY);
      } catch {
        // storage disabled
      }
      lastSaved.current = null;
      return;
    }
    // The clock and the needle are left out of the comparison: a drag and every
    // tick would otherwise look like a real change.
    const snapshot = JSON.stringify({ ...match, needleAngle: 0, remainingMs: 0 });
    const write = () => {
      safeSet(MATCH_KEY, JSON.stringify({ ...match, remainingMs: leftRef.current }));
      lastSaved.current = snapshot;
    };
    const id = snapshot === lastSaved.current ? setTimeout(write, 250) : (write(), undefined);
    const flush = () => {
      if (document.visibilityState === "hidden") write();
    };
    addEventListener("pagehide", write);
    document.addEventListener("visibilitychange", flush);
    return () => {
      if (id !== undefined) clearTimeout(id);
      removeEventListener("pagehide", write);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [match]);

  useEffect(() => {
    if (lastConfig) safeSet(CONFIG_KEY, JSON.stringify(lastConfig));
  }, [lastConfig]);

  const inMatch = match !== null;
  // Only the psychic and the guessers are timed; the reveal and the game over
  // screen leave the clock where it stopped.
  const timed = match?.phase === "psychic" || match?.phase === "guess";
  useEffect(() => {
    if (!inMatch || paused || !timed) return;
    const id = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      leftRef.current = left;
      setRemaining(left);
      // tick once per second in the last ten seconds
      const seconds = Math.ceil(left / 1000);
      if (seconds >= 1 && seconds <= 10 && lastTickSecond.current !== seconds) {
        lastTickSecond.current = seconds;
        playSfx("tick");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [inMatch, paused, timed]);

  const resetTimer = (seconds: number) => {
    const ms = seconds * 1000;
    deadlineRef.current = Date.now() + ms;
    leftRef.current = ms;
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
      const left = Math.max(0, deadlineRef.current - Date.now());
      leftRef.current = left;
      setRemaining(left);
      setPaused(true);
    }
  };

  const handleStart = async (config: SetupConfig) => {
    setStarting(true);
    setStartError(null);
    try {
      const spectra = await loadDeck(allSources, config.decks);
      if (spectra.length === 0 && config.custom.length === 0) {
        throw new Error("No questions available");
      }
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
  };

  const deal = (type: "next" | "skip") => {
    if (!match) return;
    const reshuffle = match.deck.length > 0 && (match.cardIndex + 1) % match.deck.length === 0;
    const deck = reshuffle ? shuffle(match.deck) : undefined;
    dispatch(type === "next" ? { type: "next", deck } : { type: "skip", deck });
    playSfx("click");
    resetTimer(match.psychicSeconds);
  };

  if (!match) {
    return (
      <div className="paper-texture min-h-dvh bg-paper text-ink">
        <div
          className="diwali-bg"
          aria-hidden="true"
          data-testid="diwali-bg"
        />
        <SetupScreen
          onStart={handleStart}
          sources={allSources}
          busy={starting}
          error={startError}
          easyMode={easyMode}
          onEasyModeChange={setEasyMode}
        />
      </div>
    );
  }

  const teamIndex = turnIndex % match.teams.length;
  const team = match.teams[teamIndex];
  const cardNo = (match.cardIndex % match.deck.length) + 1;
  const card = match.deck[cardNo - 1] ?? { left: "—", right: "—" };
  const turns = totalTurns(match.teams.length, match.rounds);
  const timedOut = remaining <= 0 && !paused;
  const needleVisible = match.phase === "guess" || match.phase === "reveal";
  const targetVisible = match.phase === "psychic" || match.phase === "reveal";
  const skipsLeft = match.maxSkipsPerTeam - (match.skipsUsed[teamIndex] ?? 0);

  return (
    <div className="paper-texture min-h-dvh bg-paper text-ink">
      <div
        className="diwali-bg"
        aria-hidden="true"
        data-testid="diwali-bg"
      />
      <MatchHeader
        teamName={team.name}
        teamColor={team.color}
        turnLabel={`${turnIndex + 1}/${turns}`}
        clock={formatClock(remaining)}
        urgent={timedOut}
        paused={paused}
        onHome={() => setHomePromptOpen(true)}
        onTogglePause={togglePause}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="match-shell relative z-10 mx-auto px-4 pb-4 pt-4">
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
              {BUTTON_TEXT.psychic}
            </button>
          </div>
        ) : (
          <div className="match-grid">
            <SpectrumBoard
              card={card}
              phase={match.phase}
              easyMode={easyMode}
              needle={match.needleAngle}
              target={match.targetAngle}
              showNeedle={needleVisible}
              showTarget={targetVisible}
              interactive={match.phase === "guess"}
              points={match.lastPoints}
              turnIndex={turnIndex}
              onNeedle={handleNeedle}
            />
            <PlayPanel
              match={match}
              team={team}
              skipsLeft={skipsLeft}
              timedOut={timedOut}
              turns={turns}
              turnIndex={turnIndex}
              lastConfig={lastConfig}
              onHideTarget={() => {
                playSfx("lock");
                dispatch({ type: "guess" });
                if (match) resetTimer(match.guessSeconds);
              }}
              onSkip={() => deal("skip")}
              onReveal={handleReveal}
              onNext={() => deal("next")}
              onPlayAgain={() => lastConfig && handleStart(lastConfig)}
              onNewSetup={() => dispatch({ type: "abort" })}
            />
            {match.phase !== "gameover" && (
              <ScorePanel teams={match.teams} activeIndex={teamIndex} />
            )}
          </div>
        )}
      </main>

      {homePromptOpen && (
        <LeaveMatchSheet
          onStay={() => setHomePromptOpen(false)}
          onLeave={() => {
            setHomePromptOpen(false);
            dispatch({ type: "abort" });
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          match={match}
          sources={allSources}
          cardNo={cardNo}
          soundOn={soundOn}
          easyMode={easyMode}
          onClose={() => setSettingsOpen(false)}
          onToggleSound={() => setSoundOn((value) => !value)}
          onToggleEasy={() => setEasyMode((value) => !value)}
          onAbort={() => {
            setSettingsOpen(false);
            dispatch({ type: "abort" });
          }}
        />
      )}
    </div>
  );
}
