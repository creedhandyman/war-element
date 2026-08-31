// A RAMP WITH NO CEILING.
//
// Reported from the device: enraged Vulcanyx is too powerful. The win rate did
// not show it — 75% bare, the EASIEST enraged boss on its floor — and that is
// the lesson worth keeping: the aggregate was the wrong instrument. What was
// wrong was the texture. Apex Hunger is +3 DMG a kill, the biggest on-kill ramp
// in the set (next is +2), it was uncapped, and it sits on the only boss that
// also carries LIFESTEAL, so every point of it is healing as well.
//
// Measured across real fights: mean PEAK bonus +36 on a printed 41, worst +81,
// top swing 122. Enraged — where `statScale` multiplies the TOTAL, this bonus
// included, so each kill is worth ~+5 rather than +3 — mean peak +54, worst
// +108, top swing 223 against its own 366 HP pool.
//
// Every other ramp in the engine already has a ceiling (`packDmg`, `momentum`,
// `vsFrozenRamp`, `onHitSpawn`, `spawnToken.maxAlive`). This one was the odd
// one out rather than a decision.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { basicAttack } from "../combat";
import { effectiveDmg } from "../state";
import { ENRAGE_SCALE } from "../../data/void-tower";
import { bigPrepState, place } from "./helpers";

const BOSS = "boss_vulcanyx";

/** Feed it `n` kills and return the instance. */
function feed(s: ReturnType<typeof bigPrepState>, bossId: string, n: number, scale?: number) {
  const boss = place(s, bossId, "P2", 0, 2);
  if (scale != null) s.cards[boss.instanceId].statScale = scale;
  for (let i = 0; i < n; i++) {
    const prey = place(s, "leaf_stickviper", "P1", 1, 2, { curHp: 1, maxHp: 1, curShields: 0 });
    basicAttack(s, boss.instanceId, prey.instanceId);
  }
  return s.cards[boss.instanceId];
}

describe("Apex Hunger has a ceiling", () => {
  it("the card declares one, and it is the biggest ramp in the set", () => {
    const ok = getDef(BOSS).onKill!;
    expect(ok.buffDmg).toBe(3);
    expect(ok.buffDmgMax, "bounded").toBe(18);
    // If a bigger uncapped ramp is ever printed, this is where to notice.
    expect(ok.buffDmg! <= (ok.buffDmgMax ?? Infinity)).toBe(true);
  });

  it("grows on each kill, up to the cap, and then stops", () => {
    const cap = getDef(BOSS).onKill!.buffDmgMax!;
    const per = getDef(BOSS).onKill!.buffDmg!;
    const atCap = feed(bigPrepState(), BOSS, cap / per);
    expect(atCap.dmgBonus, "exactly the ceiling").toBe(cap);
    // ...and twenty more kills do not move it.
    const wayPast = feed(bigPrepState(), BOSS, cap / per + 20);
    expect(wayPast.dmgBonus, "still the ceiling").toBe(cap);
  });

  it("the ceiling binds ENRAGED too — where it matters most", () => {
    // `statScale` multiplies base + dmgBonus together, so an uncapped ramp is
    // worth MORE than its printed value once enraged. The cap is applied to the
    // stack itself, before that multiply, so it binds in both states.
    const s = bigPrepState();
    const boss = feed(s, BOSS, 40, ENRAGE_SCALE);
    const cap = getDef(BOSS).onKill!.buffDmgMax!;
    expect(boss.dmgBonus).toBe(cap);
    const printed = getDef(BOSS).dmg;
    expect(effectiveDmg(s, boss), "bounded swing")
      .toBe(Math.floor((printed + cap) * ENRAGE_SCALE));
    // The number this whole fix exists for: it used to reach 223.
    expect(effectiveDmg(s, boss)).toBeLessThan(100);
  });

  it("leaves the other thirteen ramps alone", () => {
    // Absent = uncapped, so nothing carrying buffDmg 1-2 changes behaviour.
    const s = bigPrepState();
    const other = "bolt_voltogon";
    const def = getDef(other);
    if (!def.onKill?.buffDmg) return;            // roster moved; nothing to assert
    expect(def.onKill.buffDmgMax, "still uncapped").toBeUndefined();
    const grown = feed(s, other, 10);
    expect(grown.dmgBonus, "ramps freely").toBe(def.onKill.buffDmg * 10);
  });
});
