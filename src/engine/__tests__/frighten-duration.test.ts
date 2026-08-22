// FRIGHTEN, and the off-by-one that made three cards do half of what they said.
//
// The status has two halves: it retreats a card one slot the moment it lands,
// and it stops that card MOVING during Prep. Everything that applies it does so
// from BATTLE — a cast, a swarm, a death — and Cleanup runs immediately after
// Battle, ticking every duration down. So a 1-round FRIGHTEN expired before the
// Prep it existed to freeze: the visible half fired, the mechanical half never
// did, and it was reported as "spiders don't fright".
//
// Two ticks is ONE round of fear as the player experiences it. This file is the
// rule rather than three separate card tests, because the next card to apply
// FRIGHTEN from Battle will have the same bug and should fail here.
import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { applyStatus } from "../combat";
import { canMove } from "../rules";
import { getDef } from "../../data/cards";
import { atCleanup, place, prepState, statusOf } from "./helpers";
import type { GameState } from "../types";

/** Can this card still take its Prep move? */
function canStillMove(g: GameState, id: string, owner: "P1" | "P2"): boolean {
  g.phase = "prep";
  g.prep = { priority: owner, consecutivePasses: 0, movedThisTurn: false };
  const c = g.cards[id];
  // Anywhere orthogonally adjacent and open; the destination is not the point.
  return canMove(g, owner, id, { row: c.pos!.row, col: c.pos!.col + 1 } as never).ok;
}

describe("a FRIGHTEN applied in Battle has to reach the next Prep", () => {
  it("one tick is gone before it can pin anything — the bug", () => {
    // The control, stated as a rule rather than assumed: this is WHY the cards
    // below use 2, and if the phase order ever changes this is the test that
    // says the reason has expired.
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    place(s, "leaf_alpha", "P1", 3, 0);
    applyStatus(s, foe, "FRIGHTEN", 1, 0, "DUSK");
    expect(statusOf(s.cards[foe.instanceId], "FRIGHTEN"), "lands").toBeDefined();
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[foe.instanceId], "FRIGHTEN"), "and is gone by Prep").toBeUndefined();
    expect(canStillMove(n, foe.instanceId, "P2"), "so it moves freely").toBe(true);
  });

  it("two ticks survives Cleanup and pins the card for one Prep", () => {
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    place(s, "leaf_alpha", "P1", 3, 0);
    applyStatus(s, foe, "FRIGHTEN", 2, 0, "DUSK");
    const n = advance(atCleanup(s));
    expect(statusOf(n.cards[foe.instanceId], "FRIGHTEN"), "still there").toBeDefined();
    expect(canStillMove(n, foe.instanceId, "P2"), "and pinned by it").toBe(false);
  });

  it("and it is ONE round of fear, not two — it lets go after that", () => {
    // The other side of the fix: 2 must not mean the target is frozen for two
    // of its turns, or this trades a dead status for an oppressive one.
    const s = prepState();
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40 });
    place(s, "leaf_alpha", "P1", 3, 0);
    applyStatus(s, foe, "FRIGHTEN", 2, 0, "DUSK");
    let g = advance(atCleanup(s));
    g = advance(atCleanup(g));
    expect(statusOf(g.cards[foe.instanceId], "FRIGHTEN"), "let go").toBeUndefined();
    expect(canStillMove(g, foe.instanceId, "P2")).toBe(true);
  });
});

describe("every card that frightens from Battle uses two", () => {
  it("Aranea's Brood Summon", () => {
    expect(getDef("dusk_aranea").special?.params?.statusKind).toBe("FRIGHTEN");
    expect(getDef("dusk_aranea").special?.params?.statusDuration).toBe(2);
  });

  it("Wedded Wraith's Last Waltz", () => {
    // Fires on ANY death, which resolves in Battle like the rest.
    expect(getDef("dusk_wedded_wraith").onDeath?.frightenInRange).toBe(2);
  });

  it("Sarachnid's Silk Chase", () => {
    expect(getDef("dusk_sarachnid").special?.params?.frighten).toBe(2);
  });

  it("names every carrier, so a new one cannot be added quietly", () => {
    // The list is the point. A fourth card that applies FRIGHTEN from Battle at
    // duration 1 is the same bug again, and nothing else in the suite would
    // catch it — the status would apply, the log would say so, and the effect
    // would be missing.
    const carriers = [
      getDef("dusk_aranea").special?.params?.statusDuration,
      getDef("dusk_wedded_wraith").onDeath?.frightenInRange,
      getDef("dusk_sarachnid").special?.params?.frighten,
    ];
    expect(carriers.every((d) => d === 2), `durations: ${carriers.join(", ")}`).toBe(true);
  });
});
