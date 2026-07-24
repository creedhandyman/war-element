// A deck's hand-picked spellbook — the builder helper + how it flows into a
// fresh game (explicit book wins; empty falls back to auto-from-elements).

import { describe, expect, it } from "vitest";
import { SPELLS, spellbookFromIds, spellbookFor, getSpell, spellPickKind, MAX_SPELLBOOK } from "../spells";
import { CORES, deckById } from "../../data/cards";
import { createInitialState } from "../state";
import { canCastSpell } from "../rules";
import { place, prepState } from "./helpers";

describe("spellbookFromIds", () => {
  it("keeps order, drops unknowns, dedupes, and caps at MAX_SPELLBOOK", () => {
    const ids = [
      "pyro_spark", "not_a_spell", "aqua_chill", "pyro_spark", // dup
      "gale_gust", "dawn_sunbeam", "bore_pebble_toss", "dusk_chill_touch", // → 6 valid uniques
    ];
    const book = spellbookFromIds(ids);
    expect(book.length).toBe(MAX_SPELLBOOK); // capped at 5
    expect(book.map((s) => s.defId)).toEqual([
      "pyro_spark", "aqua_chill", "gale_gust", "dawn_sunbeam", "bore_pebble_toss",
    ]);
    expect(book.every((s) => s.used === false)).toBe(true);
  });

  it("empty input yields an empty book", () => {
    expect(spellbookFromIds([])).toEqual([]);
  });
});

describe("createInitialState spellbook wiring", () => {
  const deck = ["leaf_alpha", "leaf_nettle"]; // all-LEAF: auto-book would be LEAF spells only

  it("uses a deck's explicit spellbook verbatim (any element allowed)", () => {
    const spells = ["pyro_spark", "aqua_chill"]; // off-element on purpose
    const g = createInitialState(1, deck, deck, ["P1"], spells, undefined);
    expect(g.players.P1.spellbook.map((s) => s.defId)).toEqual(spells);
    // P2 got no explicit book → auto-derived from its (LEAF) deck, so no PYRO/AQUA.
    expect(g.players.P2.spellbook.map((s) => s.defId)).toEqual(
      spellbookFor(deck).map((s) => s.defId),
    );
  });

  it("falls back to the auto-derived book when none is supplied", () => {
    const g = createInitialState(1, deck, deck, ["P1"]);
    expect(g.players.P1.spellbook.map((s) => s.defId)).toEqual(
      spellbookFor(deck).map((s) => s.defId),
    );
  });
});

describe("a deck that chose NO spells plays with none", () => {
  it("an empty spell list is honoured, not treated as 'unspecified'", () => {
    // The reported bug: a deck saved with no spells showed the whole elemental
    // set in battle and crowded the tray. `[]` fell through to the auto-derive
    // branch because the guard tested `.length`, so "chose none" and "never
    // chose" were the same thing to the engine.
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], [], []);
    expect(s.players.P1.spellbook).toHaveLength(0);
    expect(s.players.P2.spellbook).toHaveLength(0);
  });

  it("...while UNDEFINED still auto-derives from the deck's elements", () => {
    // The distinction has to survive: premades without a spells key rely on it.
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], undefined, undefined);
    expect(s.players.P1.spellbook.length).toBeGreaterThan(0);
  });

  it("a derived book is capped like a hand-picked one", () => {
    // Uncapped, a two-element deck derived up to THIRTEEN spells — over twice
    // the limit a player is allowed to build, and unusable in the tray.
    for (const deck of ["leaf_pyro", "bore_dusk", "aqua_dawn"]) {
      const s = createInitialState(1, deck, deck, ["P1"], undefined, undefined);
      expect(s.players.P1.spellbook.length, `${deck} derived too many`)
        .toBeLessThanOrEqual(MAX_SPELLBOOK);
    }
  });

  it("a hand-picked book is unaffected", () => {
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], ["leaf_sprout"], []);
    expect(s.players.P1.spellbook.map((x) => x.defId)).toEqual(["leaf_sprout"]);
  });
});

