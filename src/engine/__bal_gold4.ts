// SCRATCH — control: same cost-vs-winrate slope on the SAME 7x7 board with the
// objective OFF. Subset of 10 decks spanning the shelf's cost range.
import { getDef } from "../data/cards";
import { runGame, shelfFor } from "./__bal_harness";
import type { RunGameOpts } from "./__bal_harness";

const S = (i: number) => i * 7919 + 13;
const shelf = shelfFor(7);
const REF = "pre_inferno_blitz_5";
const ref = shelf.find((x) => x.id === REF)!;
const n = Number(process.argv[2] ?? 40);
const which = process.argv[3] ?? "plain7";
const extra: Partial<RunGameOpts> = which === "plain7" ? { boardSize: 7, mode: "plain" } : { boardSize: 7 };

const SUBSET = [
  "pre_verdant_tide_5", "pre_stormfront_5", "pre_deep_shade_5", "pre_nightfall_5",
  "pre_titanfall_5", "pre_radiant_host_5", "pre_thornwind_5", "pre_chlorophyll_5",
  "pre_dust_patrol_5", "pre_static_shallows_5", "pre_ember_wake_5",
];

const rows: { id: string; mean: number; pct: number }[] = [];
for (const id of SUBSET) {
  const d = shelf.find((x) => x.id === id)!;
  let w = 0;
  for (let i = 0; i < n; i++) {
    const aFirst = i % 2 === 0;
    const g = runGame({
      seed: S(i), seats: 2, trackPoints: false, ...extra,
      decks: aFirst ? [d.cards, ref.cards] : [ref.cards, d.cards],
      spells: aFirst ? [d.spells, ref.spells] : [ref.spells, d.spells],
    } as RunGameOpts);
    if (g.winner === (aFirst ? "P1" : "P2")) w++;
  }
  const costs = d.cards.map((c) => getDef(c).cost);
  const row = { id, mean: costs.reduce((a, b) => a + b, 0) / costs.length, pct: (100 * w) / n };
  rows.push(row);
  console.log(`${which} ${row.id.padEnd(24)} meanCost ${row.mean.toFixed(2)}  win ${row.pct.toFixed(1)}%`);
}
const xs = rows.map((r) => r.mean), ys = rows.map((r) => r.pct);
const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
let sxy = 0, sxx = 0, syy = 0;
for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
console.log(`${which} correlation r=${(sxy / Math.sqrt(sxx * syy)).toFixed(3)} slope=${(sxy / sxx).toFixed(1)} pts per +1 mean cost (n=${rows.length} decks x ${n})`);
