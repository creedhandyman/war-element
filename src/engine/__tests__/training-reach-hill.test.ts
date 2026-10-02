// The Melee and Ranged lesson teaches King of the Hill's reach half (owner's
// call, 2026-10-02): a ranged card off its home row reaches one square further.
// The tip fires off the board, so it is checked against the rule it quotes.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { LESSONS } from "../../ui/training";
import { RANGED_REACH, rangedReachFor } from "../rules";
import { homeRow } from "../types";
import { place, prepState } from "./helpers";

const tip = LESSONS.find((l) => l.id === "reach")!.tips.find((t) => t.id === "reach-hill")!;

describe("Step out to see further", () => {
  it("is in the Melee and Ranged lesson and quotes the real numbers", () => {
    expect(tip).toBeTruthy();
    expect(tip.body).toContain(`from ${RANGED_REACH} to ${RANGED_REACH + 1}`);
  });

  it("waits while the shooter is on the home row, and fires the moment it steps off", () => {
    const s = prepState();
    const home = homeRow("P1", s.boardSize);
    const shooter = place(s, "dawn_goldeneagle", "P1", home, 0);
    expect(getDef("dawn_goldeneagle").attackType).toBe("Ranged");
    expect(tip.when(s), "still at home").toBe(false);
    expect(rangedReachFor(s, s.cards[shooter.instanceId])).toBe(RANGED_REACH);

    s.cards[shooter.instanceId].pos = { row: home - 1, col: 0 } as never;
    expect(tip.when(s), "on the battlefield").toBe(true);
    expect(rangedReachFor(s, s.cards[shooter.instanceId]), "the tip tells the truth").toBe(RANGED_REACH + 1);
  });

  it("a melee card off its home row does not set it off", () => {
    const s = prepState();
    place(s, "leaf_birch", "P1", homeRow("P1", s.boardSize) - 1, 0);
    expect(getDef("leaf_birch").attackType).toBe("Melee");
    expect(tip.when(s)).toBe(false);
  });
});
