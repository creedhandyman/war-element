// §4: every node in a region runs that element's Field spell permanently, for
// BOTH sides, at no cost. It shipped as a line of UI copy — "Terrain: Lushfield
// — runs all battle, both sides" — with nothing behind it: `fields` was only
// ever populated by a cast spell, so the terrain never existed in a battle.

import { describe, expect, it } from "vitest";
import { advance, createInitialState, getSpell, SPELLS } from "../index";
import { REGIONS } from "../../data/story";
import type { GameState } from "../index";

const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

const lushfield = SPELLS.find((s) => s.name === "Lushfield")!.id;

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
