import { createInitialState } from "./index";
import { shelfFor } from "./__bal_harness";
const s7 = shelfFor(7);
const d = s7[0];
for (const seed of [13, 7932, 15851, 999983]) {
  const st = createInitialState(seed, d.cards, d.cards, [], d.spells, d.spells, 7, undefined, undefined, undefined,
    [{ id: "P3" as any, deck: d.cards, spells: d.spells }, { id: "P4" as any, deck: d.cards, spells: d.spells }]);
  for (const p of ["P1", "P2", "P3", "P4"] as const)
    console.log(seed, p, (st.players as any)[p].hand.map((h: any) => h.defId).join(","));
  console.log("  first10 of P3 deck:", (st.players as any).P3.deck.slice(0, 10).join(","));
  console.log("");
}
console.log("premade list order first 15:", d.cards.slice(0, 15).join(","));
