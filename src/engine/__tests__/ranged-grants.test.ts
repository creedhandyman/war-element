// Reach that is bought rather than printed: Surge's stored shot, and Havoc's
// accuracy.
//
// Two different ways a card gets to hit something it could not reach before,
// and they fail differently. A stored shot is a RESOURCE — it can be spent
// twice, spent on the wrong thing, or quietly refunded by a miss. A standing
// accuracy penalty is a ROLL — it can leak onto Specials, or onto cards that
// were promised they cannot miss. These are the edges.
import { describe, expect, it } from "vitest";
import { SPECIAL_HANDLERS, basicAttack } from "../combat";
import { validSpecialTargets, validTargets } from "../rules";
import { getDef } from "../../data/cards";
import { place, prepState } from "./helpers";
import type { CardInstance, GameState } from "../types";

/** Can `attacker` pick `target` with an ordinary basic right now? */
const canHit = (g: GameState, a: CardInstance, t: CardInstance) =>
  validTargets(g, a.instanceId).some((x) => x.instanceId === t.instanceId);

/** Fire Surge's Special the way the battle phase does. */
function reArm(g: GameState, surge: CardInstance) {
  SPECIAL_HANDLERS.electroSurge(g, surge, [], {});
}

describe("Surge stores one ranged attack", () => {
  it("cannot reach across the board before the Special", () => {
    // The control. Surge is a MELEE Tank; without this the test below would
    // pass on a card that could already reach, and prove nothing.
    const g = prepState();
    const surge = place(g, "bolt_surge", "P1", 3, 0);
    const far = place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40 });
    expect(canHit(g, surge, far)).toBe(false);
  });

  it("re-arming stores a shot", () => {
    const g = prepState();
    const surge = place(g, "bolt_surge", "P1", 3, 0);
    reArm(g, surge);
    expect(surge.rangedShotsLeft).toBe(1);
  });

  it("and the shot reaches something melee could not", () => {
    const g = prepState();
    const surge = place(g, "bolt_surge", "P1", 2, 1);
    const far = place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40 });
    expect(canHit(g, surge, far), "out of melee reach").toBe(false);
    reArm(g, surge);
    expect(canHit(g, surge, far), "in range once charged").toBe(true);
  });

  it("throwing it spends it — one attack, not a permanent upgrade", () => {
    const g = prepState();
    const surge = place(g, "bolt_surge", "P1", 2, 1);
    const far = place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40 });
    reArm(g, surge);
    basicAttack(g, surge.instanceId, far.instanceId);
    expect(g.cards[surge.instanceId].rangedShotsLeft).toBe(0);
    expect(canHit(g, g.cards[surge.instanceId], g.cards[far.instanceId])).toBe(false);
  });

  it("a MISS still spends it", () => {
    // The shot is the attempt. Refunding a whiff would make the grant unlimited
    // against anything evasive — fire, miss, fire again, forever.
    //
    // BLIND is a coin per hit and Surge throws one, so sweeping seeds gives
    // both outcomes. The assertion that matters is that the whiffs are in
    // there: without `whiffed > 0` this would pass on a run that never missed.
    let whiffed = 0;
    for (let seed = 0; seed < 40; seed++) {
      const g = prepState();
      g.rngState = seed * 1013 + 7;
      const surge = place(g, "bolt_surge", "P1", 2, 1);
      const far = place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40, curShields: 0 });
      surge.statuses = [{ kind: "BLIND", duration: 3, power: 0, source: "BOLT" }];
      reArm(g, surge);
      const r = basicAttack(g, surge.instanceId, far.instanceId);
      if ((r?.landedHits ?? 0) === 0) whiffed++;
      expect(g.cards[surge.instanceId].rangedShotsLeft, `seed ${seed}`).toBe(0);
    }
    expect(whiffed, "no seed actually missed — the test proved nothing").toBeGreaterThan(0);
  });

  it("re-arming twice does not stockpile shots", () => {
    // `= 1`, not `+= 1`. Buzz-style repeated re-arms must not turn into a
    // quiver, or a card that can cast every other round becomes a shooter.
    const g = prepState();
    const surge = place(g, "bolt_surge", "P1", 3, 0);
    reArm(g, surge);
    reArm(g, surge);
    expect(surge.rangedShotsLeft).toBe(1);
  });

  it("is on Surge and NOT on Buzz, which shares the passive", () => {
    // Buzz re-arms with a once-per-game Talent on a cost-3 rare. Handing it a
    // free ranged attack too would be the better half of a legendary's kit for
    // three gold — the config is per-card for exactly this reason.
    expect(getDef("bolt_surge").electroSurge?.rangedShots).toBe(1);
    expect(getDef("bolt_buzz").electroSurge?.rangedShots).toBeUndefined();
  });

  it("does not widen Surge's own Special", () => {
    // The grant is an ATTACK, not a general upgrade. Scoped to basics on
    // purpose — see `pocketShot` in canTarget.
    const g = prepState();
    const surge = place(g, "bolt_surge", "P1", 3, 0);
    place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40 });
    reArm(g, surge);
    const before = validSpecialTargets(g, surge.instanceId).length;
    surge.rangedShotsLeft = 0;
    expect(validSpecialTargets(g, surge.instanceId).length).toBe(before);
  });
});

