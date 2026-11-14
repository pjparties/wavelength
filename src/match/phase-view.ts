import type { Phase } from "../types.ts";

/**
 * What a phase shows. A new phase sets its row here; the board, the clock,
 * and the scoreboard read this instead of each growing their own conditions.
 */
export function phaseView(phase: Phase) {
  return {
    timed: phase === "psychic" || phase === "guess",
    showNeedle: phase === "guess" || phase === "reveal",
    showTarget: phase === "psychic" || phase === "reveal",
    interactive: phase === "guess",
    showScore: phase !== "gameover" && phase !== "psychic_pass",
    passDevice: phase === "psychic_pass",
  };
}
