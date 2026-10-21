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
const PORT = Number(process.env.WL_PORT ?? 9334);
const PROFILE = "/tmp/wl-chrome-profile-visual";

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

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
  throw new Error("no devtools");
}

let id = 0;
const pending = new Map();
function send(ws, method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

async function main() {
  const ws = new WebSocket(await targetUrl());
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
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result.value;
  };
  const shot = async (name) => {
    const res = await send(ws, "Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(res.data, "base64"));
    return res.data;
  };
  const click = async (label) => {
    const ok = await evaluate(`(() => {
      const t = [...document.querySelectorAll('button')].find((n) => (n.textContent||'').toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (!t) return false; t.click(); return true;
    })()`);
    if (!ok) throw new Error("no button " + label);
    await sleep(200);
  };

  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await send(ws, "Page.navigate", { url: URL });
  await sleep(1200);

  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
    if (!ok) process.exitCode = 1;
  };

  // ---------- computed style audit ----------
  const styles = await evaluate(`(() => {
    const btn = document.querySelector('.btn');
    const card = document.querySelector('.card');
    const title = document.querySelector('.title');
    const cs = (el) => getComputedStyle(el);
    return {
      bodyBg: cs(document.body).backgroundColor,
      bodyFont: cs(document.body).fontFamily,
      btnBg: cs(btn).backgroundColor,
      btnShadow: cs(btn).boxShadow,
      btnBorder: cs(btn).border,
      btnTransform: cs(btn).transform,
      cardBorder: cs(card).border,
      cardRadius: cs(card).borderRadius,
      cardShadow: cs(card).boxShadow,
      titleFont: cs(title).fontFamily,
      titleWeight: cs(title).fontWeight,
      grain: getComputedStyle(document.querySelector('.paper-texture'), '::after').backgroundImage.slice(0, 40),
      htmlTheme: document.documentElement.getAttribute('data-theme'),
    };
  })()`);
  console.log("styles:", JSON.stringify(styles, null, 1));
  check("page uses the eggshell paper background", styles.bodyBg === "rgb(247, 243, 233)", styles.bodyBg);
  check("retro buttons have a hard offset shadow", styles.btnShadow.includes("4px 4px"), styles.btnShadow);
  check("buttons have a 2px ink border", styles.btnBorder.includes("2px"), styles.btnBorder);
  check("cards are bordered with a hard shadow", styles.cardBorder.includes("2px") && styles.cardShadow.includes("6px"), styles.cardShadow);
  check("paper grain is an inline svg data uri", styles.grain.includes("data:image/svg+xml"), styles.grain);
  check("default theme is vintage", styles.htmlTheme === "vintage");

  // ---------- pixel audit of the setup screen ----------
  const setupShot = await shot("v1-setup");
  const analyse = async (dataUrl, selector, targets = []) => {
    return await evaluate(`(async () => {
      const img = new Image();
      img.src = ${JSON.stringify("data:image/png;base64," + dataUrl)};
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const rect = ${selector ? `document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect()` : `({left:0,top:0,right:img.width,bottom:img.height})`};
      const x = Math.round(rect.left), y = Math.round(rect.top);
      const w = Math.max(1, Math.round(rect.right - rect.left)), h = Math.max(1, Math.round(rect.bottom - rect.top));
      const data = ctx.getImageData(x, y, w, h).data;
      const counts = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const hex = '#' + [data[i], data[i+1], data[i+2]].map(v => v.toString(16).padStart(2,'0')).join('');
        counts.set(hex, (counts.get(hex) || 0) + 1);
      }
      const top = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8);
      let min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
        min = Math.min(min, lum); max = Math.max(max, lum);
      }
      const near = {};
      for (const target of ${JSON.stringify(targets)}) {
        const t = [1,3,5].map(i => parseInt(target.slice(i, i+2), 16));
        let n = 0;
        for (const [hex, count] of counts) {
          const c = [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16));
          if (Math.max(Math.abs(c[0]-t[0]), Math.abs(c[1]-t[1]), Math.abs(c[2]-t[2])) <= 18) n += count;
        }
        near[target] = n;
      }
      return { size: [img.width, img.height], top, contrast: Math.round(max - min), near, total: w * h };
    })()`);
  };

  const setupPixels = await analyse(setupShot, null, ["#f7f3e9", "#fffdf7", "#1e1e1e", "#c8553d"]);
  console.log("setup screen dominant colors:", JSON.stringify(setupPixels.top));
  const paperPx = setupPixels.near["#f7f3e9"] + setupPixels.near["#fffdf7"];
  const inkPx = setupPixels.near["#1e1e1e"];
  const accentPx = setupPixels.near["#c8553d"];
  check("cream paper fills the page", paperPx > setupPixels.total * 0.4, paperPx + "/" + setupPixels.total);
  check("ink text is rendered", inkPx > 2000, String(inkPx));
  check("accent colour (terracotta) is rendered", accentPx > 500, String(accentPx));

  const btnPixels = await analyse(setupShot, ".btn-primary", ["#c8553d"]);
  check("primary button face is the accent colour", btnPixels.near["#c8553d"] > btnPixels.total * 0.6, JSON.stringify(btnPixels.top.slice(0, 3)));

  // ---------- geometry audit of the dial ----------
  await click("Start match");
  await sleep(300);
  await click("I'm the psychic");
  await sleep(300);

  const dial = await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    const r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text')].map(t => {
      const b = t.getAttribute('x');
      return { text: t.textContent, x: Number(b), y: Number(t.getAttribute('y')) };
    });
    const zoneFills = [...svg.querySelectorAll('[data-target] path')].map(p => getComputedStyle(p).fill);
    const needle = svg.querySelector('[data-needle]');
    return {
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      texts,
      zoneFills,
      needleTransform: needle ? needle.getAttribute('transform') : null,
      hasNeedle: !!needle,
      hasTarget: !!svg.querySelector('[data-target]'),
    };
  })()`);
  console.log("dial:", JSON.stringify(dial));
  check("scale label 0 sits at the left end of the arc", dial.texts[0].text === "0" && dial.texts[0].x < 60, JSON.stringify(dial.texts));
  check("scale label 10 sits at the right end of the arc", dial.texts[1].text === "10" && dial.texts[1].x > 340, JSON.stringify(dial.texts));
  check("needle is absent in the psychic phase", dial.hasNeedle === false);
  check("target renders grey + red + yellow + blue zones",
    new Set(dial.zoneFills.map((f) => f)).size >= 4, JSON.stringify(dial.zoneFills));
  check("dial fits the phone width", dial.box.w <= 430 && dial.box.w > 300, JSON.stringify(dial.box));

  // reveal: needle + target together, score badge
  await click("Hide target");
  await sleep(250);
  const guessDial = await evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    return { needle: !!svg.querySelector('[data-needle]'), target: !!svg.querySelector('[data-target]') };
  })()`);
  check("needle visible for guessers", guessDial.needle && !guessDial.target);

  await click("Lock in & reveal");
  await sleep(400);
  const revealShot = await shot("v2-reveal");
  const dialPixels = await analyse(revealShot, "svg[aria-label='Spectrum dial']", ["#2f5da8", "#e8b93b", "#c2503c", "#b9b3a6"]);
  console.log("reveal dial colours:", JSON.stringify(dialPixels.top));
  const zoneShare = (hex) => dialPixels.near[hex] / dialPixels.total;
  check("bullseye blue is painted on the dial", zoneShare("#2f5da8") > 0.01, zoneShare("#2f5da8").toFixed(3));
  check("inner yellow is painted on the dial", zoneShare("#e8b93b") > 0.01, zoneShare("#e8b93b").toFixed(3));
  check("outer red is painted on the dial", zoneShare("#c2503c") > 0.01, zoneShare("#c2503c").toFixed(3));
  check("miss grey is painted on the dial", zoneShare("#b9b3a6") > 0.05, zoneShare("#b9b3a6").toFixed(3));
  check("dial has strong internal contrast", dialPixels.contrast > 120, String(dialPixels.contrast));

  // synthwave palette check
  await evaluate(`document.querySelector('button[aria-label="Settings"]').click()`);
  await sleep(200);
  await click("Synthwave");
  await sleep(300);
  const synthShot = await shot("v3-synthwave");
  const synthPixels = await analyse(synthShot, null, ["#1b1033", "#241547", "#ff2e88"]);
  console.log("synthwave dominant colors:", JSON.stringify(synthPixels.top));
  check("synthwave switches to the dark palette",
    synthPixels.near["#1b1033"] + synthPixels.near["#241547"] > synthPixels.total * 0.5,
    JSON.stringify(synthPixels.top.slice(0, 3)));

  ws.close();
  chrome.kill();
}

main().catch((error) => {
  console.error("VISUAL AUDIT FAILED:", error);
  chrome.kill();
  process.exit(1);
});
