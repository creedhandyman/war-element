// IDLE STEALTH (Grizzly's Thicket Ambush, Magalogoon's Swamp Monster), owner's
// call 2026-10-02: acting gives the hide up for the rest of the round AND the
// next one. It used to come straight back at Cleanup, so a bear that mauled
// something was untargetable again the very next round.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types";
import { getDef } from "../../data/cards";
import { advance, applyIntent } from "../phases";
import { isStealthed } from "../rules";
import { bigPrepState, place } from "./helpers";

/** One action, then step the battle on until Cleanup has run. */
function act(s: GameState, id: string, action: "basic" | "skip", targetId?: string): GameState {
  let next = applyIntent(battleWith(s, id), { type: "BATTLE_ACTION", player: "P1", action, targetId });
  for (let i = 0; i < 20 && next.phase === "battle"; i++) next = advance(next);
  return next;
}

function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

const hidden = (s: GameState, id: string) => isStealthed(getDef(s.cards[id].defId), s.cards[id]);

describe("idle stealth needs a whole round still", () => {
  it("attacking keeps the Grizzly in the open through the next round, and a still round hides it", () => {
    const s = bigPrepState();
    const bear = place(s, "leaf_grizzly", "P1", 3, 2);
    const prey = place(s, "leaf_oak", "P2", 2, 2, { curHp: 99, maxHp: 99 });
    expect(hidden(s, bear.instanceId), "hidden before it does anything").toBe(true);

    // Round 1: the bear attacks. Cleanup runs once the queue is empty.
    const r1 = act(s, bear.instanceId, "basic", prey.instanceId);
    expect(r1.cards[bear.instanceId].attackedThisRound, "Cleanup has run").toBe(false);
    expect(hidden(r1, bear.instanceId), "still exposed the round after it attacked").toBe(false);

    // Round 2: it sits still.
    const r2 = act(structuredClone(r1), bear.instanceId, "skip");
    expect(hidden(r2, bear.instanceId), "a round without acting brings the hide back").toBe(true);
  });

  it("moving costs the next round too, same as attacking", () => {
    const s = bigPrepState();
    const bear = place(s, "leaf_grizzly", "P1", 3, 2);
    s.cards[bear.instanceId].movedThisRound = true;
    const r1 = act(s, bear.instanceId, "skip");
    expect(hidden(r1, bear.instanceId)).toBe(false);
  });
});
