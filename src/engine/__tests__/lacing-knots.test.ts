import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { place, prepState } from "./helpers";

// Lacing Knots (Tether): 9 DMG with PEN to every opponent its Magic Ropes are
// holding (owner's call; was 8, no PEN). The handler used to hard-code
// `pen: false`, so a PEN param on the card would have done nothing.

describe("Lacing Knots", () => {
  it("cuts straight through shields on a bound opponent", () => {
    const s = prepState();
    const tether = place(s, "dawn_ty", "P1", 3, 1);
    const bound = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 5 }); // not DUSK: DAWN hits DUSK 25% harder
    s.cards[bound.instanceId].specialLockedRounds = 1;
    SPECIAL_HANDLERS.lacingKnots(s, s.cards[tether.instanceId], [], getDef("dawn_ty").special!.params!);
    expect(40 - s.cards[bound.instanceId].curHp, "9, none of it stopped").toBe(9);
    expect(s.cards[bound.instanceId].curShields, "and no shield stripped").toBe(5);
  });

  it("leaves an opponent the ropes are not holding alone", () => {
    const s = prepState();
    const tether = place(s, "dawn_ty", "P1", 3, 1);
    const free = place(s, "pyro_flamehound", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.lacingKnots(s, s.cards[tether.instanceId], [], getDef("dawn_ty").special!.params!);
    expect(s.cards[free.instanceId].curHp).toBe(40);
  });
});
