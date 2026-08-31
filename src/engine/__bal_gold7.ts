// SCRATCH — reconcile: harness runGame vs my hand-rolled runner, same inputs.
import { advance, createInitialState } from "./index";
import { DOMINATION_7X7, newDomination } from "../data/domination";
import { runGame, shelfFor } from "./__bal_harness";

const shelf = shelfFor(7);
const HIGH = shelf.find((d) => d.id === "pre_ember_wake_5")!;
const LOW = shelf.find((d) => d.id === "pre_verdant_tide_5")!;
console.log("HIGH.spells", HIGH.spells, "LOW.spells", LOW.spells);

for (const seed of [13, 7932, 15851]) {
  const g1 = runGame({ seed, boardSize: 7, seats: 2, decks: ["pre_ember_wake_5", "pre_verdant_tide_5"], trackPoints: false });
  const g2 = runGame({ seed, boardSize: 7, seats: 2, decks: [HIGH.cards, LOW.cards], spells: [HIGH.spells, LOW.spells], trackPoints: false });
  let s = createInitialState(seed, HIGH.cards, LOW.cards, [], HIGH.spells, LOW.spells, 7);
  s.domination = newDomination(DOMINATION_7X7);
  let steps = 0;
  while (s.phase !== "gameover" && steps < 200_000) { const n = advance(s); steps++; if (n === s) break; s = n; }
  console.log(seed, "byId", g1.winner, g1.by, g1.rounds, "| byCards", g2.winner, g2.by, g2.rounds, "| hand", s.win?.winner, s.win?.by, s.round);
}