describe("Havoc shoots, at 85%", () => {
  it("is a Ranged card that misses 15% of the time", () => {
    const d = getDef("bolt_havoc");
    expect(d.attackType).toBe("Ranged");
    expect(d.basicMissPct).toBe(15);
  });

  it("two hits is what keeps 85% from being a coin flip", () => {
    // The reason the number is survivable: a whiff costs half a volley, not the
    // whole turn. If Havoc ever drops to one hit this stops being true and the
    // accuracy should be revisited.
    expect(getDef("bolt_havoc").hits).toBe(2);
  });

  it("reaches across the board with its basic", () => {
    const g = prepState();
    const havoc = place(g, "bolt_havoc", "P1", 2, 1);
    const far = place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40 });
    expect(canHit(g, havoc, far)).toBe(true);
  });

  it("ThunderShot reaches past the basic's range cap", () => {
    // Board is 4x4, P1 home is row 3. From home a ranged BASIC reaches 2
    // king-steps; a ranged SPECIAL is uncapped. Three steps away is the gap
    // between them, and it is the whole point of flagging the Special.
    //
    // NOT tested as "reaches the enemy home row": `ranged` deliberately does
    // not buy an exemption from the Home-Slot rule — that is `ignoreHomeRule`,
    // which ThunderShot does not claim.
    const g = prepState();
    const havoc = place(g, "bolt_havoc", "P1", 3, 0);
    const far = place(g, "dusk_gool", "P2", 1, 3, { curHp: 40, maxHp: 40 });
    expect(getDef("bolt_havoc").special?.ranged).toBe(true);
    expect(canHit(g, havoc, far), "past the basic's reach").toBe(false);
    expect(
      validSpecialTargets(g, havoc.instanceId).some((x) => x.instanceId === far.instanceId),
      "but inside the Special's",
    ).toBe(true);
  });

  it("the Special does NOT roll to miss", () => {
    // Specials auto-hit everywhere else in the game. A 3-magic cast that can
    // whiff would be a different card, so `basicMissPct` is scoped to basics —
    // 200 casts, zero of them lost.
    const g = prepState();
    const havoc = place(g, "bolt_havoc", "P1", 3, 0);
    const foe = place(g, "dusk_gool", "P2", 1, 1, { curHp: 4000, maxHp: 4000, curShields: 0 });
    const before = foe.curHp;
    for (let i = 0; i < 200; i++) {
      g.rngState = i * 977 + 13;
      SPECIAL_HANDLERS.strike(g, havoc, [foe], getDef("bolt_havoc").special!.params!);
    }
    expect(before - g.cards[foe.instanceId].curHp).toBe(200 * 7);
  });

  it("the miss actually happens, and lands near 15%", () => {
    // Rolled per hit like BLIND. Wide bounds on purpose — this is asserting
    // that the penalty is wired in and roughly the printed number, not that a
    // seeded RNG produces an exact count.
    const g = prepState();
    const havoc = place(g, "bolt_havoc", "P1", 2, 1);
    let hits = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const foe = place(g, "dusk_gool", "P2", 1, 1, { curHp: 999, maxHp: 999, curShields: 0 });
      g.rngState = i * 7919 + 3;
      const r = basicAttack(g, havoc.instanceId, foe.instanceId);
      hits += r?.landedHits ?? 0;
      delete g.cards[foe.instanceId];
      havoc.attackedThisRound = false;
    }
    const rate = hits / (N * 2); // two hits per volley
    expect(rate, `landed ${hits}/${N * 2}`).toBeGreaterThan(0.75);
    expect(rate, `landed ${hits}/${N * 2}`).toBeLessThan(0.95);
  });
});
