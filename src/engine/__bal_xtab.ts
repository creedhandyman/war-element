import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { runBatch, shelfFor } from "./__bal_harness";
import { wilson, line } from "./__bal_lib";
import type { PlayerId } from "./types";
const S = (i: number) => i * 7919 + 13;
const d = shelfFor(7)[0];
const pct = (k: number, n: number) => { if (!n) return "n=0"; const [lo, hi] = wilson(k, n); return `${(100*k/n).toFixed(1)}% [${lo.toFixed(1)}-${hi.toFixed(1)}] n=${n}`; };

console.log("=== K. 3-seat, win split by ending reason (mirror) ===");
const g3 = runBatch(500, (i) => ({ seed: S(i), boardSize: 7, seats: 3, decks: [d.cards], spells: [d.spells, d.spells, d.spells], trackPoints: false }));
line("3seat all", g3, 3);
line("  by=domination", g3.filter((g) => g.by === "domination"), 3);
line("  by=elimination", g3.filter((g) => g.by === "elimination"), 3);

console.log("=== L. 2-seat: round-1 first mover x parity of the final round ===");
const N = Number(process.env.N ?? 1500);
const tab: Record<string, { n: number; w1: number }> = {};
for (let i = 0; i < N; i++) {
  let s = createInitialState(S(i), d.cards, d.cards, [], d.spells, d.spells, 7);
  s.domination = newDomination(DOMINATION_7X7);
  let first1: PlayerId | null = null, steps = 0;
  while (s.phase !== "gameover" && steps < 200000) {
    if (s.phase === "prep" && s.prep && s.round === 1 && !first1) first1 = s.prep.priority as PlayerId;
    const nx = advance(s); steps++; if (nx === s) break; s = nx;
  }
  const key = `first1=${first1} finalRound=${s.round % 2 === 1 ? "odd" : "even"}`;
  (tab[key] ??= { n: 0, w1: 0 }).n++;
  if (s.win?.winner === "P1") tab[key].w1++;
}
for (const k of Object.keys(tab).sort()) console.log(`  ${k.padEnd(34)} P1 wins ${pct(tab[k].w1, tab[k].n)}`);
