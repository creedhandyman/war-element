// Milestone 6: slot capture by survival + both win conditions.

import { describe, expect, it } from "vitest";
import { advance, applyIntent, needsInput } from "../phases";
import { boardCards, hasCaptureWin, isContested, isEliminated, spawnTokens } from "../state";
import { createInitialState } from "../index";
import { seatsOf } from "../types";
import { DOMINATION_7X7, newDomination } from "../../data/domination";
import type { GameState, PlayerId } from "../types";
import { atCleanup, place, prepState } from "./helpers";

const DECK = [
  "leaf_oak", "leaf_python", "leaf_birch", "leaf_stickers", "leaf_nettle", "leaf_weeds",
  "leaf_sticks", "leaf_cactus", "leaf_leaf", "leaf_stickviper", "leaf_hunter", "leaf_walking_tree",
];

describe("surrender", () => {
  it("P1 surrender ends the game as a P2 win", () => {
    const s = prepState();
    place(s, "leaf_alpha", "P1", 3, 0); // both sides still have cards
    place(s, "dusk_gool", "P2", 0, 0);
    const next = applyIntent(s, { type: "SURRENDER", player: "P1" });
    expect(next.phase).toBe("gameover");
    expect(next.win).toEqual({ winner: "P2", by: "surrender" });
    expect(next.prep).toBeNull();
  });

  it("surrendering an already-over game is a no-op", () => {
    const s = prepState();
    s.phase = "gameover";
    s.win = { winner: "P1", by: "capture" };
    const next = applyIntent(s, { type: "SURRENDER", player: "P2" });
    expect(next.win).toEqual({ winner: "P1", by: "capture" });
  });
});

// ── 3-4 SEATS ────────────────────────────────────────────────────────────
//
// Every rule that ends a match used to be written for two players. The loop
// that awards an elimination iterated every seat but asked
// `isEliminated(draft, enemyOf(player))`, and `enemyOf` only has an answer for
// P1 and P2 — so on a four-player map the match ended the instant either of
// them emptied and handed it to the other, whatever P3 and P4 were doing.
// Measured over 150 four-seat AI games: 85 ended that way, 83 of them with two
// or more seats still alive, and two declared a winner that was itself dead.
//
// The surrender path had the same shape, which made conceding a one-click way
// to hand the match to P1 from any seat.
describe("a match with more than two seats", () => {
  /** A live 4-seat game parked in Prep, every seat AI so nothing waits. */
  function fourSeat(): GameState {
    const extra = [
      { id: "P3" as PlayerId, deck: [...DECK] },
      { id: "P4" as PlayerId, deck: [...DECK] },
    ];
    let s = createInitialState(9, [...DECK], [...DECK], [], undefined, undefined,
      7, undefined, undefined, undefined, extra);
    s.domination = newDomination(DOMINATION_7X7);
    for (const p of seatsOf(s)) s.players[p].mulliganDone = true;
    for (let i = 0; i < 40 && s.phase === "mulligan"; i++) s = advance(s);
    s.phase = "prep";
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    return s;
  }

  /** Board, hand and deck gone — what `isEliminated` asks about. */
  function empty(s: GameState, p: PlayerId) {
    for (const c of boardCards(s, p)) delete s.cards[c.instanceId];
    s.players[p].hand = [];
    s.players[p].deck = [];
  }

  it("does not end when ONE seat empties", () => {
    // The whole reason this change exists. On the old rule P2 emptying was
    // instantly "P1 WINS by elimination" with P3 and P4 mid-match.
    const s = fourSeat();
    for (const p of ["P1", "P3", "P4"] as PlayerId[]) place(s, "leaf_alpha", p, 3, 1 + Number(p[1]));
    empty(s, "P2");
    const next = advance(atCleanup(s));
    expect(next.win, "the match ended on one seat emptying").toBeNull();
    expect(next.phase).not.toBe("gameover");
  });

  it("gives it to the last seat standing, even when that is P4", () => {
    // A seat `enemyOf` can never name, winning. Impossible before this.
    const s = fourSeat();
    place(s, "leaf_alpha", "P4", 3, 5);
    for (const p of ["P1", "P2", "P3"] as PlayerId[]) empty(s, p);
    const next = advance(atCleanup(s));
    expect(next.win).toEqual({ winner: "P4", by: "elimination" });
  });

  it("does not crown a dead seat while two are still alive", () => {
    // Measured twice in 300 games: P1 and P2 both gone, P3 and P4 still
    // playing, and the engine announced "P1 WINS by elimination".
    const s = fourSeat();
    place(s, "leaf_alpha", "P3", 3, 2);
    place(s, "leaf_alpha", "P4", 3, 5);
    empty(s, "P1");
    empty(s, "P2");
    const next = advance(atCleanup(s));
    expect(next.win).toBeNull();
  });

  it("a concession removes that seat and the match goes on", () => {
    const s = fourSeat();
    for (const p of seatsOf(s)) place(s, "leaf_alpha", p, 3, 1 + Number(p[1]));
    const next = applyIntent(s, { type: "SURRENDER", player: "P3" });
    expect(next.win, "a concession from P3 ended the whole match").toBeNull();
    expect(next.phase).not.toBe("gameover");
    expect(isEliminated(next, "P3"), "the conceding seat is still in it").toBe(true);
    expect(boardCards(next, "P3")).toHaveLength(0);
  });

  it("a concession that leaves one seat ends it — for the survivor", () => {
    const s = fourSeat();
    place(s, "leaf_alpha", "P1", 3, 1);
    place(s, "leaf_alpha", "P4", 3, 5);
    empty(s, "P2");
    empty(s, "P3");
    const next = applyIntent(s, { type: "SURRENDER", player: "P4" });
    expect(next.win).toEqual({ winner: "P1", by: "surrender" });
  });

  it("a concession is not a kill and credits nobody", () => {
    // `removeCard`, not `defeatCard`: conceding must not fire death triggers
    // or pad anyone's stats.
    const s = fourSeat();
    for (const p of seatsOf(s)) place(s, "leaf_alpha", p, 3, 1 + Number(p[1]));
    const before = JSON.stringify(s.stats ?? {});
    const next = applyIntent(s, { type: "SURRENDER", player: "P3" });
    expect(JSON.stringify(next.stats ?? {})).toBe(before);
  });

  it("never asks a seat that is out to take another turn", () => {
    // A human who decks out was still handed Prep priority every round for the
    // rest of a match they could no longer act in.
    const s = fourSeat();
    s.humans = ["P1", "P2", "P3", "P4"];
    place(s, "leaf_alpha", "P1", 3, 1);
    empty(s, "P3");
    s.prep = { priority: "P3", consecutivePasses: 0, movedThisTurn: false };
    expect(needsInput(s), "an emptied seat was asked to act").toBeNull();
    s.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    expect(needsInput(s), "a live seat stopped being asked").toBe("P1");
  });
});

