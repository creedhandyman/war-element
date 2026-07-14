// Milestone 1: state, decks, shuffle/deal, mulligan, draw math, resources.

import { describe, expect, it } from "vitest";
import { createInitialState } from "../state";
import { applyIntent, advance, advanceUntilInput } from "../phases";
import { CARDS, DECK_P1, DECK_P2 } from "../../data/cards";
import { freshGame, giveHand } from "./helpers";

describe("setup", () => {
  it("deals 4-card opening hands, leaving the rest in each deck", () => {
    const s = createInitialState(1);
    expect(s.players.P1.hand).toHaveLength(4);
    expect(s.players.P2.hand).toHaveLength(4);
    expect(s.players.P1.deck).toHaveLength(DECK_P1.length - 4);
    expect(s.players.P2.deck).toHaveLength(DECK_P2.length - 4);
    expect(s.phase).toBe("mulligan");
  });

  it("every card's cost matches the stat formula (total ≈ 5·cost + 10)", () => {
    // shields count 2 points each; source-printed costs may drift ±2 total.
    // Skeleton Knight's Bone Shield is a passive grant priced outside the total.
    // Cost-8 Legendaries sit in the tier band (40-50 total) rather than the
    // exact formula, and pay part of their cost in strong abilities/immunity.
    const exceptions = new Set([
      "dusk_skeleton_knight",
      "bore_bearocks",
      "dusk_skelider",
      // SP-heavy canon glass cannon: the doc costs it at 1 despite the high
      // SP inflating the stat total.
      "dawn_sparkle",
      // Cost-10 Mythics sit in the tier band (55-67 total) above the exact
      // formula — they pay part of their cost in spawns / auras / on-kill snowball.
      "gale_griffith",
      "bolt_elecdroid",
      "dusk_shadowhorsemen",
      "bore_deepest",
    ]);
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
  it("returns a subset, reshuffles, redraws to 4", () => {
    const s = freshGame(3);
    const toss = s.players.P1.hand.slice(0, 2).map((h) => h.handId);
    const next = applyIntent(s, { type: "MULLIGAN", player: "P1", returnHandIds: toss });
    expect(next.players.P1.hand).toHaveLength(4);
    expect(next.players.P1.deck).toHaveLength(DECK_P1.length - 4);
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
    // round 1: opening 4 + drew 1 = hand 5, summon pool 1, magic 0 + round-1 drip 1.
    // (P2 may already have spent its summon pool if it won the coin flip.)
    expect(s.players.P1.hand).toHaveLength(5);
    expect(s.players.P1.summonPool).toBe(1);
    expect(s.players.P1.magicPool).toBe(1);
    expect(s.players.P2.summonPool).toBeLessThanOrEqual(1);
  });
});

describe("draw math", () => {
  it("draws 1 per normal round, 3 on rounds 10 and 15", () => {
    for (const [round, expected] of [
      [4, 1],
      [5, 1], // no longer a bonus round
      [10, 3],
      [15, 3],
      [20, 1],
    ] as const) {
      const s = freshGame(9);
      s.phase = "draw";
      s.round = round;
      const before = s.players.P1.hand.length;
      const next = advance(s);
      expect(next.players.P1.hand.length - before, `round ${round}`).toBe(expected);
    }
  });

  it("has no hand cap — draws keep filling the hand", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 10; // draws 3
    // pad hand well past the old cap of 7
    while (s.players.P1.hand.length < 9)
      s.players.P1.hand.push({ handId: `h${s.nextId++}`, defId: "leaf_alpha" });
    const before = s.players.P1.hand.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(before + 3);
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

describe("resource math (two pools)", () => {
  it("summon pool gains min(round, 10); magic gains +1 in the 1–5 bracket", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 4;
    s.players.P1.summonPool = 0;
    s.players.P1.magicPool = 3;
    const next = advance(s);
    expect(next.players.P1.summonPool).toBe(4);
    expect(next.players.P1.magicPool).toBe(4); // +1 (rounds 1–5)
  });

  it("magic gain scales in 5-round brackets (1/2/3/4)", () => {
    const gain = (round: number) => {
      const s = freshGame(9);
      s.phase = "resource";
      s.round = round;
      s.players.P1.magicPool = 3;
      return advance(s).players.P1.magicPool - 3;
    };
    expect(gain(5)).toBe(1); // last of the 1–5 bracket
    expect(gain(6)).toBe(2); // first of 6–10
    expect(gain(10)).toBe(2);
    expect(gain(11)).toBe(3); // first of 11–15
    expect(gain(15)).toBe(3);
    expect(gain(16)).toBe(4); // 16+ caps at +4
    expect(gain(30)).toBe(4);
  });

  it("summon pool still caps its per-round gain at min(round, 10)", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 12;
    s.players.P1.summonPool = 0;
    s.players.P1.magicPool = 3;
    const next = advance(s);
    expect(next.players.P1.summonPool).toBe(10); // still min(round, 10)
    expect(next.players.P1.magicPool).toBe(6); // 3 + 3 (11–15 bracket)
  });

  it("magic starts at 0 and drips +1 on round 1", () => {
    const s = freshGame(9);
    expect(s.players.P1.magicPool).toBe(0);
    s.phase = "resource";
    s.round = 1;
    const next = advance(s);
    expect(next.players.P1.magicPool).toBe(1); // 0 + round-1 bracket (+1)
    expect(next.players.P1.summonPool).toBe(1);
  });

  it("both pools cap carryover at 10 before the gain", () => {
    const s = freshGame(9);
    s.phase = "resource";
    s.round = 3;
    s.players.P1.summonPool = 14; // carryover clamps to 10
    s.players.P1.magicPool = 14;
    const next = advance(s);
    expect(next.players.P1.summonPool).toBe(13);
    expect(next.players.P1.magicPool).toBe(11);
  });

  it("prep initiative alternates each round (odd = coin-flip winner)", () => {
    const first = (round: number) => {
      const s = freshGame(9);
      s.firstPlayer = "P1";
      s.phase = "resource";
      s.round = round;
      return advance(s).prep?.priority;
    };
    expect(first(1)).toBe("P1"); // odd → coin-flip winner
    expect(first(2)).toBe("P2"); // even → the opponent
    expect(first(3)).toBe("P1");
  });

  it("the pools never drain each other", () => {
    const s = freshGame(9);
    s.players.P1.mulliganDone = true;
    s.players.P2.mulliganDone = true;
    s.round = 4;
    s.phase = "prep";
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    s.players.P1.summonPool = 5;
    s.players.P1.magicPool = 5;
    const handId = giveHand(s, "P1", "leaf_greegon"); // cost 3
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 0 });
    expect(next.players.P1.summonPool).toBe(2);
    expect(next.players.P1.magicPool).toBe(5); // untouched
  });
});
