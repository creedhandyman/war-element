// Drone Sweep's STOCK, as distinct from its rate.
//
// `oncePerRound` already capped how often Buzzard answers a summon. Nothing
// capped how many drones it had out: one a round across a fifteen-round match is
// fifteen drones, and the only way one leaves the board is by dying. This is the
// ceiling on the fleet.
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { boardCards } from "../state";
import { getDef } from "../../data/cards";
import { giveHand, place, prepState } from "./helpers";
import type { GameState } from "../types";

const DRONE = "bolt_drone_tok";

/** P2 summons a body into its home row, which is what Buzzard reacts to. */
function oppSummon(s: GameState, col: number): GameState {
  s.prep = { priority: "P2", consecutivePasses: 0, movedThisTurn: false };
  s.players.P2.gold = 30;
  const handId = giveHand(s, "P2", "dusk_gool");
  return applyIntent(s, { type: "SUMMON", player: "P2", handId, col } as never);
}

const dronesOut = (s: GameState) =>
  boardCards(s, "P1").filter((c) => c.curHp > 0 && c.defId === DRONE).length;

describe("Drone Sweep keeps one drone up", () => {
  it("is declared on the card", () => {
    expect(getDef("bolt_buzzard").onOppSummon?.spawnMaxAlive).toBe(1);
    expect(getDef("bolt_buzzard").onOppSummon?.oncePerRound, "the rate limit too").toBe(true);
  });

  it("launches one, then stops while it is alive", () => {
    let s = prepState(5, "P2");
    place(s, "bolt_buzzard", "P1", 3, 0);
    s = oppSummon(s, 1);
    expect(dronesOut(s), "the first answer").toBe(1);

    // Clear the per-round flag so only the STOCK cap can be what stops it —
    // otherwise this would pass on the rate limit and prove nothing.
    for (const c of boardCards(s, "P1")) c.oppSummonFiredRound = false;
    s = oppSummon(s, 2);
    expect(dronesOut(s), "still one — the fleet is capped").toBe(1);
  });

  it("launches again once the drone falls", () => {
    // A cap, not a once-per-game. Losing the drone re-arms the sweep.
    let s = prepState(5, "P2");
    place(s, "bolt_buzzard", "P1", 3, 0);
    s = oppSummon(s, 1);
    expect(dronesOut(s)).toBe(1);
    for (const c of boardCards(s, "P1")) {
      if (c.defId === DRONE) c.curHp = 0;
      c.oppSummonFiredRound = false;
    }
    s = oppSummon(s, 2);
    expect(dronesOut(s), "a replacement, once there is room in the fleet").toBe(1);
  });

  it("the cap is per CARD, so two Buzzards keep one each", () => {
    // Counting the owner's whole side would make a second Buzzard do nothing at
    // all, which is not what a per-card ceiling means.
    let s = prepState(5, "P2");
    place(s, "bolt_buzzard", "P1", 3, 0);
    place(s, "bolt_buzzard", "P1", 3, 1);
    s = oppSummon(s, 2);
    expect(dronesOut(s), "one each").toBe(2);
  });
});
