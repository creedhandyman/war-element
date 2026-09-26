import { describe, expect, it } from "vitest";
import { cardAttack, cardAttackEffects, damageAt, shotPower } from "../../ui/vfx/spell-fx";
import { place, prepState } from "./helpers";

/** A battle step by `attackerId`, with `after` left for the test to shape. */
function step(s: ReturnType<typeof prepState>, attackerId: string) {
  s.phase = "battle";
  s.battle = { queue: [attackerId], index: 0, awaitingInput: null };
  const after = structuredClone(s);
  after.battle!.index = 1;
  return after;
}

describe("a projectile's size is its damage", () => {
  it("its area in proportion: a 4-point basic and an 8-point Special are the 1s", () => {
    expect(shotPower(4, false)).toBeCloseTo(1);
    expect(shotPower(16, false)).toBeCloseTo(2); // four times the damage, twice as wide
    expect(shotPower(2, false)).toBeCloseTo(Math.SQRT1_2);
    expect(shotPower(8, true)).toBeCloseTo(1);
    // A basic hitting as hard as a typical Special is drawn like one: each
    // look already draws a Special about √2 its basic.
    expect(shotPower(8, false)).toBeCloseTo(Math.SQRT2);
    expect(shotPower(0, false)).toBe(0.55); // a miss still flies, small
    expect(shotPower(99, true)).toBe(2);
  });

  it("reads each target's damage the way the floating numbers show it", () => {
    const s = prepState(1);
    const a = place(s, "pyro_firebird", "P2", 0, 1);
    const volleyed = place(s, "leaf_greegon", "P1", 3, 0, { curHp: 20 });
    const plated = place(s, "leaf_greegon", "P1", 3, 1, { curHp: 20, curShields: 3 });
    const killed = place(s, "leaf_greegon", "P1", 3, 2, { curHp: 3 });
    const dodged = place(s, "leaf_greegon", "P1", 3, 3, { curHp: 20 });
    const after = step(s, a.instanceId);
    // A three-hit volley: its hits are summed.
    const v = after.cards[volleyed.instanceId];
    v.curHp -= 6;
    v.fxDmgHits = [...(v.fxDmgHits ?? []), 2, 2, 2];
    v.fxDmgSeq = (v.fxDmgSeq ?? 0) + 3;
    // Only shields broken: no number floats, but it was still hit for 2.
    after.cards[plated.instanceId].curShields -= 2;
    // Killed outright: what it had left.
    delete after.cards[killed.instanceId];
    // A dodge changes nothing but its MISS counter.
    after.cards[dodged.instanceId].fxMiss = (dodged.fxMiss ?? 0) + 1;
    expect(damageAt(s, after, volleyed.pos!)).toBe(6);
    expect(damageAt(s, after, plated.pos!)).toBe(2);
    expect(damageAt(s, after, killed.pos!)).toBe(3);
    expect(damageAt(s, after, dodged.pos!)).toBe(0);
    // ...and the attack carries them aligned with its targets.
    const act = cardAttack(s, after)!;
    const by = Object.fromEntries(act.targets.map((t, i) => [`${t.row},${t.col}`, act.damage[i]]));
    expect(by).toEqual({ "3,0": 6, "3,1": 2, "3,2": 3, "3,3": 0 });
    // A blow's mark is sized the same way: each hit carries its own.
    const hits = cardAttackEffects(s, after).filter((f) => f.kind === "hit");
    const power = Object.fromEntries(hits.map((h) => [`${h.at.row},${h.at.col}`, h.kind === "hit" ? h.power : undefined]));
    expect(power["3,0"]).toBeCloseTo(shotPower(6, false));
    expect(power["3,2"]).toBeCloseTo(shotPower(3, false));
  });
});
