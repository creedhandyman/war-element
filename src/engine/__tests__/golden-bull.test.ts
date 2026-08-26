// THE GOLDEN BULL — Lassos ropes one in as it rides on, and it arrives already
// running.
//
// Two things are being pinned here. The CHARGE: it does not stop for an enemy
// the way `summonAdvance` does, it runs through and leaves them standing. And
// WHERE IT STOPS, which is the fiddly half — a trampled body still occupies its
// square, so the bull can pass over it but cannot stand on it, unless the
// trample killed it.
//
// The charge is exercised by PLACING a bull and calling `chargeOnArrival`
// rather than by summoning Lassos and hoping. `spawnTokens` drops a token in
// whatever slot beside its spawner happens to be open, so the bull's column is
// not knowable in advance — the first draft of this file assumed it was Lassos'
// column and three tests measured a lane the bull never ran down. Worse, one of
// them read 12 damage on a 6-damage trample and looked like a double hit: it
// was Lassos' OWN on-summon strike landing on the same body.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { boardCards } from "../state";
import { applyIntent, chargeOnArrival } from "../phases";
import { bigPrepState, giveHand, place } from "./helpers";

const BULL = "dawn_golden_bull_tok";

/** Summon Lassos from hand into a column and hand back the bull it ropes in. */
function rideIn(s: ReturnType<typeof bigPrepState>, col: number) {
  const handId = giveHand(s, "P1", "dawn_lassos");
  s.players.P1.gold = 99;
  const n = applyIntent(s, { type: "SUMMON", player: "P1", handId, col } as never);
  const bull = boardCards(n, "P1").find((c) => c.defId === BULL) ?? null;
  return { n, bull };
}

describe("Lassos ropes one in, once, as it arrives", () => {
  it("summoning Lassos brings a Golden Bull with it", () => {
    const s = bigPrepState();
    const { bull } = rideIn(s, 2);
    expect(bull, "a bull came back on the end of the rope").toBeTruthy();
  });

  it("it is ONE bull, not one per Hogtie", () => {
    // On summon rather than on the Special deliberately: Hogtie is repeatable on
    // a 1-round cooldown, and a free 4-cost body every other round would be a
    // second card stapled to this one.
    expect(getDef("dawn_lassos").summonSpawn?.count).toBe(1);
    expect(getDef("dawn_lassos").special?.params?.spawnToken,
      "the Special does not spawn anything").toBeUndefined();
  });
});

describe("Wild Charge", () => {
  /** A bull standing at `row` in column 2, about to bolt. */
  const bullAt = (s: ReturnType<typeof bigPrepState>, row: number) =>
    place(s, BULL, "P1", row, 2);
  const foeAt = (s: ReturnType<typeof bigPrepState>, row: number, col: number, hp = 90) => {
    const c = place(s, "leaf_stickviper", "P1", row, col, { curHp: hp, maxHp: 90, curShields: 0 });
    s.cards[c.instanceId].owner = "P2";
    return c;
  };
  const DMG = getDef(BULL).summonCharge!.dmg;

  it("bolts for the far side of an empty board", () => {
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(s.cards[bull.instanceId].pos!.row, "the length of the board").toBe(0);
  });

  it("tramples an enemy in the lane and RUNS ON PAST it", () => {
    // The whole difference from `summonAdvance`, which halts at the first body.
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    const blocker = foeAt(s, 2, 2);
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(90 - s.cards[blocker.instanceId].curHp, "it went through them").toBe(DMG);
    expect(s.cards[blocker.instanceId].pos!.row, "and left them standing").toBe(2);
    expect(s.cards[bull.instanceId].pos!.row, "ending BEYOND them").toBeLessThan(2);
  });

  it("the trample PENETRATES shields — hooves do not care about armour", () => {
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    const blocker = place(s, "leaf_stickviper", "P1", 2, 2, { curHp: 90, maxHp: 90, curShields: 99 });
    s.cards[blocker.instanceId].owner = "P2";
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(s.cards[blocker.instanceId].curHp, "the shields did not stop it").toBeLessThan(90);
  });

  it("it will NOT run down its own side — that would be a drawback, not a charge", () => {
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    const ally = place(s, "leaf_stickviper", "P1", 3, 2, { curHp: 90, maxHp: 90, curShields: 0 });
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(s.cards[ally.instanceId].curHp, "untouched").toBe(90);
    expect(s.cards[bull.instanceId].pos!.row, "and it never left the gate").toBe(4);
  });

  it("a body it could not kill is a square it cannot STAND on", () => {
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    for (const r of [0, 1, 2, 3]) foeAt(s, r, 2, 500);
    chargeOnArrival(s, s.cards[bull.instanceId]);
    const at = s.cards[bull.instanceId].pos!;
    expect(at.row, "nowhere open to run to").toBe(4);
    expect(boardCards(s).filter((c) => c.pos!.row === at.row && c.pos!.col === at.col).length,
      "one body per square").toBe(1);
  });

  it("...but a body it KILLS is a square it takes", () => {
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    const frail = foeAt(s, 3, 2, DMG);
    for (const r of [0, 1, 2]) foeAt(s, r, 2, 500);
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(s.cards[frail.instanceId], "it went down").toBeFalsy();
    expect(s.cards[bull.instanceId].pos!.row, "and the bull stands where it stood").toBe(3);
  });

  it("tramples EVERY enemy in the lane, not just the first", () => {
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    const a = foeAt(s, 3, 2);
    const b = foeAt(s, 1, 2);
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(90 - s.cards[a.instanceId].curHp, "the first").toBe(DMG);
    expect(90 - s.cards[b.instanceId].curHp, "and the one behind it").toBe(DMG);
  });

  it("only the bull's own COLUMN is in danger", () => {
    // It is a lane, not a nova — spread your line and it costs almost nothing.
    const s = bigPrepState();
    const bull = bullAt(s, 4);
    const aside = foeAt(s, 2, 0);
    chargeOnArrival(s, s.cards[bull.instanceId]);
    expect(s.cards[aside.instanceId].curHp, "two columns over is untouched").toBe(90);
  });

  it("an ordinary card is not moved by any of this", () => {
    // `summonCharge` is opt-in; nothing else on the roster carries it.
    const s = bigPrepState();
    const plain = place(s, "leaf_stickviper", "P1", 4, 2);
    chargeOnArrival(s, s.cards[plain.instanceId]);
    expect(s.cards[plain.instanceId].pos!.row, "stayed put").toBe(4);
  });
});
