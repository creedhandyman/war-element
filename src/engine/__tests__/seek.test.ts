import { describe, it, expect } from "vitest";
import { SPECIAL_HANDLERS } from "../combat";
import { effectiveSummonCost } from "../rules";
import { createInitialState } from "../state";
import { HAND_CAP } from "../types";
import type { GameState } from "../types";
import { place, prepState } from "./helpers";
import { CARDS, getDef } from "../../data/cards";

/** Fire a Seek from a card owned by P2, with an explicit filter. */
function fire(s: GameState, defId: string, params: Record<string, number | string>) {
  const caster = place(s, defId, "P2", 2, 1);
  SPECIAL_HANDLERS.seek(s, caster, [], params);
  return caster;
}

describe("Seek — the consistency primitive", () => {
  it("pulls the first matching card out of the deck and into hand", () => {
    const s = prepState(7, "P2");
    s.players.P2.deck = ["leaf_weeds", "dusk_pumpkin", "dusk_zhunk", "leaf_cactus"];
    s.players.P2.hand = [];
    fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3 });
    expect(s.players.P2.hand.map((h) => h.defId), "the first DUSK match, in deck order")
      .toEqual(["dusk_pumpkin"]);
    expect(s.players.P2.deck, "and the rest of the order is untouched")
      .toEqual(["leaf_weeds", "dusk_zhunk", "leaf_cactus"]);
  });

  it("never touches the RNG cursor", () => {
    // THE HARD CONSTRAINT. rngState is a single advancing cursor that every
    // shuffle, coin and tie-break reads IN ORDER — one stray draw here would
    // shift the opening hand of every seeded game ever recorded. A Seek that
    // sorted, shuffled or rolled would break the suite in a way that looks like
    // a hundred unrelated failures.
    const s = prepState(7, "P2");
    s.players.P2.deck = ["leaf_weeds", "dusk_pumpkin", "dusk_zhunk"];
    s.players.P2.hand = [];
    const before = s.rngState;
    fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3 });
    expect(s.rngState, "the cursor has not moved").toBe(before);
  });

  it("holds the find on top of the deck when the hand is full", () => {
    // The same courtesy `drawCards` gives an overflowing draw: held, not burned.
    const s = prepState(7, "P2");
    s.players.P2.deck = ["leaf_weeds", "dusk_pumpkin"];
    s.players.P2.hand = Array.from({ length: HAND_CAP }, (_, i) => ({
      handId: `x${i}`, defId: "leaf_cactus",
    }));
    fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3 });
    expect(s.players.P2.hand.length, "hand is untouched at the cap").toBe(HAND_CAP);
    expect(s.players.P2.deck[0], "the find is waiting on top instead").toBe("dusk_pumpkin");
  });

  it("is a quiet no-op when nothing matches", () => {
    const s = prepState(7, "P2");
    s.players.P2.deck = ["leaf_weeds", "leaf_cactus"];
    s.players.P2.hand = [];
    expect(() => fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3 })).not.toThrow();
    expect(s.players.P2.hand).toEqual([]);
    expect(s.players.P2.deck).toEqual(["leaf_weeds", "leaf_cactus"]);
  });

  it("matches a card by ONE of its several tribes", () => {
    // `tribe` is `string | string[]` — Frostbeak is ["Avian", "Ice"]. A dual
    // tribe card must be findable by EITHER of its tribes, not just the first.
    const dual = CARDS.find((c) => Array.isArray(c.tribe) && c.tribe.length > 1);
    expect(dual, "the set has a dual-tribe card to assert on").toBeTruthy();
    const tribes = dual!.tribe as string[];
    for (const t of tribes) {
      const s = prepState(7, "P2");
      s.players.P2.deck = [dual!.id];
      s.players.P2.hand = [];
      fire(s, "bore_rockgoblin", { tribe: t });
      expect(s.players.P2.hand.map((h) => h.defId), `findable by "${t}"`).toEqual([dual!.id]);
    }
  });

  it("refuses to match on an empty filter", () => {
    // A Seek with no clauses must find NOTHING, not anything. A missing param
    // turning into "fetch an arbitrary card" is the worst failure a
    // deterministic engine could have here.
    const s = prepState(7, "P2");
    s.players.P2.deck = ["leaf_weeds", "dusk_pumpkin"];
    s.players.P2.hand = [];
    fire(s, "bore_rockgoblin", {});
    expect(s.players.P2.hand).toEqual([]);
    expect(s.players.P2.deck.length).toBe(2);
  });

  describe("the voucher", () => {
    it("discounts only the card it names, and only once", () => {
      const s = prepState(7, "P2");
      s.players.P2.deck = ["dusk_zhunk", "dusk_pumpkin"];
      s.players.P2.hand = [];
      fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3, discount: 1 });
      expect(Object.keys(s.players.P2.seek!)).toEqual(["dusk_zhunk"]);
      expect(effectiveSummonCost(s, "P2", "dusk_zhunk"), "the named card is cheaper")
        .toBe(getDef("dusk_zhunk").cost - 1);
      expect(effectiveSummonCost(s, "P2", "dusk_pumpkin"), "nothing else is")
        .toBe(getDef("dusk_pumpkin").cost);
      expect(effectiveSummonCost(s, "P1", "dusk_zhunk"), "and not for the opponent")
        .toBe(getDef("dusk_zhunk").cost);
    });

    it("floors at zero rather than paying you to summon", () => {
      const s = prepState(7, "P2");
      s.players.P2.deck = ["dusk_pumpkin"];
      s.players.P2.hand = [];
      fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3, discount: 9 });
      expect(effectiveSummonCost(s, "P2", "dusk_pumpkin")).toBe(0);
    });

    it("a SECOND Seek does not cancel the first card's discount", () => {
      // One slot made the printed text a lie. Two Seekers in a deck is legal
      // and reachable in shipped premades, and the second used to silently void
      // the first card's "costs 1 less" — a promise the player had read and
      // planned around, cancelled with no message and no way to see it.
      const s = prepState(7, "P2");
      s.players.P2.deck = ["dusk_zhunk", "leaf_cactus"];
      s.players.P2.hand = [];
      fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3, discount: 1 });
      fire(s, "bore_rockgoblin", { element: "LEAF", maxCost: 3, discount: 1 });
      expect(effectiveSummonCost(s, "P2", "dusk_zhunk"), "the first is still honoured")
        .toBe(getDef("dusk_zhunk").cost - 1);
      expect(effectiveSummonCost(s, "P2", "leaf_cactus"), "and so is the second")
        .toBe(getDef("leaf_cactus").cost - 1);
    });

    it("spending one leaves the others standing", () => {
      const s = prepState(7, "P2");
      s.players.P2.deck = ["dusk_zhunk", "leaf_cactus"];
      s.players.P2.hand = [];
      fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3, discount: 1 });
      fire(s, "bore_rockgoblin", { element: "LEAF", maxCost: 3, discount: 1 });
      // Spend the DUSK one by hand, the way the summon site does.
      const { dusk_zhunk: _spent, ...rest } = s.players.P2.seek!;
      s.players.P2.seek = rest;
      expect(effectiveSummonCost(s, "P2", "dusk_zhunk"), "spent").toBe(getDef("dusk_zhunk").cost);
      expect(effectiveSummonCost(s, "P2", "leaf_cactus"), "untouched")
        .toBe(getDef("leaf_cactus").cost - 1);
    });

    it("is absent when the card prints no discount", () => {
      const s = prepState(7, "P2");
      s.players.P2.deck = ["dusk_pumpkin"];
      s.players.P2.hand = [];
      fire(s, "bore_rockgoblin", { element: "DUSK", maxCost: 3 });
      expect(s.players.P2.seek?.["dusk_pumpkin"], "a Seek without a discount arms no voucher")
        .toBeUndefined();
    });
  });

  it("leaves a state that declared nothing completely alone", () => {
    // Every deck, replay and fixture that predates Seek must be unchanged.
    const s = createInitialState(11);
    expect(s.players.P1.seek).toBeUndefined();
    expect(effectiveSummonCost(s, "P1", "leaf_weeds")).toBe(getDef("leaf_weeds").cost);
  });
});
