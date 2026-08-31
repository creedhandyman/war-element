import { runBatch, flatDeck } from "./__bal_harness";
import { line } from "./__bal_lib";
const S = (i: number) => i * 7919 + 13;
const cards = ["leaf_weeds", "pyro_flamehound", "bolt_zap", "aqua_bubbles", "dusk_imp"];
console.log("=== H. 2-seat 7x7 DOM, FLAT single-card mirror, NO spells (pure bodies) ===");
for (const c of cards) {
  try { line(`DOM flat ${c}`, runBatch(600, (i) => ({ seed: S(i), boardSize: 7, seats: 2, decks: [flatDeck(c, 30)], spells: [[], []], trackPoints: false }))); }
  catch (e) { console.log(c, "ERR", (e as Error).message); }
}
console.log("=== I. same flat mirrors, spells ON (engine-derived book) ===");
for (const c of cards) {
  try { line(`DOM flat+spells ${c}`, runBatch(600, (i) => ({ seed: S(i), boardSize: 7, seats: 2, decks: [flatDeck(c, 30)], trackPoints: false }))); }
  catch (e) { console.log(c, "ERR", (e as Error).message); }
}
console.log("=== J. flat mirror on the SAME board, objective OFF ===");
for (const c of cards) {
  try { line(`PLAIN7 flat ${c}`, runBatch(400, (i) => ({ seed: S(i), boardSize: 7, mode: "plain", seats: 2, decks: [flatDeck(c, 30)], spells: [[], []], trackPoints: false }))); }
  catch (e) { console.log(c, "ERR", (e as Error).message); }
}
