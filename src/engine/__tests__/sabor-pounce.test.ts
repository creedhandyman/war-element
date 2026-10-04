// Crystal Sabor's Sabor Pounce leaps up to 2 squares toward its target before
// it strikes (owner, 2026-10-03).
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { place, prepState } from "./helpers";

function pounce(from: [number, number], at: [number, number]) {
  const s = prepState();
  s.players.P1.magicPool = 6;
  const cat = place(s, "bore_rohojohn", "P1", ...from);
  const foe = place(s, "dusk_gool", "P2", ...at, { curHp: 40, maxHp: 40, curShields: 0 });
  s.phase = "battle"; s.prep = null;
  s.battle = { queue: [cat.instanceId], index: 0, awaitingInput: cat.instanceId };
  const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId });
  return { g, cat: g.cards[cat.instanceId], foe: g.cards[foe.instanceId] };
}
const king = (a: { row: number; col: number }, b: { row: number; col: number }) =>
  Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

describe("Sabor Pounce", () => {
  it("leaps up to two squares toward the target, then strikes it", () => {
    const { cat, foe } = pounce([3, 0], [1, 3]);   // row 1: row 0 is their Home row (Home rule)
    expect(king(cat.pos!, { row: 3, col: 0 })).toBe(2);           // it moved two
    expect(king(cat.pos!, { row: 1, col: 3 })).toBeLessThan(3);   // closer than it started
    expect(foe.curHp).toBeLessThan(40);
    expect(foe.statuses.map((s) => s.kind)).toEqual(expect.arrayContaining(["STUN", "BLEED"]));
  });

  it("goes no further than it needs to: next to the target it strikes without moving", () => {
    const { cat } = pounce([2, 1], [1, 1]);
    expect(cat.pos).toEqual({ row: 2, col: 1 });
  });
});
