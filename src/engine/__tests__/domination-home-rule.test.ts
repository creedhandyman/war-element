// Domination has no Home-slot targeting rule (owner, 2026-10-03): on the 7x7 a
// card standing in its own back row can strike into the enemy's back row, as it
// can anywhere else. The 4x4 and 5x5 keep the rule.
import { describe, expect, it } from "vitest";
import { DOMINATION_7X7, newDomination } from "../../data/domination";
import { createInitialState } from "../index";
import { canTarget } from "../rules";
import { boardCards } from "../state";
import { place, prepState } from "./helpers";
import type { GameState } from "../types";

function board7(domination: boolean): GameState {
  const s = createInitialState(7, undefined, undefined, ["P1", "P2"], undefined, undefined, DOMINATION_7X7.boardSize);
  if (domination) s.domination = newDomination(DOMINATION_7X7);
  for (const c of boardCards(s)) delete s.cards[c.instanceId];
  return s;
}

describe("the Home-slot rule", () => {
  it("is gone in Domination: back row to back row is a legal target", () => {
    const s = board7(true);
    const a = place(s, "leaf_birch", "P1", 6, 3);   // P1's back row
    const t = place(s, "leaf_birch", "P2", 0, 3);   // P2's back row
    expect(canTarget(s, a, t, true)).toBe(true);
  });

  it("still holds on an ordinary board", () => {
    const s = prepState();
    const a = place(s, "leaf_birch", "P1", 3, 1);
    const t = place(s, "leaf_birch", "P2", 0, 1);
    expect(canTarget(s, a, t, true)).toBe(false);
  });

  it("...and on a 7x7 that is not Domination", () => {
    const s = board7(false);
    const a = place(s, "leaf_birch", "P1", 6, 3);
    const t = place(s, "leaf_birch", "P2", 0, 3);
    expect(canTarget(s, a, t, true)).toBe(false);
  });
});
