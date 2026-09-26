import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { canFireSpecial } from "../rules";
import { place, prepState } from "./helpers";

// Razor Guard (Dandelion) can be cast with nobody in range, for the step alone
// (owner's call). Dandelion is SP 0: the Special's step is the only way it ever
// advances, and a Special that needed a target left it stuck where it landed.

const DANDE = "leaf_dande";
const params = () => getDef(DANDE).special!.params!;

describe("Razor Guard with nobody in range", () => {
  it("can be cast, and steps forward", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const me = place(s, DANDE, "P1", 3, 1);
    place(s, "pyro_flamehound", "P2", 0, 3); // far off, out of reach
    expect(canFireSpecial(s, me.instanceId).ok).toBe(true);
    SPECIAL_HANDLERS.barrage(s, s.cards[me.instanceId], [], params());
    expect(s.cards[me.instanceId].pos).toEqual({ row: 2, col: 1 });
  });

  it("rakes whatever the step brings into range", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const me = place(s, DANDE, "P1", 3, 1);
    const foe = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    expect(canFireSpecial(s, me.instanceId).ok, "two rows off: nobody in range yet").toBe(true);
    SPECIAL_HANDLERS.barrage(s, s.cards[me.instanceId], [], params());
    expect(30 - s.cards[foe.instanceId].curHp, "3 once it stepped up to it").toBe(3);
  });

  it("is refused when the square ahead is taken", () => {
    const s = prepState();
    s.players.P1.magicPool = 9;
    const me = place(s, DANDE, "P1", 3, 1);
    place(s, "leaf_greegon", "P1", 2, 1); // its own card, in the way
    expect(canFireSpecial(s, me.instanceId).ok).toBe(false);
  });
});

describe("Mega Icicle (Cryo)", () => {
  function hit(frozen: boolean) {
    const s = prepState();
    const cryo = place(s, "aqua_cryo", "P1", 3, 1);
    const foe = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 30, maxHp: 30, curShields: 0 });
    if (frozen) s.cards[foe.instanceId].statuses.push({ kind: "FREEZE", duration: 2, power: 0 } as never);
    SPECIAL_HANDLERS.areaBlast(s, s.cards[cryo.instanceId], [s.cards[foe.instanceId]], getDef("aqua_cryo").special!.params!);
    return 30 - s.cards[foe.instanceId].curHp;
  }

  it("hits a FROZEN target for double (owner's call)", () => {
    expect(hit(false)).toBe(5);
    expect(hit(true)).toBe(10);
  });
});
