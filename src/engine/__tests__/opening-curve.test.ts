// THE OPENING HAND YOU CAN ACTUALLY PLAY.
//
// A 45-card core deck holds exactly six 1-drops, so a four-card opening missed
// them entirely 56% of the time and held fewer than two 92.5% of the time —
// which came out in play as 37.7% of every prep turn in rounds 1 through 5
// having nothing the seat could legally summon. Gold pays 1 a round until round
// 6; a hand of threes and fives is a hand you sit and look at.
//
// `seedOpeningCurve` swaps cheap cards up into the opening window. The full
// measurement, both variants and the harness numbers are in state.ts above it.
// What these tests hold down is that the guarantee is a guarantee: it survives
// a mulligan, it does not change what is IN a deck, and it gives up rather than
// looping when a deck has nothing cheap to give.
import { describe, expect, it } from "vitest";
import { CORES, getDef } from "../../data/cards";
import {
  OPENING_CHEAP_COST, OPENING_CHEAP_MIN, createInitialState, seedOpeningCurve,
} from "../state";
import { applyMulligan } from "../state";
import { OPENING_HAND } from "../types";
import type { GameState, PlayerId, PlayerState } from "../types";

const costs = (s: GameState, seat: PlayerId) =>
  s.players[seat].hand.map((h) => getDef(h.defId).cost);
const cheapIn = (s: GameState, seat: PlayerId) =>
  costs(s, seat).filter((c) => c <= OPENING_CHEAP_COST).length;

/** Every core, both seats, a lot of seeds. */
function everyOpening(fn: (s: GameState, seat: PlayerId) => void, seeds = 120) {
  for (let k = 0; k < seeds; k++)
    for (const core of CORES) {
      const s = createInitialState(k * 31 + 7, core.cards, core.cards, [], [], [], 4);
      fn(s, "P1");
      fn(s, "P2");
    }
}

describe("the opening hand is dealt playable", () => {
  it("always holds its cheap cards, on every core and both seats", () => {
    // The whole feature in one line. Not "usually" — the point of doing this in
    // the deck rather than in the draw is that there is no unlucky case left.
    let worst = 99;
    everyOpening((s, seat) => { worst = Math.min(worst, cheapIn(s, seat)); });
    expect(worst, `some opening hand had only ${worst} cheap cards`)
      .toBeGreaterThanOrEqual(OPENING_CHEAP_MIN);
  });

  it("deals the promised number of cards and no extra", () => {
    // A swap must not become a draw. If this ever reads 5, the fix is adding
    // cards to a hand instead of reordering a deck.
    everyOpening((s, seat) => {
      expect(s.players[seat].hand.length).toBe(OPENING_HAND);
    }, 20);
  });

  it("changes the ORDER of a deck and never its contents", () => {
    // Reordering is what makes this safe to apply to a scripted formation, a
    // drafted list and a campaign Throne alike: the 45 cards you built are the
    // 45 cards you play, and the displaced card is a few draws away, not gone.
    for (const core of CORES) {
      const before = [...core.cards].sort();
      const s = createInitialState(99, core.cards, core.cards, [], [], [], 4);
      for (const seat of ["P1", "P2"] as const) {
        const after = [
          ...s.players[seat].deck,
          ...s.players[seat].hand.map((h) => h.defId),
        ].sort();
        expect(after, `${core.id} ${seat}`).toEqual(before);
      }
    }
  });

  it("leaves an already-good hand exactly as the shuffle dealt it", () => {
    // A no-op on the common case is what keeps this from reading as the game
    // rearranging your deck. Run it twice: the second call must find nothing.
    for (const core of CORES) {
      const s = createInitialState(5, core.cards, core.cards, [], [], [], 4);
      const p = s.players.P1;
      const before = [...p.deck];
      seedOpeningCurve(p);
      seedOpeningCurve(p);
      // The hand is already dealt, so the top of the deck is past the window
      // and satisfied by the cards in hand — nothing should move at all.
      expect(p.deck).toEqual(before);
    }
  });

  it("survives a mulligan, which is what used to undo a stacked deck", () => {
    // `applyMulligan` reshuffles. A guarantee that a mulligan silently drops is
    // worse than none, because it fails on exactly the hand the player already
    // told you they were unhappy with.
    for (let k = 0; k < 60; k++)
      for (const core of CORES) {
        const s = createInitialState(k * 31 + 7, core.cards, core.cards, [], [], [], 4);
        // Throw back everything — the harshest case for the refill.
        applyMulligan(s, "P1", s.players.P1.hand.map((h) => h.handId));
        expect(cheapIn(s, "P1"), `${core.id} seed ${k}`)
          .toBeGreaterThanOrEqual(OPENING_CHEAP_MIN);
        expect(s.players.P1.hand.length).toBe(OPENING_HAND);
      }
  });

  it("counts the cards a partial mulligan KEPT", () => {
    // Keeping a 1-drop and throwing back three should not force two more on
    // top of it — the guarantee is about the hand, not about the refill.
    const s = createInitialState(7, CORES[0].cards, CORES[0].cards, [], [], [], 4);
    const keep = s.players.P1.hand.find((h) => getDef(h.defId).cost <= OPENING_CHEAP_COST);
    if (keep) {
      applyMulligan(s, "P1", s.players.P1.hand.filter((h) => h !== keep).map((h) => h.handId));
      expect(s.players.P1.hand).toContainEqual(keep);
      expect(cheapIn(s, "P1")).toBeGreaterThanOrEqual(OPENING_CHEAP_MIN);
    }
  });
});

