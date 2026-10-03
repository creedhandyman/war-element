// Outside Story, a match is fought on the element its decks are mostly made of
// (owner, 2026-10-03), ties settled by the seed — see engine/ground.ts.
import { describe, expect, it } from "vitest";
import { CARDS } from "../../data/cards";
import { pickGround } from "../ground";
import { createInitialState } from "../state";

const ofElement = (el: string, n: number) =>
  CARDS.filter((c) => c.element === el).slice(0, n).map((c) => c.id);

describe("the match ground", () => {
  it("is the element most of the cards in the match belong to", () => {
    expect(pickGround(1, [ofElement("PYRO", 5), [...ofElement("LEAF", 3), ...ofElement("PYRO", 1)]])).toBe("PYRO");
    expect(pickGround(1, [ofElement("AQUA", 2), ofElement("BOLT", 6)])).toBe("BOLT");
  });

  it("settles a tie by the seed, landing on each tied element and nothing else", () => {
    const decks = [ofElement("DUSK", 4), ofElement("DAWN", 4)];
    const seen = new Set(Array.from({ length: 40 }, (_, seed) => pickGround(seed, decks)));
    expect([...seen].sort()).toEqual(["DAWN", "DUSK"]);
    expect(pickGround(7, decks), "and the same seed always picks the same one").toBe(pickGround(7, decks));
  });

  it("keeps the stone when nothing in the match has a ground", () => {
    expect(pickGround(1, [[], ["not-a-card"]])).toBeUndefined();
  });

  it("is dealt at setup without touching the match's RNG", () => {
    const g = createInitialState(12345);
    expect(g.ground).toBe(pickGround(12345, [g.players.P1.deck.concat(g.players.P1.hand.map((h) => h.defId)),
      g.players.P2.deck.concat(g.players.P2.hand.map((h) => h.defId))]));
    expect(g.ground).toBeTruthy();
  });
});
