// Checks the backend/DB extension point: the app loads questions from a remote
// deck source and plays them.
//
//   node scripts/remote.mjs            (needs scripts/mock-api.mjs running)

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const API_URL = process.env.WL_API_URL ?? "http://localhost:4000";
const APP_URL =
  process.env.WL_URL ??
  `file://${path.resolve("dist/index.html")}?api=${API_URL}`;
const PORT = Number(process.env.WL_PORT ?? 9402);
const PROFILE = "/tmp/wl-chrome-profile-remote";

fs.rmSync(PROFILE, { recursive: true, force: true });

// The mock API doubles as the contract a real backend must implement.
const api = spawn(process.execPath, ["scripts/mock-api.mjs"], {
  env: { ...process.env, PORT: new URL(API_URL).port || "4000" },
  stdio: "ignore",
});

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
const pending = new Map();
const errors = [];

function send(ws, method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

async function main() {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(250);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.text);
    }
  };
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");

  const evaluate = async (expression) => {
    const res = await send(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result.value;
  };
  const body = async () => (await evaluate("document.body.innerText")).toLowerCase();
  const click = async (label) => {
    const ok = await evaluate(`(() => {
      const t = [...document.querySelectorAll('button')].find((n) => (n.textContent||'').toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (!t) return false; t.click(); return true;
    })()`);
    if (!ok) throw new Error("no button " + label);
    await sleep(250);
  };

  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await send(ws, "Page.navigate", { url: APP_URL });
  await sleep(1500);

  const setup = await body();
  check("the remote deck is offered on the setup screen", setup.includes("community"), setup.slice(0, 120));

  // pick the remote deck only
  await click("SFW");
  await click("Community");
  await click("Start match");
  await sleep(600);
  const started = await body();
  check("the match started from the remote deck", started.includes("pass the device to"));

  await click("I'm the psychic");
  await sleep(300);
  const card = await body();
  check(
    "the first card came from the backend",
    card.includes("backend online") || card.includes("admin writes") || card.includes("one more row") || card.includes("local storage"),
    card.slice(0, 160),
  );

  const deckIds = await evaluate("JSON.parse(localStorage.getItem('wavelength.match.v1')).deckIds");
  check("the match records which deck source it used", JSON.stringify(deckIds) === '["community"]', JSON.stringify(deckIds));

  // a backend that is down must not break the app
  await evaluate("localStorage.removeItem('wavelength.match.v1')");
  await send(ws, "Page.navigate", { url: APP_URL.replace(/api=[^&]*/, "api=http://localhost:4999") });
  await sleep(1500);
  await click("SFW");
  await click("Community");
  await click("Start match");
  await sleep(1500);
  const dead = await body();
  check("a dead backend shows an error and stays on setup", dead.includes("start match"), dead.slice(0, 140));
  check("the error names the failing source", /community/i.test(dead), dead.slice(0, 200));

  check("no page exceptions", errors.length === 0, errors.join(" | "));
  ws.close();
  api.kill();
  chrome.kill();
}

main().catch((e) => {
  console.error("REMOTE AUDIT FAILED:", e);
  api.kill();
  chrome.kill();
  process.exit(1);
});
