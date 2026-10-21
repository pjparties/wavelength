import { CLEAN_SPECTRUMS, DIRTY_SPECTRUMS, SPICY_SPECTRUMS } from "./decks.ts";
import { parseDeckList, parseSpectrumList } from "./dto.ts";
import type { DeckDTO } from "./dto.ts";
import type { DeckSource, Spectrum } from "./types.ts";

const REQUEST_TIMEOUT_MS = 8_000;

/** A deck that ships with the app. Edit src/decks.ts to change its questions. */
export function builtinSource(id: string, label: string, spectra: Spectrum[]): DeckSource {
  return { id, label, size: spectra.length, load: async () => spectra };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`server answered ${res.status}`);
    return res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("server request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * A deck served by a backend. The endpoint may answer with a list of
 * {left, right} pairs or with {items: [...]}. A database with an admin CRUD for
 * questions plugs in here without any UI change.
 */
export function remoteSource(id: string, label: string, url: string): DeckSource {
  return {
    id,
    label,
    load: async () => parseSpectrumList(await fetchJson(url)),
  };
}

/** The decks of a backend catalogue: each one loads GET /decks/{id}/spectra. */
export function remoteDeckSources(baseUrl: string, decks: DeckDTO[]): DeckSource[] {
  const base = baseUrl.replace(/\/+$/, "");
  return decks.map((deck) => ({
    id: deck.id,
    label: deck.label,
    size: deck.size,
    load: async () => parseSpectrumList(await fetchJson(`${base}/decks/${deck.id}/spectra`)),
  }));
}

/**
 * The decks a backend offers. A backend with a catalogue (GET /decks) gets one
 * button per deck; a backend without one keeps working through a single flat
 * list of questions (GET /spectra).
 */
export async function loadRemoteDeckSources(baseUrl: string): Promise<DeckSource[]> {
  const base = baseUrl.replace(/\/+$/, "");
  try {
    return remoteDeckSources(base, parseDeckList(await fetchJson(`${base}/decks`)));
  } catch {
    return [remoteSource("community", "Community", `${base}/spectra`)];
  }
}

/** Backend base URL: ?api=... in the address bar wins, else VITE_API_URL at build time. */
export function apiBaseUrl(): string | null {
  let configured: string | null = null;
  try {
    const fromQuery = new URL(window.location.href).searchParams.get("api");
    if (fromQuery) configured = fromQuery;
  } catch {
    // no window (unit tests)
  }
  configured ??= (import.meta.env?.VITE_API_URL as string | undefined) || null;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (typeof window !== "undefined" && window.location.protocol === "https:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** The decks the app ships with. Backend decks are added on top of these. */
export function defaultDeckSources(): DeckSource[] {
  return [
    builtinSource("clean", "Clean", CLEAN_SPECTRUMS),
    builtinSource("spicy", "Spicy", SPICY_SPECTRUMS),
    builtinSource("dirty", "Dirty (NSFW)", DIRTY_SPECTRUMS),
  ];
}

/** Load the questions of the selected sources. A failing source fails the load. */
export async function loadDeck(sources: DeckSource[], ids: string[]): Promise<Spectrum[]> {
  const chosen = sources.filter((source) => ids.includes(source.id));
  const loaded = await Promise.all(chosen.map((source) => source.load()));
  return loaded.flat();
}
