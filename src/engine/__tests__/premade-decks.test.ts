// Guards the shipped premade decks: every card id must still exist and be
// deck-eligible, and each deck must be a legal size. Catches a card rename or
// removal silently breaking a premade build.

import { describe, expect, it } from "vitest";
import { CARD_INDEX, getDef } from "../../data/cards";
import { getSpell, spellCapForBoard } from "../spells";
import {
  DECK_TIERS, PREMADE_DECKS, deckLimits, decksForTier, isBuildable, premadeDecksFor,
  rollOpponent, tierOf, validateDeck,
} from "../../data/custom-decks";

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
  it("offers the same decks on both battlefields, and only those", () => {
    // Six hand-tuned originals (four dual-element, two three-element) plus the
    // twelve-deck matchmaker ladder. Derived rather than restated: the point of
    // the assertion is that the two boards offer the SAME set, which a literal
    // count stops testing the moment someone adds a deck.
    const standard = PREMADE_DECKS.filter((d) => d.boardSize === 4);
    expect(standard).toHaveLength(6 + DECK_TIERS.length * 4);
    expect(premadeDecksFor(4)).toHaveLength(standard.length);
    expect(premadeDecksFor(5)).toHaveLength(standard.length);
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

describe("the matchmaker ladder", () => {
  it("has four decks on every rung", () => {
    for (const tier of DECK_TIERS) {
      expect(decksForTier(tier, 4), tier).toHaveLength(4);
      expect(decksForTier(tier, 5), `${tier} 5x5`).toHaveLength(4);
    }
  });

  it("can play from round one on every rung", () => {
    // THE regression. The first cut of this ladder tiered on `rarity`, which
    // types.ts documents as cosmetic — and no epic in the set costs less than
    // 3, so "hard = epic and up" meant those decks held nothing castable on
    // round one and lost to a rush in four.
    //
    // `poolGainForRound` gives 1 gold a round for the first five, so round one
    // buys a 1-drop and nothing else, and a deck whose cheapest card costs 3
    // stands there until round three. That is the whole bug: difficulty is
    // what a deck plays, not when it can first play. Every rung gets a 1-cost
    // card, and enough cheap ones that the opening is not a single card.
    for (const tier of DECK_TIERS) for (const board of [4, 5] as const) {
      for (const d of decksForTier(tier, board)) {
        const costs = d.cards.map((id) => CARD_INDEX[id]!.cost);
        expect(Math.min(...costs), `${d.name} ${board}x${board} has no 1-drop`).toBe(1);
        expect(costs.filter((c) => c <= 2).length,
          `${d.name} ${board}x${board} cheap bodies`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("tiers on the plan, and the plans are actually different", () => {
    // Rarity is cosmetic and the stat budget is enforced (dmg*hits + hp +
    // shields*2 + sp tracks 5*cost + 10 across the whole set), so neither a
    // label nor raw numbers can carry difficulty. What is left is the list's
    // plan, and these are the three axes the tuning measured as levers.
    const of = (tier: (typeof DECK_TIERS)[number], board: 4 | 5) =>
      decksForTier(tier, board).map((d) => {
        const cs = d.cards.map((id) => CARD_INDEX[id]!);
        return {
          name: d.name,
          cheap: cs.filter((c) => c.cost <= 2).length / cs.length,
          comp: cs.filter((c) => c.cardClass === "Tank" || c.cardClass === "Support").length,
          reach: cs.filter((c) => c.attackType === "Ranged").length / cs.length,
        };
      });

    for (const board of [4, 5] as const) {
      // Easy has NO front line and NO healer. Capture is a win condition, so
      // holding nothing is a real hole rather than a smaller number.
      for (const d of of("easy", board)) expect(d.comp, `${d.name} runs no comp`).toBe(0);
      for (const tier of ["mid", "hard"] as const)
        for (const d of of(tier, board)) expect(d.comp, `${d.name} fields one`).toBeGreaterThanOrEqual(4);

      // Cheap and wide is the strongest thing a deck can do here: the budget's
      // +10 is flat, so a 1-cost body returns 15 stat points per gold and a
      // 9-cost returns 6.1. The rungs are ordered by how much of that they take.
      //
      // EVERY ADJACENT PAIR, not just each against easy. The first cut of this
      // test compared mid and hard to easy and never to each other, on any
      // axis — so the top two rungs could invert and stay green. That is the
      // exact silent inversion the ladder's banner records happening twice
      // already, and swapping four same-element cards in one hard deck was
      // enough to reproduce it under the old assertions.
      const cheap = DECK_TIERS.map((t) => Math.min(...of(t, board).map((d) => d.cheap)));
      expect(cheap[1], `mid ${cheap[1]} > easy ${cheap[0]} (${board}x${board})`).toBeGreaterThan(cheap[0]);
      expect(cheap[2], `hard ${cheap[2]} > mid ${cheap[1]} (${board}x${board})`).toBeGreaterThan(cheap[1]);

      // Reach separates HARD, and only hard. mid's Ranged density is level with
      // easy's — 20/72 each on 4x4 — so this asserts what the data does rather
      // than what the first draft of the docs claimed; see the note on the
      // ladder banner. Both comparisons, so hard cannot slide under either.
      const reach = DECK_TIERS.map((t) => {
        const ds = of(t, board);
        return ds.reduce((n, d) => n + d.reach, 0) / ds.length;
      });
      expect(reach[2], `hard reach ${reach[2]} > easy ${reach[0]}`).toBeGreaterThan(reach[0] + 0.1);
      expect(reach[2], `hard reach ${reach[2]} > mid ${reach[1]}`).toBeGreaterThan(reach[1] + 0.1);
    }
  });

  it("never rolls a near-clone off the same rung", () => {
    // `rollOpponent` only avoids the deck already seated, so two decks on one
    // rung sharing half their list means a re-roll hands back the same fight —
    // and a Gauntlet run deals the WHOLE rung, so it plays both back to back.
    // The banner promises "new opponents rather than reskins"; this is what
    // that promise costs.
    for (const tier of DECK_TIERS) for (const board of [4, 5] as const) {
      const ds = decksForTier(tier, board);
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
        const shared = ds[i].cards.filter((id) => ds[j].cards.includes(id));
        expect(shared.length, `${ds[i].name} vs ${ds[j].name} share ${shared.join(", ")}`).toBe(0);
      }
    }
  });

  it("rolls a different opponent when the rung has one to give", () => {
    const first = decksForTier("mid", 4)[0];
    const rolled = rollOpponent("mid", 4, first.id, () => 0);
    expect(rolled).toBeTruthy();
    expect(rolled!.id).not.toBe(first.id);
    // A rung of one would have nothing else to hand back; it must still answer.
    expect(rollOpponent("hard", 4, undefined, () => 0.999)).toBeTruthy();
  });

  it("leaves the six originals off the ladder", () => {
    // They are hand-tuned archetypes, not rungs, and the matchmaker should not
    // guess where they sit.
    const tiered = PREMADE_DECKS.filter((d) => d.boardSize === 4 && d.tier);
    expect(tiered).toHaveLength(12);
    expect(tierOf("pre_inferno_blitz")).toBeNull();
  });

  it("gives every deck a one-line note", () => {
    for (const d of PREMADE_DECKS) expect(d.note, d.name).toBeTruthy();
  });
});
