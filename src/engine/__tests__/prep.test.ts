// Milestone 2: prep priority loop — summon / move / pass, two-pass exit.

import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { canMove, canSummon } from "../rules";
import { cardAt, moveReach, SP_MID_MAX, SP_SLOW_MAX } from "../state";
import { giveHand, place, prepState } from "./helpers";
import { getDef } from "../../data/cards";
import type { GameState } from "../types";

describe("summoning", () => {
  it("summons into an open home slot, paying cost", () => {
    const s = prepState();
    s.players.P1.summonPool = 5;
    const handId = giveHand(s, "P1", "leaf_greegon"); // cost 3
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 2 });
    const card = cardAt(next, 3, 2);
    expect(card?.defId).toBe("leaf_greegon");
    expect(card?.summonedThisRound).toBe(true);
    expect(next.players.P1.summonPool).toBe(2);
    expect(next.players.P1.hand.some((h) => h.handId === handId)).toBe(false);
  });

  it("rejects: not enough resources", () => {
    const s = prepState();
    s.players.P1.summonPool = 2;
    const handId = giveHand(s, "P1", "leaf_greegon");
    expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
  });

  it("rejects: occupied, contested, and captured slots", () => {
    const s = prepState();
    s.players.P1.summonPool = 10;
    const handId = giveHand(s, "P1", "leaf_greegon");
    place(s, "leaf_alpha", "P1", 3, 0); // occupied by own card
    place(s, "dusk_vamp", "P2", 3, 1); // enemy on our home = contested
    s.slots[3][2].capturedBy = "P2"; // captured
    expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
    expect(canSummon(s, "P1", handId, 1).ok).toBe(false);
    expect(canSummon(s, "P1", handId, 2).ok).toBe(false);
    expect(canSummon(s, "P1", handId, 3).ok).toBe(true);
  });

  it("rejects summoning without priority", () => {
    const s = prepState(42, "P2");
    s.players.P1.summonPool = 10;
    const handId = giveHand(s, "P1", "leaf_greegon");
    expect(canSummon(s, "P1", handId, 0).ok).toBe(false);
  });

  it("allows multiple summons in one priority turn", () => {
    const s = prepState();
    s.players.P1.summonPool = 10;
    const h1 = giveHand(s, "P1", "leaf_greegon");
    const h2 = giveHand(s, "P1", "leaf_alpha");
    let next = applyIntent(s, { type: "SUMMON", player: "P1", handId: h1, col: 0 });
    next = applyIntent(next, { type: "SUMMON", player: "P1", handId: h2, col: 1 });
    expect(cardAt(next, 3, 0)).toBeTruthy();
    expect(cardAt(next, 3, 1)).toBeTruthy();
    expect(next.prep?.priority).toBe("P1"); // actions don't pass priority
  });
});

