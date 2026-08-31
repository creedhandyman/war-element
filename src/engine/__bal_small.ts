import { runBatch, shelfFor } from "./__bal_harness";
import { line } from "./__bal_lib";
const S = (i: number) => i * 7919 + 13;
console.log("=== C. 5x5 plain mirrors ===");
for (const dd of shelfFor(5)) line(`5x5 ${dd.id}`, runBatch(1200, (i) => ({ seed: S(i), boardSize: 5, seats: 2, decks: [dd.cards], spells: [dd.spells, dd.spells], trackPoints: false })));
console.log("=== D. 4x4 plain mirrors ===");
for (const dd of shelfFor(4)) line(`4x4 ${dd.id}`, runBatch(1200, (i) => ({ seed: S(i), boardSize: 4, seats: 2, decks: [dd.cards], spells: [dd.spells, dd.spells], trackPoints: false })));
