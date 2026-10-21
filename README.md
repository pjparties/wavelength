# Wavelength — offline pass-and-play

A single-file, offline Wavelength game for 2–8 teams on one phone or tablet.
The Psychic peeks at the spectrum and the secret target, the team slides the needle,
and the target zone reveals itself: **5** blue bullseye, **3** yellow, **1** red, **0** grey.

## Run it

```bash
npm install
npm run dev      # dev server on http://localhost:3000
npm run build    # -> dist/index.html  (one file, no CDN, opens from file://)
npm run preview  # serve the built file on http://localhost:3000
```

`dist/index.html` is fully self-contained: no network, no fonts, no images. Copy it to a
phone, AirDrop it, open it in a browser, play.

## Play

1. **Setup** — teams (name + colour), rounds per team, seconds per turn, deck (SFW / NSFW),
   optional custom spectra and an optional "first to N points" target.
2. **Psychic pass** — the screen hides behind a curtain. Hand the device to the Psychic only.
3. **Psychic** — sees the spectrum and the target position. The needle is hidden.
4. **Guess** — the target is hidden, the needle appears. Drag it (or use ←/→ keys).
5. **Reveal** — the target zone shows up and points are awarded to the team.

Turns rotate team by team. The turn timer sits top right with a pause button; the match
survives a page reload. The ⚙ button switches theme (Vintage Paper, Swiss Minimalist,
Warm Earth, Synthwave), shows the card pool stats and aborts the match.

## Custom spectra

One per line, in the setup screen:

```
0: Total Cringe ↔ 100: Pure Masterpiece
0: Rainy Day ↔ 100: Beach Day
```

`↔`, `->`, `|`, `vs` and `—` all work as separators. End values must be 0–100.
Custom spectra either play first or shuffle into the deck.

## Layout

| Path | What |
| --- | --- |
| `src/App.tsx` | screens, timer, persistence, wiring |
| `src/setup.tsx` | match setup screen + validation |
| `src/dial.tsx` | SVG spectrum dial, needle drag, zone wedges |
| `src/game.ts` | the domain: scoring, deck building, custom parsing, validation, the state machine (no React) |
| `src/types.ts` | shared domain types (`Spectrum`, `SetupConfig`, `Match`, `DeckSource`) |
| `src/deck-source.ts` | where questions come from: built-in decks and backend decks |
| `src/decks.ts` | SFW (140) and NSFW (70) spectra |
| `src/audio.ts` | Web Audio click/lock/reveal/miss sounds |
| `src/theme.css` | Tailwind v4 tokens, 4 themes, paper grain, retro buttons |

## Questions from a backend

A deck is anything that implements `DeckSource`:

```ts
type DeckSource = { id: string; label: string; size?: number; load: () => Promise<Spectrum[]> };
```

The app ships two built-in sources (SFW, NSFW). Point it at an API and a third one appears
on the setup screen:

```bash
npm run mock-api                                   # serves GET /spectra on :4000
open "http://localhost:3000/?api=http://localhost:4000"
```

The endpoint must answer with a list of `{left, right}` pairs (or `{items: [...]}`). A
database behind an admin CRUD for questions plugs in the same way — `remoteSource()` in
`src/deck-source.ts` is the only thing that has to change, and no UI code moves. Without
`?api=`, the app stays fully offline; a backend that is down shows an error and never
blocks the built-in decks.

Users and accounts would need an auth layer on top of that; the match state itself is
transport-agnostic and lives in `src/game.ts`.

## Tests

```bash
npm test           # node --test, no test framework needed
npm run check      # types + lint
npm run verify     # builds, then drives the built file in Chrome: flow, visuals, scoring
npm run verify:remote  # drives the backend deck source against the mock API
```

`npm run verify` needs Google Chrome installed; it writes screenshots to `./shots`.
CI runs all of it on every push (`.github/workflows/ci.yml`).
