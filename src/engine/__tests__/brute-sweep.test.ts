// Sweep (Brute) — one swing at everything in range.
//
// It used to take the ROW AHEAD, every column of it. Two things were wrong with
// that and they pull in opposite directions: it swung at an empty row whenever
// the enemy had stepped out of the lane, and it missed a card standing right
// beside Brute because "beside" is not "ahead". The row was also a set the fire
// gate could not see, so the Special carried a `ranged` flag purely to stop
// canFireSpecial refusing it — gate and effect describing different things.
//
// In range means `validTargets`: the same list the basic attack offers, so the
// sweep reaches exactly what Brute could have hit one at a time.
import { describe, expect, it } from "vitest";
import { SPECIAL_HANDLERS } from "../combat";
import { validTargets } from "../rules";
import { getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import type { CardInstance, GameState } from "../types";

const HP = { curHp: 40, maxHp: 40, curShields: 0 };
const sweep = (g: GameState, b: CardInstance) =>
  SPECIAL_HANDLERS.sweep(g, b, [], getDef("dusk_brute").special!.params!);
const hurt = (g: GameState, c: CardInstance) => 40 - g.cards[c.instanceId].curHp;

describe("Sweep hits everything in range", () => {
  it("catches a card BESIDE Brute, which the row-ahead version could not", () => {
    // The miss that motivated this. Same row, one column over: adjacent, a
    // legal basic-attack target, and not "the row directly ahead".
    const g = prepState();
    const brute = place(g, "dusk_brute", "P1", 2, 1);
    const beside = place(g, "leaf_alpha", "P2", 2, 2, HP);
    expect(validTargets(g, brute.instanceId).some((t) => t.instanceId === beside.instanceId),
      "a basic could hit it").toBe(true);
    sweep(g, brute);
    expect(hurt(g, beside), "and so does the sweep").toBeGreaterThan(0);
  });

  it("still catches the card directly ahead", () => {
    const g = prepState();
    const brute = place(g, "dusk_brute", "P1", 2, 1);
    const ahead = place(g, "leaf_alpha", "P2", 1, 1, HP);
    sweep(g, brute);
    expect(hurt(g, ahead)).toBeGreaterThan(0);
  });

  it("hits ALL of them in one cast, not just the first", () => {
    const g = prepState();
    const brute = place(g, "dusk_brute", "P1", 2, 1);
    const a = place(g, "leaf_alpha", "P2", 1, 0, HP);
    const b = place(g, "leaf_alpha", "P2", 1, 1, HP);
    const c = place(g, "leaf_alpha", "P2", 1, 2, HP);
    sweep(g, brute);
    for (const [name, foe] of [["a", a], ["b", b], ["c", c]] as const)
      expect(hurt(g, foe), `${name} was swept`).toBeGreaterThan(0);
  });

  it("leaves anything OUT of range alone", () => {
    // "Everything in range" is a real limit, not a board wipe. Brute is Melee,
    // so a card two rows back is not its business.
    const g = prepState();
    const brute = place(g, "dusk_brute", "P1", 3, 1);
    const far = place(g, "leaf_alpha", "P2", 0, 3, HP);
    sweep(g, brute);
    expect(hurt(g, far)).toBe(0);
  });

  it("never hits an ally", () => {
    const g = prepState();
    const brute = place(g, "dusk_brute", "P1", 2, 1);
    const friend = place(g, "dusk_gool", "P1", 2, 2, HP);
    place(g, "leaf_alpha", "P2", 1, 1, HP);
    sweep(g, brute);
    expect(hurt(g, friend)).toBe(0);
  });

  it("pays +2 shields a kill, and nothing when it kills nothing", () => {
    const g = prepState();
    const brute = place(g, "dusk_brute", "P1", 2, 1, { curShields: 0 });
    place(g, "leaf_alpha", "P2", 1, 1, { curHp: 1, maxHp: 40, curShields: 0 });
    place(g, "leaf_alpha", "P2", 1, 2, { curHp: 1, maxHp: 40, curShields: 0 });
    sweep(g, brute);
    expect(g.cards[brute.instanceId].curShields, "two kills, +4").toBe(4);

    const g2 = prepState();
    const b2 = place(g2, "dusk_brute", "P1", 2, 1, { curShields: 0 });
    place(g2, "leaf_alpha", "P2", 1, 1, HP);
    sweep(g2, b2);
    expect(g2.cards[b2.instanceId].curShields, "no kill, no shields").toBe(0);
  });

  it("the fire gate and the effect now describe the same set", () => {
    // The `ranged` flag is gone. It existed only because the row-ahead effect
    // could be live while canFireSpecial saw nothing adjacent; with the effect
    // scoped to `validTargets`, the ordinary melee gate is exactly right, and
    // keeping the flag would let Brute spend 3 magic on an empty swing.
    expect(getDef("dusk_brute").special?.ranged).toBeUndefined();
    expect(getDef("dusk_brute").special?.text).toContain("in range");
  });
});
