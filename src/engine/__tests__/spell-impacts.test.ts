import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { spellHits } from "../../ui/vfx/use-spell-impacts";
import { place, prepState } from "./helpers";

// The effects layer is aimed by a DIFF — a spell became used, and cards lost
// HP in the same transition — because the engine's log is prose and has no
// "spell X hit card Y" event. These pin that the diff finds the square a real
// cast hit, and fires for nothing else.
describe("spell impacts are found by diffing two states", () => {
  const setup = (hp: number) => {
    const s = prepState(1, "P2");
    s.players.P2.magicPool = 5;
    s.players.P2.spellbook = [{ defId: "pyro_spark", used: false }]; // 3 DMG
    const target = place(s, "leaf_greegon", "P1", 1, 2, { curHp: hp, curShields: 0 });
    return { s, target };
  };

  it("a damage spell hits the square it was cast at, in its element", () => {
    const { s, target } = setup(9);
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: target.instanceId });
    expect(after.cards[target.instanceId].curHp).toBe(6); // the cast really landed
    expect(spellHits(s, after)).toEqual([{ row: 1, col: 2, element: "PYRO", strength: expect.any(Number) }]);
  });

  it("a lethal cast still reports the square — the card is gone, not unhit", () => {
    const { s, target } = setup(2);
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P2", spellId: "pyro_spark", targetId: target.instanceId });
    expect(after.cards[target.instanceId]?.pos ?? null).toBeNull();
    expect(spellHits(s, after).map((h) => [h.row, h.col])).toEqual([[1, 2]]);
  });

  it("damage with no spell spent is not a spell hit", () => {
    const { s, target } = setup(9);
    const after = structuredClone(s);
    after.cards[target.instanceId].curHp -= 4; // a basic attack, say
    expect(spellHits(s, after)).toEqual([]);
  });

  it("strength grows with the damage and is clamped", () => {
    const { s, target } = setup(40);
    const small = structuredClone(s); small.players.P2.spellbook[0].used = true;
    small.cards[target.instanceId].curHp -= 1;
    const huge = structuredClone(s); huge.players.P2.spellbook[0].used = true;
    huge.cards[target.instanceId].curHp -= 30;
    expect(spellHits(s, small)[0].strength).toBe(0.7);
    expect(spellHits(s, huge)[0].strength).toBe(2.2);
  });
});
