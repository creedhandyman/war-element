import { runBatch, shelfFor } from "./__bal_harness";
import { line } from "./__bal_lib";
const S = (i: number) => i * 7919 + 13;
const s7 = shelfFor(7);
const d = s7[0];

// deterministic per-(game,seat) permutation so EVERY seat gets a randomized
// deck order — the engine only shuffles P1/P2 (state.ts:129-130).
function mul32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function perm(cards: string[], seed: number) { const r = mul32(seed), a = [...cards];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const N4 = Number(process.env.N4 ?? 400), N3 = Number(process.env.N3 ?? 500);

console.log("=== E. 4-seat 7x7 DOM, mirror pre_inferno_blitz_5, AS SHIPPED ===");
const e4 = runBatch(N4, (i) => ({ seed: S(i), boardSize: 7, seats: 4, decks: [d.cards], spells: [d.spells, d.spells, d.spells, d.spells], trackPoints: false }));
line("4seat asShipped", e4, 4);
{ const dom = e4.filter((g) => g.by === "domination"), el = e4.filter((g) => g.by === "elimination");
  line("  4seat by=domination", dom, 4); line("  4seat by=elimination", el, 4); }

console.log("=== F. 4-seat, SAME but every seat's deck pre-shuffled by me ===");
const f4 = runBatch(N4, (i) => ({ seed: S(i), boardSize: 7, seats: 4, trackPoints: false,
  decks: [0,1,2,3].map((k) => perm(d.cards, S(i) * 4 + k)), spells: [d.spells, d.spells, d.spells, d.spells] }));
line("4seat preShuffled", f4, 4);
{ const dom = f4.filter((g) => g.by === "domination"), el = f4.filter((g) => g.by === "elimination");
  line("  4seat by=domination", dom, 4); line("  4seat by=elimination", el, 4); }

console.log("=== G. 3-seat 7x7 DOM, mirror ===");
const g3 = runBatch(N3, (i) => ({ seed: S(i), boardSize: 7, seats: 3, decks: [d.cards], spells: [d.spells, d.spells, d.spells], trackPoints: false }));
line("3seat asShipped", g3, 3);
const h3 = runBatch(N3, (i) => ({ seed: S(i), boardSize: 7, seats: 3, trackPoints: false,
  decks: [0,1,2].map((k) => perm(d.cards, S(i) * 4 + k)), spells: [d.spells, d.spells, d.spells] }));
line("3seat preShuffled", h3, 3);
