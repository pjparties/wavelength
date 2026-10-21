# Wavelength — offline pass-and-play

A single-file, offline Wavelength game for 2–8 teams on one phone or tablet.
The Psychic peeks at the spectrum and the secret target, the team slides the needle,
and the target zone reveals itself: **5** blue bullseye, **3** yellow, **1** red, **0** grey.

## Run it

```bash
npm install
npm run dev      # dev server
npm run build    # -> dist/index.html  (one file, no CDN, opens from file://)
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
| `src/App.tsx` | state machine, screens, timer, persistence |
| `src/setup.tsx` | match setup screen + validation |
| `src/dial.tsx` | SVG spectrum dial, needle drag, zone wedges |
| `src/game.ts` | scoring, deck building, custom parsing, validation |
| `src/decks.ts` | SFW (140) and NSFW (70) spectra |
| `src/audio.ts` | Web Audio click/lock/reveal/miss sounds |
| `src/theme.css` | Tailwind v4 tokens, 4 themes, paper grain, retro buttons |

## Tests

```bash
npm test        # node --test, no test framework needed
npm run verify  # builds, then drives the built file in Chrome: flow, visuals, scoring
```

`npm run verify` needs Google Chrome installed; it writes screenshots to `./shots`.
