// Every browser check, in order, even when one of them fails: a red visual
// audit must not hide the logic and scoring audits behind it.
//
//   node scripts/verify-all.mjs

import { spawnSync } from "node:child_process";

const runs = [
  ["scripts/drive.mjs", "./shots"],
  ["scripts/visual.mjs", "./shots"],
  ["scripts/logic.mjs"],
  ["scripts/scoring.mjs"],
];

let failed = 0;
for (const [script, ...args] of runs) {
  const run = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  if (run.status !== 0) failed = run.status ?? 1;
}
process.exit(failed);
