import assert from "node:assert/strict";
import test from "node:test";
import { parseDeckList, parseSpectrum, parseSpectrumList, toSpectrumDTO } from "./dto.ts";

test("a spectrum on the wire becomes a domain spectrum", () => {
  assert.deepEqual(parseSpectrum({ left: " Cold ", right: " Hot " }), { left: "Cold", right: "Hot" });
});

test("a spectrum without both poles is skipped", () => {
  assert.equal(parseSpectrum({ left: "Cold" }), null);
  assert.equal(parseSpectrum(null), null);
});

test("a question list is read from items or from a bare array", () => {
  const rows = [{ left: "A", right: "B" }];
  assert.deepEqual(parseSpectrumList({ items: rows }), [{ left: "A", right: "B" }]);
  assert.deepEqual(parseSpectrumList(rows), [{ left: "A", right: "B" }]);
});

test("a broken question payload is an error, not an empty deck", () => {
  assert.throws(() => parseSpectrumList({ nope: true }));
});

test("the deck catalogue is read from decks or from a bare array", () => {
  const rows = [{ id: "community", label: "Community", size: 4 }];
  assert.deepEqual(parseDeckList({ decks: rows }), rows);
  assert.deepEqual(parseDeckList(rows), rows);
});

test("a deck without an id is dropped", () => {
  assert.deepEqual(parseDeckList([{ label: "No id" }]), []);
  assert.throws(() => parseDeckList({ nope: true }));
});

test("a domain spectrum can be written back to the wire", () => {
  assert.deepEqual(toSpectrumDTO({ left: "A", right: "B" }), { left: "A", right: "B" });
});

test("a row that is not two strings is skipped", () => {
  assert.equal(parseSpectrum({ left: { text: "Cold" }, right: "Hot" }), null);
  assert.equal(parseSpectrum({ left: 5, right: "Hot" }), null);
  assert.equal(parseSpectrum({ left: "x".repeat(500), right: "Hot" }), null);
});

test("duplicate deck ids keep the first deck only", () => {
  assert.deepEqual(
    parseDeckList([
      { id: "community", label: "Community" },
      { id: "community", label: "Community again" },
    ]),
    [{ id: "community", label: "Community" }],
  );
});
