import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination, heldCount } from "../data/domination";
import { shelfFor } from "./__bal_harness";
import { wilson } from "./__bal_lib";
import type { PlayerId } from "./types";

const S = (i: number) => i * 7919 + 13;
const d = shelfFor(7)[0];
function mul(a: number): number { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const coinFirst = (seed: number): PlayerId => (mul((seed + 59) | 0) < 0.5 ? "P1" : "P2");
const pct = (k: number, n: number) => { const [lo, hi] = wilson(k, n); return `${(100*k/n).toFixed(1)}% [${lo.toFixed(1)}-${hi.toFixed(1)}] (n=${n})`; };

const N = Number(process.env.N ?? 1200);
type Row = { winner: PlayerId | null; by: string; rounds: number; pts: Record<string, number[]>; lastAct: Record<number, PlayerId>; first1: PlayerId };
const rows: Row[] = [];

for (let i = 0; i < N; i++) {
  const seed = S(i);
  let s = createInitialState(seed, d.cards, d.cards, [], d.spells, d.spells, 7);
  s.domination = newDomination(DOMINATION_7X7);
  const pts: Record<string, number[]> = { P1: [], P2: [] };
  const lastAct: Record<number, PlayerId> = {};
  let first1: PlayerId | null = null;
  let lastRound = s.round, steps = 0;
  while (s.phase !== "gameover" && steps < 200000) {
    if (s.phase === "prep" && s.prep && s.round >= 1) {
      lastAct[s.round] = s.prep.priority as PlayerId;
      if (s.round === 1 && !first1) first1 = s.prep.priority as PlayerId;
    }
    const next = advance(s); steps++;
    if (next === s) break;
    if (next.round !== lastRound) {
      if (lastRound >= 1 && next.domination)
        for (const p of ["P1", "P2"] as PlayerId[]) pts[p].push(heldCount(next.domination.held as never, p));
      lastRound = next.round;
    }
    s = next;
  }
  if (s.domination && s.round >= 1) for (const p of ["P1", "P2"] as PlayerId[]) pts[p].push(heldCount(s.domination.held as never, p));
  rows.push({ winner: s.win?.winner ?? null, by: s.win?.by ?? "stalled", rounds: s.round, pts, lastAct, first1: first1 ?? coinFirst(seed) });
}

console.log(`=== 2-seat 7x7 DOM, mirror ${d.id}, n=${rows.length} ===`);
const w1 = rows.filter(r => r.winner === "P1").length;
console.log(`P1 overall ${pct(w1, rows.length)}`);

// coin flip / round-1 first mover
for (const f of ["P1", "P2"] as PlayerId[]) {
  const sub = rows.filter(r => r.first1 === f);
  console.log(`round-1 first mover = ${f}: that seat wins ${pct(sub.filter(r => r.winner === f).length, sub.length)}`);
}
// agreement of analytic coin model with observed round-1 priority
console.log("coin model vs observed round-1 priority agree:", rows.filter(r => coinFirst(S(rows.indexOf(r))) === r.first1).length, "/", rows.length);

// who acted LAST in the final round
{ let k = 0, n = 0;
  for (const r of rows) { const la = r.lastAct[r.rounds]; if (!la || !r.winner) continue; n++; if (la === r.winner) k++; }
  console.log(`the seat holding prep priority LAST in the deciding round wins: ${pct(k, n)}`); }

// leader at round 3
const at = (r: Row, p: PlayerId, k: number) => r.pts[p][k - 1] ?? 0;
for (const R of [2, 3, 4]) {
  const eligible = rows.filter(r => r.pts.P1.length >= R && r.winner);
  let leadWins = 0, leadN = 0, behindWins = 0, behindN = 0, tieN = 0;
  for (const r of eligible) {
    const a = at(r, "P1", R), b = at(r, "P2", R);
    if (a === b) { tieN++; continue; }
    const leader: PlayerId = a > b ? "P1" : "P2";
    leadN++; if (r.winner === leader) leadWins++;
    behindN++; if (r.winner !== leader) behindWins++;
  }
  console.log(`round ${R}: leader-on-Points wins ${pct(leadWins, leadN)} | the seat BEHIND wins ${pct(behindWins, behindN)} | tied at round ${R}: ${tieN} games (${(100*tieN/eligible.length).toFixed(1)}%)`);
}
// round histogram
const h: Record<number, number> = {};
for (const r of rows) h[r.rounds] = (h[r.rounds] ?? 0) + 1;
console.log("rounds histogram:", Object.keys(h).map(Number).sort((a,b)=>a-b).map(k => `${k}:${h[k]}`).join(" "));
// winner by parity of final round
{ const odd = rows.filter(r => r.rounds % 2 === 1), ev = rows.filter(r => r.rounds % 2 === 0);
  console.log(`games ending on an ODD round: ${odd.length}, P1 wins ${pct(odd.filter(r=>r.winner==="P1").length, odd.length)}`);
  console.log(`games ending on an EVEN round: ${ev.length}, P1 wins ${pct(ev.filter(r=>r.winner==="P1").length, ev.length)}`); }
