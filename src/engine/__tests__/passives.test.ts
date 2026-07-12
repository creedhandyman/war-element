// Restored card passives: the generic hooks (onKill, thorns, vsStatus, gated
// on-hit riders, roundTick, onDeath row-ahead) that back the doc-correct
// abilities in cards.ts.

import { describe, expect, it } from "vitest";
import { basicAttack } from "../combat";
import { advance } from "../phases";
import { atCleanup, place, prepState } from "./helpers";

describe("on-kill triggers", () => {
  it("Fenrir gains a permanent +1 basic hit on a kill", () => {
    const s = prepState();
    const fenrir = place(s, "pyro_fenrir", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 3 }); // some enemy so we don't over-clean
    const prey = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 });
    basicAttack(s, fenrir.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId]).toBeUndefined(); // killed
    expect(s.cards[fenrir.instanceId].hitsBonus).toBe(1);
  });
});

describe("vsStatus conditional keyword", () => {
  it("Alpha lifesteals only vs ROOTed targets (Gnashing Bite)", () => {
    const rooted = prepState();
    const alpha = place(rooted, "leaf_alpha", "P1", 3, 0, { curHp: 5 });
    const rootedFoe = place(rooted, "dusk_gool", "P2", 3, 1, {
      curHp: 20,
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    basicAttack(rooted, alpha.instanceId, rootedFoe.instanceId);
    expect(rooted.cards[alpha.instanceId].curHp).toBeGreaterThan(5); // healed

    const notRooted = prepState();
    const a2 = place(notRooted, "leaf_alpha", "P1", 3, 0, { curHp: 5 });
    const t2 = place(notRooted, "dusk_gool", "P2", 3, 1, { curHp: 20 });
    basicAttack(notRooted, a2.instanceId, t2.instanceId);
    expect(notRooted.cards[a2.instanceId].curHp).toBe(5); // no heal
  });
});

describe("thorns (onHitByMelee)", () => {
  it("Thorn's Transfusion BLEEDs a melee attacker", () => {
    const s = prepState();
    const attacker = place(s, "gale_duster", "P1", 2, 0); // Melee assassin
    const thorn = place(s, "leaf_thorn", "P2", 2, 1, { curHp: 18 });
    basicAttack(s, attacker.instanceId, thorn.instanceId);
    expect(s.cards[attacker.instanceId].statuses.some((x) => x.kind === "BLEED")).toBe(true);
  });
});

describe("gated on-hit riders", () => {
  it("Gool FRIGHTENs only on the first hit of a round", () => {
    const s = prepState();
    const gool = place(s, "dusk_gool", "P1", 2, 0);
    const target = place(s, "aqua_coralgolem", "P2", 2, 1, { curHp: 30 });
    basicAttack(s, gool.instanceId, target.instanceId);
    const afterFirst = s.cards[target.instanceId].statuses.filter((x) => x.kind === "FRIGHTEN").length;
    // clear the FRIGHTEN and hit again in the SAME round → no re-application
    s.cards[target.instanceId].statuses = [];
    basicAttack(s, gool.instanceId, target.instanceId);
    const afterSecond = s.cards[target.instanceId].statuses.filter((x) => x.kind === "FRIGHTEN").length;
    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(0); // gated: already struck this round
  });
});

describe("roundTick self effects", () => {
  it("Sandman's Sandstorm dings every enemy in Cleanup", () => {
    const s = prepState();
    place(s, "bore_sandman", "P1", 2, 0);
    place(s, "leaf_greegon", "P1", 3, 0); // keep P1 on the board
    const enemy = place(s, "dusk_gool", "P2", 1, 0, { curHp: 13 });
    const next = advance(atCleanup(s));
    expect(next.cards[enemy.instanceId].curHp).toBe(12); // −1 Sandstorm
  });
});

describe("on-death row-ahead (Burnout)", () => {
  it("FireBird blasts the enemy row directly ahead when it dies", () => {
    const s = prepState();
    const fb = place(s, "pyro_firebird", "P1", 2, 0, { curHp: 1 });
    const killer = place(s, "dusk_gool", "P2", 2, 1); // adjacent, kills FireBird
    const victim = place(s, "dusk_vamp", "P2", 1, 0, { curHp: 6 }); // row ahead of FireBird
    basicAttack(s, killer.instanceId, fb.instanceId);
    expect(s.cards[fb.instanceId]).toBeUndefined();
    expect(s.cards[victim.instanceId].curHp).toBe(2); // −4 Burnout
  });
});
