// Wind-Driven (Tumbleweed) — the passive that moves your card for you.
//
// Owner, 2026-10-27: "a passive ability that makes it move one space randomly
// starting each round". Two halves worth pinning separately: WHERE a drift may
// go, which is a legality question with no dice in it (`driftSquares`), and
// WHEN it happens, which is the top of the round rather than Cleanup.

import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { driftSquares } from "../rules";
import { getDef } from "../../data/cards";
import { applyStatus } from "../combat";
import { atCleanup, bigPrepState, place, prepState } from "./helpers";
import type { GameState } from "../types";

/** Cleanup → the next round's startRound, which is where the drift runs. */
const intoNextRound = (s: GameState) => advance(atCleanup(s));

describe("Wind-Driven: where the wind may take it", () => {
  it("offers all eight neighbours, diagonals included", () => {
    // Not `movesLikeKing` — the card is not walking. A drift that respected a
    // card's own gait would have the weather honouring its footwork.
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 2, 1);
    expect(driftSquares(s, weed).length).toBe(8);
  });

  it("will not stand on an occupied square — it is weather, not a charge", () => {
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 2, 1);
    place(s, "leaf_alpha", "P1", 2, 2);
    place(s, "dusk_gool", "P2", 1, 1);
    const open = driftSquares(s, weed);
    expect(open).not.toContainEqual({ row: 2, col: 2 });
    expect(open).not.toContainEqual({ row: 1, col: 1 });
    expect(open.length).toBe(6);
  });

  it("NEVER drifts onto an enemy Home slot", () => {
    // The one exclusion that is not bookkeeping. Standing on an enemy home
    // slot at Cleanup captures it permanently, which is a win condition — so
    // without this a die roll could hand the game's objective to a player who
    // did nothing, against an opponent who could not have stopped it.
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 1, 1); // row 0 is P2's home
    const open = driftSquares(s, weed);
    expect(open.some((p) => p.row === 0), "the enemy line is off the table").toBe(false);
    expect(open.length).toBe(5); // the five squares in rows 1 and 2
  });

  it("...but its OWN home row is fine — nobody captures a slot from themselves", () => {
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 2, 1); // P1's home is row 3
    expect(driftSquares(s, weed).some((p) => p.row === 3)).toBe(true);
  });

  it("stays inside the board, in every corner", () => {
    const s = prepState();
    // P1's own corner, so the home-slot rule is not what is doing the work.
    const weed = place(s, "gale_tumbleweed", "P1", 3, 0);
    expect(driftSquares(s, weed)).toEqual([
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 3, col: 1 },
    ]);
  });

  it("is pinned by ROOT and by FREEZE, which is what those statuses mean", () => {
    for (const kind of ["ROOT", "FREEZE"] as const) {
      const s = prepState();
      const weed = place(s, "gale_tumbleweed", "P1", 2, 1);
      applyStatus(s, weed, kind, 2, 0, "LEAF");
      expect(driftSquares(s, weed), kind).toEqual([]);
    }
  });

  it("boxed in, it offers nothing rather than shoving its way out", () => {
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 3, 0);
    place(s, "leaf_alpha", "P1", 2, 0);
    place(s, "leaf_alpha", "P1", 2, 1);
    place(s, "leaf_alpha", "P1", 3, 1);
    expect(driftSquares(s, weed)).toEqual([]);
  });

  it("works on the large board too, where the rows are numbered differently", () => {
    const s = bigPrepState();
    const weed = place(s, "gale_tumbleweed", "P1", 1, 2); // row 0 = P2's home
    const open = driftSquares(s, weed);
    expect(open.some((p) => p.row === 0)).toBe(false);
    expect(open.length).toBe(5);
  });
});

describe("Wind-Driven: when it happens", () => {
  it("the card prints it, and the text says it is random", () => {
    // A passive that moves your card without saying it is unpredictable reads
    // as a bug the first time it fires.
    expect(getDef("gale_tumbleweed").driftEachRound).toBe(1);
    expect(getDef("gale_tumbleweed").passiveNames?.driftEachRound).toBe("Wind-Driven");
  });

  it("moves exactly one space at the top of the round, and logs it", () => {
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 2, 1);
    const from = { ...weed.pos! };
    const n = intoNextRound(s);
    const now = n.cards[weed.instanceId].pos!;
    expect(n.round, "we are in the next round").toBe(2);
    expect(now, "it moved").not.toEqual(from);
    expect(Math.max(Math.abs(now.row - from.row), Math.abs(now.col - from.col)),
      "one king-step, no more").toBe(1);
    expect(n.log.some((l) => l.includes("The wind takes"))).toBe(true);
  });

  it("drifts again every round, not once", () => {
    let g: GameState = prepState();
    const weed = place(g, "gale_tumbleweed", "P1", 2, 1);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      g = intoNextRound(g);
      const p = g.cards[weed.instanceId].pos!;
      seen.add(`${p.row},${p.col}`);
    }
    expect(seen.size, "six rounds of wind do not park it on one square")
      .toBeGreaterThan(1);
  });

  it("the direction is the dice, so a different seed wanders differently", () => {
    const run = (seed: number) => {
      let g: GameState = prepState(seed);
      const weed = place(g, "gale_tumbleweed", "P1", 2, 1);
      const path: string[] = [];
      for (let i = 0; i < 5; i++) {
        g = intoNextRound(g);
        const p = g.cards[weed.instanceId].pos!;
        path.push(`${p.row},${p.col}`);
      }
      return path.join(" ");
    };
    expect(run(42)).not.toBe(run(1337));
  });

  it("an ordinary card stays exactly where it was put", () => {
    const s = prepState();
    const rock = place(s, "leaf_alpha", "P1", 2, 1);
    const n = intoNextRound(s);
    expect(n.cards[rock.instanceId].pos).toEqual({ row: 2, col: 1 });
    expect(n.log.some((l) => l.includes("The wind takes"))).toBe(false);
  });

  it("boxed in, the round starts and nothing happens", () => {
    const s = prepState();
    const weed = place(s, "gale_tumbleweed", "P1", 3, 0);
    place(s, "leaf_alpha", "P1", 2, 0);
    place(s, "leaf_alpha", "P1", 2, 1);
    place(s, "leaf_alpha", "P1", 3, 1);
    const n = intoNextRound(s);
    expect(n.cards[weed.instanceId].pos).toEqual({ row: 3, col: 0 });
    expect(n.log.some((l) => l.includes("The wind takes"))).toBe(false);
  });
});
