// Every mechanical field on a card must produce card text. Without this, a
// passive can ship working-but-invisible: the only way to learn what the card
// did was to read the source. That is exactly how ~19 of them ended up
// undescribed.

import { describe, expect, it } from "vitest";
import { CARDS, TOKENS } from "../../data/cards";
import { SPELLS } from "../spells";
import { describePassives } from "../../ui/card-text";
import { KEYWORDS, KEYWORD_STYLE } from "../../ui/shared";
import { cardHasKeyword } from "../../ui/filters";
import { buildableCards } from "../../data/custom-decks";
import { hasArcDischarge } from "../auras";

/** Card-def fields that carry a real ability the player should be told about.
 *  Purely structural fields (art, rarity, stats, tribe) are not listed. */
const ABILITY_FIELDS = [
  "onHitStatus", "onHitByMelee", "onKill", "vsStatus", "onRevive", "onLowHp",
  "onOppSummon", "ignoresSleepWake", "firstStrikeBonus", "basicBonus",
  "attackTrade", "summonSpawn", "summonScaleFromEnemy", "onHitSelfBuff",
  "shieldPerHitTaken", "healPerHit", "healPerCrit", "onDeath", "incinerate",
  "highSpeedImpact", "alwaysHit", "onlyAdjacentAttackers", "summonSelfShields",
  "onShieldBreak", "blocksRangedChance", "critIfFaster", "onCritBonus", "weakBelowHp",
  "healsFromBleed", "onHitZap", "critStatus", "onAllyKilled",
  "spWhileStealthed", "onAllyHitShield", "basicHealsAllies",
  "evasionEnemySideOnly",
  // Wave 1/2 additions — every one of these shipped with NO card text at all
  // until this list caught up, which is exactly what the list is for.
  "meleeBonusDmg", "onEnterEnemySide", "onEnterMidRow", "onHitPush", "basicLineReach", "mounted",
  // (shoveWeaker was here until Trample Through became the TRAMPLE keyword. It
  // is covered by the keyword sweep below instead — this list is def FIELDS.)
  // Wave 3 — Oakgre's enemy-facing aura and Drakonbane's target-keyed bonus.
  "intimidate", "vsTarget",
  // Wave 3b — Magalogoon, Keeper, Prism.
  "stealthWhenIdle", "hiveAbsorb", "startsWithFreeSpecial", "diesAfterAttacking", "contagionAura", "summonFog",
  "purelightAura", "totemSpiritAura", "penWhileAlly", "falseHead", "advanceOnBasic", "windWarp",
  // Wave 4 — Imperator scaling off the army already standing.
  "summonScaleFromKin",
  // Void Tower boss mechanics — reusable fields, so any card may carry them.
  "allyRevive", "firstAttackMisses",
] as const;

/** Every effect a roundTick can carry. */
const ROUND_TICK_KEYS = [
  "aoeDmg", "aoeStatus", "lowestEnemyStatus", "pokeDmg", "pokeStatus", "randomEnemyDmg",
  "healAllies", "healLowestAlly", "healSelfToFull", "buffDmgEveryN", "scaldFrozen", "paralyzeOne",
  "pushEnemies", "rowAheadDmg", "inRangeDmg", "inRangeStatus", "selfShields",
  "pokeParalyzedDmg", "aoeParalyzedDmg", "rootedDmg", "roundHealElement",
  "spawn", "aoeElectrifiedDmg", "selfHpCost", "spawnTriggerAt", "enemyHomeRowStatus",
  "spawnMaxAlive", "healHomeRow", "healHomeRowElement", "allyInRangeShields", "randomEnemyStatus",
  "shiftLateral", "fireSpecialEveryN",
  // Absent from this list is how Blackout's Power Grid and Magmadon's Scorched
  // Fury stayed invisible: the roundTick check only walks the keys named here,
  // so an effect nobody added was an effect nobody checked.
  "paralyzeLowHp", "selfBurnForDmg", "drainAdjacent", "overheatDmg", "healWoundedAllies",
  "rootZeroSp", "lockEnemySpecials", "drainMaxAdjacent", "rootFastest", "refreshShieldsTo",
  "rootedStatus", "pokeAheadAdvance",
  // The Butler's Service.
  "healAlliesInRange",
] as const;

