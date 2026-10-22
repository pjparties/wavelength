// The scoring maths: aim the needle at the target and the awarded points must
// match the zone maths, and a deliberate miss must score 0.
//
//   node scripts/scoring.mjs

import path from "node:path";
import { check, launch } from "./lib/cdp.mjs";

const URL = process.env.WL_URL ?? `file://${path.resolve("dist/index.html")}`;
const PORT = Number(process.env.WL_PORT ?? 9336);

const app = await launch({ url: URL, width: 430, height: 932, port: PORT });

try {
  await app.clickId("start-match");

  // Play 8 rounds, each time aiming the needle with a pointer at a known angle,
  // then compare the awarded points + scoreboard against the expected zone maths.
  for (let round = 0; round < 8; round++) {
    await app.clickId("psychic");
    await app.clickId("hide-target");

    const target = await app.evaluate(
      "JSON.parse(localStorage.getItem('wavelength.match.v1')).targetAngle",
    );
    // aim exactly at the target -> must score 4
    await app.evaluate(`(() => {
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
    // Read the needle from the dial: a move is saved shortly after, not at once.
    const needleAngle = await app.evaluate(`(() => {
      const t = document.querySelector('[data-needle]').getAttribute('transform');
      return Number(t.match(/-?[0-9.]+/)[0]) + 90;
    })()`);
    const diff = Math.abs(needleAngle - target);

    const beforeScores = await app.evaluate(
      "JSON.parse(localStorage.getItem('wavelength.match.v1')).teams.map(t => t.score)",
    );
    await app.clickId("reveal");
    const result = await app.evaluate(`(() => {
      const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
      const badge = document.body.innerText.match(/\\+(\\d)/);
      return { badge: badge ? Number(badge[1]) : null, scores: raw.teams.map((t) => t.score), turn: raw.turnIndex };
    })()`);
    const expected = diff <= 5 ? 4 : diff <= 13.5 ? 3 : diff <= 22.5 ? 2 : 0;
    const teamSlot = result.turn % result.scores.length;
    const delta = result.scores[teamSlot] - beforeScores[teamSlot];
    check(
      `round ${round + 1}: needle ${needleAngle.toFixed(1)} vs target ${target.toFixed(1)} scores ${expected}`,
      result.badge === expected && delta === expected,
      `badge=${result.badge} delta=${delta} scores=${JSON.stringify(result.scores)}`,
    );

    await app.clickId("next");
  }

  // aim far away -> must score 0 and the score must not change
  await app.clickId("psychic");
  await app.clickId("hide-target");
  const target2 = await app.evaluate(
    "JSON.parse(localStorage.getItem('wavelength.match.v1')).targetAngle",
  );
  await app.evaluate(`(() => {
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
  const missAngle = await app.evaluate(`(() => {
    const t = document.querySelector('[data-needle]').getAttribute('transform');
    return Number(t.match(/-?[0-9.]+/)[0]) + 90;
  })()`);
  const missDiff = Math.abs(missAngle - target2);
  await app.clickId("reveal");
  const missResult = await app.evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
    const badge = document.body.innerText.match(/\\+(\\d)/);
    return { badge: badge ? Number(badge[1]) : null, scores: raw.teams.map((t) => t.score) };
  })()`);
  const missExpected = missDiff <= 22.5 ? (missDiff <= 13.5 ? 3 : 2) : 0;
  check(
    `deliberate miss: needle ${missAngle.toFixed(1)} vs target ${target2.toFixed(1)} scores ${missExpected}`,
    missResult.badge === missExpected,
    `badge=${missResult.badge} scores=${JSON.stringify(missResult.scores)}`,
  );

  console.log("\nconsole errors:", app.errors.length ? app.errors : "none");
  if (app.errors.length) process.exitCode = 1;
} catch (error) {
  console.error("SCORING AUDIT FAILED:", error);
  process.exitCode = 1;
} finally {
  app.close();
}
