// SCRATCH — audit: does the archetype result reproduce, and is GOLD the cause?
import { CARDS, getDef } from "../data/cards";
import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { engineCanary } from "./__bal_harness";
import type { GameState, PlayerId } from "./types";

console.log("CANARY:", engineCanary());

// ── deck builders (deterministic) ──────────────────────────────────────────
const POOL = CARDS.filter((c) => !c.boss);
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function pick(pool: typeof POOL, n: number, seed: number): string[] {
  const r = lcg(seed);
  return Array.from({ length: n }, () => pool[Math.floor(r() * pool.length)].id);
}
const inCost = (lo: number, hi: number) => POOL.filter((c) => c.cost >= lo && c.cost <= hi);
const DECK = {
  c1: (s: number) => pick(inCost(1, 1), 30, s),
  c45: (s: number) => pick(inCost(4, 5), 30, s),
  c6: (s: number) => pick(inCost(6, 99), 30, s),
  rand: (s: number) => pick(POOL, 30, s),
};

// ── a runner that can INJECT gold (the only way to test the fix w/o editing) ─
// bonus(round) extra gold handed to EVERY seat at the top of each round, on top
// of the engine's own income. bonus = 0 -> stock engine.
function play(
  seed: number, decks: string[][], dom: boolean, boardSize: number,
  bonus: (r: number) => number,
): { winner: PlayerId | null; by: string; rounds: number } {
  let s = createInitialState(
    seed, decks[0], decks[1], [], undefined, undefined, boardSize,
    undefined, undefined, undefined, undefined,
  );
  if (dom) s.domination = newDomination(DOMINATION_7X7);
  let last = s.round;
  let steps = 0;
  while (s.phase !== "gameover" && steps < 200_000) {
    const next = advance(s);
    steps++;
    if (next === s) break;
    s = next;
    if (s.round !== last) {
      last = s.round;
      const b = bonus(s.round);
      if (b) for (const p of s.seats) s.players[p].gold += b;
    }
  }
  return { winner: s.win?.winner ?? null, by: s.win?.by ?? "none", rounds: s.round };
}

const S = (i: number) => i * 7919 + 13;
function h2h(
  label: string, mk: [(s: number) => string[], (s: number) => string[]],
  n: number, dom: boolean, boardSize: number, bonus: (r: number) => number,
) {
  let aw = 0, bw = 0, none = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const aFirst = i % 2 === 0;
    const A = mk[0](1000 + i), B = mk[1](2000 + i);
    const g = play(S(i), aFirst ? [A, B] : [B, A], dom, boardSize, bonus);
    rounds += g.rounds;
    const aSeat = aFirst ? "P1" : "P2";
    if (g.winner === aSeat) aw++; else if (g.winner) bw++; else none++;
  }
  const pct = (100 * aw) / n;
  const se = Math.sqrt((pct / 100) * (1 - pct / 100) / n) * 100;
  console.log(`${label}: A ${pct.toFixed(1)}% +-${se.toFixed(1)} (a${aw}/b${bw}/none${none}, n=${n}, rounds ${(rounds / n).toFixed(1)})`);
  return pct;
}

const N = Number(process.argv[2] ?? 160);
const none = () => 0;
// The claimant's proposed fix, emulated as a top-up:
//   min(5, ceil(r/2)) - min(5, ceil(r/5))
const fix = (r: number) => Math.min(5, Math.ceil(r / 2)) - Math.min(5, Math.ceil(r / 5));
// "Money is simply not a constraint" — far beyond the proposed fix.
const rich = () => 12;

console.log("--- reproduce (stock economy) ---");
h2h("c45 vs rand  dom7  ", [DECK.c45, DECK.rand], N, true, 7, none);
h2h("c45 vs rand  plain7", [DECK.c45, DECK.rand], N, false, 7, none);
h2h("c1  vs c45   dom7  ", [DECK.c1, DECK.c45], N, true, 7, none);
h2h("c1  vs c45   plain7", [DECK.c1, DECK.c45], N, false, 7, none);

console.log("--- proposed fix: goldBase = min(5, ceil(r/2)) ---");
h2h("c45 vs rand  dom7  ", [DECK.c45, DECK.rand], N, true, 7, fix);
h2h("c1  vs c45   dom7  ", [DECK.c1, DECK.c45], N, true, 7, fix);

console.log("--- gold is a NON-ISSUE (+12/round to everyone) ---");
h2h("c45 vs rand  dom7  ", [DECK.c45, DECK.rand], N, true, 7, rich);
h2h("c1  vs c45   dom7  ", [DECK.c1, DECK.c45], N, true, 7, rich);
h2h("c1  vs c45   plain7", [DECK.c1, DECK.c45], N, false, 7, rich);
