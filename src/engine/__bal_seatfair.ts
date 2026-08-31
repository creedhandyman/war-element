import { runBatch, summarize, shelfFor } from "./__bal_harness";

const S = (i: number) => i * 7919 + 13;
const s7 = shelfFor(7);
const s5 = shelfFor(5);
const s4 = shelfFor(4);

// Wilson 95% interval for a proportion
function wilson(k: number, n: number) {
  const z = 1.959964, p = k / n;
  const d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [100 * (c - h), 100 * (c + h)] as const;
}
function line(tag: string, games: any[]) {
  const n = games.length;
  const w1 = games.filter((g) => g.winner === "P1").length;
  const w2 = games.filter((g) => g.winner === "P2").length;
  const nul = n - w1 - w2;
  const [lo, hi] = wilson(w1, n);
  const ends: Record<string, number> = {};
  for (const g of games) ends[g.by] = (ends[g.by] ?? 0) + 1;
  const rounds = games.map((g) => g.rounds).sort((a, b) => a - b);
  console.log(
    `${tag.padEnd(34)} n=${n}  P1 ${(100 * w1 / n).toFixed(1)}% [${lo.toFixed(1)}-${hi.toFixed(1)}]  P2 ${(100 * w2 / n).toFixed(1)}%  draw/none ${nul}` +
    `  | rounds med ${rounds[Math.floor(n / 2)]} mean ${(rounds.reduce((a, b) => a + b, 0) / n).toFixed(2)}` +
    `  | ${Object.entries(ends).map(([k, v]) => `${k}:${v}`).join(" ")}`,
  );
}

const N = Number(process.env.N ?? 2000);

console.log("=== A. 2-seat 7x7 DOMINATION, mirror premades ===");
for (const d of s7) {
  line(`DOM  ${d.id}`, runBatch(N, (i) => ({
    seed: S(i), boardSize: 7, seats: 2, decks: [d.cards], spells: [d.spells, d.spells], trackPoints: false,
  })));
}
