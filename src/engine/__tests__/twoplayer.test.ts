// Hot-seat 2-player: the driver must treat BOTH players as human and never
// auto-play a human's prep turn (the regression that let the AI play P2).

import { describe, expect, it } from "vitest";
import { advance, needsInput } from "../phases";
import { prepState } from "./helpers";

describe("2-player hot-seat", () => {
  it("needsInput returns the priority human in 2P prep, null for an AI in vs-AI", () => {
    // vs-AI (humans defaults to ["P1"]): P2's prep is the AI's → no human input.
    expect(needsInput(prepState(42, "P2"))).toBeNull();
    expect(needsInput(prepState(42, "P1"))).toBe("P1");

    // 2-player: both sides are human, so the priority player must act.
    const s = prepState(42, "P2");
    s.humans = ["P1", "P2"];
    expect(needsInput(s)).toBe("P2");
  });

  it("advance() never auto-plays a human's prep turn in 2P", () => {
    const s = prepState(42, "P2");
    s.humans = ["P1", "P2"];
    // Waiting on P2 (human) → advance is a no-op (same reference back).
    expect(advance(s)).toBe(s);
  });

  it("advance() still auto-plays the AI's prep in vs-AI", () => {
    const s = prepState(42, "P2"); // humans = ["P1"], so P2 is the AI
    expect(advance(s)).not.toBe(s); // AI took an action
  });

  it("mulligan requires each human individually in 2P (no AI auto-mulligan)", () => {
    const s = prepState();
    s.phase = "mulligan";
    s.players.P1.mulliganDone = false;
    s.players.P2.mulliganDone = false;
    s.humans = ["P1", "P2"];
    expect(needsInput(s)).toBe("P1");
    s.players.P1.mulliganDone = true;
    expect(needsInput(s)).toBe("P2"); // P2 is NOT auto-mulliganed
  });
});
