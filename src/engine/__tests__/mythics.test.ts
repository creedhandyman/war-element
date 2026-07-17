// Element-core Mythics + the token-spawn mechanic that several of them use.

import { describe, expect, it } from "vitest";
import { basicAttack, checkLowHpTransform, directDamage, effectiveBasicHits } from "../combat";
import { advance, applyIntent } from "../phases";
import { canFireSpecial, canFireTalent, canTarget, effectiveSpecialCost } from "../rules";
import { boardCards, effectiveDmg, effectiveMaxHp, effectiveSp } from "../state";
import { getDef } from "../../data/cards";
import { atCleanup, giveHand, place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("token spawning", () => {
  it("Trinezer's Reptilian Screech spawns 3 Reptilians on summon (in king's reach)", () => {
    const s = prepState();
    s.players.P1.summonPool = 12; // Trinezer cost 9
    place(s, "leaf_alpha", "P2", 0, 0); // keep P2 non-empty
    const handId = giveHand(s, "P1", "leaf_trinezer");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const reps = boardCards(next, "P1").filter((c) => c.defId === "leaf_reptilian_tok");
    expect(reps).toHaveLength(3);
    const trin = boardCards(next, "P1").find((c) => c.defId === "leaf_trinezer")!;
    for (const r of reps) {
      expect(Math.abs(r.pos!.row - trin.pos!.row)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.pos!.col - trin.pos!.col)).toBeLessThanOrEqual(1);
    }
  });

  it("spawned tokens never enter the deck (they're not in CARDS)", async () => {
    const { CARDS } = await import("../../data/cards");
    expect(CARDS.some((c) => c.id === "leaf_reptilian_tok")).toBe(false);
  });
});

describe("per-card auras", () => {
  it("Trinezer's Brood Command gives Reptile allies +1 DMG / +1 SP", () => {
    const s = prepState();
    place(s, "leaf_trinezer", "P1", 3, 0);
    const rep = place(s, "leaf_reptilian_tok", "P1", 3, 1); // Reptile
    const nonRep = place(s, "leaf_alpha", "P1", 3, 2); // not Reptile
    expect(effectiveDmg(s, rep)).toBe(3 + 1); // token base 3 + aura
    expect(effectiveSp(s, rep)).toBe(3 + 1);
    expect(effectiveDmg(s, nonRep)).toBe(getDef("leaf_alpha").dmg); // untouched
    expect(effectiveSp(s, nonRep)).toBe(getDef("leaf_alpha").sp);
  });

  it("the aura is gone once Trinezer leaves the board (non-stacking, board-tied)", () => {
    const s = prepState();
    const rep = place(s, "leaf_reptilian_tok", "P1", 3, 1);
    expect(effectiveDmg(s, rep)).toBe(3); // no Trinezer → no buff
    place(s, "leaf_trinezer", "P1", 3, 0);
    expect(effectiveDmg(s, rep)).toBe(4); // buffed while Trinezer is alive
  });

  it("Griffith's element aura gives GALE allies +1 SP", () => {
    const s = prepState();
    place(s, "gale_griffith", "P1", 2, 0);
    const galeAlly = place(s, "gale_galeon", "P1", 3, 0);
    const nonGale = place(s, "leaf_alpha", "P1", 3, 1);
    expect(effectiveSp(s, galeAlly)).toBe(getDef("gale_galeon").sp + 1);
    expect(effectiveSp(s, nonGale)).toBe(getDef("leaf_alpha").sp);
  });

  it("Blood Ruby: DUSK allies' basics gain PEN (ignore shields)", () => {
    const s = prepState();
    place(s, "dusk_shadowhorsemen", "P1", 2, 1); // Blood Ruby holder (DUSK)
    const ally = place(s, "dusk_gool", "P1", 2, 0); // DUSK ally
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 5 });
    const next = applyIntent(battleWith(s, ally.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curShields).toBe(5); // PEN strips no shield
    expect(next.cards[foe.instanceId].curHp).toBeLessThan(20); // damage went straight to HP
  });

  it("Pressure: The DEEPEST tops BORE allies up to +1 shield each round", () => {
    const s = prepState();
    place(s, "bore_deepest", "P1", 2, 1); // Pressure holder (BORE)
    const boreAlly = place(s, "bore_clubber", "P1", 2, 0, { curShields: 0 });
    const nonBore = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 0 });
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 non-empty
    const next = advance(atCleanup(s));
    expect(next.cards[boreAlly.instanceId].curShields).toBe(getDef("bore_clubber").shields + 1);
    expect(next.cards[nonBore.instanceId].curShields).toBe(0); // untouched
  });
});

