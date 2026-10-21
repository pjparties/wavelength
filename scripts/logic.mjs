import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const URL = process.env.WL_URL ?? "file:///Users/parth/Projects/wavelength/dist/index.html";
const PORT = Number(process.env.WL_PORT ?? 9335);
const PROFILE = "/tmp/wl-chrome-profile-logic";

fs.rmSync(PROFILE, { recursive: true, force: true });

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

function send(ws, method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

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
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");

  const evaluate = async (expression) => {
    const res = await send(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + " " + (res.exceptionDetails.exception?.description ?? ""));
    return res.result.value;
  };
  const body = async () => (await evaluate("document.body.innerText")).toLowerCase();
  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
    if (!ok) process.exitCode = 1;
  };
  const click = async (label) => {
    const ok = await evaluate(`(() => {
      const t = [...document.querySelectorAll('button')].find((n) => (n.textContent||'').toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (!t) return false; t.click(); return true;
    })()`);
    if (!ok) throw new Error("no button: " + label);
    await sleep(220);
  };
  const setValue = async (selector, value) => {
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(120);
  };

  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await send(ws, "Page.navigate", { url: URL });
  await sleep(1000);

  // ---- layout: no horizontal overflow on setup ----
  const setupOverflow = await evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
  check("setup screen has no horizontal overflow", setupOverflow <= 0, String(setupOverflow));

  // ---- validation: target points > rounds * 5 is rejected ----
  const numberInputs = await evaluate(`[...document.querySelectorAll('input[type=number]')].map(i => i.getAttribute('min'))`);
  await setValue("input[type=number]", "1"); // rounds per team = 1
  await setValue("input[placeholder='no limit']", "6"); // 6 > 1 * 5
  await click("Start match");
  await sleep(250);
  const invalid = await body();
  check("target points above rounds x 5 blocks the start",
    invalid.includes("cannot exceed 5") && invalid.includes("start match"), invalid.slice(0, 140));
  check("invalid setup keeps you on the setup screen", invalid.includes("teams"));

  // ---- target points of 0 is rejected ----
  await setValue("input[placeholder='no limit']", "0");
  await click("Start match");
  await sleep(200);
  check("target points of 0 is rejected", (await body()).includes("greater than 0"));

  // ---- valid target score of 5 with 1 round is accepted ----
  await setValue("input[placeholder='no limit']", "5");
  // custom spectrum, NSFW-only deck
  await setValue("textarea", "0: Total Cringe ↔ 100: Pure Masterpiece");
  await click("SFW");
  await click("NSFW (18+)");
  await click("Play custom first");
  await click("Start match");
  await sleep(350);
  check("valid setup starts the match", (await body()).includes("pass the device to"));

  // ---- custom first ordering: first card is the custom prompt ----
  await click("I'm the psychic");
  await sleep(300);
  const firstCard = await body();
  check("custom spectra are played first", firstCard.includes("total cringe") && firstCard.includes("pure masterpiece"), firstCard.slice(0, 160));

  // ---- timer counts down and can be paused ----
  const readClock = async () => (await evaluate(`(() => {
    const el = [...document.querySelectorAll('span')].find((n) => /^\\d:\\d\\d$/.test(n.textContent.trim()));
    return el ? el.textContent.trim() : null;
  })()`));
  const clockA = await readClock();
  await sleep(2200);
  const clockB = await readClock();
  check("turn timer counts down", clockA !== null && clockB !== null && clockA !== clockB, `${clockA} -> ${clockB}`);
  await evaluate(`document.querySelector('button[aria-label="Pause timer"]').click()`);
  await sleep(1500);
  const clockC = await readClock();
  await sleep(1200);
  const clockD = await readClock();
  check("paused timer stops", clockC === clockD, `${clockC} -> ${clockD}`);
  await evaluate(`document.querySelector('button[aria-label="Resume timer"]').click()`);
  await sleep(1300);
  check("resumed timer runs again", (await readClock()) !== clockD);

  // ---- guess + reveal, then the game ends after 1 round per team ----
  await click("Hide target");
  await sleep(200);
  await click("Lock in & reveal");
  await sleep(300);
  check("reveal awards points", /\+\d/.test(await evaluate("document.body.innerText")));
  await click("Next round");
  await sleep(300);
  check("second team takes the turn", (await body()).includes("team 2"));

  await click("I'm the psychic");
  await sleep(250);
  await click("Hide target");
  await sleep(200);
  await click("Lock in & reveal");
  await sleep(300);
  const beforeResults = await body();
  check("last round offers the results", beforeResults.includes("see results"), beforeResults.slice(0, 100));
  await click("See results");
  await sleep(300);
  const results = await body();
  check("game over screen shows the standings", results.includes("game over") || results.includes("wins"), results.slice(0, 120));
  check("standings list both teams", results.includes("team 1") && results.includes("team 2"));

  // ---- deck composition in the settings modal ----
  const deckInfo = await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
    return { deck: raw.deck.length, custom: raw.customCount, teams: raw.teams.length };
  })()`);
  check("match deck holds only NSFW + custom", deckInfo.deck === 71 && deckInfo.custom === 1, JSON.stringify(deckInfo));

  // ---- play again resets the scores ----
  await click("Play again");
  await sleep(350);
  const restarted = await body();
  check("play again starts a fresh match", restarted.includes("pass the device to") && restarted.includes("team 1"), restarted.slice(0, 120));

  ws.close();
  chrome.kill();
}

main().catch((error) => {
  console.error("LOGIC AUDIT FAILED:", error);
  chrome.kill();
  process.exit(1);
});
