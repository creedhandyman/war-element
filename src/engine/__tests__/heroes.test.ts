// HEROES — one per suit, bound to the suit the seat is playing.
import { describe, expect, it } from "vitest";
import { createInitialState } from "../state";
import { advance } from "../phases";
import { HEROES, goldRoundFor, magicRoundFor } from "../heroes";
import { SUITS } from "../suits";
import { poolGainForRound } from "../types";
import type { GameState, Suit } from "../types";

describe("the roster", () => {
  it("is one hero per suit, each explainable in a sentence", () => {
    for (const suit of SUITS) {
      const h = HEROES[suit];
      expect(h.suit).toBe(suit);
      expect(h.identity.length, `${h.name} identity`).toBeGreaterThan(20);
      expect(h.power.name.length, `${h.name} power`).toBeGreaterThan(2);
    }
    expect(new Set(SUITS.map((s) => HEROES[s].name)).size).toBe(4);
  });

  it("shifts BOUNDARIES, never rates — so the curves re-converge", () => {
    // The whole safety argument. A rate change compounds without limit; a
    // boundary shift is worth a fixed few points and then both curves sit at
    // the same tier cap. Checked at the cap: by round 25 nobody is ahead.
    for (const suit of SUITS) {
      const late = poolGainForRound(goldRoundFor(25, suit, true));
      expect(late, `${HEROES[suit].name} converges`).toBe(poolGainForRound(25));
    }
  });

  it("never runs a curve backwards", () => {
    // A penalty slows the ramp; it must not make round 1 into round 0.
    for (const suit of SUITS)
      for (const r of [1, 2, 3])
        expect(goldRoundFor(r, suit, true)).toBeGreaterThanOrEqual(1);
  });
});

describe("heroes are OFF unless a mode turns them on", () => {
  // A suit is dealt to EVERY match — it is the seat's identity and the AI's
  // playstyle. A hero moves the economy, and an ordinary skirmish must not
  // acquire one just because a glyph was dealt. Tying the shift straight to the
  // suit broke three resource tests, which is this rule arriving as a failure.
  it("the shift is the identity function with the flag off", () => {
    for (const suit of SUITS) {
      expect(goldRoundFor(7, suit)).toBe(7);
      expect(magicRoundFor(7, suit)).toBe(7);
      expect(goldRoundFor(7, suit, false)).toBe(7);
    }
  });

  it("a default match pays both seats the printed curve", () => {
    // Suits are dealt here, so this is the regression guard: same income for
    // both seats through the early rounds, whatever they drew.
    let s: GameState = createInitialState(99, "leaf_pyro", "bore_dusk");
    expect(s.seatSuits, "suits are still dealt").toBeTruthy();
    expect(s.heroes, "but heroes are not on").toBeFalsy();
    for (let i = 0; i < 4000 && s.round < 6; i++) {
      const n = advance(s); if (n === s) break; s = n;
    }
    expect(s.players.P1.gold).toBe(s.players.P2.gold);
    expect(s.players.P1.magicPool).toBe(s.players.P2.magicPool);
  });

  it("...and with heroes ON the Warlord banks gold sooner than the Mage", () => {
    const gold = (suit: Suit, round: number) =>
      poolGainForRound(goldRoundFor(round, suit, true));
    // ROUND 5 is where it bites: tier 2 starts at round 6, so a +1 shift reads
    // 6 (tier 2) while a -1 shift reads 4 (still tier 1). At round 4 both are
    // on tier 1 and the test proves nothing — which is what it did first.
    expect(gold("spade", 5), "Warlord is a tier up").toBe(2);
    expect(gold("heart", 5), "the Mage is not").toBe(1);
    // ...and magic runs the other way, by more, because magic is worth less.
    const magic = (suit: Suit, round: number) =>
      poolGainForRound(magicRoundFor(round, suit, true));
    expect(magic("heart", 5)).toBeGreaterThan(magic("spade", 5));
  });
});
