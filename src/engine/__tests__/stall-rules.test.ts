// STALLED FIGHTS (retention review, 2026-10-17): two opt-in rules that end a dead
// board on the board instead of playing it out to round 50.
//   deadlockRounds — the end-of-round board unchanged that many rounds running;
//   roundCap       — a shorter round limit than MAX_ROUNDS.
// Both are OFF unless a mode sets them, so nothing else changes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advance, type GameState } from "..";
import { MAX_ROUNDS } from "../types";
import { boardSignature } from "../phases";
import { STORY_DEADLOCK_ROUNDS, STORY_ROUND_CAP } from "../../data/story";
import { atCleanup, place, prepState } from "./helpers";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8").replace(/\r\n/g, "\n");

/** Two cards that never meet, decks and hands empty, parked at the end of a round. */
function frozen(round = 5): GameState {
  const s = prepState(7, "P1");
  for (const p of ["P1", "P2"] as const) { s.players[p].deck = []; s.players[p].hand = []; }
  place(s, "leaf_birch", "P1", 3, 0);
  place(s, "leaf_birch", "P2", 0, 3);
  s.round = round;
  return atCleanup(s);
}

/** Run one Cleanup on a copy, then put the state back at the end of the NEXT round. */
function nextRoundEnd(s: GameState): GameState {
  let t = advance(s);
  if (t.phase === "gameover") return t;
  for (const p of ["P1", "P2"] as const) { t.players[p].deck = []; t.players[p].hand = []; }
  t = atCleanup(t);
  return t;
}

describe("deadlockRounds", () => {
  it("ends a board that has not changed for that many rounds, on the board", () => {
    let s = frozen();
    s.deadlockRounds = 3;
    let rounds = 0;
    while (s.phase !== "gameover" && rounds < 20) { s = nextRoundEnd(s); rounds++; }
    expect(s.phase).toBe("gameover");
    expect(s.win?.by).toBe("deadlock");
    // 1 round to record the board, then 3 repeats.
    expect(rounds).toBe(4);
    expect(s.log.some((l) => /stalemate/.test(l))).toBe(true);
  });

  it("a board that changes resets the count", () => {
    let s = frozen();
    s.deadlockRounds = 3;
    s = nextRoundEnd(s); s = nextRoundEnd(s);
    // A Home slot is locked: not a stall any more. (Not a point of damage — LEAF
    // regenerates it by the end of the round, which is exactly the heal-undoes-chip
    // loop this rule is meant to treat as a stall.)
    s.slots[0][0].capturedBy = "P1";
    s = nextRoundEnd(s);
    expect(s.phase).not.toBe("gameover");
    expect(s.deadlock?.idle).toBe(0);
  });

  it("is off unless asked for: the same frozen board just plays on", () => {
    let s = frozen();
    for (let i = 0; i < 12 && s.phase !== "gameover"; i++) s = nextRoundEnd(s);
    expect(s.phase).not.toBe("gameover");
    expect(s.deadlock).toBeUndefined();
  });

  it("decides on the usual ladder: the side with more bodies takes it", () => {
    const s = frozen();
    place(s, "leaf_birch", "P1", 3, 2);
    s.deadlockRounds = 1;
    let t: GameState = s, i = 0;
    while (t.phase !== "gameover" && i < 6) { t = nextRoundEnd(t); i++; }
    expect(t.win).toEqual({ winner: "P1", by: "deadlock" });
  });

  it("the signature ignores gold and the round number, which tick on a frozen board", () => {
    const a = frozen(3), b = frozen(9);
    b.players.P1.gold += 5; b.players.P2.magicPool += 2;
    expect(boardSignature(a)).toBe(boardSignature(b));
    const c = frozen(3);
    Object.values(c.cards)[0].curHp -= 1;
    expect(boardSignature(c)).not.toBe(boardSignature(a));
  });
});

describe("roundCap", () => {
  it("decides the match on the board at the cap, before MAX_ROUNDS", () => {
    const s = frozen(10);
    s.roundCap = 10;
    const t = advance(s);
    expect(t.phase).toBe("gameover");
    expect(t.win?.by).toBe("timeout");
    expect(MAX_ROUNDS).toBeGreaterThan(10);
  });

  it("does nothing below the cap", () => {
    const s = frozen(9);
    s.roundCap = 10;
    expect(advance(s).phase).not.toBe("gameover");
  });

  it("warns five rounds before it, in the battle log", () => {
    const s = frozen(25);
    s.roundCap = 30;
    const t = advance(s);
    expect(t.log.some((l) => /dragging on.*round 30/.test(l))).toBe(true);
    const early = advance(frozen(24));
    early.roundCap = undefined;
    expect(early.log.some((l) => /dragging on/.test(l))).toBe(false);
  });

  it("is ignored in a Void Tower fight, whose clock is the boss's win condition", () => {
    const s = frozen(10);
    s.roundCap = 10;
    s.deadlockRounds = 1;
    s.voidTower = true;
    const t = advance(s);
    // (With no boss on this board the tower may end it its own way; it must not be
    // by either of these two rules.)
    expect(["timeout", "deadlock"]).not.toContain(t.win?.by);
    expect(t.deadlock).toBeUndefined();
  });
});

describe("the story turns them on", () => {
  it("sets both on every ordinary story fight, and not on the Void Tower trial", () => {
    expect(STORY_DEADLOCK_ROUNDS).toBeGreaterThan(0);
    expect(STORY_ROUND_CAP).toBeGreaterThan(STORY_DEADLOCK_ROUNDS);
    expect(STORY_ROUND_CAP).toBeLessThan(MAX_ROUNDS);
    const app = read("ui", "App.tsx");
    expect(app).toContain("fresh.deadlockRounds = STORY_DEADLOCK_ROUNDS;");
    expect(app).toContain("fresh.roundCap = STORY_ROUND_CAP;");
    expect(app).not.toMatch(/trial\.(deadlockRounds|roundCap)/);
  });
});
