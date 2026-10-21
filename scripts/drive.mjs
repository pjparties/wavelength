import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const URL = process.env.WL_URL ?? "file:///Users/parth/Projects/wavelength/dist/index.html";
const OUT = process.argv[2] ?? "./shots";
const PORT = Number(process.env.WL_PORT ?? 9333);
const PROFILE = "/tmp/wl-chrome-profile-flow";

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("chrome devtools never came up");
}

let id = 0;
const pending = new Map();
const logs = [];

function send(ws, method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

async function main() {
  const wsUrl = await targetUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      logs.push("console.error: " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      logs.push("exception: " + msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description ?? ""));
    }
  };

  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");

  const evaluate = async (expression) => {
    const res = await send(ws, "Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + " " + JSON.stringify(res.exceptionDetails.exception?.description ?? ""));
    return res.result.value;
  };

  const shot = async (name) => {
    const res = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(res.data, "base64"));
  };

  const viewport = async (width, height, mobile = true) => {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile,
    });
  };

  const click = async (label) => {
    const ok = await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('button, [role=button]')];
      const target = nodes.find((n) => (n.textContent || '').toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (!target) return false;
      target.click();
      return true;
    })()`);
    if (!ok) throw new Error(`no clickable element containing "${label}"`);
    await sleep(220);
    return ok;
  };

  const setValue = async (selector, value) => {
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await sleep(120);
  };

  const text = () => evaluate("document.body.innerText");
  const lower = async () => (await text()).toLowerCase();
  const check = (name, condition, detail = "") => {
    console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
    if (!condition) process.exitCode = 1;
  };

  // ---- mobile flow -------------------------------------------------
  await viewport(430, 932);
  await send(ws, "Page.navigate", { url: URL });
  await sleep(1200);

  const setupBody = await lower();
  check("setup screen renders", setupBody.includes("wavelength") && setupBody.includes("start match"), setupBody.slice(0, 80));
  await shot("01-setup-mobile");

  // custom spectra + extra team on the setup screen
  await setValue("textarea", "0: Total Cringe ↔ 100: Pure Masterpiece");
  await click("+ Add team");
  await setValue('input[placeholder="Team 3"]', "Cringe Club");
  await shot("02-setup-custom-and-team");

  const hasParsed = (await lower()).includes("total cringe");
  check("custom spectrum parsed and previewed", hasParsed);

  await click("Start match");
  await sleep(400);
  const curtain = await lower();
  check("privacy curtain shown for team 1", curtain.includes("pass the device to") && curtain.includes("team 1"), curtain.slice(0, 120));
  await shot("03-psychic-curtain");

  const curtainCovers = await evaluate(`(() => {
    const el = [...document.querySelectorAll('p')].find((n) => n.textContent.includes('Pass the device to'));
    return !!el;
  })()`);
  check("curtain copy present", curtainCovers);

  await click("I'm the psychic");
  await sleep(300);
  const psychicState = await evaluate(`(() => ({
    needle: !!document.querySelector('[data-needle]'),
    target: !!document.querySelector('[data-target]'),
    body: document.body.innerText,
  }))()`);
  check("NEEDLE HIDDEN in psychic phase", psychicState.needle === false);
  check("target zones visible in psychic phase", psychicState.target === true);
  check("psychic sees the prompt + target position", /target sits at/.test(psychicState.body.toLowerCase()));
  await shot("04-psychic-view");

  await click("Hide target");
  await sleep(300);
  const guessState = await evaluate(`(() => ({
    needle: !!document.querySelector('[data-needle]'),
    target: !!document.querySelector('[data-target]'),
    body: document.body.innerText,
  }))()`);
  check("NEEDLE VISIBLE in guess phase", guessState.needle === true);
  check("target zones hidden in guess phase", guessState.target === false);
  check("needle readout shown to guessers", /needle at/.test(guessState.body.toLowerCase()));
  await shot("05-guess-view");

  // nudge the needle with the keyboard to prove it is interactive
  const before = await evaluate("document.querySelector('[data-needle]').getAttribute('transform')");
  await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    svg.focus();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return true;
  })()`);
  await sleep(200);
  const after = await evaluate("document.querySelector('[data-needle]').getAttribute('transform')");
  check("needle responds to input", before !== after, `${before} -> ${after}`);

  // drag the needle with pointer events
  const dragAngle = await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.9;
    const opts = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    svg.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: cx + r.width * 0.32, clientY: cy - r.height * 0.28 }));
    svg.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: cx + r.width * 0.30, clientY: cy - r.height * 0.30 }));
    svg.dispatchEvent(new PointerEvent('pointerup', opts));
    return document.querySelector('[data-needle]').getAttribute('transform');
  })()`);
  check("needle drags with pointer events", typeof dragAngle === "string" && dragAngle.includes("rotate"), dragAngle);
  await shot("06-guess-after-drag");

  await click("Lock in & reveal");
  await sleep(400);
  const revealState = await evaluate(`(() => ({
    needle: !!document.querySelector('[data-needle]'),
    target: !!document.querySelector('[data-target]'),
    body: document.body.innerText,
  }))()`);
  check("reveal shows needle and target together", revealState.needle && revealState.target);
  check("a score was awarded", /\+\d/.test(revealState.body));
  await shot("07-reveal");

  await click("Next round");
  await sleep(300);
  const nextBody = await lower();
  check("turn rotates to the next team", nextBody.includes("pass the device to") && nextBody.includes("team 2"), nextBody.slice(0, 120));
  check("scoreboard keeps the points", /\b[1-5]\b/.test(nextBody));
  await shot("08-next-team-curtain");

  // settings modal
  await evaluate(`document.querySelector('button[aria-label="Settings"]').click()`);
  await sleep(300);
  const settingsBody = await lower();
  check("settings modal opens with card pool stats", settingsBody.includes("card pool") && settingsBody.includes("sfw deck"), settingsBody.slice(0, 120));
  await shot("09-settings-modal");

  // switch theme live
  await click("Synthwave");
  await sleep(300);
  const theme = await evaluate("document.documentElement.getAttribute('data-theme')");
  check("theme switches live", theme === "synthwave");
  await shot("10-synthwave-theme");
  await click("Vintage Paper");
  await sleep(200);

  // persistence across reload
  await send(ws, "Page.reload");
  await sleep(1200);
  const afterReload = await lower();
  check("match survives a page reload", afterReload.includes("pass the device to") && afterReload.includes("team 2"), afterReload.slice(0, 120));

  // abort back to setup
  await evaluate(`document.querySelector('button[aria-label="Settings"]').click()`);
  await sleep(200);
  await click("Abort match");
  await sleep(300);
  check("abort returns to setup", (await lower()).includes("start match"));
  await shot("11-back-to-setup");

  // ---- desktop shot ------------------------------------------------
  await viewport(1280, 860, false);
  await sleep(300);
  await shot("12-setup-desktop");

  console.log("\nconsole errors:", logs.length ? logs : "none");
  if (logs.length) process.exitCode = 1;
  ws.close();
  chrome.kill();
}

main().catch((error) => {
  console.error("DRIVER FAILED:", error);
  chrome.kill();
  process.exit(1);
});
