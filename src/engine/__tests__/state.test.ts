// Milestone 1: state, decks, shuffle/deal, mulligan, draw math, resources.

import { describe, expect, it } from "vitest";
import { createInitialState } from "../state";
import { canSummon } from "../rules";
import { homeRow } from "../types";
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
    // Cost-8 Legendaries sit in the tier band (40-50 total) rather than the
    // exact formula, and pay part of their cost in strong abilities/immunity.
    const exceptions = new Set([
      "bore_bearocks",
      "dusk_skelider",
      // SP-heavy canon glass cannons: the doc keeps the high SP despite it
      // inflating the stat total past the ±2 band.
      "dawn_sparkle",
      "gale_toxhawk",
      // Cost-10 Mythics sit in the tier band (55-67 total) above the exact
      // formula — they pay part of their cost in spawns / auras / on-kill snowball.
      "gale_griffith",
      "bolt_elecdroid",
      "dusk_shadowhorsemen",
      "bore_deepest",
      // Promoted token. Sits 6 BELOW the formula, the opposite direction from
      // the mythics above: its stat line was drawn for something you get spawned
      // for free, and the power lives in Crowned + King Me instead. Left as
      // printed so a spawned copy behaves identically to a drafted one.
      // (Reptilian used to be here too. Its SP buffs brought it to 13 vs 15,
      // inside the band, so it is held to the formula again like anything else.)
      "dawn_heir_tok",
      // Ability-carried, same reasoning as the mythics above but downward: 31 vs
      // 35. War Mount hands it +5 shield on arrival AND a permanent +6 on every
      // basic landed from melee range — comfortably more than the 4 points the
      // printed line gives up.
      "bore_rohojohn",
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

  it("caps the hand at 7 — a bonus-draw round only fills up to the cap", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 10; // draws 3
    // Pad to 6 so a 3-draw would overshoot the cap of 7.
    while (s.players.P1.hand.length < 6)
      s.players.P1.hand.push({ handId: `h${s.nextId++}`, defId: "leaf_alpha" });
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(7); // 6 → 7, not 9
  });

  it("a hand already at the cap draws nothing, leaving cards on the deck", () => {
    const s = freshGame(9);
    s.phase = "draw";
    s.round = 4; // would draw 1
    while (s.players.P1.hand.length < 7)
      s.players.P1.hand.push({ handId: `h${s.nextId++}`, defId: "leaf_alpha" });
    const deckBefore = s.players.P1.deck.length;
    const next = advance(s);
    expect(next.players.P1.hand.length).toBe(7);
    expect(next.players.P1.deck.length).toBe(deckBefore); // not burned
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

describe("board size lives on the state", () => {
  it("defaults to 4x4", () => {
    const s = createInitialState(1);
    expect(s.boardSize).toBe(4);
    expect(s.slots.length).toBe(4);
    expect(s.slots.every((r) => r.length === 4)).toBe(true);
  });

  it("a 5x5 match really is 5x5 — slots and bounds both follow the state", () => {
    const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], undefined, undefined, 5);
    expect(s.boardSize).toBe(5);
    expect(s.slots.length).toBe(5);
    expect(s.slots.every((r) => r.length === 5)).toBe(true);
  });

  it("homeRow follows the board: P1 defends the far edge, P2 always row 0", () => {
    // The bug this replaced: a hardcoded 0|3 put P1's home in the MIDDLE of a
    // 5x5 and left the last row as dead ground nothing could summon into.
    expect(homeRow("P2", 4)).toBe(0);
    expect(homeRow("P1", 4)).toBe(3);
    expect(homeRow("P2", 5)).toBe(0);
    expect(homeRow("P1", 5)).toBe(4);
  });

  it("column 4 is summonable on a 5x5 and rejected on a 4x4", () => {
    // The real proof the refactor bites: the column bound is read from
    // state.boardSize, not from a module constant. Col 4 does not exist on the
    // standard board and must still be refused there.
    const arm = (size: number) => {
      const s = createInitialState(1, "leaf_pyro", "bore_dusk", ["P1"], undefined, undefined, size);
      s.players.P1.mulliganDone = true;
      s.players.P2.mulliganDone = true;
      s.round = 1;
      s.phase = "prep";
      s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
      s.players.P1.summonPool = 9;
      const handId = `h${s.nextId++}`;
      s.players.P1.hand.push({ handId, defId: "leaf_greegon" });
      return { s, handId };
    };
    const big = arm(5);
    expect(canSummon(big.s, "P1", big.handId, 4).ok).toBe(true);
    const std = arm(4);
    expect(canSummon(std.s, "P1", std.handId, 4).ok).toBe(false);
  });
});

describe("rarity floor: a Special is an epic-and-up privilege", () => {
  it("no RARE card carries a Special — talents excepted", () => {
    // Design rule, not a mechanic: rarity is cosmetic (Deck Builder sorting and
    // a badge), so nothing enforces this at runtime and a rare could quietly
    // ship with a Special again. A TALENT is deliberately exempt — it costs 0,
    // fires free exactly once per game and is then spent, which is a different
    // thing from a repeatable Special even though it rides the same field.
    const offenders = CARDS.filter(
      (c) => c.rarity === "rare" && c.special && !c.special.talent,
    ).map((c) => `${c.id} (${c.special!.name})`);
    expect(offenders, `rare cards with a Special:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("the talent exemption is narrow — exactly one card uses it", () => {
    // If this count climbs, "talents are exempt" has quietly become a loophole
    // for putting Specials on rares.
    const talents = CARDS.filter((c) => c.rarity === "rare" && c.special?.talent);
    expect(talents.map((c) => c.id)).toEqual(["leaf_alpha"]);
  });
});