describe("Trinezer — Jungle Culling", () => {
  it("deals 11 to any opponent (ranged snipe)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const trin = place(s, "leaf_trinezer", "P1", 3, 0); // home row; foe is far away
    const foe = place(s, "dusk_gool", "P2", 1, 3, { curHp: 20, maxHp: 20, curShields: 0 }); // mid row, far
    const next = applyIntent(battleWith(s, trin.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(9); // 20 − 11
  });
});

describe("Imperator — Strike of Dawn", () => {
  it("spawns an Heir token", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const imp = place(s, "dawn_imperator", "P1", 3, 0);
    const next = applyIntent(battleWith(s, imp.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
    });
    expect(boardCards(next, "P1").some((c) => c.defId === "dawn_heir_tok")).toBe(true);
  });
});

describe("Kraken — From the Deep", () => {
  it("surges once (+3 DMG/+3 SP/+3 shield) when first dropping to ≤8 HP", () => {
    const s = prepState();
    const kraken = place(s, "aqua_kraken", "P1", 2, 0, { curHp: 10, maxHp: 42, curShields: 0 });
    const src = place(s, "leaf_alpha", "P2", 1, 0);
    directDamage(s, src, kraken, 5, false); // 10 → 5, crosses the threshold
    expect(s.cards[kraken.instanceId].dmgBonus).toBe(3);
    expect(s.cards[kraken.instanceId].spBonus).toBe(3);
    expect(s.cards[kraken.instanceId].curShields).toBe(3);
  });

  it("the surge does NOT cost Kraken his Special (only the surge, no dismount)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const kraken = place(s, "aqua_kraken", "P1", 2, 0, { curHp: 8, maxHp: 42, curShields: 0 });
    place(s, "leaf_alpha", "P2", 1, 0); // a target so the Special is castable
    checkLowHpTransform(s, kraken);
    const k = s.cards[kraken.instanceId];
    expect(k.transformed).toBe(false); // not "dismounted"
    expect(canFireSpecial(s, kraken.instanceId).ok).toBe(true); // Black Wave Crash intact
  });

  it("Black Wave Crash pays 5 HP and can trip From the Deep itself", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const kraken = place(s, "aqua_kraken", "P1", 2, 0, { curHp: 12, maxHp: 42, curShields: 0 });
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, kraken.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const k = next.cards[kraken.instanceId];
    expect(k.curHp).toBe(7); // 12 − 5 self-cost (surge grants shields, not HP)
    expect(k.curShields).toBe(3); // From the Deep tripped by the self-cost
    expect(k.dmgBonus).toBe(3);
  });
});

describe("temporary self-buffs (STEALTH / EVASION)", () => {
  it("Griffith's Dive Bomb grants STEALTH — he becomes untargetable", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const griff = place(s, "gale_griffith", "P1", 2, 0);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, griff.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    const g = next.cards[griff.instanceId];
    expect(statusOf(g, "STEALTH")).toBeTruthy();
    expect(canTarget(next, next.cards[foe.instanceId], g)).toBe(false); // untargetable
  });

  it("Shadow Horsemen's Shadow Charge grants EVASION", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const sh = place(s, "dusk_shadowhorsemen", "P1", 2, 0);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, sh.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(statusOf(next.cards[sh.instanceId], "EVASION")).toBeTruthy();
  });
});

