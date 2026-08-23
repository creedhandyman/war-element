// Butler's Service — +4 HP to every OTHER ally within range, end of round.
//
// The Butler is a token nothing spawns except Nightfang's disguise, so this
// ability only ever runs on a disguised Nightfang. That is the point rather than
// a side effect: a card that visibly mends the line reads as exactly the
// harmless back-row Support the disguise wants you to see, and the healing is
// real for as long as the mask holds.
import { describe, expect, it } from "vitest";
import { advance } from "../phases";
import { getDef } from "../../data/cards";
import { atCleanup, place, prepState } from "./helpers";

describe("Butler's Service", () => {
  it("heals wounded allies standing beside it", () => {
    const s = prepState();
    const butler = place(s, "dusk_butler", "P1", 2, 1);
    const near = place(s, "dusk_gool", "P1", 2, 2, { curHp: 10, maxHp: 40 });
    const diagonal = place(s, "dusk_gool", "P1", 1, 0, { curHp: 10, maxHp: 40 });
    place(s, "leaf_alpha", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(n.cards[near.instanceId].curHp, "orthogonally adjacent").toBe(14);
    // Range is chebyshev, so the eight surrounding squares all count — the same
    // shape a Melee basic reaches.
    // 14 from the Butler, +1 from CREEPING DARK: the diagonal gool is itself a
    // DUSK card standing in contact with the enemy at (0,0), so it drains one
    // and keeps it. Two auras land on the same body and both are working.
    expect(n.cards[diagonal.instanceId].curHp, "diagonally adjacent").toBe(15);
    expect(n.log.some((l) => /attends 2 nearby/.test(l))).toBe(true);
    void butler;
  });

  it("does not reach across the board", () => {
    // "In range", not board-wide. The Butler is Melee, so it has to stand with
    // the people it keeps alive.
    const s = prepState();
    place(s, "dusk_butler", "P1", 3, 0);
    const far = place(s, "dusk_gool", "P1", 1, 3, { curHp: 10, maxHp: 40 });
    place(s, "leaf_alpha", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(n.cards[far.instanceId].curHp).toBe(10);
  });

  it("never heals itself", () => {
    // "All OTHER allies". A self-heal would make it quietly unkillable by chip
    // damage, and killing it is the whole way the disguise comes off.
    const s = prepState();
    const butler = place(s, "dusk_butler", "P1", 2, 1, { curHp: 5, maxHp: 12 });
    place(s, "dusk_gool", "P1", 2, 2, { curHp: 10, maxHp: 40 });
    place(s, "leaf_alpha", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(n.cards[butler.instanceId].curHp).toBe(5);
  });

  it("does not heal the enemy standing next to it", () => {
    // A DUSK body deliberately: the first draft of this used leaf_alpha and it
    // came back healed by 2 — LEAF's own regen aura, not the Butler. An enemy
    // that mends itself cannot prove anything about who mended it.
    const s = prepState();
    place(s, "dusk_butler", "P1", 2, 1);
    const foe = place(s, "dusk_gool", "P2", 2, 2, { curHp: 10, maxHp: 40 });
    const n = advance(atCleanup(s));
    expect(n.cards[foe.instanceId].curHp).toBe(10);
  });

  it("stays quiet with nobody to attend", () => {
    // A full-HP neighbour is not a heal — `healCard` returns 0 and the line
    // must not print, or the log claims work it did not do.
    const s = prepState();
    place(s, "dusk_butler", "P1", 2, 1);
    place(s, "dusk_gool", "P1", 2, 2);
    place(s, "leaf_alpha", "P2", 0, 0);
    const n = advance(atCleanup(s));
    expect(n.log.some((l) => /attends/.test(l))).toBe(false);
  });

  it("is the disguise's ability, so Nightfang wears it", () => {
    // `summonCard` swaps defId wholesale, so a disguised Nightfang IS the
    // Butler for every getDef lookup — including this round tick.
    expect(getDef("dusk_nightfang").disguise?.as).toBe("dusk_butler");
    expect(getDef("dusk_butler").roundTick?.healAlliesInRange).toBe(4);
  });
});
