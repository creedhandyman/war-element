// Milestone 4: the combat pipeline — worked examples from the rules FAQ.

import { describe, expect, it } from "vitest";
import { basicAttack, resolveHit } from "../combat";
import { advance } from "../phases";
import { atCleanup, place, prepState, seedForCoins, statusOf } from "./helpers";
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
    // attacker in its home row: printed damage, no King-of-the-Hill bonus
    const a = place(s, "leaf_sumerose", "P1", 3, 0, { curHp: 10, maxHp: 13 }); // LIFESTEAL, dmg 7
    const t = place(s, "dusk_gool", "P2", 2, 0, { curHp: 13, maxHp: 13, curShields: 0 });
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
    const a = place(s, "leaf_greegon", "P1", 3, 0, { curHp: 14, maxHp: 17, curShields: 0 }); // 1 hit × 4 dmg
    const t = place(s, "bore_clubber", "P2", 2, 0, { curHp: 7, maxHp: 7, curShields: 2 }); // REFLECT 1
    basicAttack(s, a.instanceId, t.instanceId);
    expect(a.curHp).toBe(13); // one landed hit → REFLECT 1 back
  });

  it("different status kinds coexist; re-applying the same kind refreshes it", () => {
    const s = duel();
    const a = place(s, "leaf_stickviper", "P1", 2, 0); // BLEED 2 (2r) on hit
    const t = place(s, "dusk_gool", "P2", 2, 1, {
      curHp: 13,
      maxHp: 13,
      status: { kind: "FRIGHTEN", duration: 2, power: 0, source: "DUSK" },
    });
    basicAttack(s, a.instanceId, t.instanceId);
    // BLEED joins FRIGHTEN — different kinds stack side by side
    expect(t.statuses.map((x) => x.kind).sort()).toEqual(["BLEED", "FRIGHTEN"]);
    // tick BLEED down, then hit again: same kind REFRESHES (no second entry)
    t.statuses.find((x) => x.kind === "BLEED")!.duration = 1;
    basicAttack(s, a.instanceId, t.instanceId);
    const bleeds = t.statuses.filter((x) => x.kind === "BLEED");
    expect(bleeds).toHaveLength(1);
    expect(bleeds[0].duration).toBe(2); // refreshed back to the rider's 2 rounds
  });

  it("Lingering Venom poisons the killer instead of hitting it", () => {
    // It used to slap the killer for 10 PEN on the spot. Now there is no impact
    // damage at all — the killer walks away untouched but carrying the venom.
    const s = duel();
    const killer = place(s, "leaf_greegon", "P1", 2, 0, { curHp: 17, maxHp: 17, curShields: 2 });
    const widow = place(s, "dusk_widowbite", "P2", 2, 1, { curHp: 3 });
    basicAttack(s, killer.instanceId, widow.instanceId); // 4 dmg kills it
    expect(s.cards[widow.instanceId]).toBeUndefined();
    expect(killer.curHp).toBe(17); // no instant retaliation any more
    expect(killer.curShields).toBe(2);
    const dot = statusOf(s.cards[killer.instanceId], "DOT");
    expect(dot?.power).toBe(5);
    expect(dot?.duration).toBe(3);
  });

  it("...and the venom actually ticks — 15 over three rounds", () => {
    // A DOT that never resolves is the whole point of the card, so measure it
    // rather than trusting the status was attached. Deliberately NOT a LEAF
    // killer: Photosynthesis + REGEN heal 3 a round, which nets the venom down
    // to 2 a tick and makes the number say nothing about the venom itself.
    const s = duel();
    const killer = place(s, "dusk_vamp", "P1", 2, 0, { curHp: 99, maxHp: 99, curShields: 0 });
    const widow = place(s, "dusk_widowbite", "P2", 2, 1, { curHp: 3 });
    basicAttack(s, killer.instanceId, widow.instanceId);
    let n = s;
    for (let i = 0; i < 3; i++) n = advance(atCleanup(n));
    expect(99 - n.cards[killer.instanceId].curHp).toBe(15);
    expect(statusOf(n.cards[killer.instanceId], "DOT")).toBeUndefined(); // burnt out
  });

  it("a killer OUT of its reach walks away clean", () => {
    // inRangeOnly: Widowbite is Melee, so its grudge reaches one slot. Picking
    // it off from further away is now the safe way to handle it.
    const s = duel();
    const sniper = place(s, "dawn_sparkle", "P1", 0, 3, { curHp: 30, maxHp: 30 });
    const widow = place(s, "dusk_widowbite", "P2", 2, 1, { curHp: 3 });
    basicAttack(s, sniper.instanceId, widow.instanceId);
    expect(s.cards[widow.instanceId]).toBeUndefined();
    expect(statusOf(s.cards[sniper.instanceId], "DOT")).toBeUndefined();
  });

  it("the venom can still finish a wounded killer, just not instantly", () => {
    const s = duel();
    const killer = place(s, "dusk_crow", "P1", 2, 0, { curHp: 4, maxHp: 20 });
    const widow = place(s, "dusk_widowbite", "P2", 2, 1, { curHp: 3 });
    const r = basicAttack(s, killer.instanceId, widow.instanceId);
    expect(s.cards[killer.instanceId]).toBeDefined(); // survives the kill itself
    expect(r?.attackerDied).toBeFalsy();
    const n = advance(atCleanup(s)); // first venom tick: 5 vs 4 HP
    expect(n.cards[killer.instanceId]).toBeUndefined();
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

describe("on-death retaliation only reaches killers the corpse could have hit", () => {
  it("Crock's Deathroll thrashes an adjacent killer", () => {
    const s = prepState();
    const killer = place(s, "dusk_vamp", "P1", 2, 0, { curHp: 30, maxHp: 30, curShields: 0 });
    const crock = place(s, "bore_crock", "P2", 2, 1, { curHp: 1, curShields: 0 });
    basicAttack(s, killer.instanceId, crock.instanceId);
    expect(s.cards[crock.instanceId]).toBeUndefined();
    expect(30 - s.cards[killer.instanceId].curHp).toBe(5);
  });

  it("...but never a killer it could not have reached", () => {
    // A death roll is a melee thrash. It was landing on ranged killers clear
    // across the board, which made picking Crock off from range strictly worse
    // than walking up to it.
    const s = prepState();
    const sniper = place(s, "dawn_sparkle", "P1", 0, 3, { curHp: 30, maxHp: 30, curShields: 0 });
    const crock = place(s, "bore_crock", "P2", 2, 1, { curHp: 1, curShields: 0 });
    basicAttack(s, sniper.instanceId, crock.instanceId);
    expect(s.cards[crock.instanceId]).toBeUndefined();
    expect(s.cards[sniper.instanceId].curHp).toBe(30); // untouched
  });
});
