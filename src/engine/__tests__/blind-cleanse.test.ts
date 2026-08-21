// BLIND, and the three things in DAWN that are supposed to take it off again.
//
// Written after a report that DAWN's cost-10 play "wasn't working right — they
// still missed, I think they can be blinded still". None of these three turned
// out to be broken, and that is exactly why they are pinned now: the next time
// that report arrives, this file is what rules them out in a second rather than
// an afternoon.
import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { atCleanup, place, prepState, statusOf } from "./helpers";

const blind = (d = 3) => ({ kind: "BLIND" as const, duration: d, power: 0, source: "DAWN" as const });

describe("shaking off BLIND", () => {
  it("a plain card just carries it, one round shorter", () => {
    // The control. Without this the three cases below could all be passing
    // because BLIND never sticks to anything.
    const s = prepState();
    const c = place(s, "leaf_alpha", "P1", 3, 0, { status: blind(3) });
    place(s, "dusk_gool", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[c.instanceId], "BLIND")?.duration).toBe(2);
  });

  it("Awakening: a DAWN card burns one negative off itself every round", () => {
    const s = prepState();
    const c = place(s, "dawn_star", "P1", 3, 0, { status: blind(3) });
    place(s, "leaf_alpha", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[c.instanceId], "BLIND"), "gone, not merely ticked").toBeUndefined();
    expect(n.log.some((l) => /burns off BLIND/.test(l)), "and it says so").toBe(true);
  });

  it("Crowned: Imperator washes the whole army, DAWN or not", () => {
    const s = prepState();
    place(s, "dawn_imperator", "P1", 3, 0);
    const kin = place(s, "dawn_star", "P1", 3, 1, { status: blind(3) });
    const other = place(s, "leaf_alpha", "P1", 3, 2, { status: blind(3) });
    place(s, "dusk_gool", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[kin.instanceId], "BLIND")).toBeUndefined();
    // The LEAF ally is the half that makes this Imperator's doing rather than
    // Awakening's — Awakening only cleanses DAWN, and only itself.
    expect(statusOf(n.cards[other.instanceId], "BLIND"), "allies of any element").toBeUndefined();
  });

  it("Crowned says what it did", () => {
    // It fired every round and printed nothing, which from the player's chair
    // is indistinguishable from not firing — and the statuses it strips are
    // exactly the ones behind "why did my card miss".
    //
    // A LEAF ally deliberately: Awakening runs FIRST and burns a DAWN card's
    // own BLIND off before Crowned ever sees it, so on an all-DAWN board there
    // is genuinely nothing left to wash and the line correctly never prints.
    // That ordering is worth knowing — it is why this passive looks idle.
    const s = prepState();
    place(s, "dawn_imperator", "P1", 3, 0);
    place(s, "leaf_alpha", "P1", 3, 1, { status: blind(3) });
    place(s, "dusk_gool", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(n.log.some((l) => /Crowned washes/.test(l))).toBe(true);
  });

  it("stays quiet on a clean board", () => {
    // A line every round saying nothing happened is worse than no line.
    const s = prepState();
    place(s, "dawn_imperator", "P1", 3, 0);
    place(s, "dawn_star", "P1", 3, 1);
    place(s, "dusk_gool", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(n.log.some((l) => /Crowned washes/.test(l))).toBe(false);
  });
});
