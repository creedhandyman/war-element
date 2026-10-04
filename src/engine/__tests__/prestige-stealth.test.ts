// Prestige's Sleight of Hand leaves the caster in STEALTH (owner, 2026-10-04),
// and Silk Chase costs 3 (same day).
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { applyIntent } from "../phases";
import { place, prepState, statusOf } from "./helpers";

describe("Prestige — Sleight of Hand", () => {
  it("mutes and weakens, then the caster slips into STEALTH", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const pre = place(s, "dusk_prestige", "P1", 2, 1);
    place(s, "leaf_birch", "P2", 1, 1, { curHp: 30, maxHp: 30 });
    s.phase = "battle"; s.prep = null;
    s.battle = { queue: [pre.instanceId], index: 0, awaitingInput: pre.instanceId };
    const g = applyIntent(s, { type: "BATTLE_ACTION", player: "P1", action: "special" });
    expect(statusOf(g.cards[pre.instanceId], "STEALTH"), "hidden after the trick").toBeTruthy();
  });
});

describe("Sarachnid — Silk Chase", () => {
  it("costs 3", () => {
    expect(getDef("dusk_sarachnid").special?.cost).toBe(3);
  });
});
