import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeck,
  buildMatch,
  clamp,
  DEFAULT_MAX_SKIPS,
  formatClock,
  NEEDLE_MAX,
  NEEDLE_MIN,
  parseCustomSpectrum,
  parseCustomSpectra,
  randomTarget,
  reducer,
  scoreFor,
  shuffle,
  validateSetup,
  zoneBands,
} from "./game.ts";
import type { SetupConfig } from "./game.ts";

function setupConfig(patch: Partial<SetupConfig> = {}): SetupConfig {
  return {
    teams: [
      { name: "A", color: "#000" },
      { name: "B", color: "#111" },
    ],
    rounds: 1,
    psychicSeconds: 60,
    guessSeconds: 45,
    decks: ["clean"],
    custom: [],
    customFirst: true,
    targetScore: null,
    maxSkipsPerTeam: 2,
    ...patch,
  };
}

test("score zones: 5 / 3 / 1 / 0", () => {
  assert.equal(scoreFor(90, 90), 5);
  assert.equal(scoreFor(90 + 5, 90), 5);
  assert.equal(scoreFor(90 + 5.1, 90), 3);
  assert.equal(scoreFor(90 + 13.5, 90), 3);
  assert.equal(scoreFor(90 + 13.6, 90), 1);
  assert.equal(scoreFor(90 + 22.5, 90), 1);
  assert.equal(scoreFor(90 + 22.6, 90), 0);
  assert.equal(scoreFor(50, 90), 0);
});

test("a miss is reachable from both ends of the scale", () => {
  // the needle stops at 0 and 10, so the far end of the scale from the target
  // is always a miss.
  assert.equal(scoreFor(0, 159), 0);
  assert.equal(scoreFor(180, 21), 0);
  assert.equal(scoreFor(180, 0), 0);
  assert.ok(scoreFor(0, 21) > 0);
});

test("the needle cannot leave the 0-10 scale", () => {
  assert.equal(clamp(-25, NEEDLE_MIN, NEEDLE_MAX), 0);
  assert.equal(clamp(205, NEEDLE_MIN, NEEDLE_MAX), 180);
  assert.equal(clamp(90, NEEDLE_MIN, NEEDLE_MAX), 90);
});

test("targets can reach both ends of the scale", () => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 500; i++) {
    const target = randomTarget();
    assert.ok(target >= 0 && target <= 180, `target out of range: ${target}`);
    min = Math.min(min, target);
    max = Math.max(max, target);
  }
  // the ends must be reachable, otherwise the banded spectrum is never half
  assert.ok(min < 5, `no target near 0: ${min}`);
  assert.ok(max > 175, `no target near 180: ${max}`);
});

test("target generation includes the exact endpoints", () => {
  assert.equal(randomTarget(() => 0), 0);
  assert.equal(randomTarget(() => 0.999999), 180);
});

test("clamp respects bounds", () => {
  assert.equal(clamp(-10, -25, 205), -10);
  assert.equal(clamp(-100, -25, 205), -25);
  assert.equal(clamp(999, -25, 205), 205);
});

test("shuffle keeps every card", () => {
  const input = Array.from({ length: 50 }, (_, i) => i);
  const output = shuffle(input);
  assert.equal(output.length, input.length);
  assert.deepEqual([...output].sort((a, b) => a - b), input);
});

test("custom spectra parse from the documented format", () => {
  const parsed = parseCustomSpectrum("Total Cringe : Pure Masterpiece");
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.ok && parsed.spectrum, {
    left: "Total Cringe",
    right: "Pure Masterpiece",
  });
});

test("custom spectra split on the first colon and ignore spacing", () => {
  for (const line of ["Cold : Hot", "Cold:Hot", "  Cold  :  Hot  "]) {
    const parsed = parseCustomSpectrum(line);
    assert.equal(parsed.ok, true, line);
    assert.deepEqual(parsed.ok && parsed.spectrum, { left: "Cold", right: "Hot" }, line);
  }
  const spaced = parseCustomSpectrum("Rainy Day : Beach Day");
  assert.deepEqual(spaced.ok && spaced.spectrum, {
    left: "Rainy Day",
    right: "Beach Day",
  });
});

