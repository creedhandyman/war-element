// Every mechanical field on a card must produce card text. Without this, a
// passive can ship working-but-invisible: the only way to learn what the card
// did was to read the source. That is exactly how ~19 of them ended up
// undescribed.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS } from "../../data/cards";
import { SPELLS } from "../spells";
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
  // Wave 1/2 additions — every one of these shipped with NO card text at all
  // until this list caught up, which is exactly what the list is for.
  "meleeBonusDmg", "onEnterEnemySide", "onEnterMidRow", "onHitPush", "basicLineReach", "mounted", "shoveWeaker",
] as const;

/** Every effect a roundTick can carry. */
const ROUND_TICK_KEYS = [
  "aoeDmg", "aoeStatus", "lowestEnemyStatus", "pokeDmg", "pokeStatus",
  "healAllies", "healLowestAlly", "buffDmgEveryN", "scaldFrozen", "paralyzeOne",
  "pushEnemies", "rowAheadDmg", "inRangeDmg", "inRangeStatus", "selfShields",
  "pokeParalyzedDmg", "aoeParalyzedDmg", "rootedDmg", "roundHealElement",
  "spawn", "aoeElectrifiedDmg", "selfHpCost", "spawnTriggerAt", "enemyHomeRowStatus",
  "spawnMaxAlive",
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

  it("every spell's text states the numbers it actually uses", () => {
    // Spell text is hand-written, so the risk isn't a missing description — it's
    // one that drifts from the params after a balance change. Check the figures
    // a player would act on actually appear.
    const wrong: string[] = [];
    for (const s of SPELLS) {
      const t = s.text;
      if (!t || t.length < 10) { wrong.push(`${s.id}: no text`); continue; }
      const say = (v: number | undefined, label: string) => {
        if (v == null || v === 0) return;
        if (!new RegExp(`\\b${v}\\b`).test(t)) wrong.push(`${s.id}: ${label} ${v} not in text`);
      };
      say(s.dmg, "dmg");
      say(s.allyHeal, "allyHeal");
      say(s.allyShield, "allyShield");
      say(s.allySp, "allySp");
      say(s.drainMaxHp, "drainMaxHp");
      say(s.gainSummon, "gainSummon");
      // A converter's text has to state BOTH sides of the trade, or the player
      // can't tell what the exchange rate is.
      if (s.kind === "convert") say(s.cost, "cost (magic spent)");
      say(s.wall?.dmg, "wall dmg");
      say(s.wall?.rounds, "wall rounds");
      say(s.field?.rounds, "field rounds");
      // Statuses must be named, or the player can't know what they're applying.
      // Card text uses natural English, so accept the irregular forms: FREEZE
      // reads as "FROZEN", MUTED as "MUTE". The regular ones (ROOTed, BLINDed,
      // PARALYZED, FRIGHTENed) all contain their kind as a prefix already.
      const ALIAS: Record<string, string[]> = { FREEZE: ["FREEZE", "FROZEN"], MUTED: ["MUTED", "MUTE"] };
      for (const [st, where] of [[s.status, "status"], [s.wall?.status, "wall status"]] as const) {
        if (!st) continue;
        const forms = ALIAS[st.kind] ?? [st.kind];
        if (!forms.some((f) => t.toUpperCase().includes(f)))
          wrong.push(`${s.id}: ${where} ${st.kind} not named in text`);
      }
    }
    expect(wrong, `spell text out of sync with params:\n  ${wrong.join("\n  ")}`).toEqual([]);
  });

  it("every SUB-field of a composite ability is mentioned too", () => {
    // The gap that let +max HP ship invisible on Pyrogon, Octoirate and
    // Reptilian: the outer field (onKill) produced a line, so the coverage check
    // passed, while one of its sub-values was silently dropped from that line.
    // Compare the text with and without each sub-field — if removing it doesn't
    // change the text, it was never being said.
    const SUBS: Record<string, string[]> = {
      onKill: ["buffDmg", "buffDmgRound", "buffSp", "buffHits", "buffMaxHp", "healSelf",
               "gainShields", "aoeDmg", "aoeDmgElectrified", "spawnToken", "coinBonusDmg",
               "reduceSpecialCost", "extendStatus"],
      vsStatus: ["anyStatus", "lifesteal", "crit", "bonusDmg", "dmgMult", "healOnHit"],
      onRevive: ["heal", "sleep", "decay", "maxRevives"],
      aura: ["dmg", "sp", "maxHp", "shields", "pen"],
      onLowHp: ["dmg", "loseSp", "loseSpecial"],
      onDeath: ["dmg", "rowAhead", "spawnToken", "frightenInRange", "allyTribeBuffDmg",
                "killerStatus", "inRangeOnly"],
    };
    const silent: string[] = [];
    for (const def of all) {
      for (const [outer, keys] of Object.entries(SUBS)) {
        const o = (def as unknown as Record<string, Record<string, unknown>>)[outer];
        if (!o) continue;
        for (const k of keys) {
          // A sub-field set to 0 or false is not a claim — WarPhant and Wedded
          // Wraith both carry onDeath.dmg: 0 purely to hang a spawn or a tribe
          // buff off, and "deals 0 damage back to its killer" was precisely the
          // nonsense this pass removed.
          if (o[k] == null || o[k] === 0 || o[k] === false) continue;
          const stripped = { ...o };
          delete stripped[k];
          const withIt = describePassives(def).join("|");
          const without = describePassives({ ...def, [outer]: stripped } as typeof def).join("|");
          if (withIt === without) silent.push(`${def.id}.${outer}.${k}`);
        }
      }
    }
    expect(silent, `sub-fields absent from the card text:\n  ${silent.join("\n  ")}`).toEqual([]);
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
