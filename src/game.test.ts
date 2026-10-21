import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeck,
  clamp,
  formatClock,
  parseCustomSpectrum,
  parseCustomSpectra,
  randomTarget,
  scoreFor,
  shuffle,
  validateSetup,
} from "./game.ts";

test("score zones: 5 / 3 / 1 / 0", () => {
  assert.equal(scoreFor(90, 90), 5);
  assert.equal(scoreFor(90 + 4.5, 90), 5);
  assert.equal(scoreFor(90 + 4.6, 90), 3);
  assert.equal(scoreFor(90 + 13.5, 90), 3);
  assert.equal(scoreFor(90 + 13.6, 90), 1);
  assert.equal(scoreFor(90 + 22.5, 90), 1);
  assert.equal(scoreFor(90 + 22.6, 90), 0);
  assert.equal(scoreFor(50, 90), 0);
});

test("a miss is reachable at both ends of the arc", () => {
  // target never lands closer than 21 degrees to an end, so the needle must be able
  // to swing past the arc or a 0 point score would be impossible.
  assert.equal(scoreFor(-25, 21), 0);
  assert.equal(scoreFor(205, 159), 0);
  assert.ok(scoreFor(0, 21) > 0);
});

test("targets stay inside the 21-159 degree band", () => {
  for (let i = 0; i < 500; i++) {
    const target = randomTarget();
    assert.ok(target >= 21 && target <= 159, `target out of range: ${target}`);
  }
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
  const parsed = parseCustomSpectrum("0: Total Cringe ↔ 100: Pure Masterpiece");
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.ok && parsed.spectrum, {
    left: "Total Cringe",
    right: "Pure Masterpiece",
  });
});

test("custom spectra accept alternative separators", () => {
  for (const line of [
    "0: Cold | 100: Hot",
    "0: Cold -> 100: Hot",
    "0: Cold vs 100: Hot",
    "20: Meh — 80: Great",
  ]) {
    assert.equal(parseCustomSpectrum(line).ok, true, line);
  }
});

test("bad custom spectra are rejected with a message", () => {
  assert.equal(parseCustomSpectrum("Total Cringe ↔ Pure Masterpiece").ok, false);
  assert.equal(parseCustomSpectrum("0: Cold ↔ 900: Hot").ok, false);
  assert.equal(parseCustomSpectrum("0: Cold ↔ 100: ").ok, false);
});

test("parsing keeps good lines and reports bad ones by line number", () => {
  const { items, errors } = parseCustomSpectra(
    "0: A ↔ 100: B\n\nbroken line\n0: C ↔ 100: D",
  );
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
    turnSeconds: 60,
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
  assert.ok(validateSetup({ ...base, turnSeconds: 5 }).turnSeconds);
  assert.ok(
    validateSetup({ ...base, decks: [] }).decks,
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
