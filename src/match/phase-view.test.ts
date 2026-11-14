import assert from "node:assert/strict";
import { test } from "node:test";
import { phaseView } from "./phase-view.ts";

test("each phase shows one combination of the dial, the clock, and the score", () => {
  assert.deepEqual(phaseView("psychic_pass"), {
    timed: false,
    showNeedle: false,
    showTarget: false,
    interactive: false,
    showScore: false,
    passDevice: true,
  });
  assert.equal(phaseView("psychic").showTarget, true);
  assert.equal(phaseView("psychic").timed, true);
  assert.equal(phaseView("guess").interactive, true);
  assert.equal(phaseView("guess").showNeedle, true);
  assert.equal(phaseView("reveal").showNeedle, true);
  assert.equal(phaseView("reveal").showTarget, true);
  assert.equal(phaseView("reveal").timed, false);
  assert.equal(phaseView("gameover").showScore, false);
});
