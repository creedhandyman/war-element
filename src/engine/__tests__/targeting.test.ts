// Milestone 3: targeting — melee rows, ranged, Home Slot Rule, FLYING, STEALTH.

import { describe, expect, it } from "vitest";
import { canTarget, previewOnSummonArea, rangedCanSee, validSpecialTargets, validTargets } from "../rules";
import { getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import type { Pos } from "../types";

const key = (p: Pos) => `${p.row},${p.col}`;

describe("previewOnSummonArea (placement preview)", () => {
  it("corridor blast (Pyrogon) → the 3-wide corridor, 2 rows deep (matches its Special)", () => {
    const s = prepState();
    const area = previewOnSummonArea(s, getDef("pyro_pyrogon"), "P1", { row: 3, col: 1 });
    expect(new Set(area.map(key))).toEqual(new Set(["2,0", "2,1", "2,2", "1,0", "1,1", "1,2"]));
  });

  it("no-spread on-summon (Krakler) → the reachable enemy cards (king reach)", () => {
    const s = prepState();
    const near = place(s, "dusk_gool", "P2", 2, 1); // king-adjacent to home (3,1)
    place(s, "dusk_vamp", "P2", 0, 0); // far away — out of a melee's reach
    const area = previewOnSummonArea(s, getDef("aqua_krakler"), "P1", { row: 3, col: 1 });
    expect(area.map(key)).toEqual([key(near.pos!)]);
  });

  it("ally / no-on-summon cards preview nothing", () => {
    const s = prepState();
    expect(previewOnSummonArea(s, getDef("leaf_greegon"), "P1", { row: 3, col: 1 })).toHaveLength(0);
  });
});

describe("melee vs ranged reach", () => {
  it("melee hits the 8 adjacent squares only (king reach)", () => {
    const s = prepState();
    const melee = place(s, "leaf_alpha", "P1", 2, 1); // Warrior, melee
    const beside = place(s, "dusk_vamp", "P2", 2, 2); // same row, adjacent col
    const diagonal = place(s, "dusk_gool", "P2", 1, 0); // adjacent row + col
    const farCol = place(s, "dusk_ghastly", "P2", 1, 3); // adjacent row, 2 cols away
    const farRow = place(s, "bore_smith", "P2", 0, 1); // two rows away — also P2 home
    expect(canTarget(s, melee, beside)).toBe(true);
    expect(canTarget(s, melee, diagonal)).toBe(true);
    expect(canTarget(s, melee, farCol)).toBe(false); // no cross-board lunges
    expect(canTarget(s, melee, farRow)).toBe(false);
  });

  it("ranged hits any slot (columns never matter)", () => {
    const s = prepState();
    const ranged = place(s, "leaf_fallona", "P1", 2, 0); // Mage
    const far = place(s, "dusk_vamp", "P2", 0, 3);
    expect(canTarget(s, ranged, far)).toBe(true);
  });
});

describe("Home Slot Targeting Rule", () => {
  it("a card in its own Home row cannot target the enemy Home row", () => {
    const s = prepState();
    const mage = place(s, "leaf_fallona", "P1", 3, 0); // ranged, in own home
    const homeSitter = place(s, "dusk_vamp", "P2", 0, 0); // in P2 home
    const midSitter = place(s, "dusk_gool", "P2", 1, 1);
    expect(canTarget(s, mage, homeSitter)).toBe(false); // camping is denied
    expect(canTarget(s, mage, midSitter)).toBe(true); // mid rows are fair game
  });

  it("from a Mid row (or inside the enemy Home row) the enemy Home is targetable", () => {
    const s = prepState();
    const inMid = place(s, "leaf_fallona", "P1", 2, 0); // ranged
    const inTheirHome = place(s, "pyro_firebird", "P1", 0, 1); // melee, beside the sitter
    const homeSitter = place(s, "dusk_gool", "P2", 0, 0);
    expect(canTarget(s, inMid, homeSitter)).toBe(true);
    expect(canTarget(s, inTheirHome, homeSitter)).toBe(true);
  });

  it("an invader in MY home row is targetable from my home row (not an opp-home slot)", () => {
    const s = prepState();
    const defender = place(s, "leaf_alpha", "P1", 3, 0);
    const invader = place(s, "dusk_vamp", "P2", 3, 1); // standing on P1 home, beside us
    expect(canTarget(s, defender, invader)).toBe(true);
  });
});

describe("ignoresHomeRule (Pumpkin's Catapult)", () => {
  it("may snipe the enemy Home row from its own Home row", () => {
    const s = prepState();
    const pumpkin = place(s, "dusk_pumpkin", "P2", 0, 0); // in its own home
    const normal = place(s, "dusk_gool", "P2", 0, 1); // ordinary ranged
    const camper = place(s, "leaf_fallona", "P1", 3, 0); // in P1's home row
    expect(canTarget(s, pumpkin, camper)).toBe(true); // Catapult ignores the rule
    expect(canTarget(s, normal, camper)).toBe(false); // everyone else obeys it
  });
});

describe("FLYING & STEALTH", () => {
  it("FLYING is immune to melee, ranged hits it", () => {
    const s = prepState();
    const melee = place(s, "dusk_vamp", "P2", 1, 0);
    const ranged = place(s, "bore_krysteel", "P2", 1, 1);
    const flyer = place(s, "pyro_fenrir", "P1", 2, 0); // FLYING
    expect(canTarget(s, melee, flyer)).toBe(false);
    expect(canTarget(s, ranged, flyer)).toBe(true);
  });

  it("STEALTH is untargetable until it attacks, then targetable that round", () => {
    const s = prepState();
    const enemy = place(s, "dusk_vamp", "P2", 2, 0);
    const sneak = place(s, "leaf_darth", "P1", 2, 1); // Shadow Step: STEALTH
    expect(canTarget(s, enemy, sneak)).toBe(false);
    sneak.attackedThisRound = true; // it attacked → revealed for the round
    expect(canTarget(s, enemy, sneak)).toBe(true);
  });

  it("validTargets excludes allies and off-board cards", () => {
    const s = prepState();
    const me = place(s, "leaf_fallona", "P1", 2, 0);
    place(s, "leaf_alpha", "P1", 2, 1);
    place(s, "dusk_gool", "P2", 1, 1);
    const ids = validTargets(s, me.instanceId).map((t) => t.defId);
    expect(ids).toEqual(["dusk_gool"]);
  });
});

describe("ranged reach — 2 king-steps, blocked on straight lines", () => {
  it("reaches every square within 2 king-steps, knight-shapes included", () => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 2, 1, { autoMode: "manual" }); // Ranged
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 1 }, "P2")).toBe(true); // 2 straight
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 3 }, "P2")).toBe(true); // 2 diagonal
    // Knight-shaped: one row over, two columns across. Ray-only targeting left
    // these permanently unhittable though they sit 2 steps away — the hole this
    // rule was widened to close.
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 2 }, "P2")).toBe(true);
    expect(rangedCanSee(s, me.pos!, { row: 0, col: 0 }, "P2")).toBe(true);
  });

  it("3 king-steps is still out of reach", () => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 0, 0, { autoMode: "manual" });
    expect(rangedCanSee(s, me.pos!, { row: 2, col: 2 }, "P2")).toBe(true);  // exactly 2
    expect(rangedCanSee(s, me.pos!, { row: 3, col: 0 }, "P2")).toBe(false); // 3 straight
    expect(rangedCanSee(s, me.pos!, { row: 1, col: 3 }, "P2")).toBe(false); // 3 across
  });

  it("the reported gap: a Ranger on r1c3 can shoot r2c1", () => {
    // Straight from a real game — Dart Frog on r1c3, Rhe on r2c1 and Hillbilly
    // on r0c1 both two king-steps away, and Basic Attack greyed out entirely
    // because neither enemy happened to sit on a ray.
    const s = prepState();
    const frog = place(s, "leaf_dartfrog", "P1", 1, 3, { autoMode: "manual" });
    const rhe = place(s, "bore_rhe", "P2", 2, 1);
    const hillbilly = place(s, "bore_hillbilly", "P2", 0, 1);
    const far = place(s, "aqua_blackbeard", "P2", 2, 0); // 3 columns across — still out
    const ids = validTargets(s, frog.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(rhe.instanceId);
    expect(ids).toContain(hillbilly.instanceId);
    expect(ids).not.toContain(far.instanceId);
  });

  it("knight-shaped shots arc — nothing can screen them", () => {
    // No single square sits between r1c3 and r2c1, so there is nothing for a
    // body to stand on. Occupying both plausible paths must not block it.
    const s = prepState();
    const frog = place(s, "leaf_dartfrog", "P1", 1, 3, { autoMode: "manual" });
    const rhe = place(s, "bore_rhe", "P2", 2, 1);
    place(s, "leaf_alpha", "P1", 1, 2);
    place(s, "leaf_greegon", "P1", 2, 2);
    expect(validTargets(s, frog.instanceId).map((t) => t.instanceId)).toContain(rhe.instanceId);
  });

  it("a body on the ray blocks the shot beyond it — and IS the target", () => {
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
    const near = place(s, "leaf_alpha", "P1", 2, 1);  // directly ahead, 1 away
    const far = place(s, "leaf_greegon", "P1", 1, 1); // 2 ahead, behind `near`
    const ids = validTargets(s, me.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(near.instanceId);     // the blocker is hittable
    expect(ids).not.toContain(far.instanceId);  // screened
  });

  it("allies do NOT block — you shoot straight past your own front line", () => {
    // Chess would screen here, but you advance into your own firing lane
    // constantly, and an archer silently disarmed by its own tank reads as a
    // bug rather than a tactic.
    const s = prepState();
    const me = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
    place(s, "dusk_gool", "P2", 2, 1); // an ALLY standing squarely in the lane
    const far = place(s, "leaf_greegon", "P1", 1, 1);
    expect(validTargets(s, me.instanceId).map((t) => t.instanceId)).toContain(far.instanceId);
  });

  it("an ally and an enemy on the same square-count behave differently", () => {
    // Same geometry, same distance — only the blocker's side changes.
    const build = (blockerOwner: "P1" | "P2") => {
      const s = prepState();
      const me = place(s, "dusk_ghastly", "P2", 3, 1, { autoMode: "manual" });
      place(s, blockerOwner === "P2" ? "dusk_gool" : "leaf_alpha", blockerOwner, 2, 1);
      const far = place(s, "leaf_greegon", "P1", 1, 1);
      return validTargets(s, me.instanceId).map((t) => t.instanceId).includes(far.instanceId);
    };
    expect(build("P2")).toBe(true);  // ally in the lane — shot goes past
    expect(build("P1")).toBe(false); // enemy in the lane — shot is stopped
  });

  it("specials are exempt — they keep the full board", () => {
    const s = prepState();
    s.players.P2.magicPool = 20;
    const me = place(s, "dusk_ghastly", "P2", 3, 0, { autoMode: "manual" });
    const offRay = place(s, "leaf_greegon", "P1", 1, 3); // off-ray AND 3 away
    expect(validTargets(s, me.instanceId).map((t) => t.instanceId)).not.toContain(offRay.instanceId);
    // …but the Special still reaches it.
    expect(validSpecialTargets(s, me.instanceId).map((t) => t.instanceId)).toContain(offRay.instanceId);
  });

  it("melee is untouched — still king's move, still 1 space", () => {
    const s = prepState();
    const me = place(s, "leaf_sticks", "P1", 2, 1, { autoMode: "manual" }); // Melee
    const beside = place(s, "dusk_gool", "P2", 1, 2);
    const twoAway = place(s, "dusk_vamp", "P2", 0, 1); // on a ray, but 2 out
    const ids = validTargets(s, me.instanceId).map((t) => t.instanceId);
    expect(ids).toContain(beside.instanceId);
    expect(ids).not.toContain(twoAway.instanceId);
  });
});
