// SCRATCH — does the Domination clock stay short when BOTH decks are expensive?
// If the mode's 8-round clock is a property of the mode, an expensive mirror
// should still end in ~8 rounds. If it stretches, the "clock beats the economy"
// framing is really "a cheap deck beats an expensive one", which is ordinary.
import { CARDS, getDef } from "../data/cards";
import { runGame } from "./__bal_harness";
import type { RunGameOpts } from "./__bal_harness";

const POOL = CARDS.filter((c) => !c.boss);
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function pick(pool: typeof POOL, n: number, seed: number): string[] {
  const r = lcg(seed);
  return Array.from({ length: n }, () => pool[Math.floor(r() * pool.length)].id);
}
const c45 = pick(POOL.filter((c) => c.cost >= 4 && c.cost <= 5), 30, 1001);
const c1 = pick(POOL.filter((c) => c.cost === 1), 30, 1002);
const S = (i: number) => i * 7919 + 13;

function probe(label: string, decks: string[][], opts: Partial<RunGameOpts>, n: number) {
  let rounds = 0, summons = 0, dom = 0, ge4 = 0;
  for (let i = 0; i < n; i++) {
    const g = runGame({ seed: S(i), boardSize: 7, seats: 2, trackPoints: false, keepState: true, decks, spells: [[], []], ...opts });
    rounds += g.rounds;
    if (g.by === "domination") dom++;
    for (const line of g.state!.log) {
      const m = /^P[1-4] summons .*\(cost (\d+)\)/.exec(line);
      if (m) { summons++; if (Number(m[1]) >= 4) ge4++; }
    }
  }
  console.log(`${label}: rounds ${(rounds / n).toFixed(1)}  summons/game ${(summons / n).toFixed(1)} (cost>=4: ${(ge4 / n).toFixed(1)})  domination endings ${dom}/${n}`);
}

const N = Number(process.argv[2] ?? 80);
probe("c45 MIRROR   dom7  ", [c45, c45], {}, N);
probe("c1  MIRROR   dom7  ", [c1, c1], {}, N);
probe("c45 vs c1    dom7  ", [c45, c1], {}, N);
probe("c45 MIRROR   plain7", [c45, c45], { mode: "plain" }, N);
