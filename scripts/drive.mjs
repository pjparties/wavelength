// The mobile flow, end to end: setup -> privacy curtain -> psychic -> guess ->
// reveal -> next team -> settings -> reload -> abort.
//
//   node scripts/drive.mjs [outDir]

import path from "node:path";
import { check, launch } from "./lib/cdp.mjs";

const URL = process.env.WL_URL ?? `file://${path.resolve("dist/index.html")}`;
const OUT = process.argv[2] ?? "./shots";
const PORT = Number(process.env.WL_PORT ?? 9333);

const app = await launch({
  url: URL,
  width: 430,
  height: 932,
  port: PORT,
  out: OUT,
  scale: 2,
});

try {
  const setupBody = await app.text();
  check(
    "setup screen renders",
    setupBody.includes("wavelength") && setupBody.includes("start match"),
    setupBody.slice(0, 80),
  );
  await app.shot("01-setup-mobile");

  // custom spectra + extra team on the setup screen
  const boxHidden = await app.evaluate(
    `!document.querySelector('[data-testid="custom-spectra"]')`,
  );
  check("custom text box stays hidden until the option is checked", boxHidden === true);
  check("custom spectra are a deck option", (await app.text()).includes("custom spectra"));
  const deckSummary = await app.textId("deck-summary");
  check("the deck summary hides custom until it is picked", !deckSummary.includes("custom"), deckSummary);
  await app.clickId("deck-custom");
  await app.setValueId("custom-spectra", "Total Cringe : Pure Masterpiece");
  await app.clickId("add-team");
  await app.setValueId("team-name-2", "Cringe Club");
  await app.shot("02-setup-custom-and-team");

  check("custom spectrum parsed and previewed", (await app.text()).includes("total cringe"));
  check("the deck summary counts the custom spectra",
    (await app.textId("deck-summary")).includes("1 custom"), await app.textId("deck-summary"));

  await app.clickId("start-match");
  const curtain = await app.text();
  check(
    "privacy curtain shown for team 1",
    curtain.includes("pass the device to") && curtain.includes("starks"),
    curtain.slice(0, 120),
  );
  check("the card button is called Show Card", curtain.includes("show card"), curtain.slice(0, 160));
  await app.shot("03-psychic-curtain");

  const curtainCovers = await app.evaluate(`(() => {
    const el = [...document.querySelectorAll('p')].find((n) => n.textContent.includes('Pass the device to'));
    return !!el;
  })()`);
  check("curtain copy present", curtainCovers);

  await app.clickId("psychic");
  const psychicState = await app.evaluate(`(() => ({
    needle: !!document.querySelector('[data-needle]'),
    target: !!document.querySelector('[data-target]'),
    body: document.body.innerText,
  }))()`);
  check("NEEDLE HIDDEN in psychic phase", psychicState.needle === false);
  check("target zones visible in psychic phase", psychicState.target === true);
  check("hard mode hides the target position from the psychic",
    !/target sits at/.test(psychicState.body.toLowerCase()), psychicState.body.slice(0, 120));
  const hardDial = await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    return { labels: svg.querySelectorAll('text').length, ticks: svg.querySelectorAll('[data-tick]').length };
  })()`);
  check("hard mode has no scale markers on the dial", hardDial.labels === 0 && hardDial.ticks === 0, JSON.stringify(hardDial));
  await app.shot("04-psychic-view");

  await app.clickId("hide-target");
  const guessState = await app.evaluate(`(() => ({
    needle: !!document.querySelector('[data-needle]'),
    target: !!document.querySelector('[data-target]'),
    body: document.body.innerText,
  }))()`);
  check("NEEDLE VISIBLE in guess phase", guessState.needle === true);
  check("target zones hidden in guess phase", guessState.target === false);
  check("hard mode hides the needle readout", !/needle at/.test(guessState.body.toLowerCase()));

  // easy mode puts the scale and the readouts back
  await app.clickId("settings");
  await app.clickId("toggle-easy");
  await app.clickId("close-settings");
  const easyDial = await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    return { labels: svg.querySelectorAll('text').length, ticks: svg.querySelectorAll('[data-tick]').length };
  })()`);
  check("easy mode brings back the scale markers", easyDial.labels === 2 && easyDial.ticks === 11, JSON.stringify(easyDial));
  check("easy mode brings back the needle readout", /needle at/.test((await app.text())));
  await app.shot("05-guess-view");
  await app.clickId("settings");
  await app.clickId("toggle-easy");
  await app.clickId("close-settings");

  // nudge the needle with the keyboard to prove it is interactive
  const before = await app.evaluate("document.querySelector('[data-needle]').getAttribute('transform')");
  await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    svg.focus();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  const after = await app.evaluate("document.querySelector('[data-needle]').getAttribute('transform')");
  check("needle responds to input", before !== after, `${before} -> ${after}`);

  // drag the needle with pointer events
  const dragAngle = await app.evaluate(`(() => {
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
  await app.shot("06-guess-after-drag");

  // the needle may not leave the 0-10 scale
  const dragToEdge = async (edge) => {
    await app.evaluate(`(() => {
      const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
      const r = svg.getBoundingClientRect();
      const opts = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      const x = ${edge === "left" ? "r.left - 40" : "r.right + 40"};
      // On the arc's own base line: below it the dial correctly ignores the touch.
      svg.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: x, clientY: r.top + r.height * (199 / 234) }));
      svg.dispatchEvent(new PointerEvent('pointerup', opts));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    return app.evaluate("document.querySelector('[data-needle]').getAttribute('transform')");
  };
  const leftEdge = await dragToEdge("left");
  const rightEdge = await dragToEdge("right");
  const angle = (transform) => Number(/rotate\((-?[\d.]+)/.exec(transform)[1]) + 90;
  check("the needle stops at 0", angle(leftEdge) <= 1, leftEdge);
  check("the needle stops at 10", angle(rightEdge) >= 179, rightEdge);

  // below the arc there is no angle: a thumb there must not move the needle
  const beforeLowTap = await app.evaluate("document.querySelector('[data-needle]').getAttribute('transform')");
  await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    const r = svg.getBoundingClientRect();
    const opts = { bubbles: true, pointerId: 3, pointerType: 'touch', isPrimary: true };
    svg.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: r.left + r.width * 0.55, clientY: r.bottom - 2 }));
    svg.dispatchEvent(new PointerEvent('pointerup', opts));
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  check("a tap below the arc leaves the needle alone",
    (await app.evaluate("document.querySelector('[data-needle]').getAttribute('transform')")) === beforeLowTap);

  await app.clickId("reveal");
  const revealState = await app.evaluate(`(() => ({
    needle: !!document.querySelector('[data-needle]'),
    target: !!document.querySelector('[data-target]'),
    body: document.body.innerText,
  }))()`);
  check("reveal shows needle and target together", revealState.needle && revealState.target);
  check("a score was awarded", /\+\d/.test(revealState.body));
  await app.shot("07-reveal");

  await app.clickId("next");
  const nextBody = await app.text();
  check(
    "turn rotates to the next team",
    nextBody.includes("pass the device to") && nextBody.includes("lannisters"),
    nextBody.slice(0, 120),
  );
  check("scoreboard keeps the points", /\b[1-5]\b/.test(nextBody));
  await app.shot("08-next-team-curtain");

  // settings modal
  await app.clickId("settings");
  await app.waitFor(`!!document.querySelector('[data-testid="abort"]')`);
  const settingsBody = await app.text();
  check(
    "settings modal opens with card pool stats",
    settingsBody.includes("card pool") && settingsBody.includes("clean deck"),
    settingsBody.slice(0, 120),
  );
  await app.shot("09-settings-modal");

  // one theme only, marked by the ascii diwali backdrop
  const themeState = await app.evaluate(`(() => {
    const bg = document.querySelector('[data-testid="diwali-bg"]');
    const body = getComputedStyle(document.body).backgroundColor;
    return {
      themeAttribute: document.documentElement.getAttribute('data-theme'),
      themeButtons: document.querySelectorAll('[data-testid^="theme-"]').length,
      diwali: bg ? getComputedStyle(bg).backgroundImage.slice(0, 30) : null,
      body,
    };
  })()`);
  check("no theme picker is offered", themeState.themeButtons === 0 && themeState.themeAttribute === "diwali", JSON.stringify(themeState));
  check("the diwali ascii backdrop is on the page", (themeState.diwali ?? "").includes("data:image/svg+xml"), String(themeState.diwali));
  check("the app uses the diwali cream paper", themeState.body === "rgb(251, 239, 217)", themeState.body);
  await app.shot("10-diwali-theme");

  // persistence across reload, clock included
  const clockOf = async () => (await app.evaluate(`(() => {
    const el = [...document.querySelectorAll('span')].find((n) => /^\\d:\\d\\d$/.test(n.textContent.trim()));
    return el ? el.textContent.trim() : null;
  })()`));
  const beforeReload = await clockOf();
  await app.reload();
  const afterReload = await app.text();
  check(
    "match survives a page reload",
    afterReload.includes("pass the device to") && afterReload.includes("lannisters"),
    afterReload.slice(0, 120),
  );
  check("the clock survives a page reload",
    (await clockOf()) === beforeReload && beforeReload !== "0:00",
    `${beforeReload} -> ${await clockOf()}`);

  // abort back to setup
  await app.clickId("settings");
  await app.clickId("abort");
  check("abort returns to setup", (await app.text()).includes("start match"));
  await app.shot("11-back-to-setup");

  // ---- desktop shot ------------------------------------------------
  await app.viewport(1280, 860, { mobile: false, deviceScaleFactor: 2 });
  await app.shot("12-setup-desktop");

  // ---- home button: the logo asks before it leaves the match ----
  await app.clickId("start-match");
  await app.clickId("home");
  const homePrompt = await app.text();
  check("the logo opens a confirmation popup", homePrompt.includes("leave the match"), homePrompt.slice(0, 120));
  await app.shot("13-home-confirm");
  await app.clickId("home-cancel");
  check("cancelling keeps the match", (await app.text()).includes("pass the device to"));
  await app.clickId("home");
  await app.clickId("home-confirm");
  check("confirming leaves the match for the home screen", (await app.text()).includes("start match"));
  await app.shot("14-back-home");

  // ---- the bands cover the target and stop at the ends of the scale ----
  // (the halving at 0 and 180 is unit-tested in game.test.ts: a browser test
  // cannot force a random target to an end without editing the saved match)
  await app.clickId("start-match");
  await app.clickId("psychic");
  const bands = await app.evaluate(`(() => {
    const svg = document.querySelector('svg[aria-label="Spectrum dial"]');
    // viewBox centre + the arc endpoint pair of each wedge give its angle span.
    const arc = (x, y) => (Math.atan2(200 - y, 200 - x) * 180) / Math.PI;
    return [...svg.querySelectorAll('[data-target] path')].map((p) => {
      const n = p.getAttribute('d').match(/-?[0-9.]+/g).map(Number);
      const from = arc(n[2], n[3]);
      const to = arc(n[n.length - 2], n[n.length - 1]);
      return { fill: getComputedStyle(p).fill, from: +from.toFixed(2), to: +to.toFixed(2), span: +(to - from).toFixed(2) };
    });
  })()`);
  const target = await app.evaluate(
    "JSON.parse(localStorage.getItem('wavelength.match.v1')).targetAngle",
  );
  const lo = Math.max(0, target - 22.5);
  const hi = Math.min(180, target + 22.5);
  const covered = bands.reduce((sum, band) => sum + band.span, 0);
  check("the dial paints the bands for the current target",
    Math.abs(covered - (hi - lo)) < 0.3, JSON.stringify({ target, covered, expected: hi - lo }));
  check("the bands start and end where the scale allows",
    bands.length > 0 && Math.abs(bands[0].from - lo) < 0.3 && Math.abs(bands[bands.length - 1].to - hi) < 0.3,
    JSON.stringify(bands));
  check("the bands use three zone colours", new Set(bands.map((band) => band.fill)).size === 3,
    JSON.stringify(bands.map((band) => band.fill)));

  // ---- skip: next to hide target, one budget per team ----
  const skipUi = await app.evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
    return {
      max: raw.maxSkipsPerTeam,
      used: raw.skipsUsed,
      text: document.querySelector('[data-testid="skip"]')?.textContent ?? "",
    };
  })()`);
  check("a skip button sits beside hide target with its count", /skip \(3\)/i.test(skipUi.text), skipUi.text);
  check("the match starts with a full skip budget for every team",
    skipUi.max === 3 && skipUi.used.join() === "0,0", JSON.stringify(skipUi));
  check("the pass button is short copy", (await app.text()).includes("hide target & pass"));
  const cardBefore = await app.textId("spectrum-card");
  await app.clickId("skip");
  const afterSkip = await app.evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
    return {
      turn: raw.turnIndex,
      card: raw.cardIndex,
      used: raw.skipsUsed,
      phase: raw.phase,
      score: raw.teams.map((t) => t.score),
      text: document.querySelector('[data-testid="skip"]')?.textContent ?? "",
    };
  })()`);
  const cardAfter = await app.textId("spectrum-card");
  check("a skip deals a new card to the same team",
    afterSkip.turn === 0 && afterSkip.card === 1 && cardAfter !== cardBefore,
    JSON.stringify([cardBefore.slice(0, 40), cardAfter.slice(0, 40)]));
  check("the skipped card scores nothing and costs one skip",
    afterSkip.phase === "psychic" && afterSkip.used.join() === "1,0" &&
      afterSkip.score.join() === "0,0" && /skip \(2\)/i.test(afterSkip.text),
    JSON.stringify(afterSkip));

  console.log("\nconsole errors:", app.errors.length ? app.errors : "none");
  if (app.errors.length) process.exitCode = 1;
} catch (error) {
  console.error("DRIVER FAILED:", error);
  process.exitCode = 1;
} finally {
  app.close();
}
