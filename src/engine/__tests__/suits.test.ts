// SUITS — dealt per match, and each one a different AI personality.
import { describe, expect, it } from "vitest";
import { createInitialState } from "../state";
import { dealSuits, styleOf, SUITS, SUIT_STYLES } from "../suits";
import { aiPrepIntent } from "../ai";
import { getDef } from "../../data/cards";
import { prepState } from "./helpers";
import type { Suit } from "../types";

describe("the deal", () => {
  it("gives every seat a different suit", () => {
    for (let seed = 0; seed < 200; seed++) {
      const dealt = dealSuits(seed);
      const seen = new Set(Object.values(dealt));
      expect(seen.size, `seed ${seed} dealt a duplicate`).toBe(4);
    }
  });

  it("is deterministic from the seed, and actually varies", () => {
    // Replays, online matches and tests all have to agree on the deal, so it
    // has to be a function of the seed — and it has to MOVE, or "randomized"
    // is a word rather than a feature.
    expect(dealSuits(42)).toEqual(dealSuits(42));
    const p1 = new Set(Array.from({ length: 200 }, (_, i) => dealSuits(i).P1));
    expect(p1.size, "P1 is not always the same suit").toBe(4);
  });

  it("does NOT spend the match's RNG cursor", () => {
    // The one constraint that made this its own generator: `rng.ts` is a single
    // advancing stream feeding every shuffle, coin and tie-break in order, so
    // four draws here would have shifted the opening hand of every seeded game
    // ever recorded.
    //
    // `dealSuits` takes a NUMBER, not a draft — it cannot reach the cursor even
    // by accident, which is the structural half of the guarantee. This is the
    // observable half: a seeded match still lands where it always did, deck
    // order and all, while carrying a deal.
    const a = createInitialState(1234, "leaf_pyro", "bore_dusk");
    const b = createInitialState(1234, "leaf_pyro", "bore_dusk");
    expect(a.rngState, "same seed, same cursor").toBe(b.rngState);
    expect(a.players.P1.deck, "same seed, same shuffle").toEqual(b.players.P1.deck);
    expect(a.seatSuits, "and the suits came with it").toEqual(b.seatSuits);
    expect(new Set(Object.values(a.seatSuits!)).size).toBe(4);
  });

  it("falls back to the traditional seating when a state has no deal", () => {
    // Saved games and hand-built fixtures predate the field; nothing should
    // have to check for absence.
    expect(styleOf(undefined, "P1").key).toBe("spade");
    expect(styleOf(undefined, "P2").key).toBe("club");
  });
});

describe("the four personalities actually differ", () => {
  /** What the AI reaches for first, given a hand spanning the curve. */
  function firstSummon(suit: Suit): string | null {
    // A real prep state, not a hand-built one: `canSummon` reads the phase, the
    // turn and the home row, and a fixture that fakes those just returns PASS.
    const s = prepState(7, "P2");
    s.seatSuits = { ...(s.seatSuits ?? {}), P2: suit } as never;
    s.players.P2.gold = 99; // afford anything, so the CHOICE is the only variable
    // A hand where the four tastes pull APART. The dearest card must not also
    // be the hardest hitter or the toughest body, or the test passes on a
    // coincidence — which is how it broke when Spades moved from `cheapest` to
    // `hardest` and both it and the hoarder reached for the same Mythic.
    s.players.P2.hand = [
      { handId: "h1", defId: "leaf_nettle" },      // c1,  3 dmg   — the cheapest
      { handId: "h2", defId: "pyro_spitfire" },    // c3,  6 dmg   — the hardest hitter
      { handId: "h3", defId: "leaf_elderroot" },   // c6,  Support — the caster
      { handId: "h4", defId: "bore_bastion" },     // c8, 31+12 hp — dearest AND toughest
    ];
    const intent = aiPrepIntent(s, "P2");
    if (intent.type !== "SUMMON") return null;
    return s.players.P2.hand.find((h) => h.handId === intent.handId)?.defId ?? null;
  }

  it("Spades reaches for the hardest hitter, Diamonds for the dearest", () => {
    const spade = firstSummon("spade");
    const diamond = firstSummon("diamond");
    expect(spade, "attack wants damage on the board").toBe("pyro_spitfire");
    expect(diamond, "the hoarder wants the heavy end").toBe("bore_bastion");
    // The point of the pairing: they are DIFFERENT cards, and Spades' pick is
    // not simply the expensive one.
    expect(getDef(spade!).cost).toBeLessThan(getDef(diamond!).cost);
    expect(getDef(spade!).dmg * getDef(spade!).hits)
      .toBeGreaterThan(getDef(diamond!).dmg * getDef(diamond!).hits);
  });

  it("Clubs reaches for the toughest, Hearts for the caster", () => {
    const club = firstSummon("club")!;
    expect(getDef(club).hp + getDef(club).shields * 2, "defense wants a wall")
      .toBeGreaterThanOrEqual(getDef("bore_bastion").hp);
    expect(getDef(firstSummon("heart")!).cardClass, "control wants its Support").toBe("Support");
  });

  it("every suit has a distinct style, and each names itself", () => {
    const names = SUITS.map((s) => SUIT_STYLES[s].name);
    expect(new Set(names).size).toBe(4);
    for (const s of SUITS) {
      expect(SUIT_STYLES[s].key).toBe(s);
      expect(SUIT_STYLES[s].blurb.length).toBeGreaterThan(20);
    }
  });
});
