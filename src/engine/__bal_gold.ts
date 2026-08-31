// SCRATCH — REDO of A and B using explicit CARD LISTS.
// The harness's `decks: ["<premade id>"]` path is BROKEN: state.ts resolveDeck
// -> cards.ts deckById, which only knows the four element pairings and falls
// back to DECKS[0] (leaf_pyro) for any unknown id. So a premade id silently
// plays leaf_pyro. Only `d.cards` is real.
import { getDef } from "../data/cards";
import { runGame, shelfFor, engineCanary } from "./__bal_harness";
import type { RunGameOpts } from "./__bal_harness";

console.log("CANARY:", engineCanary());
const S = (i: number) => i * 7919 + 13;
const shelf = shelfFor(7);
const HIGH = shelf.find((d) => d.id === "pre_ember_wake_5")!;   // mean 4.47, 67% cost>=4
const LOW = shelf.find((d) => d.id === "pre_verdant_tide_5")!;  // mean 2.43, 23% cost>=4

function h2h(label: string, n: number, extra: Partial<RunGameOpts>) {
  let hw = 0, other = 0, rounds = 0;
  for (let i = 0; i < n; i++) {
    const hFirst = i % 2 === 0;
    const g = runGame({
      seed: S(i), boardSize: 7, seats: 2, trackPoints: false,
      decks: hFirst ? [HIGH.cards, LOW.cards] : [LOW.cards, HIGH.cards],
      spells: hFirst ? [HIGH.spells, LOW.spells] : [LOW.spells, HIGH.spells],
      ...extra,
    } as RunGameOpts);
    rounds += g.rounds;
    if (g.winner === (hFirst ? "P1" : "P2")) hw++;
    else if (!g.winner) other++;
  }
  const pct = (100 * hw) / n;
  console.log(`A ${label} ember_wake(4.47) vs verdant_tide(2.43): HIGH ${pct.toFixed(1)}% +-${(Math.sqrt(pct / 100 * (1 - pct / 100) / n) * 100).toFixed(1)} (n=${n}, no-winner ${other}, rounds ${(rounds / n).toFixed(1)})`);
}
h2h("dom7  ", 200, {});
h2h("plain7", 120, { mode: "plain" });
h2h("plain5", 200, { boardSize: 5 });

// B. deployment by cost, HIGH mirror, real card lists
function deployHist(label: string, extra: Partial<RunGameOpts>, n: number) {
  const hist: Record<number, number> = {};
  let rounds = 0, total = 0;
  for (let i = 0; i < n; i++) {
    const g = runGame({
      seed: S(i), boardSize: 7, seats: 2, trackPoints: false, keepState: true,
      decks: [HIGH.cards, HIGH.cards], spells: [HIGH.spells, HIGH.spells], ...extra,
    } as RunGameOpts);
    rounds += g.rounds;
    for (const line of g.state!.log) {
      const m = /^P[1-4] summons .*\(cost (\d+)\)/.exec(line);
      if (m) { hist[Number(m[1])] = (hist[Number(m[1])] ?? 0) + 1; total++; }
    }
  }
  const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
  const ge4 = keys.filter((k) => k >= 4).reduce((a, k) => a + hist[k], 0);
  console.log(`B ${label} ember_wake MIRROR: ${(total / n).toFixed(1)} summons/game over ${(rounds / n).toFixed(1)} rounds; cost>=4 = ${((100 * ge4) / total).toFixed(1)}% of summons (deck is 67%)`,
    JSON.stringify(Object.fromEntries(keys.map((k) => [k, +(hist[k] / n).toFixed(2)]))));
}
deployHist("dom7  ", {}, 120);
deployHist("plain7", { mode: "plain" }, 80);
