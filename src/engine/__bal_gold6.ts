// SCRATCH — would the proposed fix help REAL decks, and what does it do to the
// mode's clock? Emulates goldBase = min(5, ceil(r/2)) via a per-round top-up.
import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { shelfFor } from "./__bal_harness";
import type { PlayerId } from "./types";

const shelf = shelfFor(7);
const HIGH = shelf.find((d) => d.id === "pre_ember_wake_5")!;
const LOW = shelf.find((d) => d.id === "pre_verdant_tide_5")!;
const S = (i: number) => i * 7919 + 13;

function play(seed: number, a: typeof HIGH, b: typeof HIGH, bonus: (r: number) => number) {
  let s = createInitialState(seed, a.cards, b.cards, [], a.spells, b.spells, 7);
  s.domination = newDomination(DOMINATION_7X7);
  let last = s.round, steps = 0;
  while (s.phase !== "gameover" && steps < 200_000) {
    const next = advance(s); steps++;
    if (next === s) break;
    s = next;
    if (s.round !== last) {
      last = s.round;
      const bo = bonus(s.round);
      if (bo) for (const p of s.seats) s.players[p].gold += bo;
    }
  }
  return { winner: (s.win?.winner ?? null) as PlayerId | null, by: s.win?.by ?? "none", rounds: s.round };
}

function run(label: string, bonus: (r: number) => number, n: number) {
  let hw = 0, rounds = 0, dom = 0;
  for (let i = 0; i < n; i++) {
    const hFirst = i % 2 === 0;
    const g = play(S(i), hFirst ? HIGH : LOW, hFirst ? LOW : HIGH, bonus);
    rounds += g.rounds;
    if (g.by === "domination") dom++;
    if (g.winner === (hFirst ? "P1" : "P2")) hw++;
  }
  const pct = (100 * hw) / n;
  console.log(`${label}: HIGH(ember_wake, mean cost 4.47) ${pct.toFixed(1)}% +-${(Math.sqrt(pct / 100 * (1 - pct / 100) / n) * 100).toFixed(1)}  rounds ${(rounds / n).toFixed(1)}  dom endings ${dom}/${n}`);
}

const N = Number(process.argv[2] ?? 200);
run("stock       ", () => 0, N);
run("proposed fix", (r) => Math.min(5, Math.ceil(r / 2)) - Math.min(5, Math.ceil(r / 5)), N);
run("+12/round   ", () => 12, N);
