// SCRATCH — audit: when does the winning hold actually BEGIN, and does the
// real premade shelf show a cost cliff on dom7?
import { getDef } from "../data/cards";
import { runGame, shelfFor, engineCanary } from "./__bal_harness";

console.log("CANARY:", engineCanary());
const S = (i: number) => i * 7919 + 13;
const shelf = shelfFor(7);

// ── C. Round on which the winner's decisive 3-round hold STARTS ────────────
// The claim says a cost-4 deck's first body (round 4) lands "one round after
// the winning 3-Point hold has typically already begun" (i.e. begun ~round 3).
{
  const starts: number[] = [];
  const firstMajority: number[] = [];
  for (let i = 0; i < 300; i++) {
    const d = shelf[i % shelf.length];
    const g = runGame({ seed: S(i), boardSize: 7, seats: 2, decks: [d.cards], spells: [d.spells, d.spells] });
    if (g.by !== "domination" || !g.winner) continue;
    const series = g.seatStats[g.winner].pointsByRound;
    // the closing run of >=3
    let run = 0, start = -1;
    for (let r = series.length - 1; r >= 0; r--) {
      if (series[r] >= 3) { run++; start = r + 1; } else break;
    }
    if (run >= 1) starts.push(start);
    const fm = series.findIndex((n) => n >= 3);
    if (fm >= 0) firstMajority.push(fm + 1);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const pctLe = (a: number[], k: number) => (100 * a.filter((x) => x <= k).length) / a.length;
  console.log(`C winning hold STARTS on round: mean ${mean(starts).toFixed(2)} median ${med(starts)} `
    + `| <=3: ${pctLe(starts, 3).toFixed(1)}%  <=4: ${pctLe(starts, 4).toFixed(1)}%  (n=${starts.length})`);
  console.log(`C first round anyone-the-winner held a majority: mean ${mean(firstMajority).toFixed(2)} median ${med(firstMajority)} `
    + `| <=3: ${pctLe(firstMajority, 3).toFixed(1)}%  (n=${firstMajority.length})`);
}

// ── D. All 30 real 7x7 premades vs one fixed reference, dom7. Correlate ────
{
  const REF = "pre_inferno_blitz_5";
  const n = Number(process.argv[2] ?? 100);
  const rows: { id: string; mean: number; ge4: number; pct: number }[] = [];
  for (const d of shelf) {
    if (d.id === REF) continue;
    const ref = shelf.find((x) => x.id === REF)!;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const aFirst = i % 2 === 0;
      const g = runGame({
        seed: S(i), boardSize: 7, seats: 2, trackPoints: false,
        decks: aFirst ? [d.cards, ref.cards] : [ref.cards, d.cards],
        spells: aFirst ? [d.spells, ref.spells] : [ref.spells, d.spells],
      });
      if (g.winner === (aFirst ? "P1" : "P2")) w++;
    }
    const costs = d.cards.map((c) => getDef(c).cost);
    rows.push({
      id: d.id,
      mean: costs.reduce((a, b) => a + b, 0) / costs.length,
      ge4: costs.filter((c) => c >= 4).length / costs.length,
      pct: (100 * w) / n,
    });
  }
  rows.sort((a, b) => a.mean - b.mean);
  for (const r of rows)
    console.log(`D ${r.id.padEnd(24)} meanCost ${r.mean.toFixed(2)}  ge4 ${(100 * r.ge4).toFixed(0)}%  win ${r.pct.toFixed(1)}%`);
  const cor = (xs: number[], ys: number[]) => {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx };
  };
  const c = cor(rows.map((r) => r.mean), rows.map((r) => r.pct));
  console.log(`D correlation(meanCost, win%) r=${c.r.toFixed(3)} slope=${c.slope.toFixed(1)} pts per +1 mean cost (n=${rows.length} decks x ${n} games)`);
}