describe("movement", () => {
  it("movement tiers: 0 = pinned, slow 1–5 = 1, mid and fast = 2", () => {
    // Reach TOPS OUT at 2. The fast tier's payoff is the king-move (below), not
    // a third step: extra reach compounded with board depth, handing the quick
    // elements a 76% win rate on 5x5, while cutting corners is worth the same
    // on any board size.
    expect(moveReach(0)).toBe(0);
    expect(moveReach(1)).toBe(1);
    expect(moveReach(SP_SLOW_MAX)).toBe(1);
    expect(moveReach(SP_SLOW_MAX + 1)).toBe(2);
    expect(moveReach(SP_MID_MAX)).toBe(2);
    expect(moveReach(SP_MID_MAX + 1)).toBe(2);
    expect(moveReach(21)).toBe(2); // the GALE Zephyr cap changes nothing
  });

  it("the FAST tier cuts corners — that is what it buys", () => {
    // A diagonal costs a mid card 2 of its 2 steps (Manhattan) and a fast card
    // 1 (Chebyshev), so only the fast card can go diagonally AND keep moving.
    const s = prepState();
    const mid = place(s, "dusk_gool", "P1", 2, 1); // mid band
    const fast = place(s, "dusk_silkstalker", "P1", 2, 3); // SP 12
    expect(moveReach(getDef("dusk_gool").sp)).toBe(2);
    expect(moveReach(getDef("dusk_silkstalker").sp)).toBe(2); // same reach...
    // ...but only the fast one reaches TWO diagonal steps away.
    expect(canMove(s, "P1", fast.instanceId, { row: 0, col: 1 }).ok).toBe(true);
    expect(canMove(s, "P1", mid.instanceId, { row: 0, col: 3 }).ok).toBe(false);
  });

  it("each tier walks its own distance on the board", () => {
    // Cards picked by tier and asserted against moveReach, not against
    // remembered numbers: the SP pass moved several cards across a boundary and
    // a hardcoded "Greegon is slow" broke this test rather than catching a bug.
    const s = prepState();
    const slow = place(s, "bore_armadillo", "P1", 2, 0); // slow band
    const mid = place(s, "leaf_stickviper", "P1", 2, 3); // mid band
    expect(moveReach(getDef("bore_armadillo").sp)).toBe(1);
    expect(moveReach(getDef("leaf_stickviper").sp)).toBe(2);
    expect(canMove(s, "P1", slow.instanceId, { row: 1, col: 0 }).ok).toBe(true);
    expect(canMove(s, "P1", slow.instanceId, { row: 0, col: 0 }).ok).toBe(false); // 2 away
    expect(canMove(s, "P1", mid.instanceId, { row: 1, col: 3 }).ok).toBe(true);
    // Straight up the column: a ground card pays MANHATTAN, so (2,3)->(0,2)
    // would be 3, not 2. Only FLYING and mounted cards cut corners.
    expect(canMove(s, "P1", mid.instanceId, { row: 0, col: 3 }).ok).toBe(true); // dist 2
  });

  it("the home-to-home rule holds, though nothing can currently reach that far", () => {
    // Kept as a GUARD, not an active rule. With reach capped at 2 and the home
    // rows 3 apart on a 4x4 (4 on a 5x5), no card can make the crossing in one
    // move anyway — the cap that made this rule necessary is gone. It stays so
    // that raising reach later cannot silently re-open the dash.
    const s = prepState();
    const runner = place(s, "dusk_silkstalker", "P1", 3, 1); // fastest in the game
    const dash = canMove(s, "P1", runner.instanceId, { row: 0, col: 1 });
    expect(dash.ok).toBe(false);
    // The DISTANCE check answers first, which is the proof: the crossing is out
    // of range on its own, so the rule never has to fire. If a future reach
    // change makes it reachable, this reason flips to the Home-row one and the
    // rule catches it.
    expect(dash.reason).toMatch(/Too far/i);
  });

  it("...and it only blocks the DASH, not the destination", () => {
    // From a mid row the enemy home row is still a legal landing.
    const s = prepState();
    const runner = place(s, "dusk_silkstalker", "P1", 1, 1);
    expect(canMove(s, "P1", runner.instanceId, { row: 0, col: 1 }).ok).toBe(true);
  });

  it("can't move onto an occupied or captured slot", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 2, 1);
    place(s, "leaf_alpha", "P1", 2, 2);
    s.slots[1][1].capturedBy = "P2";
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 2 }).ok).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 1 }).ok).toBe(false);
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 2 }).ok).toBe(true);
  });

  it("only one move per priority turn", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 3, 0);
    const next = applyIntent(s, {
      type: "MOVE",
      player: "P1",
      instanceId: c.instanceId,
      to: { row: 2, col: 0 },
    });
    expect(canMove(next, "P1", c.instanceId, { row: 1, col: 0 }).ok).toBe(false);
  });

  it("ROOT pins SP to 0 (no move)", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 3, 0, {
      status: { kind: "ROOT", duration: 2, power: 0, source: "LEAF" },
    });
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 0 }).ok).toBe(false);
  });

  it("SLEEP prevents moving until woken", () => {
    const s = prepState();
    const c = place(s, "leaf_stickviper", "P1", 3, 0, {
      status: { kind: "SLEEP", duration: 2, power: 0, source: "BORE" },
    });
    expect(canMove(s, "P1", c.instanceId, { row: 2, col: 0 }).ok).toBe(false);
  });
});

