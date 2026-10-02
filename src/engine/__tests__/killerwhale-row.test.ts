// TIDAL CRUSH REACHES TWO RANKS (owner's call, 2026-10-02): the row directly
// ahead takes the full wave, the row behind it half — half the damage and half
// the FREEZE.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types";
import { applyIntent } from "../phases";
import { bigPrepState, place } from "./helpers";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}
const freezeOf = (s: GameState, id: string) =>
  s.cards[id].statuses.find((x) => x.kind === "FREEZE")?.duration ?? 0;

describe("Killer Whale's Tidal Crush", () => {
  it("hits the row behind the first for half, and freezes it for half as long", () => {
    const s = bigPrepState();
    const whale = place(s, "aqua_killerwhale", "P1", 3, 2);
    s.players.P1.magicPool = 10;
    const tough = { curHp: 60, maxHp: 60, curShields: 0 };
    const front = place(s, "leaf_oak", "P2", 2, 1, tough);
    const back = place(s, "leaf_oak", "P2", 1, 3, tough);
    const beyond = place(s, "leaf_oak", "P2", 0, 2, tough);

    const next = applyIntent(battleWith(s, whale.instanceId), {
      type: "BATTLE_ACTION", player: "P1", action: "special",
    });
    // Read off the hits rather than HP: Oak drinks in AQUA's water (+2 HP) on
    // every hit, which is its passive and not what is being measured here.
    const hits = next.log.filter((l) => /^Killer Whale \(P1\) hits Oak/.test(l))
      .map((l) => Number(/for (\d+)/.exec(l)![1]));
    expect(hits, "the front rank once, the rank behind once").toHaveLength(2);
    const [full, half] = hits;
    expect(full).toBeGreaterThan(0);
    expect(half, "half the wave").toBe(full / 2);
    expect(freezeOf(next, front.instanceId)).toBe(2);
    expect(freezeOf(next, back.instanceId), "half the freeze").toBe(1);
    expect(next.cards[beyond.instanceId].curHp, "three ranks out is untouched").toBe(60);
    expect(freezeOf(next, beyond.instanceId)).toBe(0);
  });
});
