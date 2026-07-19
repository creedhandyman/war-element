// A deck's hand-picked spellbook — the builder helper + how it flows into a
// fresh game (explicit book wins; empty falls back to auto-from-elements).

import { describe, expect, it } from "vitest";
import { spellbookFromIds, spellbookFor, MAX_SPELLBOOK } from "../spells";
import { createInitialState } from "../state";

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
