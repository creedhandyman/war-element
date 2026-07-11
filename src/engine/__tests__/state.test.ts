// Milestone 1: state, decks, shuffle/deal, mulligan, draw math, resources.

import { describe, expect, it } from "vitest";
import { createInitialState } from "../state";
import { applyIntent, advance, advanceUntilInput } from "../phases";
import { CARDS, DECK_P1, DECK_P2 } from "../../data/cards";
import { HAND_CAP } from "../types";
import { freshGame } from "./helpers";

describe("setup", () => {
  it("deals 5-card opening hands from 17-card decks", () => {
    const s = createInitialState(1);
    expect(DECK_P1).toHaveLength(17);
    expect(DECK_P2).toHaveLength(17);
    expect(s.players.P1.hand).toHaveLength(5);
    expect(s.players.P2.hand).toHaveLength(5);
    expect(s.players.P1.deck).toHaveLength(12);
    expect(s.players.P2.deck).toHaveLength(12);
    expect(s.phase).toBe("mulligan");
  });

  it("every card's cost matches the stat formula (total ≈ 5·cost + 10)", () => {
    // shields count 2 points each; source-printed costs may drift ±2 total.
    // Skeleton Knight's Bone Shield is a passive grant priced outside the total.
    const exceptions = new Set(["dusk_skeleton_knight"]);
    for (const def of CARDS) {
      if (exceptions.has(def.id)) continue;
      const total = def.dmg * def.hits + def.hp + def.shields * 2 + def.sp;
      const expected = 5 * def.cost + 10;
      expect(
        Math.abs(total - expected),
        `${def.id}: total ${total} vs 5·${def.cost}+10 = ${expected}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = createInitialState(7);
    const b = createInitialState(7);
    expect(a.players.P1.hand.map((h) => h.defId)).toEqual(
      b.players.P1.hand.map((h) => h.defId),
    );
    expect(a.firstPlayer).toBe(b.firstPlayer);
  });

  it("different seeds shuffle differently (spot check)", () => {
    const hands = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      hands.add(
        createInitialState(seed)
          .players.P1.hand.map((h) => h.defId)
          .join(","),
      );
    }
    expect(hands.size).toBeGreaterThan(1);
  });
});

describe("mulligan", () => {
  it("returns a subset, reshuffles, redraws to 5", () => {
    const s = freshGame(3);
    const toss = s.players.P1.hand.slice(0, 2).map((h) => h.handId);
    const next = applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: toss });
    expect(next.players.P1.hand).toHaveLength(5);
    expect(next.players.P1.deck).toHaveLength(12);
    expect(next.players.P1.mulliganDone).toBe(true);
    for (const id of toss)
      expect(next.players.P1.hand.some((h) => h.handId === id)).toBe(false);
  });

  it("cannot mulligan twice", () => {
    const s = applyIntent(freshGame(3), { type: "MULLIGAN", player: "P1", returnHandIds: [] });
    expect(() =>
      applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: [] }),
    ).toThrow();
  });

  it("after both mulligans the game advances to round 1 prep", () => {
    let s = applyIntent(freshGame(3), { type: "MULLIGAN", player: "P1", returnHandIds: [] });
    s = advanceUntilInput(s); // AI mulligans, draw + resource resolve
    expect(s.round).toBe(1);
    expect(s.phase).toBe("prep");
    // round 1: drew 1 (hand 6), pool 1. (P2 may already have spent its pool
    // if it won the coin flip and summoned before passing priority.)
    expect(s.players.P1.hand).toHaveLength(6);
    expect(s.players.P1.pool).toBe(1);
    expect(s.players.P2.pool).toBeLessThanOrEqual(1);
  });
});

describe("draw math", () => {
  it("draws 2 on every 5th round", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 5;
    s.players.P1.hand = s.players.P1.hand.slice(0, 2); // room to draw
    const before = s.players.P1.hand.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(before + 2);
  });

  it("skips the excess draw at the 7-card cap (card stays in deck)", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 1;
    // pad hand to the cap
    while (s.players.P1.hand.length < HAND_CAP)
      s.players.P1.hand.push({ handId: `h${s.nextId++}`, defId: "leaf_alpha" });
    const deckBefore = s.players.P1.deck.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(HAND_CAP);
    expect(next.players.P1.deck.length).toBe(deckBefore);
  });

  it("empty deck draws nothing, no penalty", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 2;
    s.players.P1.deck = [];
    const handBefore = s.players.P1.hand.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(handBefore);
    expect(next.phase).toBe("resource");
  });
});

describe("resource math", () => {
  it("gains min(round, 10)", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 12;
    s.players.P1.pool = 0;
    const next = advance(s);
    expect(next.players.P1.pool).toBe(10);
  });

  it("caps carryover at 10 before the gain", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 3;
    s.players.P1.pool = 14; // carryover clamps to 10
    const next = advance(s);
    expect(next.players.P1.pool).toBe(13);
  });
});