describe("splash damage", () => {
  it("Dive Bomb hits the target 27 and splashes 11 to adjacent enemies only", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const griff = place(s, "gale_griffith", "P1", 2, 0);
    const main = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const adj = place(s, "leaf_alpha", "P2", 1, 2, { curHp: 40, maxHp: 40, curShields: 0 }); // adjacent to main
    const far = place(s, "leaf_alpha", "P2", 1, 3, { curHp: 40, maxHp: 40, curShields: 0 }); // 2 away
    const next = applyIntent(battleWith(s, griff.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: main.instanceId,
    });
    expect(next.cards[main.instanceId].curHp).toBe(40 - 27); // main hit
    expect(next.cards[adj.instanceId].curHp).toBe(40 - 11); // splash
    expect(next.cards[far.instanceId].curHp).toBe(40); // out of splash range
  });

  it("Griffith takes 10% recoil from Dive Bomb (27 dealt → 3 back)", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const griff = place(s, "gale_griffith", "P1", 2, 0);
    const startHp = s.cards[griff.instanceId].curHp; // 29
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, griff.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(40 - 27); // full hit
    expect(next.cards[griff.instanceId].curHp).toBe(startHp - 3); // round(27 * 10%)
  });
});

describe("Jungle Culling — STEALTH on kill", () => {
  it("Trinezer gains STEALTH when the cull kills", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const trin = place(s, "leaf_trinezer", "P1", 3, 0);
    const weak = place(s, "dusk_gool", "P2", 1, 0, { curHp: 5, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, trin.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: weak.instanceId,
    });
    expect(next.cards[weak.instanceId]).toBeUndefined(); // culled
    expect(statusOf(next.cards[trin.instanceId], "STEALTH")).toBeTruthy();
  });

  it("no STEALTH if the target survives the cull", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const trin = place(s, "leaf_trinezer", "P1", 3, 0);
    const tough = place(s, "dusk_gool", "P2", 1, 0, { curHp: 20, maxHp: 20, curShields: 0 });
    const next = applyIntent(battleWith(s, trin.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: tough.instanceId,
    });
    expect(statusOf(next.cards[trin.instanceId], "STEALTH")).toBeFalsy();
  });
});

describe("Talents — Dart Frog's Bleed Out", () => {
  it("loads darts so the next basic fires 3 hits; once per game, consumed on use", () => {
    const s = prepState();
    const frog = place(s, "leaf_dartfrog", "P1", 3, 0); // home row (no mid +1 DMG)
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    // Fire the Talent (free, uses the turn instead of attacking).
    const t1 = applyIntent(battleWith(s, frog.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "talent",
    });
    const f = t1.cards[frog.instanceId];
    expect(f.talentUsed).toBe(true);
    expect(effectiveBasicHits(f)).toBe(3); // 1 base + 2 loaded
    expect(canFireTalent(t1, frog.instanceId).ok).toBe(false); // once per game

    // Next basic fires as 3 darts (5 DMG each) and clears the load.
    const t2 = applyIntent(battleWith(t1, frog.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "basic",
      targetId: foe.instanceId,
    });
    expect(t2.cards[foe.instanceId].curHp).toBe(40 - 15); // 3 × 5
    expect(t2.cards[frog.instanceId].loadedHits).toBe(0); // spent
  });
});

describe("Talents — Hawk's Wind Surge", () => {
  it("grants +2 SP, once per game", () => {
    const s = prepState();
    const hawk = place(s, "gale_hawk", "P1", 2, 0);
    const before = effectiveSp(s, hawk);
    const next = applyIntent(battleWith(s, hawk.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "talent",
    });
    const h = next.cards[hawk.instanceId];
    expect(h.talentUsed).toBe(true);
    expect(effectiveSp(next, h)).toBe(before + 2);
    expect(canFireTalent(next, hawk.instanceId).ok).toBe(false); // once per game
  });
});

