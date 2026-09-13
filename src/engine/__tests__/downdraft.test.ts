// GYRE'S DOWNDRAFT — the passive that replaced Wheeling Sky.
//
// Wheeling Sky was Skybreaker's `cycloneSpin`: every opponent rotated one slot
// around Gyre, every round. Downdraft keeps the kit's speed theme (the Talent
// already drains SP) and moves nothing: at the end of each round the CLOSEST
// opponent loses 3 SP for the next round.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { advance } from "../phases";
import { effectiveSp } from "../state";
import { describePassives } from "../../ui/card-text";
import type { GameState } from "../types";
import { atCleanup, bigPrepState, place } from "./helpers";

const GYRE = "gale_gyre";
const foe = (s: GameState, row: number, col: number) =>
  place(s, "leaf_stickviper", "P2", row, col, { curHp: 500, maxHp: 500, curShields: 0 });
const sp = (s: GameState, id: string) => effectiveSp(s, s.cards[id]);

describe("Downdraft", () => {
  it("replaces Wheeling Sky: no spin left on the card", () => {
    const d = getDef(GYRE);
    expect(d.passiveNames?.roundTick).toBe("Downdraft");
    expect(d.roundTick).toEqual({ slowNearest: 3 });
  });

  it("slows the closest opponent by 3 for the next round, and only that one", () => {
    const s = bigPrepState();
    place(s, GYRE, "P1", 3, 2);
    const near = foe(s, 1, 2); // 2 away
    const far = foe(s, 0, 0);  // 5 away
    const nearSp = sp(s, near.instanceId);
    const farSp = sp(s, far.instanceId);
    const n = advance(atCleanup(s));
    expect(sp(n, near.instanceId), "the closest is slowed").toBe(nearSp - 3);
    expect(sp(n, far.instanceId), "the rest keep their speed").toBe(farSp);
    // Wheeling Sky moved every opponent; Downdraft moves nobody.
    expect(n.cards[near.instanceId].pos).toEqual({ row: 1, col: 2 });
    expect(n.cards[far.instanceId].pos).toEqual({ row: 0, col: 0 });
  });

  it("never touches Gyre's own side, however close", () => {
    const s = bigPrepState();
    place(s, GYRE, "P1", 3, 2);
    const ally = place(s, "leaf_stickviper", "P1", 3, 1, { curHp: 500, maxHp: 500 });
    const target = foe(s, 0, 2);
    const allySp = sp(s, ally.instanceId);
    const targetSp = sp(s, target.instanceId);
    const n = advance(atCleanup(s));
    expect(sp(n, ally.instanceId)).toBe(allySp);
    expect(sp(n, target.instanceId)).toBe(targetSp - 3);
  });

  it("refreshes each round rather than stacking", () => {
    const s = bigPrepState();
    place(s, GYRE, "P1", 3, 2);
    const near = foe(s, 1, 2);
    const base = sp(s, near.instanceId);
    let g = s;
    for (let i = 0; i < 3; i++) g = advance(atCleanup(g));
    expect(sp(g, near.instanceId), "still -3 after three rounds, not -9").toBe(base - 3);
  });

  it("follows whoever is closest NOW, and the last target's slow lapses", () => {
    const s = bigPrepState();
    const gyre = place(s, GYRE, "P1", 3, 2);
    const first = foe(s, 1, 2);
    const second = foe(s, 0, 0);
    const firstSp = sp(s, first.instanceId);
    const secondSp = sp(s, second.instanceId);
    const r1 = advance(atCleanup(s));
    expect(sp(r1, first.instanceId)).toBe(firstSp - 3);
    // The second opponent walks up beside Gyre.
    r1.cards[second.instanceId].pos = { row: gyre.pos!.row - 1, col: gyre.pos!.col };
    const r2 = advance(atCleanup(r1));
    expect(sp(r2, second.instanceId), "the new closest is slowed").toBe(secondSp - 3);
    expect(sp(r2, first.instanceId), "the old target has its speed back").toBe(firstSp);
  });

  it("takes only the speed a card has, and passes over one with none left", () => {
    const s = bigPrepState();
    place(s, GYRE, "P1", 3, 2);
    const slow = foe(s, 2, 2); // 1 away, with only two SP left to lose
    s.cards[slow.instanceId].buffs.push({ dmg: 0, sp: -(sp(s, slow.instanceId) - 2), rounds: 9 });
    const n = advance(atCleanup(s));
    // Floored at what it had: a -2, not a -3 that banks a round of debt.
    expect(n.cards[slow.instanceId].buffs.some((b) => b.sp === -2 && b.rounds === 1)).toBe(true);
    expect(sp(n, slow.instanceId)).toBe(0);

    // With the closest card already at zero, the slow goes to the next one out.
    const t = bigPrepState();
    place(t, GYRE, "P1", 3, 2);
    const zero = foe(t, 2, 2);
    const live = foe(t, 0, 2);
    t.cards[zero.instanceId].buffs.push({ dmg: 0, sp: -sp(t, zero.instanceId), rounds: 9 });
    const liveSp = sp(t, live.instanceId);
    const m = advance(atCleanup(t));
    expect(sp(m, live.instanceId)).toBe(liveSp - 3);
  });

  it("says what it does on the card", () => {
    const text = describePassives(getDef(GYRE)).join(" ");
    expect(text).toContain("Downdraft");
    expect(text).toMatch(/3 SP off the closest opponent/);
    expect(text).not.toMatch(/spin/);
  });
});
