// Milestone 6: slot capture by survival + both win conditions.

import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { isContested } from "../state";
import { atCleanup, place, prepState } from "./helpers";

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