describe("The DEEPEST — Drilling Quake sinkhole", () => {
  it("applies DOT + BLIND + a −5 SP debuff to opponents", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const deepest = place(s, "bore_deepest", "P1", 2, 0);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, deepest.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    const f = next.cards[foe.instanceId];
    expect(statusOf(f, "DOT")).toBeTruthy();
    expect(statusOf(f, "BLIND")).toBeTruthy();
    expect(effectiveSp(next, f)).toBe(getDef("leaf_alpha").sp - 5); // −5 SP
  });

  it("has a 3-round cooldown — locked out until three Cleanups have ticked it", () => {
    const s = prepState();
    s.players.P1.magicPool = 10;
    const deepest = place(s, "bore_deepest", "P1", 2, 0);
    place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, deepest.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: undefined,
    });
    const d = next.cards[deepest.instanceId];
    expect(d.specialCooldown).toBe(4); // cooldown 3 (+1 for this round's Cleanup)
    // Tick three rounds of Cleanup worth of cooldown; still blocked each time.
    d.summonedThisRound = false;
    next.players.P1.magicPool = 10;
    for (let i = 0; i < 3; i++) {
      d.specialCooldown--; // simulate a Cleanup tick
      expect(canFireSpecial(battleWith(next, d.instanceId), d.instanceId).ok).toBe(false);
    }
    d.specialCooldown--; // 4th tick → 0
    expect(canFireSpecial(battleWith(next, d.instanceId), d.instanceId).ok).toBe(true);
  });
});

describe("Heir — Crowned self-buff + King Me cost reduction", () => {
  it("Crowned grants +5 DMG / +5 HP / +5 SP to itself", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const heir = place(s, "dawn_heir_tok", "P1", 2, 0, { curHp: 10, maxHp: 10 });
    const before = { dmg: effectiveDmg(s, heir), sp: effectiveSp(s, heir), max: heir.maxHp };
    const next = applyIntent(battleWith(s, heir.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: undefined,
    });
    const h = next.cards[heir.instanceId];
    expect(effectiveDmg(next, h)).toBe(before.dmg + 5);
    expect(effectiveSp(next, h)).toBe(before.sp + 5);
    expect(h.maxHp).toBe(before.max + 5);
    expect(h.curHp).toBe(15); // +5 HP healed with the max bump
    expect(next.players.P1.magicPool).toBe(2); // paid the base cost 3
  });

  it("King Me shaves 1 off Crowned's cost per kill", () => {
    const s = prepState();
    const heir = place(s, "dawn_heir_tok", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 1, 0, { curHp: 20 }); // keep P2 on the board
    const prey = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 1 }); // adjacent, dies
    basicAttack(s, heir.instanceId, prey.instanceId);
    expect(s.cards[heir.instanceId].specialCostReduction).toBe(1);
    expect(effectiveSpecialCost(s.cards[heir.instanceId], 3)).toBe(2);
    // With only 2 magic, the discounted Crowned is now castable.
    s.players.P1.magicPool = 2;
    expect(canFireSpecial(battleWith(s, heir.instanceId), heir.instanceId).ok).toBe(true);
  });
});

describe("Shadow Horsemen — charge move", () => {
  it("advances toward the enemy home with Shadow Charge", () => {
    const s = prepState();
    s.players.P1.magicPool = 6;
    const sh = place(s, "dusk_shadowhorsemen", "P1", 3, 0); // own home row
    const foe = place(s, "leaf_alpha", "P2", 1, 3, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, sh.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[sh.instanceId].pos!.row).toBeLessThan(3); // charged forward
  });
});

