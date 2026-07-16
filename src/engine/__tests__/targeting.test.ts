// Milestone 3: targeting — melee rows, ranged, Home Slot Rule, FLYING, STEALTH.

import { describe, expect, it } from "vitest";
import { canTarget, previewOnSummonArea, validTargets } from "../rules";
import { getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import type { Pos } from "../types";

const key = (p: Pos) => `${p.row},${p.col}`;

describe("previewOnSummonArea (placement preview)", () => {
  it("corridor blast (Pyrogon) → the 3 tiles in the row directly ahead", () => {
    const s = prepState();
    const area = previewOnSummonArea(s, getDef("pyro_pyrogon"), "P1", { row: 3, col: 1 });
    expect(new Set(area.map(key))).toEqual(new Set(["2,0", "2,1", "2,2"]));
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
