// The rules and the screens: setup validation, the timer, the turn order and
// the end of the match.
//
//   node scripts/logic.mjs

import path from "node:path";
import { check, launch } from "./lib/cdp.mjs";

const URL = process.env.WL_URL ?? `file://${path.resolve("dist/index.html")}`;
const PORT = Number(process.env.WL_PORT ?? 9335);

const app = await launch({ url: URL, width: 430, height: 932, port: PORT });

try {
  // ---- layout: no horizontal overflow on setup ----
  const setupOverflow = await app.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  check("setup screen has no horizontal overflow", setupOverflow <= 0, String(setupOverflow));

  // ---- validation: target points > rounds * 5 is rejected ----
  await app.setValueId("rounds", "1"); // rounds per team = 1
  await app.setValueId("target-score", "6"); // 6 > 1 * 5
  await app.clickId("start-match");
  const invalid = await app.text();
  check("target points above rounds x 5 blocks the start",
    invalid.includes("cannot exceed 5") && invalid.includes("start match"), invalid.slice(0, 140));
  check("invalid setup keeps you on the setup screen", invalid.includes("teams"));

  // ---- target points of 0 is rejected ----
  await app.setValueId("target-score", "0");
  await app.clickId("start-match");
  check("target points of 0 is rejected", (await app.text()).includes("greater than 0"));

  // ---- valid target score of 5 with 1 round is accepted ----
  await app.setValueId("target-score", "5");
  // custom spectrum, NSFW-only deck
  await app.clickId("deck-custom");
  await app.setValueId("custom-spectra", "Total Cringe : Pure Masterpiece");
  await app.clickId("deck-sfw");
  await app.clickId("deck-nsfw");
  await app.clickId("custom-first");
  await app.setValueId("psychic-seconds", "20");
  await app.setValueId("guess-seconds", "30");
  await app.clickId("start-match");
  check("valid setup starts the match", (await app.text()).includes("pass the device to"));

  // ---- custom first ordering: first card is the custom prompt ----
  await app.clickId("psychic");
  const firstCard = await app.text();
  check("custom spectra are played first",
    firstCard.includes("total cringe") && firstCard.includes("pure masterpiece"), firstCard.slice(0, 160));

  // ---- timer counts down and can be paused ----
  const readClock = async () => (await app.evaluate(`(() => {
    const el = [...document.querySelectorAll('span')].find((n) => /^\\d:\\d\\d$/.test(n.textContent.trim()));
    return el ? el.textContent.trim() : null;
  })()`));
  const readSeconds = async () => {
    const raw = await readClock();
    if (!raw) return null;
    const [m, s] = raw.split(":").map(Number);
    return m * 60 + s;
  };
  const psychicSeconds = await readSeconds();
  check("psychic phase runs on the configured psychic time",
    psychicSeconds !== null && psychicSeconds <= 20 && psychicSeconds >= 18, String(psychicSeconds));
  const clockA = await readClock();
  await new Promise((r) => setTimeout(r, 2200));
  const clockB = await readClock();
  check("turn timer counts down", clockA !== null && clockB !== null && clockA !== clockB, `${clockA} -> ${clockB}`);
  await app.clickId("toggle-timer");
  await new Promise((r) => setTimeout(r, 1500));
  const clockC = await readClock();
  await new Promise((r) => setTimeout(r, 1200));
  const clockD = await readClock();
  check("paused timer stops", clockC === clockD, `${clockC} -> ${clockD}`);
  await app.clickId("toggle-timer");
  await new Promise((r) => setTimeout(r, 1300));
  check("resumed timer runs again", (await readClock()) !== clockD);

  // ---- guess + reveal, then the game ends after 1 round per team ----
  await app.clickId("hide-target");
  const guessSeconds = await readSeconds();
  check("guess phase runs on the configured guesser time",
    guessSeconds !== null && guessSeconds <= 30 && guessSeconds >= 28, String(guessSeconds));
  await app.clickId("reveal");
  check("reveal awards points", /\+\d/.test(await app.evaluate("document.body.innerText")));
  await app.clickId("next");
  check("second team takes the turn", (await app.text()).includes("team 2"));

  await app.clickId("psychic");
  await app.clickId("hide-target");
  await app.clickId("reveal");
  const beforeResults = await app.text();
  check("last round offers the results", beforeResults.includes("see results"), beforeResults.slice(0, 100));
  await app.clickId("next");
  const results = await app.text();
  check("game over screen shows the standings",
    results.includes("game over") || results.includes("wins"), results.slice(0, 120));
  check("standings list both teams", results.includes("team 1") && results.includes("team 2"));

  // ---- deck composition in the settings modal ----
  const deckInfo = await app.evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('wavelength.match.v1'));
    return { deck: raw.deck.length, custom: raw.customCount, teams: raw.teams.length };
  })()`);
  check("match deck holds only NSFW + custom", deckInfo.deck === 71 && deckInfo.custom === 1, JSON.stringify(deckInfo));

  // ---- play again resets the scores ----
  await app.clickId("play-again");
  const restarted = await app.text();
  check("play again starts a fresh match",
    restarted.includes("pass the device to") && restarted.includes("team 1"), restarted.slice(0, 120));

  console.log("\nconsole errors:", app.errors.length ? app.errors : "none");
  if (app.errors.length) process.exitCode = 1;
} catch (error) {
  console.error("LOGIC AUDIT FAILED:", error);
  process.exitCode = 1;
} finally {
  app.close();
}