describe("card text covers every mechanic", () => {
  const all = [...CARDS, ...TOKENS];

  it("every ability field on every card produces its own card text", () => {
    // ABLATION, not a line count. The old version asked whether the card had ANY
    // passive text beyond its element aura, which one described passive was
    // enough to satisfy — so a card with two abilities could leave the second
    // completely invisible and still pass. That is how Beebot shipped without
    // saying it dies after it attacks, and how Bastion and Velvolt Knight
    // shipped with no mention of what breaking their shield does.
    //
    // Removing a described field must CHANGE the text. If it does not, nothing
    // on the card face is reading it.
    const silent: string[] = [];
    for (const def of all) {
      const withField = describePassives(def).join(" | ");
      for (const f of ABILITY_FIELDS) {
        if ((def as unknown as Record<string, unknown>)[f] == null) continue;
        const stripped = describePassives({ ...def, [f]: undefined } as typeof def).join(" | ");
        if (stripped === withField) silent.push(`${def.id}.${f}`);
      }
    }
    expect(silent, `these fields render no card text: ${silent.join(", ")}`).toEqual([]);
  });

  it("every roundTick effect produces a passive line", () => {
    const silent: string[] = [];
    for (const def of all) {
      const rt = def.roundTick as Record<string, unknown> | undefined;
      if (!rt) continue;
      // TEXT LENGTH, not line count. A named roundTick half now JOINS the line
      // its ability already owns rather than opening a new one — Magmadon's
      // Scorched Fury is one line with two clauses, where it used to be two
      // lines with the same prefix. Counting lines called that invisible.
      // Counting characters asks the question this test actually means: does
      // turning the effect on put anything in front of the player?
      const before = describePassives({ ...def, roundTick: undefined }).join(" ").length;
      const after = describePassives(def).join(" ").length;
      for (const k of ROUND_TICK_KEYS) {
        if (rt[k] == null) continue;
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
      say(s.gainGold, "gainGold");
      // A converter's text has to state BOTH sides of the trade, or the player
      // can't tell what the exchange rate is. Keyed on gainGold rather than on
      // the KIND: Recon Ping and System Override are targetless utility spells
      // that ride the same branch without trading anything, and demanding they
      // print their cost would be asking for a number that means nothing.
      if (s.gainGold) say(s.cost, "cost (magic spent)");
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
               "reduceSpecialCost", "extendStatus", "grantStealth"],
      vsStatus: ["anyStatus", "lifesteal", "crit", "bonusDmg", "dmgMult", "healOnHit"],
      onRevive: ["heal", "sleep", "decay", "maxRevives"],
      aura: ["dmg", "sp", "maxHp", "shields", "pen"],
      onLowHp: ["dmg", "loseSp", "loseSpecial", "buffDmg", "buffSp", "gainShields"],
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

  it("no passive line is an empty label", () => {
    // The failure this catches is a describer that builds "Label: <bits>" where
    // every bit came back falsy — so the card face read literally "On a kill: ."
    // Splint and Driftwraith (onKill.grantStealth) and Kraken (onLowHp's positive
    // surge) all shipped that way: the sub-field checks above only test the keys
    // they're told about, so a field nobody listed slipped through silently.
    const empty: string[] = [];
    for (const def of all)
      for (const line of describePassives(def))
        if (/:\s*\.?\s*$/.test(line)) empty.push(`${def.id} -> "${line}"`);
    expect(empty, `passive lines with nothing after the colon:\n  ${empty.join("\n  ")}`).toEqual([]);
  });

  it("no on-summon falls back to the vague catch-all", () => {
    // "Fires an effect the moment it's summoned." tells the player nothing. It
    // is the default branch of describeOnSummon, so any handler nobody wrote a
    // case for silently lands here (spawn, empowerElement and rockslide all did).
    const vague = all
      .filter((d) => describePassives(d).some((l) => l.includes("Fires an effect the moment")))
      .map((d) => `${d.id} (handler: ${(d.onSummon as { handler?: string } | undefined)?.handler})`);
    expect(vague, `on-summon effects with no description:\n  ${vague.join("\n  ")}`).toEqual([]);
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

describe("every named passive actually shows its name", () => {
  // The complement of the ablation test above. That one asks whether an ability
  // FIELD produces text; this asks whether the NAME the data gives that field
  // survives into the text. Two cards were failing it silently: Hunter's
  // Trapper named its on-summon half and the renderer pushed that line raw, and
  // Scorch's Wildfire was looked up under a key ("enemyHomeRowStatus") that no
  // card declares. In both cases one ability rendered as two — one titled, one
  // anonymous — and nothing anywhere objected.
  it("no card declares a passive name that never reaches the card face", () => {
    const missing: string[] = [];
    for (const def of [...CARDS, ...TOKENS]) {
      const names = new Set(Object.values(def.passiveNames ?? {}));
      if (!names.size) continue;
      const text = describePassives(def).join("\n");
      for (const n of names) if (!text.includes(n)) missing.push(`${def.id}: "${n}"`);
    }
    expect(missing, `declared but never rendered:\n${missing.join("\n")}`).toEqual([]);
  });

  it("and never prints the same ability name on two separate lines", () => {
    // RIP's Dead Clock is spread over four def fields and printed four lines
    // each opening "Dead Clock —", which reads as a rendering fault rather than
    // as one ability with four clauses.
    const doubled: string[] = [];
    for (const def of [...CARDS, ...TOKENS]) {
      const lines = describePassives(def);
      for (const n of new Set(Object.values(def.passiveNames ?? {}))) {
        const hits = lines.filter((l) => l.startsWith(`${n} —`)).length;
        if (hits > 1) doubled.push(`${def.id}: "${n}" on ${hits} lines`);
      }
    }
    expect(doubled, `repeated name prefixes:\n${doubled.join("\n")}`).toEqual([]);
  });
});

describe("every keyword is either self-evident or explained", () => {
  // The field sweep above only covers def FIELDS, so a keyword can ship
  // working-but-invisible exactly the way ~19 passives once did. TRAMPLE is the
  // first keyword to arrive as a MIGRATION rather than as new content — it had
  // a card-text line as `shoveWeaker` and could have lost it on the way.
  //
  // Not "every keyword produces text": most do not, and should not. FLYING and
  // CRIT are chips whose meaning is the word itself, and spelling them out on
  // forty cards would bury the abilities that actually need explaining. What
  // the test enforces is a CHOICE — every keyword in use is deliberately in one
  // bucket or the other, so a new one cannot slip in unclassified.
  const CHIP_ONLY = new Set(["FLYING", "STEALTH", "CRIT", "PEN"]);
  const EXPLAINED = new Set(["REGEN", "LIFESTEAL", "DRAIN", "BLOCK", "REFLECT", "EVASION", "TRAMPLE"]);

  it("classifies every keyword any card carries", () => {
    const inUse = new Set<string>();
    for (const def of [...CARDS, ...TOKENS])
      for (const [k, v] of Object.entries(def.keywords)) if (v) inUse.add(k);
    const unclassified = [...inUse].filter((k) => !CHIP_ONLY.has(k) && !EXPLAINED.has(k));
    expect(unclassified, `keyword neither chip-only nor explained: ${unclassified.join(", ")}`).toEqual([]);
  });

  it("the explained ones actually say their own name on every carrier", () => {
    const missing: string[] = [];
    for (const def of [...CARDS, ...TOKENS]) {
      const text = describePassives(def).join(" | ");
      for (const [k, v] of Object.entries(def.keywords))
        if (v && EXPLAINED.has(k) && !text.includes(k)) missing.push(`${def.id}: ${k}`);
    }
    expect(missing, `carried but never described: ${missing.join(", ")}`).toEqual([]);
  });

  it("TRAMPLE survived the move from a def field to a keyword", () => {
    // The specific regression this block was written for.
    const burnout = CARDS.find((d) => d.id === "pyro_burnout")!;
    expect(burnout.keywords.TRAMPLE).toBe(true);
    expect(describePassives(burnout).join(" | ")).toContain("TRAMPLE");
  });
});

describe("the card text does not promise a passive the card lacks", () => {
  // The failure this exists for, in the reporter's words: "arc tribe still has
  // not been fixed. You did not remove the discharge passive from the lower
  // level Arc tribe cards."
  //
  // It HAD been fixed — in the engine. Discharge was narrowed to ARC's mythic
  // and legendary in the Cleanup loop, and the inspector kept its own
  // `tribes.includes("ARC")` check and went on printing the line for all
  // sixteen. Thirteen cards advertised a passive that did nothing, for four
  // commits. Every existing test asked "does the mechanic fire?" and passed;
  // none asked "does the card claim it?".
  //
  // Written against the TEXT and the ENGINE'S OWN predicate together, so the
  // two cannot drift apart again without this failing.
  it("only ARC's mythic and legendary say they Discharge", () => {
    const wrong: string[] = [];
    for (const def of [...CARDS, ...TOKENS]) {
      const claims = describePassives(def).some((l) => l.includes("ARC tribe — Discharge"));
      if (claims !== hasArcDischarge(def))
        wrong.push(`${def.id} (${def.rarity}): text says ${claims}, engine says ${hasArcDischarge(def)}`);
    }
    expect(wrong, `text and engine disagree:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("and that is genuinely three cards, not sixteen", () => {
    // Pins the SIZE of the set. Were `hasArcDischarge` loosened back to plain
    // tribe membership, the test above would still pass — text and engine would
    // agree, on the wrong rule.
    const carriers = [...CARDS, ...TOKENS].filter(hasArcDischarge).map((d) => d.id).sort();
    // boss_overclock is the fourth ON PURPOSE: it is a mythic ARC card, and the
    // rule is rarity-gated tribe membership — a dynamo at the head of a machine
    // tide discharging is the tribe rule doing exactly what it says. It is a
    // Void Tower boss, so it can never reach a player's deck.
    expect(carriers).toEqual(["bolt_elecdroid", "bolt_gigavolt", "bolt_jack_arc", "boss_overclock"]);
    const arc = [...CARDS, ...TOKENS].filter((d) => {
      const t = d.tribe == null ? [] : Array.isArray(d.tribe) ? d.tribe : [d.tribe];
      return t.includes("ARC");
    });
    expect(arc.length, "out of a tribe this size").toBeGreaterThan(12);
  });
});


// The builder and the collection both filter by KEYWORD now. A pill that can
// never match anything is a dead control, and a pill with no glyph is a blank
// one — neither is visible by reading the filter code.
describe("the keyword filter rows", () => {
  it("lists every keyword exactly once", () => {
    expect(new Set(KEYWORDS).size, "no repeats").toBe(KEYWORDS.length);
  });

  it("gives every keyword a glyph to render", () => {
    for (const k of KEYWORDS) {
      expect(KEYWORD_STYLE[k], `${k} has no pip style`).toBeTruthy();
      expect(KEYWORD_STYLE[k].glyph, `${k} glyph`).toBeTruthy();
      expect(KEYWORD_STYLE[k].color, `${k} colour`).toBeTruthy();
    }
  });

  it("reaches into the special and the passives, not just the printed pip", () => {
    // The point of the widening: a card that GRANTS a keyword from its Special
    // or hands one out through a passive is exactly what somebody filtering for
    // that keyword wants, and `keywords[kw]` says no because the pip is not on
    // the frame. Asserted as "strictly more than the printed count" per keyword
    // rather than against a hand-listed card, so it cannot rot when a card is
    // retuned - and at least one keyword must actually gain, or the widening
    // silently does nothing.
    let gained = 0;
    for (const k of KEYWORDS) {
      const printed = buildableCards().filter((d) => !!d.keywords[k]).length;
      const widened = buildableCards().filter((d) => cardHasKeyword(d, k)).length;
      expect(widened, `${k} lost cards`).toBeGreaterThanOrEqual(printed);
      if (widened > printed) gained++;
    }
    expect(gained, "no keyword gained a card from its text").toBeGreaterThan(0);
  });

  it("offers no keyword that no card carries", () => {
    // Buildable cards only: the filters run over the draftable pool, so a
    // keyword that exists solely on a boss or a token would still be a pill
    // that always empties the grid.
    for (const k of KEYWORDS) {
      const n = buildableCards().filter((d) => !!d.keywords[k]).length;
      expect(n, `${k} matches no buildable card`).toBeGreaterThan(0);
    }
  });
});
