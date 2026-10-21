// Mock question API: the contract a real backend (or DB) must implement.
//
//   GET /decks                -> [{ "id": "community", "label": "Community", "size": 4 }]
//   GET /decks/{id}/spectra   -> { "items": [{ "left": "...", "right": "..." }] }
//   GET /spectra              -> [{ "left": "...", "right": "..." }]   (legacy flat list)
//
// Run it, then point the app at it:  http://localhost:3000/?api=http://localhost:4000

import http from "node:http";

const PORT = Number(process.env.PORT ?? 4000);

const spectra = [
  { left: "Backend Online", right: "Database Offline" },
  { left: "Admin Writes", right: "User Reads" },
  { left: "One More Row", right: "Ship It" },
  { left: "Local Storage", right: "Remote API" },
];

const decks = [{ id: "community", label: "Community", size: spectra.length }];

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    const url = req.url ?? "";

    if (url === "/decks") {
      res.end(JSON.stringify(decks));
      return;
    }
    const deckSpectra = url.match(/^\/decks\/([^/]+)\/spectra$/);
    if (deckSpectra) {
      if (deckSpectra[1] !== decks[0].id) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "no such deck" }));
        return;
      }
      res.end(JSON.stringify({ items: spectra }));
      return;
    }
    if (url.startsWith("/spectra")) {
      res.end(JSON.stringify(spectra));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  })
  .listen(PORT, () => {
    console.log(`mock question API on http://localhost:${PORT}/decks`);
  });
