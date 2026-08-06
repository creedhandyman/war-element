// Opening deployment (§10.6): each side leads with one FREE teammate before
// round one, then the ordinary game resumes. Story-only, so the first thing
// these tests pin is that a normal battle is unaffected.

import { describe, expect, it } from "vitest";
import { advance, applyIntent, createInitialState, getDef } from "../index";
import { OPENING_SLOTS } from "../phases";
import { OPENING_COST_CAP } from "../types";
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

describe("opening deployment: the head start is the PLAYER'S alone", () => {
  it("places for P1 and nothing for P2, then hands over cleanly", () => {
    // The campaign passes { P1: 1, P2: 0 }. The enemy already fields a whole
    // deck matched to the player's card count with a rarity profile on top, so
    // a free placement was paying difficulty into the side that needed it least.
    const s = runUntil(pastMulligan({ P1: 1, P2: 0 }), (g) => !g.opening);
    expect(onBoard(s, "P1"), "the player leads with one").toBe(1);
    expect(onBoard(s, "P2"), "the opponent leads with none").toBe(0);
    // And the phase actually RESOLVED rather than stalling on a side with no
    // legal opening summon — canSummon fails on zero slots, aiPrepIntent falls
    // through to PASS, and two consecutive passes end deployment as usual.
    expect(s.opening).toBeUndefined();
    expect(s.round).toBe(1);
  });

  it("still ends deployment when NEITHER side can place", () => {
    // Belt and braces: the two-pass exit must not depend on anyone summoning.
    const s = runUntil(pastMulligan({ P1: 0, P2: 0 }), (g) => !g.opening);
    expect(s.opening).toBeUndefined();
    expect(onBoard(s, "P1")).toBe(0);
    expect(onBoard(s, "P2")).toBe(0);
  });
});

describe("opening deployment", () => {
  it("does not touch a battle that never asked for it", () => {
    const s = pastMulligan();
    expect(s.opening).toBeUndefined();
    expect(s.round).toBe(1);              // straight into round one
    expect(onBoard(s, "P1")).toBe(0);     // nothing pre-placed
    expect(onBoard(s, "P2")).toBe(0);
  });

  it("opens before round one and costs nothing", () => {
    const s = pastMulligan({ P1: OPENING_SLOTS, P2: OPENING_SLOTS });
    expect(s.round).toBe(0);              // still pre-round
    expect(s.phase).toBe("prep");
    // No budget at all — the placement is the head start.
    expect(s.players.P1.gold).toBe(0);
    expect(s.players.P2.gold).toBe(0);
  });

  it("places a card the player could not yet afford", () => {
    // The point of "free": at 0 gold nothing is summonable under the normal
    // rules, so if gold still gated this, deployment would place nothing.
    const s = runUntil(pastMulligan({ P1: 1, P2: 1 }), (g) => g.round >= 1);
    expect(onBoard(s, "P1")).toBe(1);
    expect(onBoard(s, "P2")).toBe(1);
  });

  it("leads with exactly one teammate, not a formation", () => {
    const s = runUntil(pastMulligan({ P1: 1, P2: 1 }), (g) => g.round >= 1);
    expect(s.round).toBe(1);
    for (const p of ["P1", "P2"] as PlayerId[]) {
      expect(onBoard(s, p), `${p} deployed nothing`).toBe(1);
    }
  });

  it("lets a Throne lead with two against your one", () => {
    const s = runUntil(pastMulligan({ P1: 1, P2: 2 }), (g) => g.round >= 1);
    expect(onBoard(s, "P1")).toBe(1);
    expect(onBoard(s, "P2")).toBe(2);
  });

  it("never places more than the home row can hold", () => {
    // A summon lands in the home row, which is exactly boardSize wide.
    const s = runUntil(pastMulligan({ P1: 9, P2: 9 }), (g) => g.round >= 1);
    for (const p of ["P1", "P2"] as PlayerId[])
      expect(onBoard(s, p), `${p} overflowed the home row`).toBeLessThanOrEqual(4);
  });

  it("leaves the round economy exactly where it would have been", () => {
    // "Then a traditional game": round one pays its normal +1 and nothing else.
    // doResourcePhase CARRIES gold (capped) before adding income, so any stray
    // deployment gold would silently inflate the first turn.
    const s = runUntil(pastMulligan({ P1: 1, P2: 1 }), (g) => g.round >= 1 && g.phase === "prep");
    for (const p of ["P1", "P2"] as PlayerId[])
      expect(s.players[p].gold, `${p} round-1 gold`).toBeLessThanOrEqual(1);
  });

  it("clears the flag once deployment is over", () => {
    const s = runUntil(pastMulligan({ P1: 1, P2: 1 }), (g) => g.round >= 1);
    expect(s.opening).toBeUndefined();
  });

  it("refuses to place past the slot cap", () => {
    const s = pastMulligan({ P1: 1, P2: 1 });
    const p = s.prep!.priority;                 // the coin flip decides who starts
    const first = s.players[p].hand[0];
    const after = applyIntent(s, { type: "SUMMON", player: p, handId: first.handId, col: 0 });
    expect(after.opening![p]).toBe(0);
    const second = after.players[p].hand[0];
    expect(() =>
      applyIntent(after, { type: "SUMMON", player: p, handId: second.handId, col: 1 }),
    ).toThrow(/deployment slots/i);
  });

  it("locks movement until the first round", () => {
    const s = pastMulligan({ P1: 1, P2: 1 });
    expect(s.prep?.movedThisTurn).toBe(true);
  });

  it("reaches a real battle from a deployed board", () => {
    // End to end: the whole point is that round one starts from a full board.
    const s = runUntil(pastMulligan({ P1: 1, P2: 1 }), (g) => g.phase === "battle");
    expect(s.phase).toBe("battle");
    expect(s.round).toBeGreaterThanOrEqual(1);
  });
});


describe("opening deployment: the cost ceiling", () => {
  it("refuses a card above the ceiling even though the placement is free", () => {
    // Without this, "free" means cost stops mattering for exactly one card and
    // every side simply leads with the biggest thing it drew.
    const heavy = ["leaf_oakgre", "leaf_trinezer", "leaf_nightshade", "leaf_fallow",
      "leaf_warden", "leaf_efy", "leaf_season", "leaf_thorn", "leaf_elderroot",
      "leaf_nettle", "leaf_weeds", "leaf_birch"];
    let s = createInitialState(7, heavy, heavy, [], [], [], 4, { P1: 1, P2: 1 });
    for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
    const p = s.prep!.priority;
    const dear = s.players[p].hand.find((h) => getDef(h.defId).cost > OPENING_COST_CAP);
    if (!dear) return;                       // hand happened to be all cheap
    expect(() => applyIntent(s, { type: "SUMMON", player: p, handId: dear.handId, col: 0 }))
      .toThrow(new RegExp(`cost ${OPENING_COST_CAP}`, "i"));
  });

  it("only ever leads with something at or under the ceiling", () => {
    const s = runUntil(pastMulligan({ P1: 1, P2: 1 }), (g) => g.round >= 1);
    for (const c of Object.values(s.cards))
      if (c.pos) expect(getDef(c.defId).cost, `${c.defId} led`).toBeLessThanOrEqual(OPENING_COST_CAP);
  });
});