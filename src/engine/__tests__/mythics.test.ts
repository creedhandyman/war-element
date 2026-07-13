// Element-core Mythics + the token-spawn mechanic that several of them use.

import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { boardCards } from "../state";
import { giveHand, place, prepState } from "./helpers";
import type { GameState } from "../types";

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

describe("token spawning", () => {
  it("Trinezer's Reptilian Screech spawns 3 tokens on summon", () => {
    const s = prepState();
    s.players.P1.summonPool = 10;
    const handId = giveHand(s, "P1", "leaf_trinezer");
    const next = applyIntent(s, { type: "SUMMON", player: "P1", handId, col: 1 });
    const mine = boardCards(next, "P1");
    expect(mine).toHaveLength(4); // Trinezer + 3 Reptilians
    expect(mine.filter((c) => c.defId === "leaf_reptilian_tok")).toHaveLength(3);
    // tokens land adjacent to Trinezer (chess-king reach)
    const trin = mine.find((c) => c.defId === "leaf_trinezer")!;
    for (const tok of mine.filter((c) => c.defId === "leaf_reptilian_tok")) {
      expect(Math.abs(tok.pos!.row - trin.pos!.row)).toBeLessThanOrEqual(1);
      expect(Math.abs(tok.pos!.col - trin.pos!.col)).toBeLessThanOrEqual(1);
    }
  });

  it("spawned tokens never enter the deck (they're not in CARDS)", async () => {
    const { CARDS } = await import("../../data/cards");
    expect(CARDS.some((c) => c.id === "leaf_reptilian_tok")).toBe(false);
  });
});

describe("Trinezer — Jungle Culling", () => {
  it("deals 11 to any opponent (ranged snipe)", () => {
    const s = prepState();
    s.players.P1.magicPool = 5;
    const trin = place(s, "leaf_trinezer", "P1", 3, 0); // home row; foe is far away
    const foe = place(s, "dusk_gool", "P2", 1, 3, { curHp: 20, maxHp: 20, curShields: 0 }); // mid row, far
    const next = applyIntent(battleWith(s, trin.instanceId), {
      type: "BATTLE_ACTION",
      player: "P1",
      action: "special",
      targetId: foe.instanceId,
    });
    expect(next.cards[foe.instanceId].curHp).toBe(9); // 20 − 11
  });
});
