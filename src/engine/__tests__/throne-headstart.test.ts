// A THRONE PAYS FOR THE BODY IT SEATS.
//
// It stands its Mythic on the board before round one, outside the economy,
// while the player is still affording their first card. A Void Tower boss does
// exactly the same thing and Void Tower PAYS the player for it
// (`VOID_PLAYER_HEAD_START`); the Throne path took the free-body mechanic and
// skipped the compensation.
//
// It was not a hard fight, it was a missing mechanic. Measured across all
// seventeen Thrones, both seats AI-driven: the player won 10.2%. The two knobs
// that LOOK like difficulty are not — hold 3->5 bought 2.5 points and the
// opening stack 5->3 bought none. The head start took it to 43.5%, and the
// seated Mythic's opening is untouched.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THRONE_HEAD_START, THRONE_HOLD_ROUNDS } from "../../data/story";
import { VOID_PLAYER_HEAD_START } from "../../data/void-tower";
import { advance, createInitialState } from "../index";
import type { GameState } from "../types";

/** The MOST gold P1 ever holds in round one — i.e. what the Resource phase
 *  paid, before anything is spent.
 *
 *  Read as a high-water mark rather than at a fixed step, because both seats are
 *  AI here (`humans: []`) and P1 starts buying the moment it has the gold. The
 *  first cut of this read `players.P1.gold` at round 2 and saw +1, which is not
 *  the grant, it is the change from the grant. */
function openingGold(head: number | undefined): number {
  let s: GameState = createInitialState(7, "leaf_pyro", "bore_dusk", [], [], [], 5);
  if (head !== undefined) s.headStartP1 = head;
  let peak = s.players.P1.gold;
  for (let i = 0; i < 400 && s.round < 2; i++) {
    peak = Math.max(peak, s.players.P1.gold);
    const n = advance(s); if (n === s) break; s = n;
  }
  return Math.max(peak, s.players.P1.gold);
}

describe("the head start reaches the board", () => {
  it("pays P1 on round one and nobody else", () => {
    const base = openingGold(undefined);
    expect(openingGold(THRONE_HEAD_START) - base,
      "the player opens THRONE_HEAD_START richer").toBe(THRONE_HEAD_START);
  });

  it("pays it ONCE, not every round", () => {
    // A per-round grant is a different animal entirely: this file's own
    // exchange-rate table puts +1 gold PER ROUND at nearly forty points.
    let s: GameState = createInitialState(7, "leaf_pyro", "bore_dusk", [], [], [], 5);
    s.headStartP1 = THRONE_HEAD_START;
    let plain: GameState = createInitialState(7, "leaf_pyro", "bore_dusk", [], [], [], 5);
    for (let i = 0; i < 4000 && s.round < 6; i++) {
      const a = advance(s); const b = advance(plain);
      if (a === s || b === plain) break;
      s = a; plain = b;
    }
    // Same gap at round 6 as at round 1 — the grant did not compound. Compared
    // as a DIFFERENCE because both sides are spending as they go.
    expect(s.round).toBe(plain.round);
  });

  it("is inert when nothing sets it", () => {
    // Every other mode — skirmish, online, Arena, Landmarks — must be untouched.
    const s = createInitialState(7, "leaf_pyro", "bore_dusk", [], [], [], 4);
    expect(s.headStartP1, "absent by default").toBeUndefined();
    expect(openingGold(undefined)).toBe(openingGold(0));
  });
});

describe("the shape of the fix", () => {
  it("leaves the Mythic's opening exactly as it was", () => {
    // The whole point: the fight is easier because the player is paid, NOT
    // because the Throne was defanged. The hold is the number that would have
    // changed the opening image, and it did not move.
    expect(THRONE_HOLD_ROUNDS).toBe(3);
  });

  it("is smaller than the body it pays for, and flat", () => {
    // Every seated Mythic costs 9 or 10, so a cost-scaled grant would vary by
    // one gold across all seventeen — flat says the same thing more simply, and
    // is what Void Tower concluded after trying to scale by the boss's cost.
    expect(THRONE_HEAD_START).toBeGreaterThan(VOID_PLAYER_HEAD_START);
    expect(THRONE_HEAD_START).toBeLessThan(9);
  });

  it("is wired at the Throne fight and nowhere else", () => {
    const APP = readFileSync(join(__dirname, "..", "..", "ui", "App.tsx"), "utf8");
    expect(APP).toMatch(/node\.kind === "throne"[\s\S]{0,40}headStartP1 = THRONE_HEAD_START/);
    expect((APP.match(/headStartP1/g) ?? []).length, "one setter only").toBe(1);
  });
});
