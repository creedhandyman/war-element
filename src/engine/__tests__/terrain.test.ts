// §4: every node in a region runs that element's Field spell permanently, for
// BOTH sides, at no cost. It shipped as a line of UI copy — "Terrain: Lushfield
// — runs all battle, both sides" — with nothing behind it: `fields` was only
// ever populated by a cast spell, so the terrain never existed in a battle.

import { describe, expect, it } from "vitest";
import { advance, applyIntent, canCastSpell, createInitialState, getSpell, SPELLS } from "../index";
import { REGIONS } from "../../data/story";
import type { GameState } from "../index";

const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

const lushfield = SPELLS.find((s) => s.name === "Lushfield")!.id;
/** Some other element's Field, so "cast one of your own" is actually testable —
 *  a spellbook derived from an all-LEAF deck would only ever hold LEAF spells. */
const otherField = SPELLS.find((s) => s.kind === "field" && s.id !== lushfield)!;

describe("standing terrain", () => {
  it("is absent from a battle that never asked for one", () => {
    expect(createInitialState(3, DECK, DECK, [], [], [], 4).fields).toEqual([]);
  });

  it("runs for BOTH sides, not just the caster's", () => {
    // fieldBonus keys on the card's OWN owner, so a single shared entry would
    // leave half the board feeling nothing.
    const s = createInitialState(3, DECK, DECK, [], [], [], 4, undefined, lushfield);
    expect(s.fields).toHaveLength(2);
    expect(s.fields.map((f) => f.owner).sort()).toEqual(["P1", "P2"]);
    for (const f of s.fields) expect(f.element).toBe("LEAF");
  });

  it("carries the spell's actual buff", () => {
    const s = createInitialState(3, DECK, DECK, [], [], [], 4, undefined, lushfield);
    const printed = getSpell(lushfield)!.field!;
    for (const f of s.fields) expect(f.regen).toBe(printed.regen);
  });

  it("never expires, however long the battle runs", () => {
    // The whole difference from a cast field: Cleanup ticks those down and
    // removes them at zero. Terrain is the battlefield, not a spell.
    let s: GameState = createInitialState(3, DECK, DECK, [], [], [], 4, undefined, lushfield);
    for (let i = 0; i < 2500 && s.phase !== "gameover"; i++) s = advance(s);
    expect(s.round, "battle was too short to prove anything").toBeGreaterThan(4);
    expect(s.fields).toHaveLength(2);
    for (const f of s.fields) expect(f.permanent).toBe(true);
  });

  it("leaves a cast field expiring normally", () => {
    // Nothing above may make ordinary Field spells permanent by accident.
    for (const sp of SPELLS.filter((x) => x.kind === "field"))
      expect(sp.field!.rounds, `${sp.name}`).toBeGreaterThan(0);
  });

  it("has a real field spell behind every region's terrain", () => {
    // The lookup App does at battle start, checked for all eight so a region
    // cannot silently fight on bare ground.
    for (const r of REGIONS) {
      const found = SPELLS.find((sp) => sp.kind === "field" && sp.name === r.terrain);
      expect(found, `${r.id}: no field spell named "${r.terrain}"`).toBeTruthy();
      expect(found!.element).toBe(r.element);
    }
  });
});


describe("terrain and cast Field spells coexist", () => {
  /** A live game standing on Lushfield, run forward to P1's prep turn — the one
   *  moment a spell can legally be cast. */
  function onTerrain() {
    let s: GameState = createInitialState(
      3, DECK, DECK, ["P1"], [lushfield, otherField.id], [], 4, undefined, lushfield);
    s.players.P1.mulliganDone = true;
    for (let i = 0; i < 200; i++) {
      if (s.phase === "prep" && s.prep?.priority === "P1") break;
      s = advance(s);
    }
    s.players.P1.magicPool = 20;
    return s;
  }

  it("still lets a player cast a Field of their own", () => {
    // The regression this nearly shipped as: the "one Field per owner" rule
    // counted the terrain, so seeding it made EVERY field spell in the game
    // uncastable for the whole of Story Mode.
    const s = onTerrain();
    expect(canCastSpell(s, "P1", otherField.id).ok, canCastSpell(s, "P1", otherField.id).reason).toBe(true);
  });

  it("refuses the Field that is already the terrain", () => {
    const s = onTerrain();
    const check = canCastSpell(s, "P1", lushfield);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/already the terrain/i);
  });

  it("puts a cast Field ahead of the terrain so it actually applies", () => {
    // Every lookup takes the FIRST match, so a cast field laid over matching
    // terrain would otherwise be paid for and ignored.
    const s = onTerrain();
    const after = applyIntent(s, { type: "CAST_SPELL", player: "P1", spellId: otherField.id });
    expect(after.fields[0].spellId).toBe(otherField.id);
    expect(after.fields[0].permanent).toBeUndefined();
  });

  it("keeps exactly one terrain entry per side, and no more", () => {
    const s = onTerrain();
    const terrain = s.fields.filter((f) => f.permanent);
    expect(terrain).toHaveLength(2);
    expect(new Set(terrain.map((f) => f.owner)).size).toBe(2);
    expect(new Set(terrain.map((f) => f.spellId)).size).toBe(1); // one battlefield
  });
});