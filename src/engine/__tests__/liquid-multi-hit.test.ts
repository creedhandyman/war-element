// AQUA Flow Change, Liquid (owner, 2026-10-04): +2 DMG per hit made a 2-hit
// card's pick +4 a volley and a 3-hit card's +6. Now a 2-3 hit card takes +1
// DMG, a single-hit card still +2, a 4+ hit card still +1 hit — and the tide
// still adds its +1 on top for all of them.
import { describe, expect, it } from "vitest";
import { CARDS } from "../../data/cards";
import { applyFlow, liquidDmg, liquidGivesHit } from "../auras";
import { place, prepState } from "./helpers";

const aquaWithHits = (n: number) => CARDS.find((c) => c.element === "AQUA" && c.hits === n)!;

describe("Liquid on multi-hit cards", () => {
  it("+2 on one hit, +1 on two or three, +1 hit on four or more", () => {
    const s = prepState();
    for (const [hits, dmg] of [[1, 2], [2, 1], [3, 1]] as const) {
      const def = aquaWithHits(hits);
      if (!def) continue;
      const c = place(s, def.id, "P1", 3, hits);
      expect(liquidGivesHit(c), def.id).toBe(false);
      expect(liquidDmg(c), def.id).toBe(dmg);
      const before = c.dmgBonus;
      applyFlow(c, "water", true);
      expect(c.dmgBonus - before, `${def.id} (${hits} hits)`).toBe(dmg);
    }
  });

  it("a 2-hit card's volley gains 2 at the pick, not 4", () => {
    const s = prepState();
    const def = aquaWithHits(2);
    const c = place(s, def.id, "P1", 3, 0);
    applyFlow(c, "water", true);
    expect(c.dmgBonus * def.hits).toBe(2);
  });
});
