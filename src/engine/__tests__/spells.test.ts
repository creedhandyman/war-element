// Spells — Cost-1 effects + Cost-4 walls: casting, cost, once-per-game,
// Home-slot targeting, wall placement / movement trigger / expiry.

import { describe, expect, it } from "vitest";
import { directDamage, wallEvasion, wallFlatReduction } from "../combat";
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

  it("Frost Shard deals 3 and FREEZEs the target (AQUA's cost-1)", () => {
    const s = prepState();
    armSpell(s, "aqua_frost_shard", 3);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 14, maxHp: 14, curShields: 0 });
    const next = applyIntent(s, {
      type: "CAST_SPELL",
      player: "P1",
      spellId: "aqua_frost_shard",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(11); // 14 − 3
    expect(statusOf(next.cards[foe.instanceId], "FREEZE")).toBeTruthy();
    expect(next.players.P1.magicPool).toBe(2); // cost 1, from 3
  });

  it("Jolt deals 3 and PARALYZEs the target (BOLT's cost-1)", () => {
    const s = prepState();
    armSpell(s, "bolt_jolt", 3);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 14, maxHp: 14, curShields: 0 });
    const next = applyIntent(s, {
      type: "CAST_SPELL",
      player: "P1",
      spellId: "bolt_jolt",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(11); // 14 − 3
    expect(statusOf(next.cards[foe.instanceId], "PARALYZE")).toBeTruthy();
    expect(next.players.P1.magicPool).toBe(2); // cost 1, from 3
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
  it("erupts immediately on enemies already in the row when cast", () => {
    const s = prepState(); // P1 has priority
    s.players.P1.spellbook = [{ defId: "pyro_firewall", used: false }];
    s.players.P1.magicPool = 4;
    const foe = place(s, "leaf_alpha", "P2", 2, 0, { curHp: 14, maxHp: 14, curShields: 0 }); // already in Mid row 2
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "pyro_firewall", row: 2 });
    expect(next.cards[foe.instanceId].curHp).toBe(11); // Firewall's 3 DMG on cast
    expect(statusOf(next.cards[foe.instanceId], "BURN")).toBeTruthy();
  });

  it("a wall triggers on an enemy MOVING into its row (dmg + status)", () => {
    const s = prepState(42, "P2"); // give P2 priority so it can move
    // Lay P1's Firewall on Mid row 2 directly.
    s.walls = [
      { owner: "P1", spellId: "pyro_firewall", element: "PYRO", row: 2, dmg: 3, status: { kind: "BURN", duration: 1, power: 1 }, roundsLeft: 3 },
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

  it("a fast card can't leap OVER a wall — passing its row still triggers it", () => {
    const s = prepState(42, "P2");
    s.walls = [
      { owner: "P1", spellId: "pyro_firewall", element: "PYRO", row: 1, dmg: 3, status: { kind: "BURN", duration: 1, power: 1 }, roundsLeft: 3 },
    ];
    // leaf_sumerose SP 8 (reach 2): row 0 → row 2 vaults OVER the wall on row 1.
    const foe = place(s, "leaf_sumerose", "P2", 0, 0, { curHp: 13, maxHp: 13, curShields: 0 });
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P2",
      instanceId: foe.instanceId,
      to: { row: 2, col: 0 },
    });
    expect(next.cards[foe.instanceId].curHp).toBe(10); // took 3 crossing row 1
    expect(statusOf(next.cards[foe.instanceId], "BURN")).toBeTruthy();
  });

  it("FLYING cards soar over walls untouched", () => {
    const s = prepState(42, "P2");
    s.walls = [{ owner: "P1", spellId: "pyro_firewall", element: "PYRO", row: 2, dmg: 3, roundsLeft: 3 }];
    const flyer = place(s, "pyro_fenrir", "P2", 1, 0, { curHp: 17, maxHp: 17, curShields: 0 }); // FLYING
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P2",
      instanceId: flyer.instanceId,
      to: { row: 2, col: 0 },
    });
    expect(next.cards[flyer.instanceId].curHp).toBe(17); // untouched
  });

  it("walls cannot be placed on the opponent's summon (Home) row", () => {
    const s = prepState();
    s.players.P1.spellbook = [{ defId: "leaf_bramble_wall", used: false }];
    s.players.P1.magicPool = 5;
    place(s, "leaf_alpha", "P1", 2, 3); // a qualifier in a Mid row still doesn't unlock it
    expect(canCastSpell(s, "P1", "leaf_bramble_wall", { row: 0 }).ok).toBe(false); // P2 Home
    expect(canCastSpell(s, "P1", "leaf_bramble_wall", { row: 2 }).ok).toBe(true); // a Mid row
    expect(canCastSpell(s, "P1", "leaf_bramble_wall", { row: 3 }).ok).toBe(true); // own Home
  });

  it("a caster's own card is unharmed crossing its own wall", () => {
    const s = prepState();
    s.walls = [{ owner: "P1", spellId: "pyro_firewall", element: "PYRO", row: 2, dmg: 3, roundsLeft: 3 }];
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
    s.walls = [{ owner: "P1", spellId: "pyro_firewall", element: "PYRO", row: 2, dmg: 3, roundsLeft: 1 }];
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

  it("Stone Wall entry strips a shield before dealing its damage", () => {
    const s = prepState(42, "P2");
    s.walls = [
      { owner: "P1", spellId: "bore_stone_wall", element: "BORE", row: 3, dmg: 3, stripShields: 1, allyBuff: { block: 2 }, roundsLeft: 3 },
    ];
    const foe = place(s, "leaf_alpha", "P2", 2, 0, { curHp: 14, maxHp: 14, curShields: 2 });
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P2",
      instanceId: foe.instanceId,
      to: { row: 3, col: 0 },
    });
    // strip 1 shield (2→1), then 3 DMG through the gate: 2 to HP, 1 more shield off.
    expect(next.cards[foe.instanceId].curShields).toBe(0);
    expect(next.cards[foe.instanceId].curHp).toBe(12);
  });
});

