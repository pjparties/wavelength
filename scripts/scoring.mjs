import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const URL = process.env.WL_URL ?? "file:///Users/parth/Projects/wavelength/dist/index.html";
const PORT = Number(process.env.WL_PORT ?? 9336);
const PROFILE = "/tmp/wl-chrome-profile-scoring";
fs.rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });

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
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
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
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result.value;
  };
  const click = async (label) => {
    const ok = await evaluate(`(() => {
      const t = [...document.querySelectorAll('button')].find((n) => (n.textContent||'').toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (!t) return false; t.click(); return true;
    })()`);
    if (!ok) throw new Error("no button " + label);
    await sleep(220);
  };
  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
    if (!ok) process.exitCode = 1;
  };

  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await send(ws, "Page.navigate", { url: URL });
  await sleep(1000);
  await click("Start match");
  await sleep(250);

  // Play 8 rounds, each time aiming the needle with the keyboard at a known angle,
  // then compare the awarded points + scoreboard against the expected zone maths.
  for (let round = 0; round < 8; round++) {
    await click("I'm the psychic");
    await sleep(220);
    await click("Hide target");
    await sleep(200);

    const target = await evaluate("JSON.parse(localStorage.getItem('wavelength.match.v1')).targetAngle");
    // aim exactly at the target -> must score 5
    const aim = await evaluate(`(() => {
      const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
      const r = svg.getBoundingClientRect();
      const rad = (${target} * Math.PI) / 180;
      const px = r.left + ((200 - 178 * Math.cos(rad)) / 400) * r.width;
      const py = r.top + ((200 - 178 * Math.sin(rad)) / 234) * r.height;
      const opts = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      svg.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: px, clientY: py }));
      svg.dispatchEvent(new PointerEvent('pointerup', opts));
      return true;
    })()`);
    void aim;
    await sleep(200);
    const needleAngle = await evaluate("JSON.parse(localStorage.getItem('wavelength.match.v1')).needleAngle");
    const diff = Math.abs(needleAngle - target);

    const beforeScores = await evaluate("JSON.parse(localStorage.getItem('wavelength.match.v1')).teams.map(t => t.score)");
    await click("Lock in & reveal");
    await sleep(280);
    const result = await evaluate(`(() => {
      const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
      const badge = document.body.innerText.match(/\\+(\\d)/);
      return { badge: badge ? Number(badge[1]) : null, scores: raw.teams.map((t) => t.score), turn: raw.turnIndex };
    })()`);
    const expected = diff <= 4.5 ? 5 : diff <= 13.5 ? 3 : diff <= 22.5 ? 1 : 0;
    const teamSlot = result.turn % result.scores.length;
    const delta = result.scores[teamSlot] - beforeScores[teamSlot];
    check(
      `round ${round + 1}: needle ${needleAngle.toFixed(1)} vs target ${target.toFixed(1)} scores ${expected}`,
      result.badge === expected && delta === expected,
      `badge=${result.badge} delta=${delta} scores=${JSON.stringify(result.scores)}`,
    );

    await click("Next round");
    await sleep(220);
  }

  // aim far away -> must score 0 and the score must not change
  await click("I'm the psychic");
  await sleep(200);
  await click("Hide target");
  await sleep(200);
  const target2 = await evaluate("JSON.parse(localStorage.getItem('wavelength.match.v1')).targetAngle");
  const missAim = await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    const r = svg.getBoundingClientRect();
    const t = ${target2} > 90 ? 8 : 172;
    const rad = (t * Math.PI) / 180;
    const px = r.left + ((200 - 178 * Math.cos(rad)) / 400) * r.width;
    const py = r.top + ((200 - 178 * Math.sin(rad)) / 234) * r.height;
    const opts = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    svg.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: px, clientY: py }));
    svg.dispatchEvent(new PointerEvent('pointerup', opts));
    return true;
  })()`);
  void missAim;
  await sleep(200);
  const missAngle = await evaluate("JSON.parse(localStorage.getItem('wavelength.match.v1')).needleAngle");
  const missDiff = Math.abs(missAngle - target2);
  await click("Lock in & reveal");
  await sleep(280);
  const missResult = await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
    const badge = document.body.innerText.match(/\\+(\\d)/);
    return { badge: badge ? Number(badge[1]) : null, scores: raw.teams.map((t) => t.score) };
  })()`);
  const missExpected = missDiff <= 22.5 ? (missDiff <= 13.5 ? 3 : 1) : 0;
  check(
    `deliberate miss: needle ${missAngle.toFixed(1)} vs target ${target2.toFixed(1)} scores ${missExpected}`,
    missResult.badge === missExpected,
    `badge=${missResult.badge} scores=${JSON.stringify(missResult.scores)}`,
  );

  ws.close();
  chrome.kill();
}

main().catch((e) => {
  console.error("SCORING AUDIT FAILED:", e);
  chrome.kill();
  process.exit(1);
});
