// Milestone 4: the combat pipeline — worked examples from the rules FAQ.

import { describe, expect, it } from "vitest";
import { basicAttack, resolveHit } from "../combat";
import { place, prepState, seedForCoins } from "./helpers";
import type { GameState } from "../types";

function duel(seed = 42): GameState {
  return prepState(seed);
}

describe("shield gate (rules FAQ worked example)", () => {
  it("10 DMG vs 12 HP / 5 shields -> 7 HP / 4 shields; next hit -> 1 HP / 3 shields", () => {
    const s = duel();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 12, maxHp: 12, curShields: 5 });
    resolveHit(s, a, t, { kind: "special", dmg: 10, hits: 1, pen: false, crit: false });
    expect(t.curHp).toBe(7);
    expect(t.curShields).toBe(4);
    resolveHit(s, a, t, { kind: "special", dmg: 10, hits: 1, pen: false, crit: false });
    expect(t.curHp).toBe(1);
    expect(t.curShields).toBe(3);
  });

  it("a 0-damage landed hit still strips exactly 1 shield", () => {
    const s = duel();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 10, maxHp: 10, curShields: 5 });
    resolveHit(s, a, t, { kind: "special", dmg: 2, hits: 1, pen: false, crit: false });
    expect(t.curHp).toBe(10); // fully gated
    expect(t.curShields).toBe(4); // but a shield still drops
  });

  it("multi-hit shreds shields: 2 DMG x5 vs 5 shields strips all 5", () => {
    const s = duel();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 5 });
    resolveHit(s, a, t, { kind: "special", dmg: 2, hits: 5, pen: false, crit: false });
    expect(t.curShields).toBe(0);
    // sub-hits re-run the gate against the falling count: 2-5,2-4,2-3,2-2,2-1 -> 0,0,0,0,1
    expect(t.curHp).toBe(19);
  });
});

describe("PEN / BLOCK / CRIT", () => {
  it("PEN skips the gate: full damage to HP, no shield stripped", () => {
    const s = duel();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 5 });
    resolveHit(s, a, t, { kind: "special", dmg: 10, hits: 1, pen: true, crit: false });
    expect(t.curHp).toBe(10);
    expect(t.curShields).toBe(5);
  });

  it("BLOCK reduces before shields, and still applies to PEN", () => {
    const s = duel();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "bore_armadillo", "P2", 2, 1, { curHp: 15, maxHp: 15, curShields: 2 }); // BLOCK 2
    resolveHit(s, a, t, { kind: "special", dmg: 6, hits: 1, pen: false, crit: false });
    // 6 - BLOCK 2 = 4, gate -2 shields = 2 to HP, strip 1
    expect(t.curHp).toBe(13);
    expect(t.curShields).toBe(1);
    resolveHit(s, a, t, { kind: "special", dmg: 6, hits: 1, pen: true, crit: false });
    // PEN: 6 - BLOCK 2 = 4 straight to HP, shields untouched
    expect(t.curHp).toBe(9);
    expect(t.curShields).toBe(1);
  });

  it("CRIT does nothing while the target has shields", () => {
    const s = duel();
    s.rngState = seedForCoins(true); // heads queued up — must NOT be consumed
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 2 });
    const rngBefore = s.rngState;
    resolveHit(s, a, t, { kind: "basic", dmg: 5, hits: 1, pen: false, crit: true });
    expect(t.curHp).toBe(17); // 5-2 gate, no doubling
    expect(s.rngState).toBe(rngBefore); // no crit coin was even flipped
  });

  it("CRIT doubles on heads once shields are gone", () => {
    const s = duel();
    s.rngState = seedForCoins(true);
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    resolveHit(s, a, t, { kind: "basic", dmg: 5, hits: 1, pen: false, crit: true });
    expect(t.curHp).toBe(10); // doubled
  });

  it("CRIT tails deals printed damage", () => {
    const s = duel();
    s.rngState = seedForCoins(false);
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 20, maxHp: 20, curShields: 0 });
    resolveHit(s, a, t, { kind: "basic", dmg: 5, hits: 1, pen: false, crit: true });
    expect(t.curHp).toBe(15);
  });
});

