import { DEFAULT_MAX_SKIPS } from "../game.ts";
import type { Match } from "../types.ts";

/** A saved match, including ones written before the two clocks and the skip limit existed. */
export function readSavedMatch(raw: string | null): Match | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Match & { turnSeconds?: number };
    if (!parsed?.teams?.length || !parsed.deck?.length) return null;
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