describe("it gives up rather than misbehaving", () => {
  const fake = (deck: string[]): PlayerState =>
    ({ deck: [...deck], hand: [] } as unknown as PlayerState);

  it("does what it can on a deck with too few cheap cards", () => {
    // A drafted list can be built entirely out of expensive cards. It must come
    // back with ONE where it wanted two, not throw and not spin.
    const dear = CORES[0].cards.filter((id) => getDef(id).cost > OPENING_CHEAP_COST);
    const cheap = CORES[0].cards.find((id) => getDef(id).cost <= OPENING_CHEAP_COST)!;
    const p = fake([...dear.slice(0, 8), cheap, ...dear.slice(8)]);
    seedOpeningCurve(p);
    const got = p.deck.slice(0, OPENING_HAND)
      .filter((id) => getDef(id).cost <= OPENING_CHEAP_COST).length;
    expect(got, "took the one cheap card it had").toBe(1);
  });

  it("does nothing at all on a deck with no cheap cards", () => {
    const dear = CORES[0].cards.filter((id) => getDef(id).cost > OPENING_CHEAP_COST);
    const p = fake(dear);
    const before = [...p.deck];
    seedOpeningCurve(p);
    expect(p.deck).toEqual(before);
  });

  it("leaves a SCRIPTED opening alone", () => {
    // `stackFirst` is the Void Tower boss's formation — the cards the fight is
    // about, hoisted deliberately. This ran after `restackByCost` and straight
    // over the top of it: with three named cards, a seeded run dealt two and
    // swapped the Mythic out for a 1-drop. An encounter that says what it opens
    // with means it, and a bad shuffle is not what a scripted head is.
    const deck = CORES[0].cards;
    const named = deck.slice(10, 13);
    const s = createInitialState(7, deck, deck, [], undefined, undefined, 4,
      undefined, undefined, { P2: named });
    const hand = s.players.P2.hand.map((h) => h.defId);
    for (const id of named) expect(hand, `${id} was dealt away`).toContain(id);
    // And the seat that did NOT script anything still gets its guarantee.
    expect(cheapIn(s, "P1")).toBeGreaterThanOrEqual(OPENING_CHEAP_MIN);
  });

  it("does nothing on a deck smaller than the hand it deals", () => {
    // The late-game empty deck. Reading past the end here would be a crash in
    // the one situation nobody plays enough to find.
    for (const n of [0, 1, 3, OPENING_HAND]) {
      const p = fake(CORES[0].cards.slice(0, n));
      const before = [...p.deck];
      seedOpeningCurve(p);
      expect(p.deck, `deck of ${n}`).toEqual(before);
    }
  });
});
