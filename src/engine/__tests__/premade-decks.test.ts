// Guards the shipped premade decks: every card id must still exist and be
// deck-eligible, and each deck must be a legal size. Catches a card rename or
// removal silently breaking a premade build.

import { describe, expect, it } from "vitest";
import { CARD_INDEX } from "../../data/cards";
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
        // Validated against ITS OWN board size — a 28-card large build is legal
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
  it("offers four decks per battlefield, and only those", () => {
    expect(premadeDecksFor(4)).toHaveLength(4);
    expect(premadeDecksFor(5)).toHaveLength(4);
    for (const d of premadeDecksFor(4)) expect(d.cards).toHaveLength(18);
    for (const d of premadeDecksFor(5)) expect(d.cards).toHaveLength(28);
  });

  it("each large build is its standard shell plus ten cards", () => {
    // Derived, not duplicated: editing a standard list must carry into its 5x5
    // twin rather than leaving the two to drift.
    for (const std of premadeDecksFor(4)) {
      const large = premadeDecksFor(5).find((d) => d.id === `${std.id}_5`)!;
      expect(large, `no large twin for ${std.id}`).toBeTruthy();
      expect(large.cards.slice(0, std.cards.length)).toEqual(std.cards);
      expect(large.cards.length - std.cards.length).toBe(10);
      expect(large.name).toBe(std.name);
      expect(large.spells).toEqual(std.spells);
    }
  });

  it("a 28-card deck is rejected on the standard board", () => {
    const large = premadeDecksFor(5)[0];
    expect(validateDeck(large.cards, 4).ok).toBe(false);
    expect(validateDeck(large.cards, 5).ok).toBe(true);
  });

  it("large builds keep an even element split", () => {
    // 14/14 across the deck's two elements — the standard Frostkeep is 8/10 and
    // its extras are weighted to correct that.
    for (const d of premadeDecksFor(5)) {
      const els: Record<string, number> = {};
      for (const id of d.cards) {
        const el = CARD_INDEX[id]!.element;
        els[el] = (els[el] ?? 0) + 1;
      }
      const counts = Object.values(els).sort((a, b) => a - b);
      expect(counts, `${d.name} split ${JSON.stringify(els)}`).toEqual([14, 14]);
    }
  });
});
