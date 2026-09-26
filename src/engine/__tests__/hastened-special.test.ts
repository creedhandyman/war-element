import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { SPECIAL_HANDLERS } from "../combat";
import { place, prepState } from "./helpers";

// Whirlwind Slasher carries Hastened Assault (owner's call): each hit can CRIT an
// opponent WolfBane (SP 9) is faster than, and every crit heals it 3, exactly as
// its basic does. The CRIT is the ordinary coin, so this reads across seeds.

/** Greegon (SP 4) is slower than WolfBane; `faster` gives it +10 SP. */
function slash(seed: number, faster: boolean) {
  const s = prepState(seed);
  const wolf = place(s, "gale_wolfbane", "P1", 3, 1, { curHp: 10 });
  const foe = place(s, "leaf_greegon", "P2", 1, 1, { curHp: 40, maxHp: 40, curShields: 0, spBonus: faster ? 10 : 0 });
  SPECIAL_HANDLERS.barrage(s, s.cards[wolf.instanceId], [s.cards[foe.instanceId]], getDef("gale_wolfbane").special!.params!);
  return { dealt: 40 - s.cards[foe.instanceId].curHp, healed: s.cards[wolf.instanceId].curHp - 10 };
}

describe("Whirlwind Slasher with Hastened Assault", () => {
  it("never crits an opponent faster than WolfBane", () => {
    for (let seed = 1; seed <= 20; seed++) expect(slash(seed, true).dealt).toBe(5);
  });

  it("can crit a slower one, and each crit heals 3", () => {
    const runs = Array.from({ length: 30 }, (_, i) => slash(i + 1, false));
    const crits = runs.filter((r) => r.dealt === 10);
    expect(crits.length, "the coin lands sometimes").toBeGreaterThan(0);
    expect(runs.some((r) => r.dealt === 5), "...and misses sometimes").toBe(true);
    for (const r of crits) expect(r.healed).toBe(3);
    for (const r of runs.filter((x) => x.dealt === 5)) expect(r.healed).toBe(0);
  });
});
