// A TALENT'S OWN REACH (owner's call, 2026-10-02: Quasar's Starfall is ranged).
// `talentTargets` measured every Talent by the card's SPECIAL — and no card that
// carries a Talent has one, so every Talent was plain melee whatever it said.
// A Talent now declares `ranged` itself, the same flag a Special uses.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types";
import { getDef } from "../../data/cards";
import { applyIntent } from "../phases";
import { talentTargets } from "../rules";
import { bigPrepState, place } from "./helpers";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("Starfall reaches across the board", () => {
  it("Quasar can aim it at an opponent nowhere near it", () => {
    expect(getDef("dawn_quasar").talent?.ranged).toBe(true);
    const s = bigPrepState();
    const q = place(s, "dawn_quasar", "P1", 3, 4);
    const far = place(s, "leaf_oak", "P2", 1, 0, { curHp: 40, maxHp: 40, curShields: 5 });
    expect(talentTargets(s, q.instanceId).map((c) => c.instanceId)).toContain(far.instanceId);

    const next = applyIntent(battleWith(s, q.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "talent", targetId: far.instanceId,
    });
    const hit = next.cards[far.instanceId];
    expect(hit.curHp, "7 DMG, straight through the shields (PEN)").toBe(33);
    expect(hit.statuses.some((x) => x.kind === "BLIND")).toBe(true);
  });

  it("a Talent that does not declare it is still melee", () => {
    expect(getDef("pyro_komodo").talent?.ranged).toBeFalsy();
    const s = bigPrepState();
    const k = place(s, "pyro_komodo", "P1", 3, 4);
    const far = place(s, "leaf_oak", "P2", 1, 0);
    expect(talentTargets(s, k.instanceId).map((c) => c.instanceId)).not.toContain(far.instanceId);
  });
});
