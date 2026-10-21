import type {
  Action,
  Match,
  SetupConfig,
  SetupErrors,
  Spectrum,
  TeamConfig,
} from "./types.ts";

export type { Action, Match, SetupConfig, SetupErrors, Spectrum, TeamConfig };

/** Dial geometry in "arc degrees": 0 = far left end of the arc, 90 = top, 180 = far right end. */
export const ARC_DEGREES = 180;
export const TARGET_MIN = 21;
export const TARGET_MAX = 159;
/** The needle may swing a little past the arc ends, otherwise the grey miss zone is unreachable. */
export const NEEDLE_MIN = -25;
export const NEEDLE_MAX = 205;

export const ZONE_CORE = 4.5;
export const ZONE_INNER = 13.5;
export const ZONE_OUTER = 22.5;

export const TEAM_PALETTE = [
  "#2F5DA8",
  "#C8553D",
  "#3C7A57",
  "#8A5A9B",
  "#C08A2E",
  "#2E7D8C",
  "#A63E64",
  "#5C6BC0",
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Secret target position for a round. */
export function randomTarget(): number {
  return TARGET_MIN + Math.random() * (TARGET_MAX - TARGET_MIN);
}

/** Points for a needle at `needle` against a target at `target`. */
export function scoreFor(needle: number, target: number): number {
  const diff = Math.abs(needle - target);
  if (diff <= ZONE_CORE) return 5;
  if (diff <= ZONE_INNER) return 3;
  if (diff <= ZONE_OUTER) return 1;
  return 0;
}

/** Position on the 0-10 reference scale. */
export function toScale(angle: number): number {
  return (angle / ARC_DEGREES) * 10;
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const CUSTOM_RE =
  /^\s*(\d{1,3})\s*:\s*(.+?)\s*(?:↔|->|=>|\||—|–|vs\.?)\s*(\d{1,3})\s*:\s*(.+?)\s*$/i;

export type ParsedCustom =
  | { ok: true; spectrum: Spectrum }
  | { ok: false; error: string };

export function parseCustomSpectrum(line: string): ParsedCustom {
  const match = CUSTOM_RE.exec(line);
  if (!match) return { ok: false, error: 'Use "0: Left pole ↔ 100: Right pole"' };
  const [, leftValue, left, rightValue, right] = match;
  const leftEnd = Number(leftValue);
  const rightEnd = Number(rightValue);
  if (leftEnd < 0 || leftEnd > 100 || rightEnd < 0 || rightEnd > 100) {
    return { ok: false, error: "End values must be whole numbers from 0 to 100" };
  }
  if (!left.trim() || !right.trim()) {
    return { ok: false, error: "Both poles need a word" };
  }
  return { ok: true, spectrum: { left: left.trim(), right: right.trim() } };
}

export function parseCustomSpectra(text: string): {
  items: Spectrum[];
  errors: { line: number; message: string }[];
} {
  const items: Spectrum[] = [];
  const errors: { line: number; message: string }[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const parsed = parseCustomSpectrum(line);
    if (parsed.ok) items.push(parsed.spectrum);
    else errors.push({ line: index + 1, message: parsed.error });
  });
  return { items, errors };
}

/** Custom spectra first (in the order written) or shuffled into the base deck. */
export function buildDeck(base: Spectrum[], custom: Spectrum[], customFirst: boolean): Spectrum[] {
  return customFirst ? [...custom, ...shuffle(base)] : shuffle([...base, ...custom]);
}

/** Start a match from a validated setup and the questions that were loaded for it. */
export function buildMatch(config: SetupConfig, spectra: Spectrum[]): Match {
  return {
    teams: config.teams.map((team) => ({ ...team, score: 0 })),
    rounds: config.rounds,
    turnSeconds: config.turnSeconds,
    deck: buildDeck(spectra, config.custom, config.customFirst),
    customCount: config.custom.length,
    deckIds: config.decks,
    targetScore: config.targetScore,
    turnIndex: 0,
    targetAngle: randomTarget(),
    needleAngle: 90,
    phase: "psychic_pass",
    lastPoints: null,
    winner: null,
  };
}

/** The whole game as one pure state machine: no React, no storage, no DOM. */
export function reducer(state: Match | null, action: Action): Match | null {
  if (action.type === "start") return action.match;
  if (action.type === "abort") return null;
  if (!state) return state;

  switch (action.type) {
    case "pass":
      return { ...state, phase: "psychic" };
    case "guess":
      return { ...state, phase: "guess" };
    case "needle":
      if (state.phase !== "guess") return state;
      return { ...state, needleAngle: action.angle };
    case "reveal": {
      const index = state.turnIndex % state.teams.length;
      const teams = state.teams.map((team, i) =>
        i === index ? { ...team, score: team.score + action.points } : team,
      );
      const current = teams[index];
      const reached = state.targetScore !== null && current.score >= state.targetScore;
      return {
        ...state,
        teams,
        phase: "reveal",
        lastPoints: action.points,
        winner: reached ? current.name : state.winner,
      };
    }
    case "next": {
      const nextIndex = state.turnIndex + 1;
      if (state.winner || nextIndex >= totalTurns(state.teams.length, state.rounds)) {
        return { ...state, phase: "gameover" };
      }
      return {
        ...state,
        turnIndex: nextIndex,
        phase: "psychic_pass",
        targetAngle: randomTarget(),
        needleAngle: 90,
        lastPoints: null,
        deck: action.deck ?? state.deck,
      };
    }
  }
}

export function validateSetup(config: SetupConfig): SetupErrors {
  const errors: SetupErrors = {};
  const names = config.teams.map((team) => team.name.trim().toLowerCase());

  if (config.teams.length < 2) errors.teams = "Add at least 2 teams";
  else if (config.teams.length > 8) errors.teams = "Maximum 8 teams";
  else if (new Set(names).size !== names.length) errors.teams = "Team names must be unique";
  else if (names.some((name) => !name)) errors.teams = "Every team needs a name";

  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > 20) {
    errors.rounds = "Rounds per team must be between 1 and 20";
  }
  if (
    !Number.isInteger(config.turnSeconds) ||
    config.turnSeconds < 15 ||
    config.turnSeconds > 300
  ) {
    errors.turnSeconds = "Turn length must be between 15 and 300 seconds";
  }
  if (config.decks.length === 0 && config.custom.length === 0) {
    errors.decks = "Pick a deck or add custom spectra";
  }
  if (config.targetScore !== null) {
    const max = config.rounds * 5;
    if (!Number.isInteger(config.targetScore) || config.targetScore <= 0) {
      errors.targetScore = "Target points must be greater than 0";
    } else if (config.targetScore > max) {
      errors.targetScore = `Target points cannot exceed ${max} (${config.rounds} rounds x 5 points)`;
    }
  }
  return errors;
}

export function totalTurns(teamCount: number, rounds: number): number {
  return teamCount * rounds;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
