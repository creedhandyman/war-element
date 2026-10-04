// Player feedback (2026-10-03): in Melee training the log said "Birch (P1) has
// no valid action" after the first move, and the reason (nothing adjacent) only
// became clear when stepping closer fixed it. The skip now names the rule.
import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { noActionReason } from "../rules";
import { place, prepState } from "./helpers";

function skipped(defId: string, at: [number, number], foeAt: [number, number] | null) {
  const s = prepState();
  const me = place(s, defId, "P1", ...at, { autoMode: "manual" });
  if (foeAt) place(s, "dusk_gool", "P2", ...foeAt, { curHp: 30, maxHp: 30 });
  s.phase = "battle"; s.prep = null;
  s.battle = { queue: [me.instanceId], index: 0, awaitingInput: null };
  return { s, id: me.instanceId, next: advance(s) };
}

describe("a skipped card says why", () => {
  it("melee with nothing adjacent: 'no enemy in melee range'", () => {
    const { next } = skipped("leaf_birch", [3, 0], [1, 3]);
    expect(next.log.at(-1)).toContain("can't act: no enemy in melee range");
    expect(next.log.some((l) => l.includes("has no valid action"))).toBe(false);
  });

  it("no enemy at all: says so", () => {
    const { s, id } = skipped("leaf_birch", [3, 0], null);
    expect(noActionReason(s, id)).toBe("no enemy on the board");
  });
});
