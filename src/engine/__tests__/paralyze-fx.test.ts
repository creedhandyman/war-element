// PARALYZE is a coin flipped at ACT time, so a paralyzed card carries the pip
// whether or not it was actually stopped this turn. The one thing the player
// could not see was which — the skip produced no numbers and one log line.

import { describe, expect, it } from "vitest";
import { basicAttack } from "../combat";
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