describe("a derived book samples the element, not the file", () => {
  it("takes one of each KIND before doubling up", () => {
    // A plain slice(0, 5) took the first five in DECLARATION order, and SPELLS
    // is grouped by kind — so books came out as damage,damage,wall,wall,wall
    // and the later kinds could never appear. The game's only `convert` spell
    // is declared at index 42 and was unreachable in every derived book.
    const book = spellbookFor(deckById("gale_bolt").cards).map((s) => getSpell(s.defId).kind);
    expect(new Set(book).size).toBe(book.length); // no kind repeats while others wait
  });

  it("a single-element BOLT deck can now derive its convert spell", () => {
    // The game's only convert spell. A two-element PAIR has more kinds than the
    // 5 slots, so convert can still lose the draw there — this asserts it is
    // REACHABLE, which under the old first-five slice it never was.
    const bolt = CORES.find((c) => c.id === "bolt")!;
    const book = spellbookFor(bolt.cards).map((s) => s.defId);
    expect(book).toContain("bolt_power_rebate");
  });

  it("...and the cap still holds", () => {
    for (const deck of ["leaf_pyro", "bore_dusk", "aqua_dawn", "gale_bolt"])
      expect(spellbookFor(deckById(deck).cards).length).toBeLessThanOrEqual(MAX_SPELLBOOK);
  });
});

describe("every spell is castable by hand", () => {
  it("spellPickKind classifies all 80, and matches what canCastSpell demands", () => {
    // The UI decides three things from this — arm or fire immediately, which
    // squares glow, and what a click does. Each was derived separately and each
    // got it wrong: traps had their column dropped in the reducer, and Rewire /
    // Full Reroute auto-fired with no picks, so the multi-pick flow could never
    // be reached at all. This walks the whole set and proves the classification
    // agrees with the legality rules.
    const wrong: string[] = [];
    for (const spell of SPELLS) {
      const kind = spellPickKind(spell);
      const s = prepState();
      s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      s.players.P1.magicPool = 30;
      s.players.P1.spellbook = [{ defId: spell.id, used: false }];
      // A board of every element, so element-gated riders always have a target.
      for (const [i, id] of ["leaf_greegon", "pyro_firebird", "aqua_spinefin", "bolt_zap"].entries())
        place(s, id, "P1", 3, i, { curHp: 5, maxHp: 20 });
      for (const [i, id] of ["dusk_gool", "dawn_sparkle", "gale_duster", "bore_clubber"].entries())
        place(s, id, "P1", 2, i, { curHp: 5, maxHp: 20 });
      place(s, "dusk_vamp", "P2", 1, 1, { curHp: 40, maxHp: 40 });
      // A spell classified "none" MUST be legal with no picks at all — that is
      // exactly the promise the tray relies on when it fires immediately.
      if (kind === "none" && !canCastSpell(s, "P1", spell.id, {}).ok)
        wrong.push(`${spell.id}: classified "none" but needs ${canCastSpell(s, "P1", spell.id, {}).reason}`);
      // ...and one that DOES need picks must be refused without them, or the
      // tray would fire it into a no-op.
      if (kind !== "none" && kind !== "mode" && canCastSpell(s, "P1", spell.id, {}).ok)
        wrong.push(`${spell.id}: classified "${kind}" but casts with no picks`);
    }
    expect(wrong, `pick classification disagrees with legality:\n  ${wrong.join("\n  ")}`).toEqual([]);
  });

  it("the two multi-pick spells are classified as such", () => {
    // Regression guard for the specific bug: both ride kind "convert", which the
    // tray fires on sight. Only the swapAllies / rerouteCount flags separate them.
    expect(spellPickKind(getSpell("bolt_rewire"))).toBe("cards");
    expect(spellPickKind(getSpell("bolt_full_reroute"))).toBe("cards");
    // ...while the genuinely targetless converts still resolve on the spot.
    expect(spellPickKind(getSpell("bolt_recon_ping"))).toBe("none");
    expect(spellPickKind(getSpell("bolt_system_override"))).toBe("none");
    expect(spellPickKind(getSpell("bolt_power_rebate"))).toBe("none");
  });

  it("every trap asks for a SLOT, not a row", () => {
    // Traps take row AND col. Classifying one as "row" would drop the column and
    // the cast would fail with "Pick a slot" — which is exactly what the reducer
    // did before it threaded col through.
    for (const s of SPELLS.filter((x) => x.kind === "trap"))
      expect(spellPickKind(s), `${s.id}`).toBe("slot");
  });
});
