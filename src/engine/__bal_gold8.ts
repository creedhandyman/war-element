// SCRATCH — prove the harness premade-id deck bug.
import { deckById, DECKS } from "../data/cards";
import { runGame, shelfFor } from "./__bal_harness";

console.log("DECKS ids:", DECKS.map((d) => d.id).join(", "));
const resolved = deckById("pre_inferno_blitz_5");
console.log('deckById("pre_inferno_blitz_5") ->', resolved.id, resolved.name, "cards", resolved.cards.length);
const inferno = shelfFor(7).find((d) => d.id === "pre_inferno_blitz_5")!;
console.log("premade pre_inferno_blitz_5 first 5 cards:", inferno.cards.slice(0, 5).join(","));
console.log("deckById fallback  first 5 cards:", resolved.cards.slice(0, 5).join(","));

// Same seed: "premade by id" vs "leaf_pyro by id", both with inferno's spells.
for (const seed of [13, 7932]) {
  const a = runGame({ seed, boardSize: 7, seats: 2, decks: ["pre_inferno_blitz_5"], spells: [inferno.spells, inferno.spells], trackPoints: false });
  const b = runGame({ seed, boardSize: 7, seats: 2, decks: ["leaf_pyro"], spells: [inferno.spells, inferno.spells], trackPoints: false });
  const c = runGame({ seed, boardSize: 7, seats: 2, decks: [inferno.cards], spells: [inferno.spells, inferno.spells], trackPoints: false });
  console.log(seed, "id:", a.winner, a.by, a.rounds, a.steps, "| leaf_pyro:", b.winner, b.by, b.rounds, b.steps, "| REAL cards:", c.winner, c.by, c.rounds, c.steps);
}
