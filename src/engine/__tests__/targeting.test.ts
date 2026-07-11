// Milestone 3: targeting — melee rows, ranged, Home Slot Rule, FLYING, STEALTH.

import { describe, expect, it } from "vitest";
import { canTarget, validTargets } from "../rules";
import { place, prepState } from "./helpers";

describe("melee vs ranged reach", () => {
  it("melee hits same row and adjacent row only", () => {
    const s = prepState();
    const melee = place(s, "leaf_alpha", "P1", 2, 0); // Warrior, melee
    const near = place(s, "dusk_vamp", "P2", 1, 3); // adjacent row
    const same = place(s, "dusk_gool", "P2", 2, 3); // same row
    const far = place(s, "dusk_ghastly", "P2", 0, 0); // two rows away — also P2 home
    expect(canTarget(s, melee, near)).toBe(true);
    expect(canTarget(s, melee, same)).toBe(true);
    expect(canTarget(s, melee, far)).toBe(false);
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
    const inMid = place(s, "leaf_fallona", "P1", 2, 0);
    const inTheirHome = place(s, "pyro_firebird", "P1", 0, 3);
    const homeSitter = place(s, "dusk_gool", "P2", 0, 0);
    expect(canTarget(s, inMid, homeSitter)).toBe(true);
    expect(canTarget(s, inTheirHome, homeSitter)).toBe(true);
  });

  it("an invader in MY home row is targetable from my home row (not an opp-home slot)", () => {
    const s = prepState();
    const defender = place(s, "leaf_alpha", "P1", 3, 0);
    const invader = place(s, "dusk_vamp", "P2", 3, 2); // standing on P1 home
    expect(canTarget(s, defender, invader)).toBe(true);
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
    const enemy = place(s, "leaf_alpha", "P1", 2, 0);
    const sneak = place(s, "dusk_widowbite", "P2", 2, 1); // STEALTH
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