describe("priority + passes", () => {
  it("pass hands priority; two consecutive passes start Battle", () => {
    const s = prepState(42, "P1");
    const afterP1 = applyIntent(s, { type: "PASS", player: "P1" });
    expect(afterP1.prep?.priority).toBe("P2");
    expect(afterP1.prep?.consecutivePasses).toBe(1);
    const afterP2 = applyIntent(afterP1, { type: "PASS", player: "P2" });
    expect(afterP2.phase).toBe("battle");
  });

  it("an action resets the consecutive-pass counter", () => {
    let s = prepState(42, "P1");
    s.players.P2.summonPool = 5;
    const handId = giveHand(s, "P2", "dusk_vamp");
    s = applyIntent(s, { type: "PASS", player: "P1" }); // passes=1, P2 priority
    s = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 0 });
    expect(s.prep?.consecutivePasses).toBe(0);
    s = applyIntent(s, { type: "PASS", player: "P2" }); // passes=1 again
    expect(s.phase).toBe("prep");
    s = applyIntent(s, { type: "PASS", player: "P1" });
    expect(s.phase).toBe("battle");
  });

  it("move allowance resets when priority returns", () => {
    let s = prepState(42, "P1");
    const c = place(s, "leaf_stickviper", "P1", 3, 0);
    s = applyIntent(s, {
      type: "MOVE",
      player: "P1",
      instanceId: c.instanceId,
      to: { row: 2, col: 0 },
    });
    s = applyIntent(s, { type: "PASS", player: "P1" });
    s = applyIntent(s, { type: "MOVE", player: "P2", instanceId: placeP2(s), to: { row: 1, col: 3 } });
    s = applyIntent(s, { type: "PASS", player: "P2" });
    // P1's move is available again on the new priority turn
    expect(canMove(s, "P1", c.instanceId, { row: 1, col: 0 }).ok).toBe(true);
  });
});

function placeP2(s: ReturnType<typeof prepState>): string {
  const c = place(s, "dusk_vamp", "P2", 0, 3);
  return c.instanceId;
}

describe("mounted cards move like a king in Prep", () => {
  const diagonalOk = (s: GameState, id: string) =>
    canMove(s, "P1", id, { row: 1, col: 1 }).ok;

  it("a diagonal costs a mounted card ONE step, not two", () => {
    // Prep movement is Manhattan for everyone but FLYING, so a diagonal used to
    // cost two of a rider's steps. Now the four mounted cards pay one, matching
    // how Shadow Charge already rides.
    for (const id of ["dusk_shadowhorsemen", "bore_rohojohn", "dusk_skelider", "dawn_warphant"]) {
      const s = prepState();
      const c = place(s, id, "P1", 2, 2);
      s.cards[c.instanceId].spBonus = 1 - getDef(id).sp; // pin reach to exactly 1
      expect(diagonalOk(s, c.instanceId), `${id} could not step diagonally`).toBe(true);
    }
  });

  it("...and an unmounted card still cannot", () => {
    const s = prepState();
    const c = place(s, "bore_clubber", "P1", 2, 2);
    s.cards[c.instanceId].spBonus = 1 - getDef("bore_clubber").sp;
    expect(diagonalOk(s, c.instanceId)).toBe(false); // Manhattan 2 > reach 1
  });

  it("Dismount puts the rider back on foot — the king-move goes with the mount", () => {
    // Skelider's Dismount sets `transformed`. Losing the horse should cost it
    // the horse's movement, or "mounted" would just be a permanent keyword.
    const s = prepState();
    const skel = place(s, "dusk_skelider", "P1", 2, 2);
    s.cards[skel.instanceId].spBonus = 1 - getDef("dusk_skelider").sp;
    expect(diagonalOk(s, skel.instanceId)).toBe(true);
    s.cards[skel.instanceId].transformed = true; // thrown from the saddle
    expect(diagonalOk(s, skel.instanceId)).toBe(false);
  });

  it("the straight step is unchanged either way", () => {
    const s = prepState();
    const roho = place(s, "bore_rohojohn", "P1", 2, 2);
    s.cards[roho.instanceId].spBonus = 1 - getDef("bore_rohojohn").sp;
    expect(canMove(s, "P1", roho.instanceId, { row: 1, col: 2 }).ok).toBe(true);
  });
});
