// Milestone 2: prep priority loop — summon / move / pass, two-pass exit.

import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { canMove, canSummon } from "../rules";
import { cardAt, moveReach } from "../state";
import { giveHand, place, prepState } from "./helpers";

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
  it("movement tiers: SP 0 = 0 spaces, 1–7 = 1, 8–15 = 2", () => {
    expect(moveReach(0)).toBe(0);
    expect(moveReach(1)).toBe(1);
    expect(moveReach(7)).toBe(1);
    expect(moveReach(8)).toBe(2);
    expect(moveReach(15)).toBe(2);
  });

  it("SP 1–7 moves 1 space, SP 8–15 moves 2", () => {
    const s = prepState();
    const slow = place(s, "leaf_greegon", "P1", 3, 0); // SP 4
    const fast = place(s, "leaf_stickviper", "P1", 3, 3); // SP 10
    expect(canMove(s, "P1", slow.instanceId, { row: 2, col: 0 }).ok).toBe(true);
    expect(canMove(s, "P1", slow.instanceId, { row: 1, col: 0 }).ok).toBe(false);
    expect(canMove(s, "P1", fast.instanceId, { row: 1, col: 3 }).ok).toBe(true);
    expect(canMove(s, "P1", fast.instanceId, { row: 2, col: 2 }).ok).toBe(true); // diagonal-ish, dist 2
    expect(canMove(s, "P1", fast.instanceId, { row: 0, col: 3 }).ok).toBe(false); // dist 3
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
