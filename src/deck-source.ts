import { NSFW_SPECTRUMS, SFW_SPECTRUMS } from "./decks.ts";
import type { DeckSource, Spectrum } from "./types.ts";

/** A deck that ships with the app. */
export function builtinSource(id: string, label: string, spectra: Spectrum[]): DeckSource {
  return { id, label, size: spectra.length, load: async () => spectra };
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
    load: async () => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`${label}: server answered ${res.status}`);
      const body = await res.json();
      const items = Array.isArray(body) ? body : body?.items;
      if (!Array.isArray(items)) throw new Error(`${label}: expected a list of questions`);
      return items
        .map((item: { left?: unknown; right?: unknown }) => ({
          left: String(item?.left ?? "").trim(),
          right: String(item?.right ?? "").trim(),
        }))
        .filter((item) => item.left && item.right);
    },
  };
}

/** Backend base URL: ?api=... in the address bar wins, else VITE_API_URL at build time. */
export function apiBaseUrl(): string | null {
  try {
    const fromQuery = new URL(window.location.href).searchParams.get("api");
    if (fromQuery) return fromQuery;
  } catch {
    // no window (unit tests)
  }
  return (import.meta.env?.VITE_API_URL as string | undefined) || null;
}

/** Every deck the app can offer, built-in plus backend if one is configured. */
export function defaultDeckSources(): DeckSource[] {
  const sources: DeckSource[] = [
    builtinSource("sfw", "SFW", SFW_SPECTRUMS),
    builtinSource("nsfw", "NSFW (18+)", NSFW_SPECTRUMS),
  ];
  const api = apiBaseUrl();
  if (api) {
    sources.push(remoteSource("community", "Community", `${api.replace(/\/+$/, "")}/spectra`));
  }
  return sources;
}

/** Load the questions of the selected sources. A failing source fails the load. */
export async function loadDeck(sources: DeckSource[], ids: string[]): Promise<Spectrum[]> {
  const chosen = sources.filter((source) => ids.includes(source.id));
  const loaded = await Promise.all(chosen.map((source) => source.load()));
  return loaded.flat();
}
