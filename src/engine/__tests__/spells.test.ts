// Spells — Cost-1 effects + Cost-4 walls: casting, cost, once-per-game,
// Home-slot targeting, wall placement / movement trigger / expiry.

import { describe, expect, it } from "vitest";
import { applyIntent, advance } from "../phases";
import { canCastSpell } from "../rules";
import { atCleanup, place, prepState, statusOf } from "./helpers";

/** Give P1 a single spell and enough magic to cast it. */
function armSpell(s: ReturnType<typeof prepState>, defId: string, magic = 5) {
  s.players.P1.spellbook = [{ defId, used: false }];
  s.players.P1.magicPool = magic;
}

describe("Cost-1 damage spells", () => {
  it("Spark deals 3 + BURN, spends magic, and burns the slot", () => {
    const s = prepState();
    armSpell(s, "pyro_spark", 3);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 14, maxHp: 14, curShields: 0 });
    const next = applyIntent(s, {
      type: "CAST_SPELL",
      player: "P1",
      spellId: "pyro_spark",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(11);
    expect(statusOf(next.cards[foe.instanceId], "BURN")?.power).toBe(1);
    expect(next.players.P1.magicPool).toBe(2);
    expect(next.players.P1.spellbook[0].used).toBe(true);
  });

  it("can't cast the same spell twice (once per game)", () => {
    const s = prepState();
    armSpell(s, "pyro_spark", 5);
    const foe = place(s, "bore_armadillo", "P2", 1, 0, { curHp: 15, maxHp: 15, curShields: 0 });
    const next = applyIntent(s, {
      type: "CAST_SPELL",
      player: "P1",
      spellId: "pyro_spark",
      targetId: foe.instanceId,
    });
    expect(canCastSpell(next, "P1", "pyro_spark", { targetId: foe.instanceId }).ok).toBe(false);
    expect(() =>
      applyIntent(next, { type: "CAST_SPELL", player: "P1", spellId: "pyro_spark", targetId: foe.instanceId }),
    ).toThrow();
  });

  it("refuses to cast with too little magic", () => {
    const s = prepState();
    armSpell(s, "pyro_spark", 0);
    const foe = place(s, "bore_armadillo", "P2", 1, 0, { curHp: 15, maxHp: 15, curShields: 0 });
    expect(canCastSpell(s, "P1", "pyro_spark", { targetId: foe.instanceId }).ok).toBe(false);
  });

  it("Gust pushes the target back a space", () => {
    const s = prepState();
    armSpell(s, "gale_gust", 3);
    const foe = place(s, "bore_armadillo", "P2", 1, 1, { curHp: 15, maxHp: 15, curShields: 0 });
    const next = applyIntent(s, {
      type: "CAST_SPELL",
      player: "P1",
      spellId: "gale_gust",
      targetId: foe.instanceId,
    });
    // P2 is pushed toward its own home (row 0).
    expect(next.cards[foe.instanceId].pos).toEqual({ row: 0, col: 1 });
  });
});

describe("Home-slot targeting for spells", () => {
  it("enemy Home row is off-limits until a caster card reaches a Mid row", () => {
    const s = prepState();
    armSpell(s, "pyro_spark", 3);
    const foe = place(s, "bore_armadillo", "P2", 0, 0, { curHp: 15, maxHp: 15, curShields: 0 }); // P2 home
    expect(canCastSpell(s, "P1", "pyro_spark", { targetId: foe.instanceId }).ok).toBe(false);
    place(s, "leaf_alpha", "P1", 2, 3); // a P1 card in a Mid row unlocks the reach
    expect(canCastSpell(s, "P1", "pyro_spark", { targetId: foe.instanceId }).ok).toBe(true);
  });
});

describe("Support spells", () => {
  it("Sprout heals a LEAF ally, and is illegal with none on board", () => {
    const s = prepState();
    armSpell(s, "leaf_sprout", 3);
    expect(canCastSpell(s, "P1", "leaf_sprout", {}).ok).toBe(false); // no LEAF ally yet
    const ally = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 5, maxHp: 14 });
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_sprout" });
    expect(next.cards[ally.instanceId].curHp).toBe(8); // +3
  });
});

describe("Cost-4 walls", () => {
  it("a wall triggers on an enemy MOVING into its row (dmg + status)", () => {
    const s = prepState(42, "P2"); // give P2 priority so it can move
    // Lay P1's Firewall on Mid row 2 directly.
    s.walls = [
      { owner: "P1", spellId: "pyro_firewall", row: 2, dmg: 3, status: { kind: "BURN", duration: 1, power: 1 }, roundsLeft: 3 },
    ];
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 14, maxHp: 14, curShields: 0 });
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P2",
      instanceId: foe.instanceId,
      to: { row: 2, col: 0 },
    });
    expect(next.cards[foe.instanceId].curHp).toBe(11); // took 3
    expect(statusOf(next.cards[foe.instanceId], "BURN")).toBeTruthy();
  });

  it("a caster's own card is unharmed crossing its own wall", () => {
    const s = prepState();
    s.walls = [{ owner: "P1", spellId: "pyro_firewall", row: 2, dmg: 3, roundsLeft: 3 }];
    const mine = place(s, "leaf_alpha", "P1", 3, 0, { curHp: 14, maxHp: 14 });
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P1",
      instanceId: mine.instanceId,
      to: { row: 2, col: 0 },
    });
    expect(next.cards[mine.instanceId].curHp).toBe(14); // untouched
  });

  it("walls decay and lift after their duration", () => {
    const s = prepState();
    s.walls = [{ owner: "P1", spellId: "pyro_firewall", row: 2, dmg: 3, roundsLeft: 1 }];
    place(s, "leaf_alpha", "P1", 3, 0); // keep boards non-empty
    const next = advance(atCleanup(s));
    expect(next.walls).toHaveLength(0);
  });

  it("Stone Wall can only be laid on the caster's own Home row", () => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "bore_stone_wall", used: false }];
    s.players.P1.magicPool = 5;
    expect(canCastSpell(s, "P1", "bore_stone_wall", { row: 3 }).ok).toBe(true); // P1 home
    expect(canCastSpell(s, "P1", "bore_stone_wall", { row: 2 }).ok).toBe(false); // a Mid row
  });
});
