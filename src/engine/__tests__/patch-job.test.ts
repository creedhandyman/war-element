import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { place, prepState } from "./helpers";

// Patch Job (Handyman's Talent) plates every ally in RANGE (owner's call), not
// just the 8 squares around it. Range is Handyman's own attack reach: 2 king-
// steps for a Ranged card on its home row.

describe("Patch Job", () => {
  it("plates allies out to its reach, itself included, and no further", () => {
    const s = prepState();
    const hm = place(s, "bolt_handyman", "P1", 3, 1, { curShields: 0 });
    const two = place(s, "leaf_greegon", "P1", 1, 1, { curShields: 0 });   // 2 away
    const three = place(s, "leaf_greegon", "P1", 0, 1, { curShields: 0 }); // 3 away
    const t = getDef("bolt_handyman").talent!;
    SPECIAL_HANDLERS[t.handler](s, s.cards[hm.instanceId], [], t.params!);
    expect(s.cards[hm.instanceId].curShields, "itself").toBe(2);
    expect(s.cards[two.instanceId].curShields, "two squares off: in range").toBe(2);
    expect(s.cards[three.instanceId].curShields, "three: out of range").toBe(0);
  });
});
