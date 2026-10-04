// The AI lights Canister's Detonate only when the blast pays (owner's new
// Talent, 2026-10-04): a kill, or two opponents caught, and never more of its
// own non-PYRO cards than theirs.
import { describe, expect, it } from "vitest";
import { chooseBattleAction } from "../ai";
import { place, prepState } from "./helpers";

function board(foes: [number, number, number][]) {
  const s = prepState();
  const can = place(s, "pyro_canister", "P2", 1, 1);
  for (const [r, c, hp] of foes) place(s, "dusk_gool", "P1", r, c, { curHp: hp, maxHp: 40, curShields: 0 });
  s.phase = "battle"; s.prep = null;
  s.battle = { queue: [can.instanceId], index: 0, awaitingInput: null };
  return chooseBattleAction(s, can.instanceId).action;
}

describe("the AI and Detonate", () => {
  it("keeps the bomb for one sturdy opponent", () => {
    expect(board([[2, 1, 30]])).not.toBe("talent");
  });
  it("detonates when two opponents are caught", () => {
    expect(board([[2, 1, 30], [2, 2, 30]])).toBe("talent");
  });
  it("detonates to finish a lone opponent the blast kills", () => {
    expect(board([[2, 1, 4]])).toBe("talent");
  });
});