describe("Kraken — SeaC max-HP aura", () => {
  it("gives SeaC allies +4 effective max HP, others unaffected", () => {
    const s = prepState();
    const kraken = place(s, "aqua_kraken", "P1", 3, 0, { curHp: 42, maxHp: 42 });
    const nonSea = place(s, "leaf_alpha", "P1", 3, 1);
    expect(effectiveMaxHp(s, kraken)).toBe(46); // 42 + 4 (SeaC, self)
    expect(effectiveMaxHp(s, nonSea)).toBe(getDef("leaf_alpha").hp);
  });
});

describe("Pyrogon — Flame Engulf reach", () => {
  it("hits the row directly ahead — 3 wide, 1 deep (past melee range and the Home rule)", () => {
    const s = prepState();
    s.players.P1.magicPool = 4;
    const pyro = place(s, "pyro_pyrogon", "P1", 3, 1); // own home row
    const ahead = place(s, "leaf_alpha", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 }); // row ahead, same col
    const side = place(s, "leaf_alpha", "P2", 2, 0, { curHp: 20, maxHp: 20, curShields: 0 }); // row ahead, adj col
    const deep = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 20, maxHp: 20, curShields: 0 }); // 2 rows ahead → out
    const wide = place(s, "leaf_alpha", "P2", 2, 3, { curHp: 20, maxHp: 20, curShields: 0 }); // col 3 → too wide
    const next = applyIntent(battleWith(s, pyro.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: ahead.instanceId,
    });
    expect(next.cards[ahead.instanceId].curHp).toBe(13); // 20 − 7
    expect(next.cards[side.instanceId].curHp).toBe(13); // within spread 1
    expect(next.cards[deep.instanceId].curHp).toBe(20); // 2 rows ahead — not reached
    expect(next.cards[wide.instanceId].curHp).toBe(20); // outside the width
  });
});

describe("The DEEPEST — STEALTH lifecycle", () => {
  it("re-STEALTHs after Drilling Quake (untargetable), but a basic attack leaves it exposed", () => {
    // Special → regains STEALTH.
    const s = prepState();
    s.players.P1.magicPool = 5;
    const d = place(s, "bore_deepest", "P1", 2, 0);
    const foe = place(s, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const afterSpecial = applyIntent(battleWith(s, d.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    const dS = afterSpecial.cards[d.instanceId];
    expect(statusOf(dS, "STEALTH")).toBeTruthy();
    expect(canTarget(afterSpecial, afterSpecial.cards[foe.instanceId], dS)).toBe(false);

    // Basic attack → no re-STEALTH; the keyword is broken for the round.
    const s2 = prepState();
    const d2 = place(s2, "bore_deepest", "P1", 2, 0);
    const foe2 = place(s2, "leaf_alpha", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const afterBasic = applyIntent(battleWith(s2, d2.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: foe2.instanceId,
    });
    const dB = afterBasic.cards[d2.instanceId];
    expect(statusOf(dB, "STEALTH")).toBeFalsy();
    expect(canTarget(afterBasic, afterBasic.cards[foe2.instanceId], dB)).toBe(true);
  });
});

describe("Elecdroid — Light Slasher combo", () => {
  it("chains to the next enemy on a kill, raising the rest of the combo (special-only)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const elec = place(s, "bolt_elecdroid", "P1", 2, 0);
    const weak = place(s, "dusk_gool", "P2", 1, 0, { curHp: 5, maxHp: 5, curShields: 0 }); // dies to hit 1
    const chained = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    const next = applyIntent(battleWith(s, elec.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: weak.instanceId,
    });
    expect(next.cards[weak.instanceId]).toBeUndefined(); // killed by hit 1 (5)
    // remaining hits chain to `chained`, each +5 from the kill: 10 + 10 + 15 = 35.
    expect(next.cards[chained.instanceId].curHp).toBe(40 - 35);
    // the combo's raise never persisted (no permanent DMG bonus from it).
    expect(next.cards[elec.instanceId].dmgBonus).toBe(0);
  });
});
