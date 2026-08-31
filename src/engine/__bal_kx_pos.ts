// [kx] Where do a card's bodies actually STAND on the 7x7? Scratch — delete.
import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination, poiRing, isShrine } from "../data/domination";
import { shelfFor } from "./__bal_harness";
const arg = (k: string, d: string) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=").slice(1).join("=") : d; };
const CARDS_ARG = arg("cards", "bolt_rodd").split(",");
const N = Number(arg("n", "120"));
const COPIES = Number(arg("copies", "6"));
const shelf = shelfFor(7);
const BASES = ["pre_inferno_blitz_5","pre_frostkeep_5","pre_radiant_host_5","pre_nightfall_5"].map((id) => shelf.find((d) => d.id === id)!);
const M = DOMINATION_7X7;
const ringKey = new Set<string>();
for (const p of M.pois) for (const s of poiRing(p)) ringKey.add(`${s.row},${s.col}`);
for (const CARD of CARDS_ARG) {
  let onRing = 0, offRing = 0, onShrine = 0, samples = 0, games = 0;
  let baseOnRing = 0, baseOff = 0;   // the SAME seat's other (baseline) bodies
  for (let i = 0; i < N; i++) {
    const base = BASES[i % BASES.length];
    const deck = [...Array(COPIES).fill(CARD), ...base.cards.slice(COPIES)];
    let s = createInitialState(i * 7919 + 13, deck, base.cards, [], base.spells, base.spells, 7);
    s.domination = newDomination(M);
    let steps = 0, lastRound = s.round;
    while (s.phase !== "gameover" && steps < 20000) {
      const nx = advance(s); steps++;
      if (nx === s) break;
      s = nx;
      if (s.round !== lastRound) {            // sample once per round boundary
        lastRound = s.round; samples++;
        for (const c of Object.values(s.cards) as any[]) {
          if (c.owner !== "P1" || !c.pos || c.curHp <= 0) continue;
          const onR = ringKey.has(`${c.pos.row},${c.pos.col}`);
          if (c.defId === CARD) { if (onR) onRing++; else { offRing++; if (isShrine(M, c.pos.row, c.pos.col)) onShrine++; } }
          else { if (onR) baseOnRing++; else baseOff++; }
        }
      }
    }
    games++;
  }
  const tot = onRing + offRing, btot = baseOnRing + baseOff;
  console.log(`${CARD}\tgames=${games}\tbody-rounds=${tot}\tON a Point ring: ${(100*onRing/Math.max(1,tot)).toFixed(1)}%`
    + `\t(stuck on a shrine ${(100*onShrine/Math.max(1,tot)).toFixed(1)}%)`
    + `\t| same seat's OTHER bodies on a ring: ${(100*baseOnRing/Math.max(1,btot)).toFixed(1)}% of ${btot}`);
}
