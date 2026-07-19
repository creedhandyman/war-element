// Post-match stat tallying — damage/heal/kill attribution through the funnels.

import { describe, expect, it } from "vitest";
import { resolveHit } from "../combat";
import { healCard } from "../state";
import { place, prepState } from "./helpers";

describe("match stats", () => {
  it("credits HP damage + a kill to the attacker (card + side total)", () => {
    const s = prepState();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 4, maxHp: 4, curShields: 0 });
    resolveHit(s, a, t, { kind: "special", dmg: 4, hits: 1, pen: false, crit: false });
    expect(s.stats.byPlayer.P1.dmg).toBe(4);
    expect(s.stats.byPlayer.P1.kills).toBe(1);
    expect(s.stats.byCard[a.instanceId].dmg).toBe(4);
    expect(s.stats.byCard[a.instanceId].kills).toBe(1);
  });

  it("self-heal credits the recipient; an explicit healer credits the source", () => {
    const s = prepState();
    const self = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 5, maxHp: 20 });
    healCard(s, self, 7); // no source → self-sustain
    expect(s.stats.byPlayer.P1.heal).toBe(7);
    expect(s.stats.byCard[self.instanceId].heal).toBe(7);

    const healer = place(s, "dawn_amble", "P1", 2, 1);
    const ally = place(s, "leaf_nettle", "P1", 2, 2, { curHp: 2, maxHp: 20 });
    healCard(s, ally, 3, healer); // support heal → credited to the healer
    expect(s.stats.byCard[healer.instanceId].heal).toBe(3);
    expect(s.stats.byCard[ally.instanceId]).toBeUndefined(); // recipient not credited
  });

  it("does not credit friendly fire", () => {
    const s = prepState();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const friend = place(s, "leaf_nettle", "P1", 2, 1, { curHp: 10, maxHp: 10, curShields: 0 });
    resolveHit(s, a, friend, { kind: "special", dmg: 3, hits: 1, pen: false, crit: false });
    expect(s.stats.byPlayer.P1.dmg).toBe(0);
  });
});
