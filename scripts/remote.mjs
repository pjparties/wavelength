// Checks the backend/DB extension point: the app loads questions from a remote
// deck source and plays them, and a backend that is down does not break it.
//
//   node scripts/remote.mjs

import { spawn } from "node:child_process";
import path from "node:path";
import { check, launch } from "./lib/cdp.mjs";

const API_URL = process.env.WL_API_URL ?? "http://localhost:4000";
const APP_URL =
  process.env.WL_URL ??
  `file://${path.resolve("dist/index.html")}?api=${API_URL}`;
const PORT = Number(process.env.WL_PORT ?? 9402);

// The mock API doubles as the contract a real backend must implement.
const api = spawn(process.execPath, ["scripts/mock-api.mjs"], {
  env: { ...process.env, PORT: new URL(API_URL).port || "4000" },
  stdio: "ignore",
});

const app = await launch({ url: APP_URL, width: 430, height: 932, port: PORT });

try {
  // The catalogue of a backend arrives over the network, so wait for it.
  await app.waitFor(`!!document.querySelector('[data-testid="deck-community"]')`);
  const setup = await app.text();
  check("the remote deck is offered on the setup screen", setup.includes("community"), setup.slice(0, 120));

  // pick the remote deck only
  await app.clickId("deck-clean");
  await app.clickId("deck-community");
  await app.clickId("start-match");
  await app.waitFor(`document.body.innerText.toLowerCase().includes('pass the device to')`);
  const started = await app.text();
  check("the match started from the remote deck", started.includes("pass the device to"));

  await app.clickId("psychic");
  const card = await app.text();
  check(
    "the first card came from the backend",
    card.includes("backend online") || card.includes("admin writes") || card.includes("one more row") || card.includes("local storage"),
    card.slice(0, 160),
  );

  const deckIds = await app.evaluate(
    "JSON.parse(localStorage.getItem('wavelength.match.v1')).deckIds",
  );
  check("the match records which deck source it used", JSON.stringify(deckIds) === '["community"]', JSON.stringify(deckIds));

  // a backend that is down must not break the app
  await app.evaluate("localStorage.removeItem('wavelength.match.v1')");
  await app.navigate(APP_URL.replace(/api=[^&]*/, "api=http://localhost:4999"));
  await app.waitFor(`!!document.querySelector('[data-testid="deck-community"]')`);
  await app.clickId("deck-clean");
  await app.clickId("deck-community");
  await app.clickId("start-match");
  const dead = await app.text();
  check("a dead backend shows an error and stays on setup", dead.includes("start match"), dead.slice(0, 140));
  check("the error names the failing source", /community/i.test(dead), dead.slice(0, 200));

  check("no page exceptions", app.errors.length === 0, app.errors.join(" | "));
} catch (error) {
  console.error("REMOTE AUDIT FAILED:", error);
  process.exitCode = 1;
} finally {
  app.close();
  api.kill();
}