describe("a mutual wipe", () => {
  it("is a draw, not a win for whoever the loop reached first", () => {
    // The one deliberate two-seat behaviour change in all of this. Both sides
    // emptying in the same Cleanup used to award the match to P1 on the order
    // the loop happened to run in.
    const s = prepState();
    for (const p of ["P1", "P2"] as PlayerId[]) {
      s.players[p].hand = [];
      s.players[p].deck = [];
    }
    const next = advance(atCleanup(s));
    expect(next.win).toEqual({ winner: null, by: "elimination" });
    expect(next.log.join(" ")).toContain("Every side is spent");
  });
});

describe("slot capture", () => {
  it("an invader on a home slot contests it (blocks summons) but hasn't captured yet", () => {
    const s = prepState();
    place(s, "dusk_vamp", "P2", 3, 1); // P2 invader on P1 home
    expect(isContested(s, "P1", 1)).toBe(true);
    expect(s.slots[3][1].capturedBy).toBeNull();
  });

  it("an invader that survives through Cleanup captures the slot permanently", () => {
    const s = prepState();
    place(s, "dusk_vamp", "P2", 3, 1);
    place(s, "leaf_alpha", "P1", 2, 0); // both sides keep a card
    const next = advance(atCleanup(s));
    expect(next.slots[3][1].capturedBy).toBe("P2");
  });

  it("if the invader dies before round end, the slot reopens (no capture)", () => {
    const s = prepState();
    const invader = place(s, "dusk_vamp", "P2", 3, 1, {
      curHp: 2,
      status: { kind: "BURN", duration: 1, power: 3, source: "PYRO" }, // dies to DOT in Cleanup
    });
    place(s, "leaf_alpha", "P1", 2, 0);
    place(s, "dusk_gool", "P2", 0, 0);
    const next = advance(atCleanup(s));
    expect(next.cards[invader.instanceId]).toBeUndefined();
    expect(next.slots[3][1].capturedBy).toBeNull();
    expect(isContested(next, "P1", 1)).toBe(false);
  });
});

