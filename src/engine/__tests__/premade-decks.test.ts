// Guards the shipped premade decks: every card id must still exist and be
// deck-eligible, and each deck must be a legal size. Catches a card rename or
// removal silently breaking a premade build.

import { describe, expect, it } from "vitest";
import { CARD_INDEX, getDef } from "../../data/cards";
import { getSpell, spellCapForBoard } from "../spells";
import { PREMADE_DECKS, deckLimits, isBuildable, premadeDecksFor, validateDeck } from "../../data/custom-decks";

describe("premade decks", () => {
  it("ships at least 4 decks", () => {
    expect(PREMADE_DECKS.length).toBeGreaterThanOrEqual(4);
  });

  for (const deck of PREMADE_DECKS) {
    const limits = deckLimits(deck.boardSize);
    describe(`${deck.name} (${deck.boardSize}x${deck.boardSize})`, () => {
      it("has a stable unique id and the premade flag", () => {
        expect(deck.id).toMatch(/^pre_/);
        expect(deck.premade).toBe(true);
      });

      it(`is a legal deck (${limits.min}-${limits.max} unique buildable cards)`, () => {
        // Validated against ITS OWN board size — a 30-card large build is legal
        // there and illegal on the standard board, which is the point.
        expect(validateDeck(deck.cards, deck.boardSize)).toEqual({ ok: true });
      });

      it("hits the target size for its board exactly", () => {
        expect(deck.cards.length).toBe(limits.target);
      });

      it("references only real, buildable cards", () => {
        for (const id of deck.cards) {
          expect(CARD_INDEX[id], `unknown card "${id}" in ${deck.name}`).toBeTruthy();
          expect(isBuildable(id), `"${id}" is not deck-eligible`).toBe(true);
        }
      });
    });
  }

  it("has no duplicate deck ids", () => {
    const ids = PREMADE_DECKS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("board-sized premade builds", () => {
  it("offers six decks per battlefield, and only those", () => {
    // Four dual-element decks + two three-element decks (Tempest, Blight).
    expect(premadeDecksFor(4)).toHaveLength(6);
    expect(premadeDecksFor(5)).toHaveLength(6);
    // The formats are EXACT sizes, not bands — eighteen and thirty.
    for (const d of premadeDecksFor(4)) expect(d.cards).toHaveLength(deckLimits(4).target);
    for (const d of premadeDecksFor(5)) expect(d.cards).toHaveLength(deckLimits(5).target);
  });

  it("each large build is its standard shell plus twelve cards", () => {
    // Derived, not duplicated: editing a standard list must carry into its 5x5
    // twin rather than leaving the two to drift.
    for (const std of premadeDecksFor(4)) {
      const large = premadeDecksFor(5).find((d) => d.id === `${std.id}_5`)!;
      expect(large, `no large twin for ${std.id}`).toBeTruthy();
      expect(large.cards.slice(0, std.cards.length)).toEqual(std.cards);
      expect(large.cards.length - std.cards.length).toBe(12);
      expect(large.name).toBe(std.name);
      // The spellbook EXTENDS rather than matching: the big board's cap is 8,
      // not 5, and the large build used to inherit the standard five and stop —
      // three slots short of what the deck builder offers for the same board.
      expect(large.spells?.slice(0, std.spells?.length ?? 0)).toEqual(std.spells);
      expect((large.spells?.length ?? 0) - (std.spells?.length ?? 0)).toBe(3);
    }
  });

  it("a large-board deck is rejected on the standard board", () => {
    const large = premadeDecksFor(5)[0];
    expect(validateDeck(large.cards, 4).ok).toBe(false);
    expect(validateDeck(large.cards, 5).ok).toBe(true);
  });

  it("large builds keep an even element split", () => {
    // As even as the element count allows across all 30 cards: a 2-element deck
    // is 15/15, a 3-element deck is 10/10/10 — the extras balance the shell.
    for (const d of premadeDecksFor(5)) {
      const els: Record<string, number> = {};
      for (const id of d.cards) {
        const el = CARD_INDEX[id]!.element;
        els[el] = (els[el] ?? 0) + 1;
      }
      const counts = Object.values(els);
      const total = counts.reduce((a, b) => a + b, 0);
      expect(total, `${d.name} total`).toBe(deckLimits(5).target);
      // Even split: the largest and smallest element counts differ by at most 1.
      expect(Math.max(...counts) - Math.min(...counts), `${d.name} split ${JSON.stringify(els)}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("the 5x5 premades bring a full spellbook", () => {
  it("every large build fills its 8 slots, and the 4x4 builds still hold 5", () => {
    for (const d of PREMADE_DECKS) {
      const cap = spellCapForBoard(d.boardSize ?? 4);
      expect(d.spells?.length ?? 0, `${d.id} spellbook`).toBe(cap);
    }
  });

  it("no large book repeats a spell or reaches outside the deck's elements", () => {
    const large = PREMADE_DECKS.filter((d) => (d.boardSize ?? 4) >= 5);
    expect(large.length).toBeGreaterThan(0);
    for (const d of large) {
      const ids = d.spells ?? [];
      expect(new Set(ids).size, `${d.id} repeats a spell`).toBe(ids.length);
      // The elements the deck's own CARDS are built from.
      const deckEls = new Set(d.cards.map((c) => getDef(c).element));
      for (const sid of ids)
        expect(deckEls.has(getSpell(sid).element), `${d.id}: ${sid} is off-element`).toBe(true);
    }
  });
});
