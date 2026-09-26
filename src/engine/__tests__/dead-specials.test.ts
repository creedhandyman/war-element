// SPECIALS THE AI WAS RIGHT TO SKIP — and the card changes that give it a
// reason not to.
//
// The Sep 26 balance ledger flagged seven cards whose Specials fired on under a
// tenth of the boards they reached. Replayed through 560 paired games each with
// the Special forced whenever it could land, no win rate moved by more than a
// point: the AI was not leaving value on the table, the Specials had none to
// leave. Lazor's was its own basic attack at the same reach, Volcanon's hit
// for less than its basic, Coilblade's hit one target for less than its basic,
// and Sakuroot rarely had the magic for its own. The cards changed instead
// (owner's call); these tests hold what each change is for.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { chooseBattleAction } from "../ai";
import { SPECIAL_HANDLERS } from "../combat";
import { canFireSpecial, specialTargets, validTargets } from "../rules";
import { bigPrepState, place, prepState } from "./helpers";
import type { GameState } from "../types";

/** A battle-phase board with P2 to act and magic to spare for any suit. */
function battle(): GameState {
  const s = bigPrepState(7, "P2");
  s.phase = "battle";
  s.players.P2.magicPool = 30;
  return s;
}

describe("Lazor's Flash Ray Strike is a ray", () => {
  it("reaches a target two rows off, which its melee basic cannot", () => {
    const s = battle();
    const me = place(s, "dawn_lazor", "P2", 1, 2);
    const far = place(s, "leaf_greegon", "P1", 3, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    expect(validTargets(s, me.instanceId), "the basic is melee").toHaveLength(0);
    expect(specialTargets(s, me.instanceId).map((t) => t.instanceId)).toEqual([far.instanceId]);
    const choice = chooseBattleAction(s, me.instanceId);
    expect(choice.action, "fires rather than skipping the turn").toBe("special");
    expect(choice.targetId).toBe(far.instanceId);
  });
});

describe("Coilblade's Icy Storm", () => {
  it("hits two opponents for 4 that can CRIT, then vanishes into STEALTH", () => {
    const sp = getDef("aqua_icynin").special!;
    expect(sp.params).toMatchObject({ dmg: 4, targets: 2, crit: 1, stealthRounds: 2 });
    const s = prepState();
    const icy = place(s, "aqua_icynin", "P1", 3, 1);
    const a = place(s, "dusk_gool", "P2", 2, 0, { curHp: 40, maxHp: 40, curShields: 0 });
    const b = place(s, "dusk_gool", "P2", 2, 2, { curHp: 40, maxHp: 40, curShields: 0 });
    SPECIAL_HANDLERS.barrage(s, s.cards[icy.instanceId], [s.cards[a.instanceId], s.cards[b.instanceId]], sp.params!);
    expect(40 - s.cards[a.instanceId].curHp).toBeGreaterThanOrEqual(4);
    expect(40 - s.cards[b.instanceId].curHp).toBeGreaterThanOrEqual(4);
    expect(s.cards[icy.instanceId].statuses.some((st) => st.kind === "STEALTH")).toBe(true);
  });
});

describe("Sakuroot's Petal Storm costs 2", () => {
  it("fires on 2 magic, and not on 1", () => {
    const s = battle();
    const me = place(s, "leaf_sakuroot", "P2", 1, 2);
    place(s, "leaf_greegon", "P1", 2, 2, { curHp: 900, maxHp: 900, curShields: 0 });
    s.players.P2.magicPool = 2;
    expect(canFireSpecial(s, me.instanceId).ok).toBe(true);
    s.players.P2.magicPool = 1;
    expect(canFireSpecial(s, me.instanceId).reason).toBe("Not enough magic");
  });
});
