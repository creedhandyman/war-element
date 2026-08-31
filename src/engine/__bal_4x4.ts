import { runBatch, shelfFor } from "./__bal_harness";
import { line } from "./__bal_lib";
const S = (i: number) => i * 7919 + 13;
const s4 = shelfFor(4);
console.log("4x4 shelf size:", s4.length);
for (const dd of s4.slice(0, 4)) line(`4x4 ${dd.id}`, runBatch(1200, (i) => ({ seed: S(i), boardSize: 4, seats: 2, decks: [dd.cards], spells: [dd.spells, dd.spells], trackPoints: false })));
