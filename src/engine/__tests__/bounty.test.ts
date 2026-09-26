import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { basicAttack } from "../combat";
import { bigPrepState, place } from "./helpers";

// BOUNTY (Badlands Bandits): +2 shields a kill, up to +4 over the game (owner's
// call). Uncapped it banked 8+ shields on half its boards and 38 at worst, and
// every shield comes off every hit it takes, so a kill streak made it
// untouchable. The win rate never showed it; kills against its cost did.

const BANDITS = "bore_badlands_bandits";

/** Feed Bandits `n` one-HP kills and return it. */
function feed(n: number) {
  const s = bigPrepState();
  const me = place(s, BANDITS, "P1", 3, 2, { curShields: 0 });
  for (let i = 0; i < n; i++) {
    const prey = place(s, "pyro_flamehound", "P2", 2, 2, { curHp: 1, maxHp: 1, curShields: 0 });
    basicAttack(s, me.instanceId, prey.instanceId);
    expect(s.cards[prey.instanceId], `kill ${i + 1} landed`).toBeUndefined();
  }
  return s.cards[me.instanceId];
}

describe("Bounty's shields have a ceiling", () => {
  it("is printed on the card", () => {
    expect(getDef(BANDITS).onKill).toMatchObject({ gainShields: 2, gainShieldsMax: 4 });
  });

  it("two a kill, up to four, then no more", () => {
    expect(feed(1).curShields).toBe(2);
    expect(feed(2).curShields).toBe(4);
    expect(feed(6).curShields, "four kills past the cap").toBe(4);
  });

  it("leaves its DMG ceiling as it was", () => {
    expect(feed(6).dmgBonus).toBe(getDef(BANDITS).onKill!.buffDmgMax);
  });
});
