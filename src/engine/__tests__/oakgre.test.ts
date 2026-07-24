import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { canFireSpecial, canMove } from "../rules";
import { effectiveDmg, effectiveSp, moveReach } from "../state";
import { place, prepState } from "./helpers";
import { CORES } from "../../data/cards";
import type { GameState, Pos } from "../types";

// Local, as in mythics.test.ts: drop the state into battle with one card up.
function battleWith(s: GameState, activeId: string): GameState {
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [activeId], index: 0, awaitingInput: activeId };
  return s;
}

/** Fire Uprooted n times. The cooldown is cleared between casts — this is
 *  measuring that the buff STACKS, not that a card can act twice in a round. */
function uproot(s: GameState, oakId: string, n = 1): GameState {
  let cur = s;
  for (let i = 0; i < n; i++) {
    cur.players.P1.magicPool = 30;
    cur.cards[oakId].specialCooldown = 0;
    cur = applyIntent(battleWith(cur, oakId), {
      type: "BATTLE_ACTION", player: "P1", action: "special",
    });
  }
  return cur;
}

describe("Oakgre", () => {
  it("is in the LEAF core, so it can actually be drafted", () => {
    expect(CORES.find((c) => c.id === "leaf")!.cards).toContain("leaf_oakgre");
  });

  it("prints SP 0 and genuinely cannot move until Uprooted", () => {
    const s = prepState();
    const oak = place(s, "leaf_oakgre", "P1", 3, 0);
    expect(effectiveSp(s, oak)).toBe(0);
    expect(moveReach(0)).toBe(0);
    expect(canMove(s, "P1", oak.instanceId, { row: 2, col: 0 } as Pos).ok).toBe(false);

    const next = uproot(s, oak.instanceId);
    const after = next.cards[oak.instanceId];
    expect(after.curHp).toBe(55 - 9); // the HP cost is real
    expect(effectiveSp(next, after)).toBe(3); // unpinned
    expect(effectiveDmg(next, after)).toBe(6 + 2);

    // Movement is a PREP-phase action; uproot() left us mid-battle.
    next.phase = "prep";
    next.prep = { priority: "P1", consecutivePasses: 0, movedThisTurn: false };
    expect(canMove(next, "P1", oak.instanceId, { row: 2, col: 0 } as Pos).ok).toBe(true);
  });

  it("Uprooted stacks", () => {
    const s = prepState();
    const oak = place(s, "leaf_oakgre", "P1", 3, 0, { curHp: 55, maxHp: 55 });
    const cur = uproot(s, oak.instanceId, 3);
    expect(cur.cards[oak.instanceId].curHp).toBe(55 - 27);
    expect(effectiveDmg(cur, cur.cards[oak.instanceId])).toBe(6 + 6);
    expect(effectiveSp(cur, cur.cards[oak.instanceId])).toBe(9);
  });

  it("is refused rather than suicidal when the 9 HP would be lethal", () => {
    // It does NOT opt into selfHpLethal, so a 10-cost mythic can't delete itself
    // on a misclick the way RIP's Horde deliberately can.
    const s = prepState();
    s.players.P1.magicPool = 30;
    const dying = place(s, "leaf_oakgre", "P1", 3, 0, { curHp: 9, maxHp: 55 });
    expect(canFireSpecial(battleWith(s, dying.instanceId), dying.instanceId).ok).toBe(false);
  });

  describe("Intimidation", () => {
    // Measured as a DELTA against the identical board with no Oakgre on it.
    // Reading absolute damage here means silently competing with the mid-row
    // King of the Hill bonus and every friendly aura — which is exactly how the
    // first draft of these tests managed to "fail" on correct behaviour.
    function delta(foeId: string, foeRow: number, uproots = 0): number {
      const without = prepState();
      const a = place(without, foeId, "P2", foeRow, 0);
      const base = effectiveDmg(without, a);

      const withOak = prepState();
      const oak = place(withOak, "leaf_oakgre", "P1", 3, 0);
      const b = place(withOak, foeId, "P2", foeRow, 0);
      const after = uproots ? uproot(withOak, oak.instanceId, uproots) : withOak;
      return effectiveDmg(after, after.cards[b.instanceId]) - base;
    }

    it("shaves 1 DMG off a WEAKER enemy in an adjacent row", () => {
      expect(delta("leaf_greegon", 2)).toBe(-1); // Greegon 4 < Oakgre 6
    });

    it("does nothing to an enemy that is STRONGER", () => {
      expect(delta("leaf_trinezer", 2)).toBe(0); // Trinezer 11 > 6
    });

    it("does not reach two rows away", () => {
      expect(delta("leaf_greegon", 1)).toBe(0); // rows 3 vs 1
    });

    it("spares the intimidator's own side", () => {
      const s = prepState();
      place(s, "leaf_oakgre", "P1", 3, 0);
      const ally = place(s, "leaf_greegon", "P1", 2, 1);
      const alone = prepState();
      const solo = place(alone, "leaf_greegon", "P1", 2, 1);
      expect(effectiveDmg(s, ally)).toBe(effectiveDmg(alone, solo));
    });

    it("catches an enemy it could not before, once Uprooted grows its DMG", () => {
      // The live comparison is the whole reason this pairs with a ramping
      // Special. Sticks out-damages a fresh Oakgre and is unafraid; two
      // Uprooteds (6 -> 10) bring it under the aura.
      expect(delta("leaf_sticks", 2, 0)).toBe(0);
      expect(delta("leaf_sticks", 2, 2)).toBe(-1);
    });

    it("two Oakgres facing each other terminate (no mutual recursion)", () => {
      // Both sides read the same comparison. Computing the penalty from the
      // FINAL number rather than the pre-penalty one would recurse forever —
      // this test would hang rather than fail.
      const s = prepState();
      const mine = place(s, "leaf_oakgre", "P1", 3, 0);
      const theirs = place(s, "leaf_oakgre", "P2", 2, 0);
      expect(Number.isFinite(effectiveDmg(s, mine))).toBe(true);
      expect(Number.isFinite(effectiveDmg(s, theirs))).toBe(true);
      // The one standing on a Mid row is at 7 and cows the other; equal DMG
      // would cow neither, since the gate is strictly "less than".
      expect(effectiveDmg(s, theirs)).toBeGreaterThan(effectiveDmg(s, mine));
    });
  });
});
