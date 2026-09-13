// MEGA PUSH GOES OFF ONCE.
//
// Megair's desperation nova — 3 to every opponent and a 2-space shove, on a
// basic it lands while below 3 HP — used to fire on EVERY such basic for as long
// as the card clung on. It is once per game now, spent through `lowHpNovaUsed`,
// and only when it actually goes off.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { describePassives } from "../../ui/card-text";
import { basicAttack } from "../combat";
import type { GameState } from "../types";
import { bigPrepState, place } from "./helpers";

/** Megair on its home row, a target and a bystander two rows up — clear of the
 *  far edge, so the shove has room and no wall gets a say in the numbers. */
const setup = (megairHp: number) => {
  const s = bigPrepState();
  const megair = place(s, "gale_megair", "P1", 4, 0, { curHp: megairHp });
  const target = place(s, "leaf_stickviper", "P2", 2, 0, { curHp: 200, maxHp: 200, curShields: 0 });
  const bystander = place(s, "leaf_stickviper", "P2", 2, 3, { curHp: 200, maxHp: 200, curShields: 0 });
  return { s, megair, target, bystander };
};
const hp = (s: GameState, id: string) => s.cards[id].curHp;
const novas = (s: GameState) => s.log.filter((l) => l.includes("Mega Push")).length;

describe("Megair's Mega Push", () => {
  it("goes off on a basic landed below 3 HP", () => {
    const { s, megair, target, bystander } = setup(2);
    basicAttack(s, megair.instanceId, target.instanceId);
    expect(hp(s, bystander.instanceId), "every opponent takes it, not only the target").toBe(200 - 3);
    expect(s.cards[megair.instanceId].lowHpNovaUsed).toBe(true);
    expect(novas(s)).toBe(1);
  });

  it("...and only ONCE, however long Megair stays below 3 HP", () => {
    const { s, megair, target, bystander } = setup(2);
    basicAttack(s, megair.instanceId, target.instanceId);
    const afterFirst = hp(s, bystander.instanceId);
    basicAttack(s, megair.instanceId, target.instanceId);
    basicAttack(s, megair.instanceId, target.instanceId);
    expect(hp(s, bystander.instanceId), "no second nova").toBe(afterFirst);
    expect(novas(s)).toBe(1);
  });

  it("is not used up by a basic at healthy HP", () => {
    const { s, megair, target, bystander } = setup(5);
    basicAttack(s, megair.instanceId, target.instanceId);
    expect(hp(s, bystander.instanceId)).toBe(200);
    expect(s.cards[megair.instanceId].lowHpNovaUsed, "still held for when it matters").toBeFalsy();
    s.cards[megair.instanceId].curHp = 2;
    basicAttack(s, megair.instanceId, target.instanceId);
    expect(hp(s, bystander.instanceId), "and there when Megair drops below 3").toBe(200 - 3);
  });

  it("says once per game on the card", () => {
    expect(describePassives(getDef("gale_megair")).join(" ")).toMatch(/Mega Push — once per game/);
  });
});
