// Hartwood — Grove Ward (owner's call, 2026-09): Grove allies carry +2 shields,
// regrown each round up to their printed shields +2, while Hartwood stands.
import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { defeatCard } from "../combat";
import { auraShieldBonus } from "../state";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { atCleanup, place, prepState } from "./helpers";

describe("Hartwood — Grove Ward", () => {
  it("is a named +2 shield aura over the Grove tribe", () => {
    const def = getDef("leaf_warden");
    expect(def.aura).toEqual({ scope: "tribe", match: "Grove", shields: 2 });
    expect(def.passiveNames?.aura).toBe("Grove Ward");
    expect(describePassives(def).join(" | ")).toContain("Grove Ward — Grove allies gain +2 shields.");
  });

  it("Grove allies regrow to printed +2 each round; a non-Grove ally does not", () => {
    const s = prepState();
    place(s, "leaf_warden", "P1", 3, 0);
    const oak = place(s, "leaf_oak", "P1", 3, 1, { curShields: 0 }); // Grove, prints 0
    const alpha = place(s, "leaf_alpha", "P1", 3, 2, { curShields: 0 }); // Wolf
    expect(auraShieldBonus(s, s.cards[oak.instanceId])).toBe(2);
    expect(auraShieldBonus(s, s.cards[alpha.instanceId])).toBe(0);
    const next = advance(atCleanup(s));
    expect(next.cards[oak.instanceId].curShields, "two shields grown at Cleanup").toBe(2);
    expect(next.cards[alpha.instanceId].curShields).toBe(0);
  });

  it("covers Hartwood itself, and lifts when Hartwood falls", () => {
    const s = prepState();
    const hart = place(s, "leaf_warden", "P1", 3, 0);
    const oak = place(s, "leaf_oak", "P1", 3, 1);
    expect(auraShieldBonus(s, s.cards[hart.instanceId]), "a tribe aura covers its holder").toBe(2);
    defeatCard(s, s.cards[hart.instanceId], "test");
    expect(auraShieldBonus(s, s.cards[oak.instanceId])).toBe(0);
  });
});
