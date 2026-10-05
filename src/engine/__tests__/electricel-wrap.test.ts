// Electricel's Wrap moves to its basic: every hit PARALYZEs for 1 round
// (owner, 2026-10-05). The on-summon paralyze is gone.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { basicAttack } from "../combat";
import { place, prepState } from "./helpers";

describe("Electricel's Wrap", () => {
  it("a basic hit leaves the target PARALYZED for 1 round", () => {
    const s = prepState();
    const eel = place(s, "bolt_electricel", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    basicAttack(s, eel.instanceId, foe.instanceId);
    const para = s.cards[foe.instanceId].statuses.find((x) => x.kind === "PARALYZE");
    expect(para?.duration).toBe(1);
  });

  it("no longer paralyzes on summon", () => {
    expect(getDef("bolt_electricel").onSummon).toBeUndefined();
  });
});
