// Shared Chrome DevTools Protocol driver for the browser checks.
//
//   import { launch } from "./lib/cdp.mjs";
//   const app = await launch({ url, port: 9401, out: "./shots" });
//   await app.clickId("start-match");
//   console.log(await app.text());
//   app.close();
//
// Node 18+ (global WebSocket). No dependencies.
// This is the same file as the browser-checks skill's scripts/cdp.mjs; if you
// change one, change the other.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function onPath(name) {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

/** CHROME_PATH wins, then the platform default. Linux CI images ship one of these. */
export function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = onPath(name);
    if (found) return found;
  }
  return "google-chrome";
}

/** One assertion per line. The detail is flattened so the output stays greppable. */
export function check(name, ok, detail = "") {
  const flat = String(detail).replace(/\s+/g, " ").trim().slice(0, 160);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${flat ? " :: " + flat : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Fail with a readable message instead of a confusing ENOENT from spawn. */
function assertChrome(binary) {
  const exists = binary.includes(path.sep) ? fs.existsSync(binary) : onPath(binary) !== null;
  if (!exists) {
    throw new Error(
      `Chrome not found (${binary}). Install Google Chrome or set CHROME_PATH to the binary.`,
    );
  }
}

export async function launch({
  url,
  width = 430,
  height = 932,
  port = 9222,
  profile,
  out = "./shots",
  mobile = true,
  scale = 1,
} = {}) {
  const CHROME = resolveChrome();
  assertChrome(CHROME);

  // A leftover Chrome still holding the debug port would be reused silently,
  // with its old page and old profile state. Take the next free port.
  const inUse = async (p) => {
    try {
      await fetch(`http://127.0.0.1:${p}/json/version`);
      return true;
    } catch {
      return false;
    }
  };
  let chosen = port;
  while (chosen < port + 20 && (await inUse(chosen))) chosen++;

  // A fresh profile per run: a reused one restores the app's saved state
  // (localStorage) and the first assertion lands on a stale screen.
  const profileDir = profile ?? `/tmp/wl-cdp-profile-${chosen}`;
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      `--remote-debugging-port=${chosen}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${chosen}/json/list`)).json();
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error("Chrome DevTools never came up");
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  const errors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(
        "console.error: " + msg.params.args.map((a) => a.value ?? a.description).join(" "),
      );
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push("exception: " + (d.exception?.description ?? d.text));
    }
  };

  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  };

  await send("Page.enable");
  await send("Runtime.enable");

  const viewport = async (w, h, { mobile: isMobile = true, deviceScaleFactor: s = 1 } = {}) => {
    await send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: h,
      deviceScaleFactor: s,
      mobile: isMobile,
    });
    await sleep(150);
  };

  await viewport(width, height, { mobile, deviceScaleFactor: scale });

  const navigate = async (target) => {
    const loaded = new Promise((resolve) => {
      const onMessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === "Page.loadEventFired") resolve(true);
      };
      ws.addEventListener("message", onMessage);
      setTimeout(() => resolve(false), 15000);
    });
    await send("Page.navigate", { url: target });
    await loaded;
    await sleep(300);
  };

  if (url) await navigate(url);

  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(d.text + " " + (d.exception?.description ?? ""));
    }
    return res.result.value;
  };

  // innerText reflects CSS text-transform, so compare lower-cased on both sides.
  const text = async () => (await evaluate("document.body.innerText")).toLowerCase();

  // The text of one element, by data-testid.
  const textId = async (testid) =>
    (await evaluate(
      `(document.querySelector('[data-testid=${JSON.stringify(testid)}]')?.innerText ?? "")`,
    )).toLowerCase();

  // Poll a DOM condition. Use this instead of a fixed sleep after an action:
  // React renders on the next tick, so an attribute read right after a
  // synthetic event returns the pre-render value.
  const waitFor = async (expression, { timeout = 5000, every = 100 } = {}) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return true;
      await sleep(every);
    }
    return false;
  };

  const click = async (label, { settle = 250 } = {}) => {
    const ok = await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('button, a, [role=button]')];
      const t = nodes.find((n) => (n.textContent || '').toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));
      if (!t) return false;
      t.click();
      return true;
    })()`);
    if (!ok) throw new Error(`no clickable element containing "${label}"`);
    await sleep(settle);
    return true;
  };

  // Click by data-testid: stable across copy and design changes.
  const clickId = async (testid, { settle = 250 } = {}) => {
    const ok = await evaluate(`(() => {
      const el = document.querySelector('[data-testid=${JSON.stringify(testid)}]');
      if (!el) return false;
      el.click();
      return true;
    })()`);
    if (!ok) throw new Error(`no element with data-testid="${testid}"`);
    await sleep(settle);
    return true;
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

  const setValueId = async (testid, value) =>
    setValue(`[data-testid=${JSON.stringify(testid)}]`, value);

  // Screenshot: writes the png and returns its base64 for pixel audits.
  const shot = async (name) => {
    const res = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(res.data, "base64"));
    return res.data;
  };

  // Page coordinates of a fraction of an element's box, for pointer work.
  const point = (selector, fx, fy) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * ${fx}, y: r.top + r.height * ${fy} };
    })()`);

  // Synthetic pointer events. Untrusted, but React handles them.
  const drag = async (selector, from, to) => {
    const a = await point(selector, from[0], from[1]);
    const b = await point(selector, to[0], to[1]);
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const opts = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: ${a.x}, clientY: ${a.y} }));
      el.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: ${b.x}, clientY: ${b.y} }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: ${b.x}, clientY: ${b.y} }));
      return true;
    })()`);
    await sleep(200);
  };

  // Trusted input. Use when the app ignores synthetic events (pointer capture,
  // drag thresholds, focus-dependent handlers).
  const mouse = async (selector, fx, fy, { type = "click" } = {}) => {
    const p = await point(selector, fx, fy);
    await send("Input.dispatchMouseEvent", {
      type: type === "click" ? "mousePressed" : "mouseMoved",
      x: p.x,
      y: p.y,
      button: "left",
      clickCount: 1,
      pointerType: "mouse",
    });
    if (type === "click") {
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: p.x,
        y: p.y,
        button: "left",
        clickCount: 1,
      });
    }
    await sleep(200);
  };

  // Pixel audit of a screenshot, computed inside the page on a canvas.
  // Pass the target hex colours in; the result is plain numbers, because
  // functions do not survive the CDP returnByValue boundary.
  const pixels = async (imageBase64, { selector = null, targets = [] } = {}) => {
    return evaluate(`(async () => {
      const img = new Image();
      img.src = ${JSON.stringify("data:image/png;base64," + imageBase64)};
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const rect = ${selector ? `document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect()` : `({left:0,top:0,right:img.width,bottom:img.height})`};
      const x = Math.round(rect.left), y = Math.round(rect.top);
      const w = Math.max(1, Math.round(rect.right - rect.left));
      const h = Math.max(1, Math.round(rect.bottom - rect.top));
      const data = ctx.getImageData(x, y, w, h).data;
      const counts = new Map();
      let min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const hex = '#' + [data[i], data[i+1], data[i+2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        counts.set(hex, (counts.get(hex) || 0) + 1);
        const lum = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
        if (lum < min) min = lum;
        if (lum > max) max = lum;
      }
      const near = {};
      for (const target of ${JSON.stringify(targets)}) {
        const t = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
        let n = 0;
        for (const [hex, count] of counts) {
          const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
          if (Math.max(Math.abs(c[0] - t[0]), Math.abs(c[1] - t[1]), Math.abs(c[2] - t[2])) <= 18) n += count;
        }
        near[target] = n;
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { total: w * h, contrast: Math.round(max - min), near, top, size: [img.width, img.height] };
    })()`);
  };

  const shotPixels = async (name, options = {}) => {
    const res = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(res.data, "base64"));
    return pixels(res.data, options);
  };

  const reload = async () => {
    await send("Page.reload");
    await sleep(1200);
  };

  const close = () => {
    try {
      ws.close();
    } catch {}
    chrome.kill();
  };

  return {
    send,
    evaluate,
    text,
    textId,
    waitFor,
    click,
    clickId,
    setValue,
    setValueId,
    shot,
    shotPixels,
    pixels,
    point,
    drag,
    mouse,
    navigate,
    reload,
    viewport,
    errors,
    close,
  };
}