test("bad custom spectra are rejected with a message", () => {
  assert.equal(parseCustomSpectrum("Total Cringe Pure Masterpiece").ok, false);
  assert.equal(parseCustomSpectrum("Total Cringe : ").ok, false);
  assert.equal(parseCustomSpectrum(" : Pure Masterpiece").ok, false);
});

test("parsing keeps good lines and reports bad ones by line number", () => {
  const { items, errors } = parseCustomSpectra("A : B\n\nbroken line\nC : D");
  assert.equal(items.length, 2);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 3);
});

test("custom first keeps custom order, shuffle does not", () => {
  const base = Array.from({ length: 10 }, (_, i) => ({ left: `b${i}`, right: `b${i}` }));
  const custom = Array.from({ length: 3 }, (_, i) => ({ left: `c${i}`, right: `c${i}` }));
  const first = buildDeck(base, custom, true);
  assert.deepEqual(first.slice(0, 3), custom);
  const mixed = buildDeck(base, custom, false);
  assert.equal(mixed.length, 13);
});

test("setup validation enforces the target points rule", () => {
  const base = {
    teams: [
      { name: "A", color: "#000" },
      { name: "B", color: "#111" },
    ],
    rounds: 4,
    psychicSeconds: 60,
    guessSeconds: 45,
    decks: ["clean"],
    custom: [],
    customFirst: true,
    targetScore: null as number | null,
    maxSkipsPerTeam: 3,
  };
  assert.deepEqual(validateSetup(base), {});

  // max_rounds * 5 = 20
  assert.equal(validateSetup({ ...base, targetScore: 20 }).targetScore, undefined);
  assert.ok(validateSetup({ ...base, targetScore: 21 }).targetScore);
  assert.ok(validateSetup({ ...base, targetScore: 0 }).targetScore);
  assert.ok(validateSetup({ ...base, targetScore: -3 }).targetScore);

  assert.ok(validateSetup({ ...base, teams: [base.teams[0]] }).teams);
  assert.ok(validateSetup({ ...base, rounds: 0 }).rounds);
  assert.ok(validateSetup({ ...base, psychicSeconds: 5 }).psychicSeconds);
  assert.ok(validateSetup({ ...base, guessSeconds: 5 }).guessSeconds);
  assert.ok(
    validateSetup({ ...base, decks: [] }).decks,
  );
  assert.deepEqual(
    validateSetup({ ...base, decks: [], custom: [{ left: "a", right: "b" }] }),
    {},
    "custom spectra alone are enough to start",
  );
  assert.ok(
    validateSetup({
      ...base,
      teams: [
        { name: "Same", color: "#000" },
        { name: "same", color: "#111" },
      ],
    }).teams,
  );

  assert.equal(DEFAULT_MAX_SKIPS, 3);
  assert.equal(validateSetup({ ...base, maxSkipsPerTeam: 0 }).maxSkipsPerTeam, undefined);
  assert.ok(validateSetup({ ...base, maxSkipsPerTeam: -1 }).maxSkipsPerTeam);
  assert.ok(validateSetup({ ...base, maxSkipsPerTeam: 11 }).maxSkipsPerTeam);
  assert.ok(validateSetup({ ...base, maxSkipsPerTeam: 1.5 }).maxSkipsPerTeam);
});

test("clock formatting", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(5000), "0:05");
  assert.equal(formatClock(65000), "1:05");
  assert.equal(formatClock(-10), "0:00");
});

test("a skip deals a new card to the same team and costs one skip", () => {
  const match = buildMatch(
    {
      teams: [
        { name: "A", color: "#000" },
        { name: "B", color: "#111" },
      ],
      rounds: 2,
      psychicSeconds: 60,
      guessSeconds: 45,
      decks: ["clean"],
      custom: [],
      customFirst: true,
      targetScore: null,
      maxSkipsPerTeam: 2,
    },
    [
      { left: "a", right: "b" },
      { left: "c", right: "d" },
    ],
  );
  assert.equal(match.maxSkipsPerTeam, 2);
  assert.deepEqual(match.skipsUsed, [0, 0]);

  const psychic = reducer(match, { type: "pass" })!;
  const skipped = reducer(psychic, { type: "skip" })!;
  assert.equal(skipped.turnIndex, 0, "the turn does not move");
  assert.equal(skipped.phase, "psychic", "the psychic keeps looking");
  assert.equal(skipped.cardIndex, 1, "the next card is in play");
  assert.deepEqual(skipped.skipsUsed, [1, 0]);
  assert.deepEqual(skipped.teams.map((team) => team.score), [0, 0]);

  // once the budget is gone the same team's skip is a no-op
  const spent = { ...skipped, skipsUsed: [2, 0] };
  const refused = reducer(spent, { type: "skip" })!;
  assert.equal(refused.cardIndex, 1);
  assert.deepEqual(refused.skipsUsed, [2, 0]);
});

