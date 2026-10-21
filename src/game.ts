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
/** The target may sit anywhere on the scale, ends included: at an end the banded spectrum is only half. */
export const TARGET_MIN = 0;
export const TARGET_MAX = 180;
/** The needle stays on the scale: it may not go below 0 or above 10. */
export const NEEDLE_MIN = 0;
export const NEEDLE_MAX = 180;

/** Cards a team may skip per match unless the setup says otherwise. */
export const DEFAULT_MAX_SKIPS = 3;

export const ZONE_CORE = 5;
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

/** Default names for the first eight teams, in the order they are added. */
export const TEAM_NAMES = [
  "Starks",
  "Lannisters",
  "Targaryens",
  "Baratheons",
  "Tyrells",
  "Greyjoys",
  "Night’s Watch",
  "The Kingsguards",
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Secret target position for a round, including both scale endpoints. */
export function randomTarget(random: () => number = Math.random): number {
  return TARGET_MIN + Math.floor(random() * (TARGET_MAX - TARGET_MIN + 1));
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

export type ParsedCustom =
  | { ok: true; spectrum: Spectrum }
  | { ok: false; error: string };

/**
 * A custom spectrum is written as "Left pole : Right pole". The left end is
 * always 0 and the right end always 100, so there is nothing to type for them.
 */
export function parseCustomSpectrum(line: string): ParsedCustom {
  const separator = line.indexOf(":");
  if (separator === -1) {
    return { ok: false, error: 'Use "Left pole : Right pole"' };
  }
  const left = line.slice(0, separator).trim();
  const right = line.slice(separator + 1).trim();
  if (!left || !right) {
    return { ok: false, error: "Both poles need a word" };
  }
  return { ok: true, spectrum: { left, right } };
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
    psychicSeconds: config.psychicSeconds,
    guessSeconds: config.guessSeconds,
    deck: buildDeck(spectra, config.custom, config.customFirst),
    customCount: config.custom.length,
    deckIds: config.decks,
    targetScore: config.targetScore,
    turnIndex: 0,
    cardIndex: 0,
    targetAngle: randomTarget(),
    needleAngle: 90,
    phase: "psychic_pass",
    lastPoints: null,
    winner: null,
    maxSkipsPerTeam: config.maxSkipsPerTeam,
    skipsUsed: config.teams.map(() => 0),
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
        cardIndex: state.cardIndex + 1,
        phase: "psychic_pass",
        targetAngle: randomTarget(),
        needleAngle: 90,
        lastPoints: null,
        deck: action.deck ?? state.deck,
      };
    }
    case "skip": {
      if (state.phase !== "psychic") return state;
      const index = state.turnIndex % state.teams.length;
      if ((state.skipsUsed[index] ?? 0) >= state.maxSkipsPerTeam) return state;
      return {
        ...state,
        cardIndex: state.cardIndex + 1,
        skipsUsed: state.skipsUsed.map((used, i) => (i === index ? used + 1 : used)),
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
  for (const [key, label] of [
    ["psychicSeconds", "Psychic time"],
    ["guessSeconds", "Guesser time"],
  ] as const) {
    const value = config[key];
    if (!Number.isInteger(value) || value < 15 || value > 300) {
      errors[key] = `${label} must be between 15 and 300 seconds`;
    }
  }
  if (config.decks.length === 0 && config.custom.length === 0) {
    errors.decks = "Pick a deck or add custom spectra";
  }
  if (!Number.isInteger(config.maxSkipsPerTeam) || config.maxSkipsPerTeam < 0 || config.maxSkipsPerTeam > 10) {
    errors.maxSkipsPerTeam = "Max skips must be between 0 and 10";
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
