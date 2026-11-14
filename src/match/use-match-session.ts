import { useEffect, useReducer, useRef, useState } from "react";
import { playSfx } from "../audio.ts";
import { loadDeck } from "../deck-source.ts";
import { buildMatch, reducer, reshuffledDeck, scoreFor, toScale } from "../game.ts";
import { safeGet, safeRemove, safeSet } from "../storage.ts";
import type { DeckSource, Match, SetupConfig } from "../types.ts";
import { phaseView } from "./phase-view.ts";
import { readSavedMatch } from "./saved-match.ts";

const MATCH_KEY = "wavelength.match.v1";
const CONFIG_KEY = "wavelength.config.v1";

/**
 * The match, its clock, and the saved copy of both. The screen reads this
 * and calls the actions; it does not touch storage or the reducer.
 */
export function useMatchSession() {
  const [match, dispatch] = useReducer(reducer, null, () => readSavedMatch(safeGet(MATCH_KEY)));
  const [remaining, setRemaining] = useState(() => match?.remainingMs ?? 90_000);
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [lastConfig, setLastConfig] = useState<SetupConfig | null>(() => {
    try {
      return JSON.parse(safeGet(CONFIG_KEY) ?? "null") as SetupConfig | null;
    } catch {
      return null;
    }
  });

  const deadlineRef = useRef(0);
  const leftRef = useRef(remaining);
  const lastTick = useRef<number | null>(null);
  const lastTickSecond = useRef<number | null>(null);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    deadlineRef.current = Date.now() + leftRef.current;
  }, []);

  useEffect(() => {
    if (lastConfig) safeSet(CONFIG_KEY, JSON.stringify(lastConfig));
  }, [lastConfig]);

  useEffect(() => {
    if (!match) {
      safeRemove(MATCH_KEY);
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

  const inMatch = match !== null;
  const timed = match !== null && phaseView(match.phase).timed;
  useEffect(() => {
    if (!inMatch || paused || !timed) return;
    const id = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      leftRef.current = left;
      setRemaining(left);
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

  const start = async (config: SetupConfig, sources: DeckSource[]) => {
    setStarting(true);
    setStartError(null);
    try {
      const spectra = await loadDeck(sources, config.decks);
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

  const needle = (angle: number) => {
    dispatch({ type: "needle", angle });
    const tick = Math.round(toScale(angle));
    if (lastTick.current !== null && tick !== lastTick.current) playSfx("click");
    lastTick.current = tick;
  };

  const reveal = () => {
    if (!match) return;
    const points = scoreFor(match.needleAngle, match.targetAngle);
    dispatch({ type: "reveal", points });
    playSfx(points === 0 ? "miss" : "reveal");
  };

  const advance = (kind: "next" | "skip") => {
    if (!match) return;
    const deck = reshuffledDeck(match);
    dispatch(kind === "next" ? { type: "next", deck } : { type: "skip", deck });
    playSfx("click");
    resetTimer(match.psychicSeconds);
  };

  const pass = () => {
    if (!match) return;
    playSfx("click");
    dispatch({ type: "pass" });
    resetTimer(match.psychicSeconds);
  };

  const hideTarget = () => {
    if (!match) return;
    playSfx("lock");
    dispatch({ type: "guess" });
    resetTimer(match.guessSeconds);
  };

  const abort = () => dispatch({ type: "abort" });

  const playAgain = (sources: DeckSource[]) => {
    if (lastConfig) void start(lastConfig, sources);
  };

  return {
    match,
    remaining,
    paused,
    lastConfig,
    starting,
    startError,
    start,
    togglePause,
    needle,
    reveal,
    next: () => advance("next"),
    skip: () => advance("skip"),
    pass,
    hideTarget,
    abort,
    playAgain,
  };
}

export type MatchSession = ReturnType<typeof useMatchSession> & { match: Match };
