import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeck,
  clamp,
  formatClock,
  NEEDLE_MAX,
  NEEDLE_MIN,
  parseCustomSpectrum,
  parseCustomSpectra,
  randomTarget,
  scoreFor,
  shuffle,
  validateSetup,
} from "./game.ts";

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
    decks: ["sfw"],
    custom: [],
    customFirst: true,
    targetScore: null as number | null,
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
});

test("clock formatting", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(5000), "0:05");
  assert.equal(formatClock(65000), "1:05");
  assert.equal(formatClock(-10), "0:00");
});
