/**
 * The wire contract between the app and a backend (a REST API in front of
 * SQLite, say).
 *
 * The UI and the game rules only ever see the domain types in ./types.ts.
 * Everything that arrives over the network is parsed here, so a future
 * database-backed deck is a new endpoint, not a new UI.
 *
 *   GET /decks               -> DeckListDTO
 *   GET /decks/{id}/spectra  -> SpectrumListDTO
 */

import type { Spectrum } from "./types.ts";

/** One question on the wire. */
export type SpectrumDTO = { left: string; right: string };

/** A deck's questions on the wire. */
export type SpectrumListDTO = { items: SpectrumDTO[] };

/** One deck in the catalogue. */
export type DeckDTO = { id: string; label: string; size?: number };

/** The deck catalogue on the wire. */
export type DeckListDTO = { decks: DeckDTO[] };

/** Domain -> wire, for a backend that accepts new questions. */
export function toSpectrumDTO(spectrum: Spectrum): SpectrumDTO {
  return { left: spectrum.left, right: spectrum.right };
}

/** Longer than any question: a row this size is a backend bug, not a card. */
const MAX_POLE_LENGTH = 120;

/** Wire -> domain. A row without two short, string poles comes back as null and is skipped. */
export function parseSpectrum(dto: unknown): Spectrum | null {
  const { left, right } = (dto ?? {}) as SpectrumDTO;
  if (typeof left !== "string" || typeof right !== "string") return null;
  const a = left.trim();
  const b = right.trim();
  if (!a || !b || a.length > MAX_POLE_LENGTH || b.length > MAX_POLE_LENGTH) return null;
  return { left: a, right: b };
}

/**
 * A question list from the wire: {"items": [...]} or a bare [...]. Throws when
 * the payload is not a list at all, so a broken backend is reported instead of
 * silently becoming an empty deck.
 */
export function parseSpectrumList(body: unknown): Spectrum[] {
  const items = Array.isArray(body) ? body : (body as SpectrumListDTO)?.items;
  if (!Array.isArray(items)) throw new Error("expected a list of questions");
  return items
    .map((item) => parseSpectrum(item))
    .filter((item): item is Spectrum => item !== null);
}

/** The deck catalogue from the wire: {"decks": [...]} or a bare [...]. */
export function parseDeckList(body: unknown): DeckDTO[] {
  const decks = Array.isArray(body) ? body : (body as DeckListDTO)?.decks;
  if (!Array.isArray(decks)) throw new Error("expected a list of decks");
  // Duplicate ids would mean duplicate React keys and the same deck loaded twice.
  const seen = new Set<string>();
  return decks.flatMap((deck) => {
    const { id, label, size } = (deck ?? {}) as DeckDTO;
    const deckId = String(id ?? "").trim();
    if (!deckId || seen.has(deckId)) return [];
    seen.add(deckId);
    const deckLabel = String(label ?? deckId).trim() || deckId;
    const count = Number(size);
    return [{ id: deckId, label: deckLabel, ...(Number.isFinite(count) ? { size: count } : {}) }];
  });
}
