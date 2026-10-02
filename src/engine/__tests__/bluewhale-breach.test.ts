// Blue Whale's Breach reaches anywhere and costs 1 (owner's calls, 2026-10-02).
// It was a cost-3 strike that, on a Melee card, could only hit what stood in
// contact with it.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { validSpecialTargets } from "../rules";
import { place, prepState } from "./helpers";

describe("Breach", () => {
  it("reaches an opponent on the far side of the board", () => {
    const s = prepState();
    const whale = place(s, "aqua_bluewhale", "P1", 3, 0);
    const far = place(s, "pyro_flamehound", "P2", 1, 3, { curHp: 40, maxHp: 40 }); // two rows and three columns away; row 0 is its home row, which the Home-Slot rule shields
    expect(validSpecialTargets(s, whale.instanceId).map((c) => c.instanceId)).toContain(far.instanceId);
  });

  it("costs 1 magic, and the card says it reaches anywhere", () => {
    const sp = getDef("aqua_bluewhale").special!;
    expect(sp.cost).toBe(1);
    expect(sp.ranged).toBe(true);
    expect(sp.text).toContain("any opponent on the board");
  });
});
