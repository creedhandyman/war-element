// TWO THINGS A CARD DECLARED THAT THE ENGINE NEVER READ.
//
//  - Push immunity (Deep Roots, Braced Stance) is checked by every forced move
//    — push, pull, knockback, the trample shove — except Bog Ambush's drag,
//    which moved Old Timer and Sakuroot anyway.
//  - `selfShieldsMax` caps a self-shield stack on the round tick, and three
//    Specials declare one (Timberer's 9 among them), but neither Special-side
//    reader looked at it, so a Special on a cooldown stacked shields forever.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { place, prepState } from "./helpers";

const fire = (s: ReturnType<typeof prepState>, casterId: string, targetIds: string[]) => {
  const sp = getDef(s.cards[casterId].defId).special!;
  SPECIAL_HANDLERS[sp.handler](s, s.cards[casterId], targetIds.map((id) => s.cards[id]), sp.params!);
};

describe("Bog Ambush respects push immunity", () => {
  it("drags an ordinary opponent into its row", () => {
    const s = prepState();
    const bog = place(s, "aqua_magalogoon", "P1", 2, 1);
    const foe = place(s, "leaf_greegon", "P2", 0, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    fire(s, bog.instanceId, [foe.instanceId]);
    expect(s.cards[foe.instanceId].pos!.row).toBe(2);
  });

  it("does not move a card that cannot be moved — and still hits it", () => {
    const s = prepState();
    const bog = place(s, "aqua_magalogoon", "P1", 2, 1);
    const rooted = place(s, "leaf_sakuroot", "P2", 0, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    expect(getDef("leaf_sakuroot").pushImmune).toBe(true);
    fire(s, bog.instanceId, [rooted.instanceId]);
    expect(s.cards[rooted.instanceId].pos).toEqual({ row: 0, col: 1 });
    expect(s.cards[rooted.instanceId].curHp).toBeLessThan(40);
  });
});

describe("a Special's self-shields stop at its declared cap", () => {
  it("Timberer braces +3, but never past 9", () => {
    const s = prepState();
    const jack = place(s, "leaf_lumberjack", "P1", 3, 1, { curShields: 8 });
    const foe = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    fire(s, jack.instanceId, [foe.instanceId]);
    expect(s.cards[jack.instanceId].curShields).toBe(9);
    fire(s, jack.instanceId, [foe.instanceId]);
    expect(s.cards[jack.instanceId].curShields).toBe(9);
  });

  it("...and from nothing it still gains the full +3", () => {
    const s = prepState();
    const jack = place(s, "leaf_lumberjack", "P1", 3, 1, { curShields: 0 });
    const foe = place(s, "leaf_greegon", "P2", 2, 1, { curHp: 90, maxHp: 90, curShields: 0 });
    fire(s, jack.instanceId, [foe.instanceId]);
    expect(s.cards[jack.instanceId].curShields).toBe(3);
  });
});
