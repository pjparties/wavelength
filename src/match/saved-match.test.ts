import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MAX_SKIPS } from "../game.ts";
import { readSavedMatch } from "./saved-match.ts";

const saved = {
  teams: [{ name: "A", color: "#000", score: 1 }],
  rounds: 1,
  deck: [{ left: "a", right: "b" }],
  customCount: 0,
  deckIds: ["clean"],
  targetScore: null,
  turnIndex: 2,
  targetAngle: 10,
  needleAngle: 20,
  phase: "psychic",
  lastPoints: null,
  winner: null,
  turnSeconds: 40,
};

test("an old save grows the two clocks, the skip limit, and the target bag", () => {
  const match = readSavedMatch(JSON.stringify(saved));
  assert.ok(match);
  assert.equal(match.psychicSeconds, 40);
  assert.equal(match.guessSeconds, 40);
  assert.equal(match.maxSkipsPerTeam, DEFAULT_MAX_SKIPS);
  assert.deepEqual(match.skipsUsed, [0]);
  assert.equal(match.cardIndex, 2);
  assert.deepEqual(match.targetBag, []);
  assert.equal(match.remainingMs, 40_000);
});

test("a broken save is no match", () => {
  assert.equal(readSavedMatch("not json"), null);
  assert.equal(readSavedMatch(null), null);
  assert.equal(readSavedMatch(JSON.stringify({ teams: [], deck: [{ left: "a", right: "b" }] })), null);
});
