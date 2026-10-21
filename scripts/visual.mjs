// The look of the app: computed styles, pixel audits of the rendered screen,
// and the geometry of the dial.
//
//   node scripts/visual.mjs [outDir]

import path from "node:path";
import { check, launch } from "./lib/cdp.mjs";

const URL = process.env.WL_URL ?? `file://${path.resolve("dist/index.html")}`;
const OUT = process.argv[2] ?? "./shots";
const PORT = process.env.WL_PORT ?? 9334;

const app = await launch({ url: URL, width: 430, height: 932, port: PORT, out: OUT });

try {
  // ---------- computed style audit ----------
  const styles = await app.evaluate(`(() => {
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
      diwali: (() => {
        const el = document.querySelector('[data-testid="diwali-bg"]');
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { bg: cs.backgroundImage.slice(0, 30), position: cs.position, w: Math.round(r.width), h: Math.round(r.height) };
      })(),
    };
  })()`);
  console.log("styles:", JSON.stringify(styles, null, 1));
  check("page uses the warm ivory background", styles.bodyBg === "rgb(248, 243, 231)", styles.bodyBg);
  check("buttons have a soft shadow", styles.btnShadow.includes("0.1") && styles.btnShadow.includes("2px 8px"), styles.btnShadow);
  check("buttons have a thin border", styles.btnBorder.includes("1px"), styles.btnBorder);
  check("cards have a thin border and soft shadow", styles.cardBorder.includes("1px") && styles.cardShadow.includes("5px 18px"), styles.cardShadow);
  check("paper grain is an inline svg data uri", styles.grain.includes("data:image/svg+xml"), styles.grain);
  check("the diwali ascii backdrop covers the page",
    !!styles.diwali && styles.diwali.bg.includes("data:image/svg+xml") && styles.diwali.position === "fixed" && styles.diwali.w >= 430,
    JSON.stringify(styles.diwali));

  // ---------- pixel audit of the setup screen ----------
  const setupShot = await app.shot("v1-setup");
  const setupPixels = await app.pixels(setupShot, {
    targets: ["#f8f3e7", "#fffcf5", "#30271f", "#c85b35"],
  });
  console.log("setup screen dominant colors:", JSON.stringify(setupPixels.top));
  const paperPx = setupPixels.near["#f8f3e7"] + setupPixels.near["#fffcf5"];
  const inkPx = setupPixels.near["#30271f"];
  const accentPx = setupPixels.near["#c85b35"];
  check("cream paper fills the page", paperPx > setupPixels.total * 0.4, paperPx + "/" + setupPixels.total);
  check("ink text is rendered", inkPx > 2000, String(inkPx));
  check("accent colour (burnt orange) is rendered", accentPx > 500, String(accentPx));

  const btnPixels = await app.pixels(setupShot, { selector: ".btn-primary", targets: ["#c85b35"] });
  check("primary button face is the accent colour", btnPixels.near["#c85b35"] > btnPixels.total * 0.6, JSON.stringify(btnPixels.top.slice(0, 3)));

  // ---------- geometry audit of the dial ----------
  await app.clickId("start-match");
  await app.clickId("psychic");

  const dial = await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    const r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text')].map(t => {
      const b = t.getAttribute('x');
      return { text: t.textContent, x: Number(b), y: Number(t.getAttribute('y')) };
    });
    const zoneFills = [...svg.querySelectorAll('[data-target] path')].map(p => getComputedStyle(p).fill);
    const face = svg.querySelector('[data-face]');
    const needle = svg.querySelector('[data-needle]');
    return {
      box: { w: Math.round(r.width), h: Math.round(r.height) },
      texts,
      ticks: svg.querySelectorAll('[data-tick]').length,
      zoneFills,
      face: face ? face.getAttribute('data-face') : null,
      faceFill: face ? getComputedStyle(face).fill : null,
      needleTransform: needle ? needle.getAttribute('transform') : null,
      hasNeedle: !!needle,
      hasTarget: !!svg.querySelector('[data-target]'),
    };
  })()`);
  console.log("dial:", JSON.stringify(dial));
  check("hard mode has no scale labels or ticks", dial.texts.length === 0 && dial.ticks === 0, JSON.stringify(dial.texts));
  check("needle is absent in the psychic phase", dial.hasNeedle === false);
  check("the psychic meter face is plain, not grey",
    dial.face === "plain" && dial.faceFill === "rgb(255, 252, 245)", JSON.stringify([dial.face, dial.faceFill]));
  check("target renders the three scoring bands",
    new Set(dial.zoneFills.map((f) => f)).size >= 3, JSON.stringify(dial.zoneFills));
  check("dial fits the phone width", dial.box.w <= 430 && dial.box.w > 300, JSON.stringify(dial.box));

  // easy mode puts the scale back
  await app.clickId("settings");
  await app.clickId("toggle-easy");
  await app.clickId("close-settings");
  const easyDial = await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    return {
      texts: [...svg.querySelectorAll('text')].map(t => ({ text: t.textContent, x: Number(t.getAttribute('x')) })),
      ticks: svg.querySelectorAll('[data-tick]').length,
    };
  })()`);
  check("scale label 0 sits at the left end of the arc", easyDial.texts[0]?.text === "0" && easyDial.texts[0]?.x < 60, JSON.stringify(easyDial.texts));
  check("scale label 10 sits at the right end of the arc", easyDial.texts[1]?.text === "10" && easyDial.texts[1]?.x > 340, JSON.stringify(easyDial.texts));
  check("easy mode draws the scale ticks", easyDial.ticks === 11, String(easyDial.ticks));
  await app.clickId("settings");
  await app.clickId("toggle-easy");
  await app.clickId("close-settings");

  // reveal: needle + target together, score badge
  await app.clickId("hide-target");
  const guessDial = await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    return { needle: !!svg.querySelector('[data-needle]'), target:!!svg.querySelector('[data-target]') };
  })()`);
  check("needle visible for guessers", guessDial.needle && !guessDial.target);

  await app.clickId("reveal");
  const revealShot = await app.shot("v2-reveal");
  const dialPixels = await app.pixels(revealShot, {
    selector: "svg[aria-label='Spectrum dial']",
    targets: ["#747747", "#e6a52e", "#c85b35", "#d6cdbf"],
  });
  console.log("reveal dial colours:", JSON.stringify(dialPixels.top));
  const zoneShare = (hex) => dialPixels.near[hex] / dialPixels.total;
  check("olive bullseye is painted on the dial", zoneShare("#747747") > 0.01, zoneShare("#747747").toFixed(3));
  check("marigold inner zone is painted on the dial", zoneShare("#e6a52e") > 0.01, zoneShare("#e6a52e").toFixed(3));
  check("terracotta outer band is painted on the dial", zoneShare("#c85b35") > 0.01, zoneShare("#c85b35").toFixed(3));
  check("warm neutral miss is painted on the dial", zoneShare("#d6cdbf") > 0.05, zoneShare("#d6cdbf").toFixed(3));
  check("dial has strong internal contrast", dialPixels.contrast > 120, String(dialPixels.contrast));

  const revealFace = await app.evaluate(
    `document.querySelector('[data-face]')?.getAttribute('data-face') ?? null`,
  );
  check("the reveal face shows the grey miss zone", revealFace === "miss", String(revealFace));

  console.log("\nconsole errors:", app.errors.length ? app.errors : "none");
  if (app.errors.length) process.exitCode = 1;
} catch (error) {
  console.error("VISUAL AUDIT FAILED:", error);
  process.exitCode = 1;
} finally {
  app.close();
}
