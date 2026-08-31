// Does the 2-seat P2 edge come from the AI's seat-INDEX-derived Domination role?
// ai.ts:601  const seat = seatsOf(state).indexOf(player)
// ai.ts:603  const anchor = m.shrines[seat % 4]         <- different primary Point per seat
// ai.ts:634  const holder = seat % 2 === 1              <- P1 EXPANDER, P2 HOLDER
// seatsOf() just reads state.seats, so reversing that array swaps the two roles
// WITHOUT editing any engine source. Turn order also reverses (worth ~6 pts,
// and symmetric), the role swap is the big term.
import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { shelfFor } from "./__bal_harness";
import { wilson } from "./__bal_lib";
const S = (i: number) => i * 7919 + 13;
const pct = (k: number, n: number) => { const [lo, hi] = wilson(k, n); return `${(100*k/n).toFixed(1)}% [${lo.toFixed(1)}-${hi.toFixed(1)}]`; };
const N = Number(process.env.N ?? 800);

for (const deck of [shelfFor(7)[0], shelfFor(7)[3]]) {
  for (const swap of [false, true]) {
    let w1 = 0, n = 0, dom = 0;
    for (let i = 0; i < N; i++) {
      let s = createInitialState(S(i), deck.cards, deck.cards, [], deck.spells, deck.spells, 7);
      s.domination = newDomination(DOMINATION_7X7);
      if (swap) s.seats = ["P2", "P1"];
      let steps = 0;
      while (s.phase !== "gameover" && steps < 200000) { const nx = advance(s); steps++; if (nx === s) break; s = nx; }
      if (s.win?.winner === "P1") w1++; if (s.win?.by === "domination") dom++; n++;
    }
    console.log(`${deck.id.padEnd(22)} seats=${swap ? '["P2","P1"] (roles SWAPPED)' : '["P1","P2"] (as shipped)  '}  P1 ${pct(w1, n)}  n=${n}  domination-endings ${dom}`);
  }
}
