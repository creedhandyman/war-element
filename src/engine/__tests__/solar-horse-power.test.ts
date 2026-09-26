import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { place, prepState } from "./helpers";

// Solar Horse Power (Equestrian): opponents it rides PAST in the columns beside
// the charge take 4 (owner's call), on top of the 15 down the column itself.

describe("Solar Horse Power's flank", () => {
  it("hits what it passes on either side, and not what stood beside its start", () => {
    const s = prepState();
    const eq = place(s, "dawn_equestrian", "P1", 3, 1);
    const hp = { curHp: 40, maxHp: 40, curShields: 0 };
    const passedL = place(s, "leaf_greegon", "P2", 2, 0, hp);     // passed, left
    const passedR = place(s, "leaf_greegon", "P2", 1, 2, hp);     // passed, right
    const besideStart = place(s, "leaf_greegon", "P2", 3, 2, hp); // never passed
    const sp = getDef("dawn_equestrian").special!;
    SPECIAL_HANDLERS[sp.handler](s, s.cards[eq.instanceId], [], sp.params!);
    // An open column: it runs to the enemy home row and stops there.
    expect(s.cards[eq.instanceId].pos).toEqual({ row: 0, col: 1 });
    expect(40 - s.cards[passedL.instanceId].curHp).toBe(4);
    expect(40 - s.cards[passedR.instanceId].curHp).toBe(4);
    expect(s.cards[besideStart.instanceId].curHp, "beside the start, not passed").toBe(40);
  });
});
