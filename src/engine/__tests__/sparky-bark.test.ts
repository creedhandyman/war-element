// Sparky's Burning Bark: when an opponent is summoned it hops beside the
// newcomer and bites it for 2 DMG with BURN (owner, 2026-10-03 — it was BURN
// alone).
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { giveHand, place, prepState } from "./helpers";

describe("Sparky — Burning Bark", () => {
  it("hops beside the newcomer and hits it for 2 DMG + BURN", () => {
    const s = prepState(42, "P2");
    const sparky = place(s, "pyro_sparky", "P1", 2, 3);
    s.players.P2.gold = 9;
    const handId = giveHand(s, "P2", "leaf_nettle");
    const g = applyIntent(s, { type: "SUMMON", player: "P2", handId, col: 0 });
    const it = Object.values(g.cards).find((c) => c.defId === "leaf_nettle")!;
    const sp = g.cards[sparky.instanceId];
    expect(Math.max(Math.abs(sp.pos!.row - it.pos!.row), Math.abs(sp.pos!.col - it.pos!.col)), "beside it").toBe(1);
    expect(it.maxHp - it.curHp, "2 DMG landed (Nettle has no shields)").toBe(2);
    expect(it.statuses.some((x) => x.kind === "BURN"), "and it burns").toBe(true);
  });
});
