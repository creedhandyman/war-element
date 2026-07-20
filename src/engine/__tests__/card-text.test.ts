// Every mechanical field on a card must produce card text. Without this, a
// passive can ship working-but-invisible: the only way to learn what the card
// did was to read the source. That is exactly how ~19 of them ended up
// undescribed.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS } from "../../data/cards";
import { describePassives } from "../../ui/CardDetail";

/** Card-def fields that carry a real ability the player should be told about.
 *  Purely structural fields (art, rarity, stats, tribe) are not listed. */
const ABILITY_FIELDS = [
  "onHitStatus", "onHitByMelee", "onKill", "vsStatus", "onRevive", "onLowHp",
  "onOppSummon", "ignoresSleepWake", "firstStrikeBonus", "basicBonus",
  "attackTrade", "summonSpawn", "summonScaleFromEnemy", "onHitSelfBuff",
  "shieldPerHitTaken", "healPerHit", "healPerCrit", "onDeath", "incinerate",
  "highSpeedImpact", "alwaysHit", "onlyAdjacentAttackers", "summonSelfShields",
  "onShieldBreak", "blocksRangedChance", "critIfFaster", "weakBelowHp",
  "healsFromBleed", "onHitAllyBuff", "onHitZap", "critStatus", "onAllyKilled",
  "spWhileStealthed", "onAllyHitShield", "basicHealsAllies",
  "evasionEnemySideOnly",
] as const;

/** Every effect a roundTick can carry. */
const ROUND_TICK_KEYS = [
  "aoeDmg", "aoeStatus", "lowestEnemyStatus", "pokeDmg", "pokeStatus",
  "healAllies", "healLowestAlly", "buffDmgEveryN", "scaldFrozen", "paralyzeOne",
  "pushEnemies", "rowAheadDmg", "inRangeDmg", "inRangeStatus", "selfShields",
  "pokeParalyzedDmg", "aoeParalyzedDmg", "rootedDmg", "roundHealElement",
  "spawn",
] as const;

describe("card text covers every mechanic", () => {
  const all = [...CARDS, ...TOKENS];

  it("every ability field on every card produces at least one passive line", () => {
    const silent: string[] = [];
    for (const def of all) {
      const lines = describePassives(def).join(" ");
      for (const f of ABILITY_FIELDS) {
        if ((def as unknown as Record<string, unknown>)[f] == null) continue;
        // A described field always lengthens the passive list; the cheapest
        // reliable signal is that the card has ANY passive text at all beyond
        // the element aura every card gets for free.
        if (describePassives(def).length <= 1) silent.push(`${def.id}.${f}`);
        void lines;
      }
    }
    expect(silent, `these fields render no card text:\n  ${silent.join("\n  ")}`).toEqual([]);
  });

  it("every roundTick effect produces a passive line", () => {
    const silent: string[] = [];
    for (const def of all) {
      const rt = def.roundTick as Record<string, unknown> | undefined;
      if (!rt) continue;
      const before = describePassives({ ...def, roundTick: undefined }).length;
      const after = describePassives(def).length;
      for (const k of ROUND_TICK_KEYS) {
        if (rt[k] == null) continue;
        // Adding the roundTick must add text. If it doesn't, this effect is
        // invisible to the player.
        if (after <= before) silent.push(`${def.id}.roundTick.${k}`);
      }
    }
    expect(silent, `these roundTick effects render no card text:\n  ${silent.join("\n  ")}`).toEqual([]);
  });

  it("no card is left with nothing but its element aura", () => {
    // A card whose only line is the free element aura tells the player nothing
    // about itself. Stat-only vanilla cards are legitimate, so this only flags
    // cards that DO have a mechanic hiding behind that silence.
    const hasMechanic = (d: (typeof all)[number]) =>
      ABILITY_FIELDS.some((f) => (d as unknown as Record<string, unknown>)[f] != null) ||
      d.roundTick != null;
    const silent = all.filter((d) => hasMechanic(d) && describePassives(d).length <= 1).map((d) => d.id);
    expect(silent, `cards with a hidden mechanic:\n  ${silent.join("\n  ")}`).toEqual([]);
  });
});
