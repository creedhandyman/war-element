import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { shelfFor } from "./__bal_harness";
import { wilson } from "./__bal_lib";
import type { GameState, PlayerId } from "./types";

const S = (i: number) => i * 7919 + 13;
const d = shelfFor(7)[0];

interface Opt { seed: number; seats: number; pinFirst?: PlayerId; dom?: boolean; boardSize?: number }

function play(o: Opt) {
  const seats = (["P1", "P2", "P3", "P4"] as PlayerId[]).slice(0, o.seats);
  const bs = o.boardSize ?? 7;
  const extra = seats.slice(2).map((id) => ({ id, deck: d.cards, spells: d.spells }));
  let s = createInitialState(o.seed, d.cards, d.cards, [], d.spells, d.spells, bs,
    undefined, undefined, undefined, extra.length ? extra : undefined);
  if (o.dom !== false && bs === 7) s.domination = newDomination(DOMINATION_7X7);

  const order = seats;
  const firstOf: Record<number, PlayerId> = {};   // round -> who held prep priority first
  const lastOf: Record<number, PlayerId> = {};    // round -> who held prep priority last
  let steps = 0;
  const pin = (g: GameState) => {
    if (!o.pinFirst) return;
    // startRound computes order[(idx(firstPlayer) + round-1) % n] for the round it
    // is about to start (round already ++'d). Set firstPlayer so that lands on the pin.
    const t = order.indexOf(o.pinFirst);
    const idx = ((t - g.round) % order.length + order.length) % order.length;
    g.firstPlayer = order[idx];
  };
  pin(s);
  while (s.phase !== "gameover" && steps < 200000) {
    if (s.phase === "prep" && s.prep && s.round >= 1) {
      const p = s.prep.priority as PlayerId;
      if (firstOf[s.round] === undefined) firstOf[s.round] = p;
      lastOf[s.round] = p;
    }
    const next = advance(s);
    steps++;
    if (next === s) break;
    pin(next);
    s = next;
  }
  return { winner: (s.win?.winner ?? null) as PlayerId | null, by: s.win?.by ?? "stalled",
    rounds: s.round, firstOf, lastOf, seats };
}

function pct(k: number, n: number) { const [lo, hi] = wilson(k, n); return `${(100*k/n).toFixed(1)}% [${lo.toFixed(1)}-${hi.toFixed(1)}]`; }

// ---- 1. does prep initiative rotate fairly? ----
for (const seats of [2, 3, 4]) {
  const n = seats === 2 ? 400 : seats === 3 ? 200 : 120;
  const firstCount: Record<string, number> = {}, lastCount: Record<string, number> = {};
  const firstByRound: Record<number, Record<string, number>> = {};
  let totRounds = 0;
  for (let i = 0; i < n; i++) {
    const g = play({ seed: S(i), seats });
    for (const r of Object.keys(g.firstOf).map(Number)) {
      firstCount[g.firstOf[r]] = (firstCount[g.firstOf[r]] ?? 0) + 1;
      lastCount[g.lastOf[r]] = (lastCount[g.lastOf[r]] ?? 0) + 1;
      (firstByRound[r] ??= {})[g.firstOf[r]] = ((firstByRound[r] ??= {})[g.firstOf[r]] ?? 0) + 1;
      totRounds++;
    }
  }
  console.log(`INITIATIVE seats=${seats} games=${n} rounds=${totRounds}`);
  console.log("  first-mover share:", Object.entries(firstCount).sort().map(([k, v]) => `${k} ${(100*v/totRounds).toFixed(1)}%`).join("  "));
  console.log("  last-to-act share:", Object.entries(lastCount).sort().map(([k, v]) => `${k} ${(100*v/totRounds).toFixed(1)}%`).join("  "));
  for (const r of [1,2,3,4,5]) if (firstByRound[r]) {
    const tot = Object.values(firstByRound[r]).reduce((a,b)=>a+b,0);
    console.log(`   round ${r} first-mover:`, Object.entries(firstByRound[r]).sort().map(([k,v])=>`${k} ${(100*v/tot).toFixed(1)}%`).join("  "));
  }
}

// ---- 2. pinned first-mover: is acting FIRST or LAST better on the 7x7? ----
const NP = Number(process.env.NP ?? 1000);
for (const pinFirst of ["P1", "P2"] as PlayerId[]) {
  let w1 = 0, w2 = 0, n = 0;
  for (let i = 0; i < NP; i++) { const g = play({ seed: S(i), seats: 2, pinFirst });
    if (g.winner === "P1") w1++; else if (g.winner === "P2") w2++; n++; }
  console.log(`PINNED first=${pinFirst}  n=${n}  P1 ${pct(w1,n)}  P2 ${pct(w2,n)}   (the OTHER seat always acts last)`);
}