describe("EVASION", () => {
  it("a dodge negates the hit entirely — no damage, no shield strip", () => {
    const s = duel();
    s.rngState = seedForCoins(true); // heads = dodge
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_silkstalker", "P2", 2, 1, { curHp: 7, maxHp: 7, curShields: 2 });
    const r = resolveHit(s, a, t, { kind: "special", dmg: 9, hits: 1, pen: false, crit: false });
    expect(r.dodgedHits).toBe(1);
    expect(t.curHp).toBe(7);
    expect(t.curShields).toBe(2);
  });

  it("on tails the hit lands normally", () => {
    const s = duel();
    s.rngState = seedForCoins(false);
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_silkstalker", "P2", 2, 1, { curHp: 7, maxHp: 7, curShields: 0 });
    resolveHit(s, a, t, { kind: "special", dmg: 3, hits: 1, pen: false, crit: false });
    expect(t.curHp).toBe(4);
  });
});

describe("on-hit keywords", () => {
  it("LIFESTEAL heals damage dealt to HP, capped at max HP", () => {
    const s = duel();
    const a = place(s, "leaf_sumerose", "P1", 2, 0, { curHp: 10, maxHp: 13 }); // LIFESTEAL, dmg 7
    const t = place(s, "dusk_gool", "P2", 2, 1, { curHp: 13, maxHp: 13, curShields: 0 });
    basicAttack(s, a.instanceId, t.instanceId);
    expect(t.curHp).toBe(6);
    expect(a.curHp).toBe(13); // healed 7 but capped at maxHp 13 (was 10, +3 used)
  });

  it("DRAIN permanently steals 1 max HP", () => {
    const s = duel();
    const a = place(s, "dusk_vamp", "P2", 2, 1); // DRAIN, dmg 2, maxHp 6
    const t = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 17, maxHp: 17 });
    basicAttack(s, a.instanceId, t.instanceId);
    expect(t.maxHp).toBe(16);
    expect(a.maxHp).toBe(7);
  });

  it("REFLECT X returns X per landed hit (through the attacker's own gate)", () => {
    const s = duel();
    const a = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 14, maxHp: 14, curShields: 0 }); // dmg 4
    const t = place(s, "bore_clubber", "P2", 2, 1, { curHp: 7, maxHp: 7, curShields: 2 }); // REFLECT 1
    basicAttack(s, a.instanceId, t.instanceId);
    expect(a.curHp).toBe(13); // took REFLECT 1
  });

  it("basic-attack status rider applies on a landed hit (newest overwrites)", () => {
    const s = duel();
    const a = place(s, "leaf_stickviper", "P1", 2, 0); // BLEED 2 on hit
    const t = place(s, "dusk_gool", "P2", 2, 1, {
      curHp: 13,
      maxHp: 13,
      status: { kind: "FRIGHTEN", duration: 2, power: 0, source: "DUSK" },
    });
    basicAttack(s, a.instanceId, t.instanceId);
    expect(t.status?.kind).toBe("BLEED"); // overwrote FRIGHTEN — 1 status max
    expect(t.status?.power).toBe(2);
  });

  it("on-death retaliation: Widowbite's Lingering Venom hits the killer for 10 PEN", () => {
    const s = duel();
    const killer = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 17, maxHp: 17, curShields: 2 });
    const widow = place(s, "dusk_widowbite", "P2", 2, 1, { curHp: 3 });
    const r = basicAttack(s, killer.instanceId, widow.instanceId); // 4 dmg kills it
    expect(s.cards[widow.instanceId]).toBeUndefined();
    // 10 PEN back: straight to HP, shields untouched
    expect(killer.curHp).toBe(7);
    expect(killer.curShields).toBe(2);
    expect(r?.targetDied).toBe(true);
  });

  it("on-death retaliation can kill the killer (and stops there — no chains)", () => {
    const s = duel();
    const killer = place(s, "dusk_crow", "P1", 2, 0, { curHp: 1 }); // Crow also has onDeath
    const widow = place(s, "dusk_widowbite", "P2", 2, 1, { curHp: 3 });
    const r = basicAttack(s, killer.instanceId, widow.instanceId);
    expect(s.cards[widow.instanceId]).toBeUndefined();
    expect(s.cards[killer.instanceId]).toBeUndefined(); // died to the venom
    expect(r?.attackerDied).toBe(true);
  });

  it("a lethal volley kills and removes the card from the board", () => {
    const s = duel();
    const a = place(s, "pyro_ember_scorpion", "P1", 2, 0); // dmg 9
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 6, maxHp: 6 });
    const r = basicAttack(s, a.instanceId, t.instanceId);
    expect(r?.targetDied).toBe(true);
    expect(s.cards[t.instanceId]).toBeUndefined();
  });
});