test("skips are off when the limit is zero", () => {
  const match = buildMatch(
    {
      teams: [
        { name: "A", color: "#000" },
        { name: "B", color: "#111" },
      ],
      rounds: 1,
      psychicSeconds: 60,
      guessSeconds: 45,
      decks: ["clean"],
      custom: [],
      customFirst: true,
      targetScore: null,
      maxSkipsPerTeam: 0,
    },
    [{ left: "a", right: "b" }],
  );
  const psychic = reducer(match, { type: "pass" })!;
  const skipped = reducer(psychic, { type: "skip" })!;
  assert.equal(skipped.turnIndex, 0);
  assert.equal(skipped.cardIndex, 0);
});

test("a reveal scores the team on turn, next rotates, and the last turn ends the match", () => {
  const match = buildMatch(setupConfig(), [
    { left: "a", right: "b" },
    { left: "c", right: "d" },
  ]);
  const revealed = reducer(
    reducer(reducer(match, { type: "pass" }), { type: "guess" }),
    { type: "reveal", points: 3 },
  )!;
  assert.deepEqual(revealed.teams.map((team) => team.score), [3, 0]);
  assert.equal(revealed.phase, "reveal");
  assert.equal(revealed.lastPoints, 3);

  const next = reducer(revealed, { type: "next" })!;
  assert.equal(next.turnIndex, 1, "the turn moves to the second team");
  assert.equal(next.phase, "psychic_pass");
  assert.equal(next.needleAngle, 90, "the needle goes back to the middle");
  assert.equal(next.lastPoints, null);

  const end = reducer(
    reducer(
      reducer(reducer(next, { type: "pass" }), { type: "guess" }),
      { type: "reveal", points: 5 },
    ),
    { type: "next" },
  )!;
  assert.deepEqual(end.teams.map((team) => team.score), [3, 5]);
  assert.equal(end.phase, "gameover", "two teams, one round each: that is the match");
});

test("reaching the target score names the winner and ends the match", () => {
  const match = buildMatch(setupConfig({ targetScore: 5, rounds: 3 }), [
    { left: "a", right: "b" },
    { left: "c", right: "d" },
  ]);
  const won = reducer(
    reducer(reducer(match, { type: "pass" }), { type: "guess" }),
    { type: "reveal", points: 5 },
  )!;
  assert.equal(won.winner, "A");
  assert.equal(reducer(won, { type: "next" })!.phase, "gameover");
});

test("the needle only moves while guessing", () => {
  const match = buildMatch(setupConfig(), [{ left: "a", right: "b" }]);
  assert.equal(reducer(match, { type: "needle", angle: 12 })!.needleAngle, 90);
  const guessing = reducer(reducer(match, { type: "pass" }), { type: "guess" })!;
  assert.equal(reducer(guessing, { type: "needle", angle: 12 })!.needleAngle, 12);
});

test("a saved match remembers the time left on the clock", () => {
  const match = buildMatch(setupConfig({ psychicSeconds: 20 }), [{ left: "a", right: "b" }]);
  assert.equal(match.remainingMs, 20_000);
});

test("the target zones are clipped to the scale, so an end shows half", () => {
  const spans = (target: number) => zoneBands(target).map((band) => [band.from, band.to]);

  assert.deepEqual(spans(0), [
    [0, 5],
    [5, 13.5],
    [13.5, 22.5],
  ]);
  assert.deepEqual(spans(180), [
    [157.5, 166.5],
    [166.5, 175],
    [175, 180],
  ]);
  assert.equal(zoneBands(90).length, 5, "away from the ends all five bands show");
  assert.deepEqual(
    zoneBands(0).map((band) => band.points),
    [5, 3, 1],
    "the edge cuts the bullseye in half and keeps it",
  );
});