describe("double-duty wall ally buffs", () => {
  it("Stone Wall grants same-element allies +BLOCK, stacking with innate", () => {
    const s = prepState();
    s.walls = [
      { owner: "P1", spellId: "bore_stone_wall", element: "BORE", row: 3, dmg: 3, allyBuff: { block: 2 }, roundsLeft: 3 },
    ];
    const plain = place(s, "bore_clubber", "P1", 3, 0, { curHp: 20, maxHp: 20, curShields: 0 }); // no innate BLOCK
    const tanky = place(s, "bore_armadillo", "P1", 3, 1, { curHp: 20, maxHp: 20, curShields: 0 }); // innate BLOCK 2
    expect(wallFlatReduction(s, plain)).toBe(2);
    const src = place(s, "leaf_alpha", "P2", 1, 0);
    directDamage(s, src, plain, 6, false); // 6 − 2 (wall) = 4
    expect(s.cards[plain.instanceId].curHp).toBe(16);
    directDamage(s, src, tanky, 6, false); // 6 − (2 innate + 2 wall) = 2
    expect(s.cards[tanky.instanceId].curHp).toBe(18);
  });

  it("the buff is scoped to the owner's same-element allies in the row", () => {
    const s = prepState();
    s.walls = [
      { owner: "P1", spellId: "bore_stone_wall", element: "BORE", row: 3, dmg: 3, allyBuff: { block: 2 }, roundsLeft: 3 },
    ];
    const wrongEl = place(s, "leaf_alpha", "P1", 3, 0); // P1 but LEAF
    const wrongRow = place(s, "bore_clubber", "P1", 2, 0); // BORE but not in the row
    const enemy = place(s, "bore_clubber", "P2", 3, 3); // BORE but an enemy
    expect(wallFlatReduction(s, wrongEl)).toBe(0);
    expect(wallFlatReduction(s, wrongRow)).toBe(0);
    expect(wallFlatReduction(s, enemy)).toBe(0);
  });

  it("Radiant Barrier gives DAWN allies −1, Veil gives DUSK allies EVASION", () => {
    const s = prepState();
    s.walls = [
      { owner: "P1", spellId: "dawn_radiant_barrier", element: "DAWN", row: 2, dmg: 2, allyBuff: { dmgReduction: 1 }, roundsLeft: 3 },
      { owner: "P1", spellId: "dusk_veil_of_shadows", element: "DUSK", row: 1, dmg: 2, allyBuff: { evasion: true }, roundsLeft: 3 },
    ];
    const dawnAlly = place(s, "dawn_beam", "P1", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const duskAlly = place(s, "dusk_gool", "P1", 1, 0);
    expect(wallFlatReduction(s, dawnAlly)).toBe(1);
    expect(wallEvasion(s, duskAlly)).toBe(true);
    expect(wallEvasion(s, dawnAlly)).toBe(false); // wrong element for the Veil
    const src = place(s, "leaf_alpha", "P2", 0, 0);
    directDamage(s, src, dawnAlly, 5, false); // 5 − 1 = 4
    expect(s.cards[dawnAlly.instanceId].curHp).toBe(16);
  });
});

describe("expansion spells (cost 3/5/7)", () => {
  it("Vortex Strike (cost 7): 10 PEN straight through shields + STUN 1", () => {
    const s = prepState();
    armSpell(s, "gale_vortex_strike", 7);
    const foe = place(s, "dusk_gool", "P2", 1, 0, { curHp: 15, maxHp: 15, curShields: 4 });
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "gale_vortex_strike", targetId: foe.instanceId });
    expect(next.cards[foe.instanceId].curHp).toBe(5); // 10 PEN to HP
    expect(next.cards[foe.instanceId].curShields).toBe(4); // shields untouched
    expect(statusOf(next.cards[foe.instanceId], "STUN")).toBeTruthy();
    expect(next.players.P1.magicPool).toBe(0);
  });

  it("Soul Rend (cost 7): 10 PEN + DRAIN 3 max HP to a DUSK ally", () => {
    const s = prepState();
    armSpell(s, "dusk_soul_rend", 7);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 14, maxHp: 14, curShields: 0 });
    const ally = place(s, "dusk_vamp", "P1", 3, 0, { curHp: 6, maxHp: 6 });
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dusk_soul_rend", targetId: foe.instanceId });
    expect(next.cards[foe.instanceId].curHp).toBe(4); // 14 − 10 PEN
    expect(next.cards[foe.instanceId].maxHp).toBe(11); // −3 max HP
    expect(next.cards[ally.instanceId].maxHp).toBe(9); // +3 max HP stolen
  });

  it("Bulwark (cost 3): +3 shield to a BORE ally", () => {
    const s = prepState();
    armSpell(s, "bore_bulwark", 3);
    const ally = place(s, "bore_armadillo", "P1", 3, 0, { curShields: 0 });
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bore_bulwark" });
    expect(next.cards[ally.instanceId].curShields).toBe(3);
  });

  it("Shadow Step (cost 3): cloaks a DUSK ally in EVASION for 2 rounds", () => {
    const s = prepState();
    armSpell(s, "dusk_shadow_step", 3);
    const ally = place(s, "dusk_vamp", "P1", 3, 0);
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dusk_shadow_step" });
    expect(statusOf(next.cards[ally.instanceId], "EVASION")?.duration).toBe(2);
  });

  it("Fortify (cost 5): +2 shield to EVERY BORE ally, sparing other elements", () => {
    const s = prepState();
    armSpell(s, "bore_fortify", 5);
    const a = place(s, "bore_armadillo", "P1", 3, 0, { curShields: 0 });
    const b = place(s, "bore_clubber", "P1", 3, 1, { curShields: 2 });
    const off = place(s, "leaf_alpha", "P1", 3, 2, { curShields: 0 }); // not BORE
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "bore_fortify" });
    expect(next.cards[a.instanceId].curShields).toBe(2);
    expect(next.cards[b.instanceId].curShields).toBe(4);
    expect(next.cards[off.instanceId].curShields).toBe(0); // spared
  });
});

