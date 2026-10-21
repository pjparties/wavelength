// Mock question API: the contract a real backend (or DB) must implement.
//
//   GET /spectra -> [{ "left": "...", "right": "..." }, ...]
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

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (req.url?.startsWith("/spectra")) {
      res.end(JSON.stringify(spectra));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  })
  .listen(PORT, () => {
    console.log(`mock question API on http://localhost:${PORT}/spectra`);
  });