describe("win conditions", () => {
  it("capture win: holding/having captured all 4 enemy home slots", () => {
    const s = prepState();
    s.slots[0][0].capturedBy = "P1";
    s.slots[0][1].capturedBy = "P1";
    s.slots[0][2].capturedBy = "P1";
    place(s, "pyro_fenrir", "P1", 0, 3); // 4th slot currently occupied — captures at cleanup
    place(s, "dusk_gool", "P2", 1, 0);
    const next = advance(atCleanup(s));
    expect(next.phase).toBe("gameover");
    expect(next.win).toEqual({ winner: "P1", by: "capture" });
  });

  it("elimination win: opponent has no board, no hand, no deck", () => {
    const s = prepState();
    place(s, "leaf_alpha", "P1", 3, 0);
    s.players.P2.hand = [];
    s.players.P2.deck = [];
    const next = advance(atCleanup(s));
    expect(next.phase).toBe("gameover");
    expect(next.win).toEqual({ winner: "P1", by: "elimination" });
  });

  it("no premature elimination while the opponent still has cards in hand or deck", () => {
    const s = prepState();
    place(s, "leaf_alpha", "P1", 3, 0);
    // P2 board empty but hand/deck stocked (default prepState)
    const next = advance(atCleanup(s));
    expect(next.phase).toBe("draw");
    expect(next.win).toBeNull();
  });

  it("capture takes precedence when both trigger in the same Cleanup", () => {
    const s = prepState();
    // P1 holds all four P2 home slots AND P2 is fully eliminated.
    s.slots[0][0].capturedBy = "P1";
    s.slots[0][1].capturedBy = "P1";
    s.slots[0][2].capturedBy = "P1";
    s.slots[0][3].capturedBy = "P1";
    s.players.P2.hand = [];
    s.players.P2.deck = [];
    place(s, "leaf_alpha", "P1", 3, 0);
    const next = advance(atCleanup(s));
    expect(next.win).toEqual({ winner: "P1", by: "capture" });
  });
});

// SPAWNING IS NOT A LOOPHOLE ROUND CAPTURE.
//
// `summonLandingRow`'s forward hatch was closed in a duel because letting a seat
// answer a captured Home row was answering a game it had already lost. Spawning
// was the same hole one door along: tokens never go near the Home row, so a seat
// whose back line was entirely held still conjured fresh bodies — and their only
// remaining job was to kill the occupiers before Cleanup could score them.
//
// The gate is the LOST state, not merely a blocked one. A seat jammed by its own
// bodies keeps every spawn, because that is an ordinary crowded board it can fix
// by moving a card.
describe("a seat whose Home row is already theirs cannot spawn its way out", () => {
  const spawnerAt = (s: GameState, row: number, col: number) =>
    place(s, "bolt_zipp", "P2", row, col);

  it("refuses while the opponent holds every one of its Home slots", () => {
    const s = prepState();
    const home = 0; // P2's home row on the 4x4
    for (let c = 0; c < s.boardSize; c++) place(s, "leaf_alpha", "P1", home, c);
    expect(hasCaptureWin(s, "P1"), "not actually the lost state").toBe(true);
    const sp = spawnerAt(s, 1, 1);
    expect(spawnTokens(s, sp, "bolt_drone_tok", 1)).toEqual([]);
  });

  it("...but a row jammed by its OWN bodies still spawns", () => {
    // Not lost, just crowded — and one move re-opens it. Blocking here would
    // punish a seat for holding its own line, which is what pays its income.
    const s = prepState();
    for (let c = 0; c < s.boardSize; c++) place(s, "dusk_vamp", "P2", 0, c);
    expect(hasCaptureWin(s, "P1")).toBe(false);
    const sp = spawnerAt(s, 1, 1);
    expect(spawnTokens(s, sp, "bolt_drone_tok", 1).length).toBe(1);
  });

  it("...and the Tower is exempt, where capture does not exist", () => {
    const s = prepState();
    s.voidTower = true;
    for (let c = 0; c < s.boardSize; c++) place(s, "leaf_alpha", "P1", 0, c);
    const sp = spawnerAt(s, 1, 1);
    expect(spawnTokens(s, sp, "bolt_drone_tok", 1).length).toBe(1);
  });
});