describe("AoE spells (row / two-row)", () => {
  it("Thorn Patch: BLEEDs every opponent in the chosen row, sparing other rows", () => {
    const s = prepState();
    armSpell(s, "leaf_thorn_patch", 2);
    const a = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20 });
    const b = place(s, "dusk_vamp", "P2", 1, 2, { curHp: 6 });
    const other = place(s, "dusk_skeleton_knight", "P2", 2, 0, { curHp: 7 }); // different row
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "leaf_thorn_patch", row: 1 });
    expect(statusOf(next.cards[a.instanceId], "BLEED")?.power).toBe(1);
    expect(statusOf(next.cards[b.instanceId], "BLEED")).toBeTruthy();
    expect(statusOf(next.cards[other.instanceId], "BLEED")).toBeFalsy(); // row 2, spared
  });

  it("Solar Flare: BLINDs opponents across the chosen row + the one behind it", () => {
    const s = prepState();
    armSpell(s, "dawn_solar_flare", 8);
    const r1 = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20 });
    const r2 = place(s, "dusk_vamp", "P2", 2, 0, { curHp: 6 });
    const r3 = place(s, "dusk_skeleton_knight", "P2", 3, 0, { curHp: 7 }); // outside the pair (1,2)
    const next = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: "dawn_solar_flare", row: 1 });
    expect(statusOf(next.cards[r1.instanceId], "BLIND")).toBeTruthy();
    expect(statusOf(next.cards[r2.instanceId], "BLIND")).toBeTruthy();
    expect(statusOf(next.cards[r3.instanceId], "BLIND")).toBeFalsy();
  });

  it("a row AoE needs a row, and the enemy Home row stays gated until reached", () => {
    const s = prepState();
    armSpell(s, "aqua_frost_patch", 2);
    expect(canCastSpell(s, "P1", "aqua_frost_patch", {}).ok).toBe(false); // no row picked
    expect(canCastSpell(s, "P1", "aqua_frost_patch", { row: 2 }).ok).toBe(true); // a Mid row
    expect(canCastSpell(s, "P1", "aqua_frost_patch", { row: 0 }).ok).toBe(false); // P2 Home, not reached
    place(s, "leaf_alpha", "P1", 2, 3); // a P1 card in a Mid row unlocks the reach
    expect(canCastSpell(s, "P1", "aqua_frost_patch", { row: 0 }).ok).toBe(true);
  });
});
