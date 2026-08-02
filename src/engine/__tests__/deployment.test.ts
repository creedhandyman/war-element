// Opening deployment (§10.6): both sides place a board before round one, out of
// a fixed budget that is NOT part of the round economy. Story-only for now, so
// the first thing these tests pin is that an ordinary battle is unaffected.

import { describe, expect, it } from "vitest";
import { advance, applyIntent, createInitialState, getDef } from "../index";
import { OPENING_GOLD, openingGoldFor } from "../phases";
import type { GameState, PlayerId } from "../index";

const DECK = [
  "leaf_nettle", "leaf_weeds", "leaf_birch", "leaf_stickers",
  "leaf_oak", "leaf_python", "leaf_sticks", "leaf_cactus",
  "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

/** Run to the point where both sides have mulliganed. */
function pastMulligan(opening?: { P1: number; P2: number }): GameState {
  let s = createInitialState(7, DECK, DECK, [], [], [], 4, opening);
  for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
  return s;
}

/** Drive the fully-AI game forward until `stop` says so, or we run out of road. */
function runUntil(s: GameState, stop: (g: GameState) => boolean, max = 400): GameState {
  for (let i = 0; i < max && !stop(s); i++) s = advance(s);
  return s;
}

const onBoard = (s: GameState, p: PlayerId) =>
  Object.values(s.cards).filter((c) => c.owner === p && c.pos).length;

describe("opening deployment", () => {
  it("does not touch a battle that never asked for it", () => {
    const s = pastMulligan();
    expect(s.opening).toBeUndefined();
    expect(s.round).toBe(1);              // straight into round one
    expect(onBoard(s, "P1")).toBe(0);     // nothing pre-placed
    expect(onBoard(s, "P2")).toBe(0);
  });

  it("hands both sides the budget before round one", () => {
    const s = pastMulligan({ P1: 4, P2: 4 });
    expect(s.round).toBe(0);              // still pre-round
    expect(s.phase).toBe("prep");
    expect(s.players.P1.gold).toBe(OPENING_GOLD);
    expect(s.players.P2.gold).toBe(OPENING_GOLD);
  });

  it("fills a board before round one and never exceeds the slot cap", () => {
    const s = runUntil(pastMulligan({ P1: 4, P2: 4 }), (g) => g.round >= 1);
    expect(s.round).toBe(1);
    for (const p of ["P1", "P2"] as PlayerId[]) {
      expect(onBoard(s, p), `${p} deployed nothing`).toBeGreaterThan(0);
      expect(onBoard(s, p), `${p} exceeded its slots`).toBeLessThanOrEqual(4);
    }
  });

  it("spends a boss lever as bigger cards when the board is too small for more", () => {
    // A summon lands in the home row, which is exactly boardSize wide — so 6
    // slots on a 4x4 is physically impossible and would silently do nothing.
    // The budget still scales, so the Throne fields FOUR HEAVIER cards.
    expect(openingGoldFor(6)).toBeGreaterThan(openingGoldFor(4));
    const s = runUntil(pastMulligan({ P1: 4, P2: 6 }), (g) => g.round >= 1);
    expect(onBoard(s, "P2")).toBeLessThanOrEqual(4);       // clamped to the board
    const spent = (p: PlayerId) =>
      Object.values(s.cards).filter((c) => c.owner === p && c.pos)
        .reduce((t, c) => t + getDef(c.defId).cost, 0);
    expect(spent("P2"), "boss lever bought nothing").toBeGreaterThan(spent("P1"));
  });

  it("does field extra bodies once the board is wide enough", () => {
    let s = createInitialState(7, DECK, DECK, [], [], [], 5, { P1: 4, P2: 5 });
    for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
    s = runUntil(s, (g) => g.round >= 1);
    expect(onBoard(s, "P2")).toBeGreaterThan(onBoard(s, "P1"));
  });

  it("spends it or loses it — leftover budget never reaches round one", () => {
    // The trap: doResourcePhase CARRIES unspent gold (capped) and then adds the
    // round income on top, so an unspent deployment budget would silently become
    // an 11-gold round one.
    const s = runUntil(pastMulligan({ P1: 4, P2: 4 }), (g) => g.round >= 1);
    for (const p of ["P1", "P2"] as PlayerId[])
      expect(s.players[p].gold, `${p} carried deployment gold`).toBeLessThanOrEqual(1);
  });

  it("clears the flag once deployment is over", () => {
    const s = runUntil(pastMulligan({ P1: 4, P2: 4 }), (g) => g.round >= 1);
    expect(s.opening).toBeUndefined();
  });

  it("refuses to place past the slot cap even with gold to spare", () => {
    const s = pastMulligan({ P1: 1, P2: 1 });
    const p = s.prep!.priority;                 // the coin flip decides who starts
    const first = s.players[p].hand[0];
    const after = applyIntent(s, { type: "SUMMON", player: p, handId: first.handId, col: 0 });
    expect(after.opening![p]).toBe(0);
    // Gold remains, slots do not.
    expect(after.players[p].gold).toBeGreaterThan(0);
    const second = after.players[p].hand[0];
    expect(() =>
      applyIntent(after, { type: "SUMMON", player: p, handId: second.handId, col: 1 }),
    ).toThrow(/deployment slots/i);
  });

  it("locks movement until the first round", () => {
    const s = pastMulligan({ P1: 4, P2: 4 });
    expect(s.prep?.movedThisTurn).toBe(true);
  });

  it("reaches a real battle from a deployed board", () => {
    // End to end: the whole point is that round one starts from a full board.
    const s = runUntil(pastMulligan({ P1: 4, P2: 4 }), (g) => g.phase === "battle");
    expect(s.phase).toBe("battle");
    expect(s.round).toBeGreaterThanOrEqual(1);
  });
});
