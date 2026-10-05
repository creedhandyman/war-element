// Growrilla's Canopy Crash swings up to 2 squares toward its targets before
// the canopy comes down, for 5 DMG (owner, 2026-10-04).
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { applyIntent } from "../phases";
import { place, prepState } from "./helpers";

function crash(from: [number, number], at: [number, number]) {
  const s = prepState();
  s.players.P1.magicPool = 6;
  const ape = place(s, "leaf_gorilla", "P1", ...from);
  const foe = place(s, "dusk_gool", "P2", ...at, { curHp: 40, maxHp: 40, curShields: 0 });
  s.phase = "battle"; s.prep = null;
  s.battle = { queue: [ape.instanceId], index: 0, awaitingInput: ape.instanceId };
  const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId });
  return { g, ape: g.cards[ape.instanceId], foe: g.cards[foe.instanceId] };
}
const king = (a: { row: number; col: number }, b: { row: number; col: number }) =>
  Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

describe("Canopy Crash", () => {
  it("is 5 DMG now", () => {
    expect(getDef("leaf_gorilla").special!.params!.dmg).toBe(5);
  });

  it("swings up to two squares toward its target, sideways too, then lands the canopy", () => {
    const { ape, foe } = crash([3, 0], [1, 3]);   // row 1: row 0 is their Home row (Home rule)
    expect(king(ape.pos!, { row: 3, col: 0 })).toBe(2);           // it moved two
    expect(king(ape.pos!, { row: 1, col: 3 })).toBeLessThan(3);   // closer than it started
    expect(foe.curHp).toBe(35);
    expect(foe.statuses.map((s) => s.kind)).toContain("ROOT");
  });

  it("already beside its target, it stays put", () => {
    const { ape } = crash([2, 1], [1, 1]);
    expect(ape.pos).toEqual({ row: 2, col: 1 });
  });
});
