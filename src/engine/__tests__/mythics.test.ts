// Element-core Mythics + the token-spawn mechanic that several of them use.

import { describe, expect, it } from "vitest";
import { directDamage } from "../combat";
import { advance, applyIntent } from "../phases";
import { canTarget } from "../rules";
import { boardCards, effectiveDmg, effectiveSp } from "../state";
import { getDef } from "../../data/cards";
import { atCleanup, place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("token spawning", () => {
  it("Trinezer's Reptilian Screech spawns 1 Reptilian at end of round", () => {
    const s = prepState();
    const trin = place(s, "leaf_trinezer", "P1", 2, 0); // mid row → open adjacent slots
    place(s, "leaf_alpha", "P2", 0, 0); // keep P2 non-empty
    const next = advance(atCleanup(s));
    const reps = boardCards(next, "P1").filter((c) => c.defId === "leaf_reptilian_tok");
    expect(reps).toHaveLength(1);
    // lands in king's reach of Trinezer
    const t = next.cards[trin.instanceId];
    expect(Math.abs(reps[0].pos!.row - t.pos!.row)).toBeLessThanOrEqual(1);
    expect(Math.abs(reps[0].pos!.col - t.pos!.col)).toBeLessThanOrEqual(1);
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

  it("Pressure: The DEEPEST tops BORE allies up to +2 shields each round", () => {
    const s = prepState();
    place(s, "bore_deepest", "P1", 2, 1); // Pressure holder (BORE)
    const boreAlly = place(s, "bore_clubber", "P1", 2, 0, { curShields: 0 });
    const nonBore = place(s, "leaf_alpha", "P1", 3, 0, { curShields: 0 });
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 non-empty
    const next = advance(atCleanup(s));
    expect(next.cards[boreAlly.instanceId].curShields).toBe(getDef("bore_clubber").shields + 2);
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
