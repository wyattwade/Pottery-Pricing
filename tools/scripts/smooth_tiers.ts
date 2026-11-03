// Builds the fine-grained cost tier table in frontend/public/data.json.
//
// The multiplier slides linearly between the anchor tiers below (pinned at
// each anchor's midpoint) instead of jumping at tier edges. Edit ANCHORS or
// TIER_WIDTH and rerun:
//
//   cd tools && npx ts-node scripts/smooth_tiers.ts
//
// Only the "pricingMatrix" section of data.json is rewritten.

import * as fs from 'fs';
import * as path from 'path';

const TIER_WIDTH = 0.10;

// [minCost, maxCost, multiplier] — the 21-tier table this was smoothed from.
const ANCHORS: [number, number, number][] = [
  [0.25, 1.00, 12],
  [1.01, 1.50, 11],
  [1.51, 1.75, 10],
  [1.76, 2.25, 8.75],
  [2.26, 2.50, 7.75],
  [2.51, 3.00, 7.5],
  [3.01, 3.50, 7.15],
  [3.51, 3.75, 6.75],
  [3.76, 4.25, 6.5],
  [4.26, 5.00, 6],
  [5.01, 5.50, 5.75],
  [5.51, 6.25, 5.5],
  [6.26, 6.75, 5.5],
  [6.76, 7.75, 5.25],
  [7.76, 8.50, 5],
  [8.51, 9.50, 4.75],
  [9.51, 10.50, 4.5],
  [10.51, 11.75, 4.25],
  [11.76, 13.25, 4],
  [13.26, 15.00, 3.75],
  [15.01, 20.00, 3.5],
];

const round2 = (x: number) => Math.round(x * 100) / 100;

const mids = ANCHORS.map(([min, max, m]) => ({ x: (min + max) / 2, m }));

function multiplierAt(cost: number): number {
  if (cost <= mids[0].x) return mids[0].m;
  for (let i = 1; i < mids.length; i++) {
    if (cost <= mids[i].x) {
      const a = mids[i - 1], b = mids[i];
      return a.m + (b.m - a.m) * (cost - a.x) / (b.x - a.x);
    }
  }
  return mids[mids.length - 1].m;
}

const first = ANCHORS[0][0];
const last = ANCHORS[ANCHORS.length - 1][1];
const tiers: { id: number; minCost: number; maxCost: number; multiplier: number; userId: number }[] = [];
for (let lo = first; lo < last; ) {
  const hi = round2(Math.min(lo + TIER_WIDTH - 0.01, last));
  tiers.push({ id: tiers.length + 1, minCost: lo, maxCost: hi, multiplier: round2(multiplierAt((lo + hi) / 2)), userId: 1 });
  lo = round2(hi + 0.01);
}

// Run from tools/ (see header).
const dataPath = path.resolve(process.cwd(), '../frontend/public/data.json');
if (!fs.existsSync(dataPath)) throw new Error(`data.json not found at ${dataPath} — run this from the tools/ folder`);
const text = fs.readFileSync(dataPath, 'utf-8');
const start = text.indexOf('"pricingMatrix": [');
const end = text.indexOf('],', start);
if (start < 0 || end < 0) throw new Error('pricingMatrix section not found in data.json');

const body = tiers.map(t => `    ${JSON.stringify(t)}`).join(',\n');
fs.writeFileSync(dataPath, text.slice(0, start) + `"pricingMatrix": [\n${body}\n  ` + text.slice(end));

// Sanity check: file still parses and holds the new table.
const check = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
console.log(`Wrote ${check.pricingMatrix.length} tiers ($${first.toFixed(2)}–$${last.toFixed(2)}, $${TIER_WIDTH.toFixed(2)} wide); ${check.products.length} products untouched.`);
