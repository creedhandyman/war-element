// WIDOWBITE'S BITE CARRIES VENOM.
//
// Widow's Kiss: every landed basic leaves 5 DOT for one round. It ticks once, at
// the end of the round it was dealt, straight to HP — and then it is gone.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { basicAttack } from "../combat";
import { advance } from "../phases";
import type { GameState } from "../types";
import { atCleanup, place, prepState, statusOf } from "./helpers";

const BITE = "dusk_widowbite";

/** Widowbite beside a sturdy, shieldless target, which it bites once. */
function bitten() {
  const s = prepState();
  const spider = place(s, BITE, "P1", 2, 1);
  const foe = place(s, "leaf_alpha", "P2", 1, 1, { curHp: 200, maxHp: 200, curShields: 0 });
  basicAttack(s, spider.instanceId, foe.instanceId);
  return { s, foe };
}

describe("Widowbite's Widow's Kiss", () => {
  it("is a rider on the basic, beside Lingering Venom", () => {
    const d = getDef(BITE);
    expect(d.onHitStatus).toEqual({ kind: "DOT", duration: 1, power: 5 });
    expect(d.passiveNames?.onHitStatus).toBe("Widow's Kiss");
    expect(d.passiveNames?.onDeath, "the death venom is untouched").toBe("Lingering Venom");
  });

  it("a landed basic leaves 5 DOT for one round", () => {
    const { s, foe } = bitten();
    const st = statusOf(s.cards[foe.instanceId], "DOT");
    expect(st?.power).toBe(5);
    expect(st?.duration).toBe(1);
  });

  it("ticks once for 5 at the end of the round, then it is gone", () => {
    const { s, foe } = bitten();
    // The same board with the venom washed off. Everything else the round end
    // does to this card (DUSK's Midnight Shade drains an adjacent opponent, and
    // a melee bite means the target IS adjacent) happens on both boards alike,
    // so the difference between them is the bite and nothing else.
    const clean: GameState = JSON.parse(JSON.stringify(s));
    const c = clean.cards[foe.instanceId];
    c.statuses = c.statuses.filter((x) => x.kind !== "DOT");
    const withVenom = advance(atCleanup(s));
    const without = advance(atCleanup(clean));
    expect(without.cards[foe.instanceId].curHp - withVenom.cards[foe.instanceId].curHp).toBe(5);
    expect(statusOf(withVenom.cards[foe.instanceId], "DOT"), "one round, then gone").toBeUndefined();
  });

  it("says so on the card", () => {
    expect(describePassives(getDef(BITE)).join(" ")).toMatch(/Widow's Kiss — Basic hits apply DOT \(5\)/);
  });
});
