// PARALYZE is a coin flipped at ACT time, so a paralyzed card carries the pip
// whether or not it was actually stopped this turn. The one thing the player
// could not see was which — the skip produced no numbers and one log line.

import { describe, expect, it } from "vitest";
import { basicAttack } from "../combat";
import { advance, applyIntent } from "../phases";
import { canBasicAttack, validTargets } from "../rules";
import type { GameState } from "../types";
import { place, prepState, seedForCoins } from "./helpers";

describe("a paralyzed card that loses its turn says so", () => {
  /** A paralyzed attacker and a fat target, with the RNG cursor parked so the
   *  NEXT coin is `stopped`. `chance(draft, 50)` is exactly one `coin`, and
   *  seeding immediately before the swing is what makes this deterministic —
   *  seeding the GAME does not, because setup spends coins of its own (the
   *  first-player flip, the shuffles) before the attack ever happens. */
  const swing = (stopped: boolean) => {
    const s = prepState();
    const zapped = place(s, "dusk_gool", "P1", 3, 0, {
      status: { kind: "PARALYZE", duration: 3, power: 0, source: "BOLT" },
    });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    s.rngState = seedForCoins(!stopped); // the skip fires on a FALSE coin
    basicAttack(s, zapped.instanceId, foe.instanceId);
    return { marker: s.cards[zapped.instanceId].fxParalyzed ?? 0, foeHp: s.cards[foe.instanceId].curHp };
  };

  it("marks the card on the turn PARALYZE actually stops it", () => {
    const r = swing(true);
    expect(r.foeHp, "the swing never landed").toBe(60);
    expect(r.marker, "and the card says why").toBe(1);
  });

  it("stays silent on the turn the coin lets it through", () => {
    // The half that makes the marker mean something: a paralyzed card that DID
    // attack must not claim it was stopped, or the float becomes decoration.
    const r = swing(false);
    expect(r.foeHp, "it attacked").toBeLessThan(60);
    expect(r.marker, "so no marker").toBe(0);
  });

  it("never marks a card that is not paralyzed at all", () => {
    const s = prepState();
    const clean = place(s, "dusk_gool", "P1", 3, 0);
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    basicAttack(s, clean.instanceId, foe.instanceId);
    expect(s.cards[clean.instanceId].fxParalyzed ?? 0).toBe(0);
    expect(s.cards[foe.instanceId].curHp, "and it really did attack").toBeLessThan(60);
  });
});

// The coin used to be flipped at the SWING: the owner picked "attack", picked a
// target, and only then found the attack was gone. It is now flipped as the
// card's turn STARTS, so a lost basic is greyed out before anything is chosen.
describe("PARALYZE is rolled as the turn starts, before the action is chosen", () => {
  /** A manual P1 card, paralyzed, whose turn is up next — with the coin parked. */
  const turnUp = (stopped: boolean) => {
    const s = prepState();
    const zapped = place(s, "dusk_gool", "P1", 3, 0, {
      status: { kind: "PARALYZE", duration: 3, power: 0, source: "BOLT" },
      autoMode: "manual",
    });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    s.phase = "battle";
    s.battle = { queue: [zapped.instanceId], index: 0, awaitingInput: null };
    s.rngState = seedForCoins(!stopped); // a FALSE coin loses the attack
    return { s, id: zapped.instanceId, foeId: foe.instanceId };
  };
  const hp = (s: GameState, id: string) => s.cards[id].curHp;

  it("a lost roll with nothing else to do passes the turn, and says why", () => {
    const { s, id, foeId } = turnUp(true);
    const next = advance(s);
    expect(next.cards[id].fxParalyzed, "the card says so as its turn starts").toBe(1);
    expect(next.battle?.awaitingInput, "nothing left to ask").toBeNull();
    expect(next.battle?.index).toBe(1);
    expect(hp(next, foeId), "and nothing was swung").toBe(60);
  });

  it("a lost roll greys out the basic but still offers the Special", () => {
    const s = prepState();
    const whale = place(s, "aqua_bluewhale", "P1", 3, 0, {
      status: { kind: "PARALYZE", duration: 3, power: 0, source: "BOLT" },
      autoMode: "manual",
    });
    const foe = place(s, "dusk_gool", "P2", 2, 0, { curHp: 60, maxHp: 60, curShields: 0 });
    s.players.P1.magicPool = 3; // Breach costs 1
    s.phase = "battle";
    s.battle = { queue: [whale.instanceId], index: 0, awaitingInput: null };
    s.rngState = seedForCoins(false);
    const next = advance(s);
    expect(next.battle?.awaitingInput, "the owner still gets a turn").toBe(whale.instanceId);
    expect(validTargets(next, whale.instanceId), "but no basic to aim").toHaveLength(0);
    expect(canBasicAttack(next, whale.instanceId)).toBe(false);
    expect(next.cards[whale.instanceId].fxParalyzed).toBe(1);
    const after = applyIntent(next, {
      type: "BATTLE_ACTION", player: "P1", action: "special", targetId: foe.instanceId,
    });
    expect(hp(after, foe.instanceId), "PARALYZE never stopped a Special").toBeLessThan(60);
  });

  it("a won roll offers the basic, and the swing does not flip again", () => {
    const { s, id, foeId } = turnUp(false);
    const next = advance(s);
    expect(next.battle?.awaitingInput, "the owner is asked").toBe(id);
    expect(validTargets(next, id).map((t) => t.instanceId)).toContain(foeId);
    expect(next.cards[id].fxParalyzed ?? 0).toBe(0);
    // Park the RNG on a LOSING coin: if the swing flipped again it would fizzle.
    next.rngState = seedForCoins(false);
    const after = applyIntent(next, { type: "BATTLE_ACTION", player: "P1", action: "basic", targetId: foeId });
    expect(hp(after, foeId), "the roll that was shown is the roll that counts").toBeLessThan(60);
  });

  it("an opponent's paralyzed card is held to the same turn-start roll", () => {
    const { s, id, foeId } = turnUp(true);
    // Hand the paralyzed card to the AI: it must not swing on a lost roll either.
    const zapped = s.cards[id];
    const foe = s.cards[foeId];
    zapped.owner = "P2";
    foe.owner = "P1";
    const next = advance(s);
    expect(hp(next, foeId)).toBe(60);
    expect(next.battle?.index, "its turn is over").toBe(1);
  });
});
