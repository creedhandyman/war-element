// DISPOSABLE — delete before committing.
//
// ABLATION WITH A CONTROL GROUP, per CLAUDE.md: cutting a card and re-measuring
// its element is causal, but a smaller deck draws its best cards more often, so
// EVERY removal looks like an improvement (~-3 baseline drift). Only the SPREAD
// against same-element peers means anything.
//
// Scoped to the three elements the core run actually moved:
//   BOLT 57.9 -> 59.4 (now the leader; Havoc is the suspect)
//   LEAF 47.3 -> 50.1 (the only move clearly outside +/-2.6)
//   AQUA 44.1 -> 42.5 (the new floor; two AQUA cards got more expensive)
import { describe, expect, it } from "vitest";
import { CORES } from "../../data/cards";
import { createInitialState } from "../state";
import { advance } from "../phases";

/** Win% for `coreId` against the whole field, with `drop` removed. */
function winPct(coreId: string, drop: string | null, seeds: number): { pct: number; n: number } {
  const me = CORES.find((c) => c.id === coreId)!;
  const cards = drop ? me.cards.filter((id) => id !== drop) : me.cards;
  if (drop && cards.length === me.cards.length) throw new Error(`${drop} not in ${coreId}`);
  let w = 0, n = 0;
  for (const foe of CORES) {
    if (foe.id === coreId) continue;
    for (const board of [4, 5]) for (let k = 0; k < seeds; k++) {
      // Both seat orders, so a seat advantage cannot masquerade as a card one.
      for (const asP1 of [true, false]) {
        const [a, b] = asP1 ? [cards, foe.cards] : [foe.cards, cards];
        let s = createInitialState(k * 31 + 7, a, b, [], undefined, undefined, board);
        let st = 0;
        while (s.phase !== "gameover" && st < 8000) { s = advance(s); st++; }
        n++;
        if (s.win?.winner === (asP1 ? "P1" : "P2")) w++;
      }
    }
  }
  return { pct: (w / n) * 100, n };
}

describe("ablation", () => {
  it("suspects against same-element peers", () => {
    const SEEDS = 14;
    const GROUPS: [string, string, string[]][] = [
      ["bolt", "bolt_havoc", ["bolt_surge", "bolt_kore", "bolt_zagphu"]],
      ["leaf", "leaf_snapmaw", ["leaf_stickviper", "leaf_gecko", "leaf_elderroot"]],
      ["aqua", "aqua_killerwhale", ["aqua_glacius", "aqua_siren", "aqua_rain"]],
    ];
    console.log("\n=== ABLATION (delta vs that element's own baseline) ===");
    for (const [core, suspect, peers] of GROUPS) {
      const base = winPct(core, null, SEEDS);
      console.log(`\n${core.toUpperCase()} baseline ${base.pct.toFixed(1)} (n=${base.n} per cut)`);
      for (const id of [suspect, ...peers]) {
        const cut = winPct(core, id, SEEDS);
        const d = cut.pct - base.pct;
        console.log(`  ${id === suspect ? "*" : " "}${id.padEnd(22)} ${d >= 0 ? "+" : ""}${d.toFixed(1)}`);
      }
    }
    console.log("\n* = the suspect. A card CARRYING its element drops it further when cut;");
    console.log("  peers set the draw-density baseline. ~+/-5 at 95% on n=392 — a 3-point");
    console.log("  gap is noise, so read the ORDER and the size of the gap, not the digits.");
    expect(GROUPS.length).toBe(3);
  }, 1_800_000);
});
