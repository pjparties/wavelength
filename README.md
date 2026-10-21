# Wavelength — offline pass-and-play

A single-file, offline Wavelength game for 2–8 teams on one phone or tablet.
The Psychic peeks at the spectrum and the secret target, the team slides the needle,
and the target zone reveals itself: **5** green bullseye, **3** ochre, **1** burnt orange, **0** grey.
The needle never leaves the 0–10 scale.

## Run it

```bash
npm install
npm run dev      # dev server on http://localhost:3000
npm run build    # -> dist/index.html  (one file, no CDN, opens from file://)
npm run preview  # serve the built file on http://localhost:3000
```

`dist/index.html` is fully self-contained: no network, no fonts, no images. Copy it to a
phone, AirDrop it, open it in a browser, play. When served over HTTP(S), the generated
manifest and service worker also make it installable and cache the app for later offline use.

## Play

1. **Setup** — teams (name + colour), rounds per team, psychic time and guesser time in
   seconds, deck (Clean / Spicy / Dirty), optional custom spectra and an optional "first to N points" target.
2. **Psychic pass** — the screen hides behind a curtain. Hand the device to the Psychic only.
3. **Psychic** — sees the spectrum and the target position. The needle is hidden and the
   meter face is plain, not grey.
4. **Guess** — the target is hidden, the needle appears. Drag it (or use ←/→ keys).
5. **Reveal** — the target zone shows up and points are awarded to the team.

Turns rotate team by team. The turn timer sits top right with a pause button and ticks
in the last ten seconds. The match survives a page reload. The ⚙ button shows the card pool
stats, the sound switch and aborts the match.

The look is fixed: one Warm Earth theme (cream paper, ink borders, offset retro buttons,
paper grain) with an ASCII diwali backdrop.

## Custom spectra

Pick **Custom spectra** in the deck list to open the text box, then one per line:

```
Total Cringe : Pure Masterpiece
Rainy Day : Beach Day
```

The left pole is always 0 and the right pole always 100, so only the words are typed.
Custom spectra either play first or shuffle into the deck.

## Layout

| Path | What |
| --- | --- |
| `src/App.tsx` | screens, timer, persistence, wiring |
| `src/setup.tsx` | match setup screen + validation |
| `src/dial.tsx` | SVG spectrum dial, needle drag, zone wedges |
| `src/game.ts` | the domain: scoring, deck building, custom parsing, validation, the state machine (no React) |
| `src/types.ts` | shared domain types (`Spectrum`, `SetupConfig`, `Match`, `DeckSource`) |
| `src/dto.ts` | the wire contract with a backend (`SpectrumDTO`, `DeckDTO`, parsers) |
| `src/deck-source.ts` | where questions come from: built-in decks and backend decks |
| `src/decks.ts` | Clean, Spicy, and Dirty spectra — the file to edit to change the questions |
| `src/audio.ts` | Web Audio click/lock/reveal/miss/tick sounds |
| `src/diwali.ts` | the ASCII diwali backdrop, as a tiled SVG |
| `src/theme.css` | Tailwind v4 tokens, the Warm Earth theme, paper grain, retro buttons |

## Questions from a backend

A deck is anything that implements `DeckSource`:

```ts
type DeckSource = { id: string; label: string; size?: number; load: () => Promise<Spectrum[]> };
```

The app ships three built-in sources (Clean, Spicy, Dirty). Point it at an API and its decks appear
next to them on the setup screen:

```bash
npm run mock-api                                   # serves GET /decks on :4000
open "http://localhost:3000/?api=http://localhost:4000"
```

The wire contract lives in `src/dto.ts`, so the frontend and the backend agree on one
shape and the UI never sees JSON:

| Endpoint | Answers with | DTO |
| --- | --- | --- |
| `GET /decks` | `{ decks: [{ id, label, size? }] }` | `DeckListDTO` |
| `GET /decks/{id}/spectra` | `{ items: [{ left, right }] }` | `SpectrumListDTO` |
| `GET /spectra` (legacy) | `[{ left, right }]` | `SpectrumListDTO` |

Both `{"items": [...]}` and a bare `[...]` are accepted, so a plain static file works
as well as a real API. A backend without a catalogue keeps working through the legacy
`GET /spectra` and shows up as one "Community" deck. Without `?api=`, the app stays
fully offline; remote requests have an 8-second timeout, and a backend that is down
shows an error without blocking the built-in decks. HTTPS pages require an HTTPS API.

The built-in questions stay easy to edit: `src/decks.ts` is a plain array of
`{ left, right }` rows, and the domain type is the same shape as the DTO.

What a real backend still needs on top of that seam:

| Need | Where it plugs in |
| --- | --- |
| more decks than one | `GET /decks` — the app already lists every deck the backend offers |
| login / users | `DeckSource.load()` — send the token, and add a screen for it |
| admin CRUD for questions | `POST /decks/{id}/spectra` next to the GET; `toSpectrumDTO()` writes a row |
| custom spectra saved per user | the same POST, one deck per user |
| the match itself on a server | `src/game.ts` is a pure reducer, so it can move to the backend unchanged |

Users and accounts would need an auth layer on top of that; the match state itself is
transport-agnostic and lives in `src/game.ts`.

## Tests

```bash
npm test           # node --test, no test framework needed
npm run check      # types + lint (whole project)
npm run verify     # builds, then drives the built file in Chrome: flow, visuals, logic, scoring
npm run verify:remote  # drives the backend deck source against the mock API
npm run ci         # everything above, in order - this is what CI runs
```

`npm run verify` needs Google Chrome installed; it writes screenshots to `./shots`.
CI runs `npm run ci` on every push (`.github/workflows/ci.yml`).

## Deploy to GitHub Pages

The repository includes a Pages workflow. Push the `main` branch, then enable
**Settings → Pages → GitHub Actions** once in the repository. The workflow uploads
`dist/` as a static site; no server or runtime configuration is required for the
built-in decks. A remote deck API must be HTTPS and allow the Pages origin in CORS.
