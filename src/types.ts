/** Shared domain types. The UI, the game rules and the deck providers all speak these. */

export type Spectrum = { left: string; right: string };

export type TeamConfig = { name: string; color: string };

/**
 * A selectable source of questions. Built-in decks and backend/DB decks share
 * this shape, so adding a database-backed deck is a new provider, not a new UI.
 */
export type DeckSource = {
  id: string;
  label: string;
  /** Card count, when it is known without loading. */
  size?: number;
  load: () => Promise<Spectrum[]>;
};

export type SetupConfig = {
  teams: TeamConfig[];
  rounds: number;
  /** Seconds the psychic gets to think of a clue. */
  psychicSeconds: number;
  /** Seconds the guessing team gets to agree on an answer. */
  guessSeconds: number;
  /** Ids of the selected deck sources. */
  decks: string[];
  custom: Spectrum[];
  customFirst: boolean;
  targetScore: number | null;
  /** How many cards each team may skip. 0 turns the skip button off. */
  maxSkipsPerTeam: number;
};

export type SetupErrors = Partial<
  Record<
    "teams" | "rounds" | "psychicSeconds" | "guessSeconds" | "decks" | "targetScore" | "maxSkipsPerTeam",
    string
  >
>;

export type Phase = "psychic_pass" | "psychic" | "guess" | "reveal" | "gameover";

export type Team = { name: string; color: string; score: number };

export type Match = {
  teams: Team[];
  rounds: number;
  psychicSeconds: number;
  guessSeconds: number;
  deck: Spectrum[];
  customCount: number;
  /** Which deck sources produced this deck. */
  deckIds: string[];
  targetScore: number | null;
  turnIndex: number;
  /** Index into the deck for the card in play; a skip advances it without the turn. */
  cardIndex: number;
  targetAngle: number;
  needleAngle: number;
  phase: Phase;
  lastPoints: number | null;
  winner: string | null;
  maxSkipsPerTeam: number;
  /** Skips spent, indexed by team. */
  skipsUsed: number[];
};

export type Action =
  | { type: "start"; match: Match }
  | { type: "pass" }
  | { type: "guess" }
  | { type: "needle"; angle: number }
  | { type: "reveal"; points: number }
  | { type: "next"; deck?: Spectrum[] }
  | { type: "skip"; deck?: Spectrum[] }
  | { type: "abort" };
