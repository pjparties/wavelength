import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, defaultDeckSources, loadRemoteDeckSources } from "./deck-source.ts";
import type { DeckSource } from "./types.ts";

/** Built-in decks, plus a configured backend's decks once they answer. */
export function useDeckSources() {
  const builtin = useMemo(() => defaultDeckSources(), []);
  const [remote, setRemote] = useState<DeckSource[]>([]);

  useEffect(() => {
    const api = apiBaseUrl();
    if (!api) return;
    let live = true;
    loadRemoteDeckSources(api).then((loaded) => {
      if (live) setRemote(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  const all = useMemo(
    () => (remote.length > 0 ? [...builtin, ...remote] : builtin),
    [builtin, remote],
  );

  return { all };
}
