// STORM MARKS WHAT IT MEANS TO STRIKE.
//
// Thunder Strike hits every ELECTRIFIED opponent and nothing else, and it was
// "not working" because there was almost never anything ELECTRIFIED when Storm
// came up. The BOLT aura's mark lasts ONE round, so Cleanup wipes it the round
// it lands, and Storm (SP 8) usually acts before the slower allies whose basics
// would have put it there. In a 60-game BOLT-vs-LEAF sim the Special was legal
// on 2 of Storm's 66 turns.
//
// The fix is on the card, not the element: Storm's own basic leaves a 2-round
// mark, which is what survives the Cleanup between its summon-turn swing (the
// only move it is allowed on arrival) and its first chance to cast.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { advance } from "../phases";
import { basicAttack } from "../combat";
import { canFireSpecial, specialTargets } from "../rules";
import { atBattle, atCleanup, place, prepState, statusOf } from "./helpers";

const dummy = (s: ReturnType<typeof prepState>) =>
  place(s, "leaf_stickviper", "P2", 1, 1, { curHp: 300, maxHp: 300, curShields: 0 });

describe("Storm's Static Mark", () => {
  it("is a rider on the basic, and the Special still asks for the mark", () => {
    const d = getDef("bolt_storm");
    expect(d.onHitStatus).toEqual({ kind: "ELECTRIFIED", duration: 2, power: 0 });
    expect(d.passiveNames?.onHitStatus).toBe("Static Mark");
    expect(d.special?.params).toMatchObject({ requireStatus: "ELECTRIFIED" });
  });

  it("a basic leaves the target ELECTRIFIED for two rounds", () => {
    const s = prepState();
    const storm = place(s, "bolt_storm", "P1", 2, 1);
    const foe = dummy(s);
    basicAttack(s, storm.instanceId, foe.instanceId);
    expect(statusOf(s.cards[foe.instanceId], "ELECTRIFIED")?.duration).toBe(2);
  });

  it("the mark survives Cleanup, so next round Thunder Strike has a target", () => {
    const s = prepState();
    const storm = place(s, "bolt_storm", "P1", 2, 1);
    const foe = dummy(s);
    // Before the swing there is nothing to strike: the reported bug.
    expect(specialTargets(s, storm.instanceId)).toHaveLength(0);
    basicAttack(s, storm.instanceId, foe.instanceId);

    const next = advance(atCleanup(s));
    expect(statusOf(next.cards[foe.instanceId], "ELECTRIFIED"), "carried across Cleanup").toBeTruthy();
    next.players.P1.magicPool = 5;
    next.cards[storm.instanceId].summonedThisRound = false;
    next.cards[storm.instanceId].specialCooldown = 0;
    expect(specialTargets(next, storm.instanceId).map((t) => t.instanceId)).toContain(foe.instanceId);
    expect(canFireSpecial(atBattle(next), storm.instanceId).ok).toBe(true);
  });
});
