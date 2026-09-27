// Supernova's Gamma Ray Burst (owner's call, 2026-09-27): magic 4, 14 DMG to the
// target and 10 (was 14) to every opponent adjacent to it; Supernova pays 5 HP.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { applyIntent } from "../phases";
import { place, prepState } from "./helpers";

describe("Gamma Ray Burst", () => {
  it("reads as the owner wrote it", () => {
    const sp = getDef("dawn_supernova").special!;
    expect(sp.cost).toBe(4);
    expect(sp.params).toMatchObject({ dmg: 14, splash: 10, selfDamage: 5 });
    expect(sp.text).toBe(
      "Deal 14 DMG to a target and 10 DMG to every opponent adjacent to it. Supernova loses 5 HP.",
    );
  });

  it("hits the mark for 14, everything beside it for 10, nothing further, and costs Supernova 5", () => {
    // LEAF bodies: DAWN's +25% is against DUSK only, so these numbers are exact.
    const s = prepState();
    s.players.P1.magicPool = 10;
    const nova = place(s, "dawn_supernova", "P1", 3, 1);
    const body = { curHp: 40, maxHp: 40, curShields: 0 };
    const mark = place(s, "leaf_alpha", "P2", 1, 1, body);
    const beside = place(s, "leaf_alpha", "P2", 0, 2, body); // diagonal: adjacent
    const far = place(s, "leaf_alpha", "P2", 1, 3, body); // two columns over
    s.phase = "battle";
    s.prep = null;
    s.battle = { queue: [nova.instanceId], index: 0, awaitingInput: nova.instanceId };
    const hp0 = nova.curHp;
    const n = applyIntent(s, {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: mark.instanceId,
    } as never);
    expect(n.cards[mark.instanceId].curHp).toBe(26);
    expect(n.cards[beside.instanceId].curHp).toBe(30);
    expect(n.cards[far.instanceId].curHp).toBe(40);
    expect(n.cards[nova.instanceId].curHp).toBe(hp0 - 5);
  });
});
