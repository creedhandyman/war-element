import type { ReactNode } from "react";
import type { CardDef, CardInstance, GameState, PlayerId, StatusKind } from "../engine";
import { effectiveBasicHits, effectiveDmg, effectiveMaxHp, effectiveSp, effectiveSpecialCost, ELEMENT_AURA, getDef, getSpell } from "../engine";
import { EL_COLOR, EL_ICON, KEYWORD_STYLE, STATUS_STYLE } from "./shared";
import { SpIcon } from "./icons";

// Colour lookup for keyword/status terms so they render as chips in card text.
const CHIP_COLOR: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(STATUS_STYLE)) m[k] = v.color;
  for (const [k, v] of Object.entries(KEYWORD_STYLE)) m[k] = v.color;
  return m;
})();
// Trigger phrases rendered as small labels (longest first so they win the match).
const TAGS = [
  "On Hit by Melee", "On Opp Summon", "Start of Round", "End of Round",
  "On Summon", "On Attack", "On Death", "On Kill", "On Hit", "On CRIT", "On Low HP", "Passive", "Talent", "Aura",
];

/** Wrap keyword/status terms as colour chips and trigger phrases as tag labels
 *  inside a card's text — the "scannable" text box from the redesign. */
export function chipify(text: string): ReactNode[] {
  const terms = [...TAGS, ...Object.keys(CHIP_COLOR)];
  const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const term = m[0];
    const chip = CHIP_COLOR[term.toUpperCase()];
    if (chip) out.push(<span key={i++} className="txt-chip" style={{ color: chip, borderColor: chip }}>{term}</span>);
    else out.push(<span key={i++} className="txt-tag">{term}</span>);
    last = m.index + term.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Spell out an on-summon passive from its handler + params, instead of the old
 *  catch-all "fires an effect". Mirrors how the effect actually resolves. */
function describeOnSummon(os: {
  handler?: string;
  params?: Record<string, number | string>;
  targetSide?: string;
  selfStatus?: string;
  selfStatusDuration?: number;
  extendSelfStatusOnKill?: number;
}): string {
  const p = os.params ?? {};
  const n = (k: string) => Number(p[k] ?? 0);
  // A pure self-status on-summon (IcyNinza's Icy Mist — no target handler).
  if (!os.handler && os.selfStatus) {
    const dur = os.selfStatusDuration ? ` for ${rounds(os.selfStatusDuration)}` : "";
    const ext = os.extendSelfStatusOnKill ? ` (+${os.extendSelfStatusOnKill} round per kill while cloaked)` : "";
    return `On summon: gain ${os.selfStatus}${dur}${ext}.`;
  }
  const scope = () => {
    if (os.targetSide === "ally") return "nearby allies";
    // Wildfire is a zone on the enemy back line, not a volley at whatever is
    // reachable — "all enemies in range" was simply wrong for it.
    if (p.enemyHomeRow != null) return "every opponent in their Home row";
    if (p.spread != null) return "enemies in the area ahead";
    const t = Number(p.targets ?? 1);
    if (t >= 99) return "all enemies in range";
    if (t === 1) return "one enemy";
    return `${t} enemies`;
  };
  // Every status this on-summon applies — the primary (statusKind, may carry a
  // DoT power) plus the secondary (debuffStatus, e.g. Krakler's FREEZE).
  const statusParts = () => {
    const parts: string[] = [];
    if (p.statusKind)
      parts.push(`${p.statusKind}${n("statusPower") ? ` ${n("statusPower")}` : ""}${p.statusDuration ? ` for ${rounds(n("statusDuration"))}` : ""}`);
    if (p.debuffStatus)
      parts.push(`${p.debuffStatus}${p.debuffStatusRounds ? ` for ${rounds(n("debuffStatusRounds"))}` : ""}`);
    return parts;
  };
  switch (os.handler) {
    case "barrage":
    case "strike": {
      const dmg = n("dmg");
      const hits = n("hits");
      const push = n("push") ? ` and push them back ${n("push")}` : "";
      const crit = n("crit") ? " (can crit)" : "";
      const sap = n("nextAtkDebuff") ? ` and sap their next attack by ${n("nextAtkDebuff")}` : "";
      const st = statusParts();
      // A no-damage grasp (Krakler, Electricel) reads as a pure status apply.
      if (dmg <= 0 && st.length)
        return `On summon: apply ${st.join(" + ")} to ${scope()}${push}.`;
      const dmgStr = hits > 1 ? `${hits}×${dmg}` : `${dmg}`;
      return `On summon: deal ${dmgStr} DMG to ${scope()}${st.length ? ` and apply ${st.join(" + ")}` : ""}${sap}${push}${crit}.`;
    }
    case "overload":
      return "On summon: fires its Special — already-PARALYZED opponents are held 1 round longer, everyone else is marked ELECTRIFIED.";
    case "statusNova":
      return `On summon: apply ${p.statusKind}${p.statusDuration ? ` for ${rounds(n("statusDuration"))}` : ""} to ${scope()}.`;
    case "grantShield":
      return `On summon: give ${scope()} +${n("amount")} shield.`;
    case "buffSp":
      return `On summon: give ${scope()} +${n("amount")} SP.`;
    case "heal":
      return `On summon: heal ${scope()} ${n("amount")} HP.`;
    default:
      return "Fires an effect the moment it's summoned.";
  }
}

/** "1 round" / "2 rounds". The card face used to print a literal "round(s)" in
 *  eight places, which read like unfinished copy. */
const rounds = (n: number) => `${n} round${n === 1 ? "" : "s"}`;

/** Passive one-liners derived purely from a card definition (no live state).
 *  The element aura (shared by every card of this element) leads the list.
 *  Shared by the in-game CardDetail and the Deck Builder's card preview. */
export function describePassives(def: CardDef): string[] {
  const aura = ELEMENT_AURA[def.element];
  const passives: string[] = [`${def.element} aura — ${aura.name}: ${aura.desc}`];
  /** Push a line, prefixed with the card's own name for that passive when it
   *  has one. `key` is the def field the line was derived from. */
  const named = (key: string, text: string) => {
    const n = def.passiveNames?.[key];
    // Some descriptions already open with the ability's name (Regenerative,
    // Hastened Assault, Obsidian Claws…). Prefixing those produced
    // "Regenerative — Regenerative: …", so only prefix when it isn't there.
    passives.push(n && !text.startsWith(n) ? `${n} — ${text}` : text);
  };
  // Passive-flavored keywords read as the card's own ability, not just a chip.
  const kw = def.keywords;
  if (kw.REGEN) passives.push(`REGEN ${kw.REGEN}: heals ${kw.REGEN} HP at the end of each round.`);
  if (kw.LIFESTEAL) passives.push("LIFESTEAL: basic attacks heal it for the damage dealt.");
  if (kw.DRAIN)
    passives.push("DRAIN: basic attacks heal it for the damage dealt AND steal 1 max HP from the target — it grows as it feeds (DUSK lifesteal).");
  if (kw.BLOCK) passives.push(`BLOCK ${kw.BLOCK}: every incoming hit is reduced by ${kw.BLOCK} — before shields, and even against PEN.`);
  if (kw.REFLECT) passives.push(`REFLECT ${kw.REFLECT}: returns ${kw.REFLECT} DMG to attackers.`);
  if (kw.EVASION) passives.push("EVASION: ~50% chance to dodge each incoming hit.");
  if (def.onHitStatus) {
    const h = def.onHitStatus;
    const gate = h.chance != null ? `${h.chance}% chance to ` : h.firstHitOnly ? "first hit: " : h.onSecondHit ? "2nd hit: " : "";
    named("onHitStatus", 
      `Basic hits ${gate}apply ${h.kind}${h.power ? ` (${h.power})` : ""} for ${rounds(h.duration)}.`,
    );
  }
  if (def.vsStatus) {
    const v = def.vsStatus;
    const parts = [
      v.lifesteal && "LIFESTEAL",
      v.crit && "CRIT",
      v.bonusDmg && `+${v.bonusDmg} DMG`,
      v.dmgMult && `×${v.dmgMult} DMG`,
      v.healOnHit && `heal ${v.healOnHit}`,
    ].filter(Boolean);
    // anyStatus means it triggers off ANY status, not the named one — saying
    // "Vs PARALYZE targets" would understate it badly.
    named("vsStatus", 
      `Vs ${v.anyStatus ? "any target carrying a status" : `${v.status} targets`}, basics gain ${parts.join(" · ")}.`,
    );
  }
  if (def.onHitByMelee) {
    const m = def.onHitByMelee;
    const bits = [m.dmg && `${m.dmg} DMG`, m.status && m.status.kind].filter(Boolean).join(" + ");
    // anyAttacker cards (Jolt, Windsor) answer shooters too — saying "by melee"
    // there would be a straight lie on the card face.
    named("onHitByMelee", 
      `When hit${m.anyAttacker ? " (melee or ranged)" : " by melee"}${m.chance ? ` (${m.chance}%)` : ""}: retaliate — ${bits}.`,
    );
  }
  if (def.onKill) {
    const k = def.onKill;
    const bits = [
      k.buffDmg && `+${k.buffDmg} DMG`,
      k.buffDmgRound && `+${k.buffDmgRound} DMG (round)`,
      k.buffHits && `+${k.buffHits} hit`,
      k.buffSp && `+${k.buffSp} SP`,
      k.buffMaxHp && `+${k.buffMaxHp} max HP`,
      k.spawnToken &&
        `raises ${k.spawnToken.count} ${getDef(k.spawnToken.token).name}${k.spawnToken.count > 1 ? "s" : ""}`,
      k.extendStatus &&
        `extends ${k.extendStatus.kind} on every enemy by ${k.extendStatus.rounds} round${k.extendStatus.rounds > 1 ? "s" : ""}`,
      k.coinBonusDmg && `+${k.coinBonusDmg}/${k.coinBonusDmg - 1} DMG`,
      k.healSelf && `heal ${k.healSelf}`,
      k.gainShields && `+${k.gainShields} shields`,
      k.aoeDmg && `${k.aoeDmg} to all enemies`,
      k.aoeDmgElectrified && `${k.aoeDmgElectrified} to all electrified (statused) enemies, once/round`,
      // Name the Special outright and say it stacks — "Special costs 1 less"
      // read as a flat, one-off, possibly team-wide discount.
      k.reduceSpecialCost &&
        `permanently shaves ${k.reduceSpecialCost} off its own ${def.special?.name ?? "Special"} cost, stacking (King Me)`,
    ].filter(Boolean);
    named("onKill", `On a kill: ${bits.join(" · ")}.`);
  }
  if (def.roundTick) {
    const t = def.roundTick;
    // Each bit says the AMOUNT and WHO it hits. The old wording ("SCALD frozen
    // enemies", "strike the closest enemy", "+1 DMG every 3 rounds") named the
    // effect but not its size, whether it stacked, or how long it lasted — you
    // had to read the source to find out what the card actually did.
    const forR = (n: number) => `${n} round${n > 1 ? "s" : ""}`;
    const bits = [
      t.aoeDmg && `${t.aoeDmg} DMG to every opponent`,
      t.aoeStatus && `${t.aoeStatus.kind} every opponent for ${forR(t.aoeStatus.duration)}`,
      t.scaldFrozen && `SCALD ${t.scaldFrozen} on every FROZEN opponent`,
      t.lowestEnemyStatus &&
        `${t.lowestEnemyStatus.kind} the weakest opponent for ${forR(t.lowestEnemyStatus.duration)}`,
      t.paralyzeOne && `PARALYZE one opponent for ${forR(t.paralyzeOne)}`,
      t.pokeDmg && `${t.pokeDmg} DMG to the closest opponent`,
      t.pokeStatus && `${t.pokeStatus.kind} the closest opponent for ${forR(t.pokeStatus.duration)}`,
      t.pushEnemies && `push every opponent back ${t.pushEnemies} slot${t.pushEnemies > 1 ? "s" : ""}`,
      t.healAllies && `heal every ally ${t.healAllies} HP`,
      t.healLowestAlly && `heal the most wounded ally ${t.healLowestAlly} HP`,
      t.roundHealElement &&
        `heal every ${t.roundHealElement.element} ally ${t.roundHealElement.amount} HP`,
      t.spawn && `raise ${t.spawn.count} ${getDef(t.spawn.token).name}${t.spawn.count > 1 ? "s" : ""}`,
    ].filter(Boolean);
    // Not an every-round effect, so it gets its own line — "Each round: every 3
    // rounds…" reads as a contradiction.
    if (t.buffDmgEveryN)
      passives.push(
        `Every ${t.buffDmgEveryN.n} rounds: permanently gains +${t.buffDmgEveryN.amount} DMG${t.buffDmgEveryN.sp ? ` and +${t.buffDmgEveryN.sp} SP` : ""} (stacking).`,
      );
    // Some roundTick fields (selfShields, rowAheadDmg, ward/cleanse…) get their
    // own dedicated line below — don't emit an empty "Each round: ." for those.
    // "Each round" would be a lie for a firstRoundOnly tick — it fires once.
    if (bits.length)
      named(
        "roundTick",
        t.firstRoundOnly
          ? `Once, at the end of the round it lands: ${bits.join(" · ")}.`
          : `Each round: ${bits.join(" · ")}.`,
      );
  }
  if (def.aura) {
    const a = def.aura;
    const who =
      a.scope === "element" ? `${def.element} allies` :
      a.scope === "tribe" ? `${a.match} allies` :
      a.scope === "class" ? `${a.match} allies` : "all allies";
    const bits = [
      a.dmg && `+${a.dmg} DMG`,
      a.sp && `+${a.sp} SP`,
      a.maxHp && `+${a.maxHp} max HP`,
      a.shields && `+${a.shields} shields`,
      a.pen && "PEN on basics",
    ].filter(Boolean);
    passives.push(`Aura — ${who} gain ${bits.join(" / ")}.`);
  }
  if (def.talent)
    passives.push(`Talent (free · once per game) — ${def.talent.name}: ${def.talent.text}`);
  if (def.onRevive)
    named("onRevive", 
      // decay turns a one-time revive into an every-death one that grinds itself
      // down — "revives once" was the opposite of what the card does.
      def.onRevive.decay
        ? def.onRevive.maxRevives
          ? `Gets back up ${def.onRevive.maxRevives === 1 ? "once" : `${def.onRevive.maxRevives} times`} at ${def.onRevive.heal} HP, losing ${def.onRevive.decay} from each stat — after that it stays down.`
          : `Revives on EVERY death at ${def.onRevive.heal} HP, losing ${def.onRevive.decay} from each stat each time — when a stat would reach 0 it stays down.`
        : `Revives once when defeated at ${def.onRevive.heal} HP${def.onRevive.sleep ? `, then sleeps ${rounds(def.onRevive.sleep)}` : ""}.`,
    );
  if (def.onLowHp) {
    const l = def.onLowHp;
    const bits = [l.dmg && `deal ${l.dmg}`, l.loseSp && `−${l.loseSp} SP`, l.loseSpecial && "loses its Special"].filter(Boolean);
    named("onLowHp", `Below ${l.threshold} HP: ${bits.join(" · ")}.`);
  }
  if (def.onOppSummon) {
    const o = def.onOppSummon;
    const bits = [o.dmg && `${o.dmg} DMG`, o.status && o.status.kind].filter(Boolean).join(" + ");
    named("onOppSummon", `When an enemy is summoned within range, hits it with ${bits}.`);
  }
  if (def.onAllyKilled) {
    const o = def.onAllyKilled;
    const bits = [o.dmg && `${o.dmg} DMG`, o.status && `${o.status.kind} ${o.status.duration}r`].filter(Boolean).join(" + ");
    named("onAllyKilled", 
      `Brightling Ball: when an ally is killed, answers the killer with ${bits}${o.oneUse ? " (once per game)" : ""}.`,
    );
  }
  if (def.spWhileStealthed != null)
    passives.push(`Obsidian Claws: SP becomes ${def.spWhileStealthed} while STEALTHed (underground).`);
  if (def.critStatus)
    passives.push(
      `Aura — while it's on the board, every CRIT YOUR SIDE lands applies ${def.critStatus.kind} for ${rounds(def.critStatus.duration)}.`,
    );
  if (def.evasionEnemySideOnly)
    passives.push("Shadow Haunter: its EVASION is live only while it stands on the opponent's battlefield.");
  if (def.onHitZap)
    named("onHitZap", 
      `Jelly Shock: when it's hit and survives, discharges ${def.onHitZap.dmg} DMG into the attacker — melee or ranged — and every enemy standing next to it${def.onHitZap.status ? ` (+${def.onHitZap.status.kind})` : ""}.`,
    );
  if (def.firstStrikeBonus && !def.firstStrikeEnemySideOnly)
    named("firstStrikeBonus", `+${def.firstStrikeBonus} DMG on the first strike against each opponent.`);
  if (def.ignoresSleepWake) named("ignoresSleepWake", "Its attacks don't wake SLEEPING targets.");
  if (def.healsFromBleed)
    named("healsFromBleed", "Each round, heals HP equal to the total BLEED damage its enemies take.");
  if (def.basicBonus) {
    const b = def.basicBonus;
    const bits = [
      b.midLane && `+${b.midLane} in a mid row`,
      b.midLaneFull && `+${b.midLaneFull} if the mid lane is crowded`,
      b.vsSleeping && `+${b.vsSleeping} vs a SLEEPING target`,
    ].filter(Boolean);
    named("basicBonus", `Basic attacks deal bonus damage (once): ${bits.join(" · ")}.`);
  }
  if (def.attackTrade)
    named("attackTrade", 
      `Every attack (basic & Special) deals +${def.attackTrade.bonusDmg} DMG, but costs ${def.attackTrade.hpCost} HP.`,
    );
  if (def.onHitSelfBuff?.dmg)
    named("onHitSelfBuff", 
      `Bad Temper: permanently gains +${def.onHitSelfBuff.dmg} DMG each time a basic attack lands.`,
    );
  if (def.incinerate)
    named("incinerate", 
      `Incinerate: consecutive hits on the same target within a round deal +1 DMG each.`,
    );
  if (def.roundTick?.rowAheadDmg)
    passives.push(
      `End of round: deals ${def.roundTick.rowAheadDmg} DMG to opponents in the row directly ahead.`,
    );
  if (def.roundTick?.inRangeStatus)
    passives.push(
      `End of round: applies ${def.roundTick.inRangeStatus.kind} for ${def.roundTick.inRangeStatus.duration} rounds to every opponent in range.`,
    );
  if (def.roundTick?.inRangeDmg)
    passives.push(
      `End of round: deals ${def.roundTick.inRangeDmg} DMG to every opponent in range${def.roundTick.inRangeDmgPen ? " (pierces shields)" : ""}.`,
    );
  if (def.roundTick?.selfShields)
    passives.push(`Gains +${def.roundTick.selfShields} shield at the end of each round.`);
  if (def.roundTick?.pokeParalyzedDmg)
    passives.push(
      `End of round: deals ${def.roundTick.pokeParalyzedDmg} DMG to a PARALYZED opponent in range.`,
    );
  if (def.onHitAllyBuff?.shields)
    named("onHitAllyBuff", 
      `Hillside: ${def.onHitAllyBuff.firstTimeOnly ? "the first time it lands a hit, gives" : "landed hits give"} allies in the row ahead +${def.onHitAllyBuff.shields} shield.`,
    );
  if (def.shieldPerHitTaken)
    named("shieldPerHitTaken", 
      `Regenerative: at the end of each round, grows +${def.shieldPerHitTaken.shields} shield for every enemy hit it took that round${def.shieldPerHitTaken.maxShields ? ` (max ${def.shieldPerHitTaken.maxShields})` : ""}.`,
    );
  if (def.highSpeedImpact)
    named("highSpeedImpact", `High Speed Impact: +1 DMG for every point of SP above 10.`);
  if (def.blocksRangedChance)
    named("blocksRangedChance", `Rocky Force Field: ${def.blocksRangedChance}% chance to deflect a ranged attacker's hit.`);
  if (def.critIfFaster)
    named("critIfFaster", 
      `Hastened Assault: basic attacks CRIT while faster than the target${def.healPerCrit ? `, healing +${def.healPerCrit} HP per crit` : ""}.`,
    );
  if (def.roundTick?.rootedDmg)
    passives.push(
      `Trapper — end of round: deals ${def.roundTick.rootedDmg} DMG to every ROOTed opponent, anywhere on the board.`,
    );
  if (def.roundTick?.aoeParalyzedDmg)
    passives.push(
      `End of round: deals ${def.roundTick.aoeParalyzedDmg} DMG to every PARALYZED opponent in range.`,
    );
  if (def.onHitByMelee?.doubleBurn)
    named("onHitByMelee", `Hot Hot: when hit by melee, doubles the BURN already on the attacker.`);
  if (def.mounted)
    passives.push(
      "Mounted: moves like a chess king — a diagonal step costs 1, not 2 (lost if it dismounts).",
    );
  if (def.basicLineReach)
    named(
      "basicLineReach",
      `Basic attacks reach up to ${def.basicLineReach} slots straight ahead, behind, or to either side (not diagonally). An enemy in the lane blocks it.`,
    );
  if (def.onlyAdjacentAttackers)
    passives.push(`Shadow: can only be attacked by adjacent opponents — ranged shots from afar miss.`);
  if (def.firstStrikeBonus && def.firstStrikeEnemySideOnly)
    named("firstStrikeBonus", `On the enemy battlefield: +${def.firstStrikeBonus} DMG on the first strike against each opponent.`);
  if (def.summonSelfShields) {
    const sb = def.onShieldBreak;
    let breakClause = "";
    if (sb) {
      const gains: string[] = [];
      if (sb.dmg) gains.push(`+${sb.dmg} DMG`);
      if (sb.sp) gains.push(`+${sb.sp} SP`);
      if (sb.status)
        breakClause = `; when it breaks, ${sb.status.kind}s the attacker${sb.status.duration ? ` for ${rounds(sb.status.duration)}` : ""}`;
      else if (gains.length) breakClause = `; when it breaks, gains ${gains.join(" / ")}`;
    }
    named("summonSelfShields", `On summon, raises a ${def.summonSelfShields}-shield barrier${breakClause}.`);
  }
  if (def.roundTick?.selfHpCost)
    named("selfHpCost", `Each round it pays ${def.roundTick.selfHpCost} of its own HP to do so (never lethal).`);
  if (def.roundTick?.spawnTriggerAt && def.special)
    named(
      "spawnTriggerAt",
      `Every ${def.roundTick.spawnTriggerAt} raised, ${def.special.name} fires free.`,
    );
  if (def.roundTick?.spawnMaxAlive)
    named(
      "spawnMaxAlive",
      `It won't raise another while ${def.roundTick.spawnMaxAlive} of its bodies still stand — clear one to start the clock again.`,
    );
  if (def.roundTick?.wardAllies)
    passives.push(`Radiant Ward: each round, allies get a barrier that absorbs the next negative status.`);
  if (def.roundTick?.cleanseAllies)
    passives.push(`Crowned: cleanses all negative statuses from allies each round.`);
  if (def.special?.params?.freeRecastOnKill)
    passives.push(
      `On Kill, its Special recasts free next round (ignores cost & cooldown).`,
    );
  if (def.onSummon) passives.push(describeOnSummon(def.onSummon));
  if (def.onDeath) {
    const od = def.onDeath;
    const parts: string[] = [];
    // Only claim damage when there IS damage — WarPhant carries dmg 0 purely to
    // hang a spawn off, and read as "deals 0 damage back to its killer".
    if (od.dmg > 0)
      parts.push(
        od.rowAhead
          ? `blasts the enemy row ahead for ${od.dmg}${od.pen ? " (PEN)" : ""}`
          : `deals ${od.dmg}${od.pen ? " piercing" : ""} damage back to its killer`,
      );
    if (od.spawnToken)
      parts.push(
        `raises ${od.spawnToken.count} ${getDef(od.spawnToken.token).name}${od.spawnToken.count > 1 ? "s" : ""}`,
      );
    if (od.frightenInRange) parts.push(`FRIGHTENs nearby enemies for ${rounds(od.frightenInRange)}`);
    if (od.allyTribeBuffDmg)
      parts.push(`gives surviving ${od.allyTribeBuffDmg.tribe}s +${od.allyTribeBuffDmg.dmg} DMG permanently`);
    if (od.killerStatus)
      parts.push(
        `leaves its killer with ${od.killerStatus.kind} ${od.killerStatus.power} for ${rounds(od.killerStatus.duration)}`,
      );
    // The range gate is the difference between "never kill it" and "kill it from
    // two slots away", so it has to be on the card, not just in the code.
    const gate = od.inRangeOnly ? " if the killer is within its reach" : "";
    if (parts.length) named("onDeath", `On death, ${parts.join(" · ")}${gate}.`);
  }
  // ── passives that previously rendered NOTHING at all ──────────────────────
  if (def.meleeBonusDmg)
    named("meleeBonusDmg", `Basic attacks hit an ADJACENT target for +${def.meleeBonusDmg} DMG.`);
  if (def.onEnterEnemySide)
    named(
      "onEnterEnemySide",
      `On moving onto enemy ground: deal ${def.onEnterEnemySide.dmg}${def.onEnterEnemySide.pen ? " piercing" : ""} DMG to an opponent in range.`,
    );
  if (def.onEnterMidRow)
    named("onEnterMidRow", `On moving into a Mid row: gain +${def.onEnterMidRow.shields} shield.`);
  if (def.onHitPush)
    named("onHitPush", `Every landed hit shoves the victim back ${def.onHitPush} slot (if open).`);
  if (def.roundTick?.enemyHomeRowStatus) {
    const st = def.roundTick.enemyHomeRowStatus;
    named(
      "enemyHomeRowStatus",
      `The enemy Home row stays alight: each round it applies ${st.kind}${st.power ? ` ${st.power}` : ""} for ${st.duration} rounds to everything standing there.`,
    );
  }
  if (def.roundTick?.aoeElectrifiedDmg)
    named(
      "aoeElectrifiedDmg",
      `End of round: deals ${def.roundTick.aoeElectrifiedDmg} DMG to every ELECTRIFIED opponent in range.`,
    );
  if (def.statusImmune) named("statusImmune", "Immune to negative statuses.");
  if (def.ignoresHomeRule)
    named("ignoresHomeRule", "Can target the enemy Home row from anywhere.");
  if (def.special?.ranged)
    passives.push("Its Special reaches any slot on the board.");

  // ── Previously undescribed passives ────────────────────────────────────────
  // These all had real mechanical effects but no card text, so the only way to
  // learn what a card did was to read the source. Wording matches the ACTUAL
  // behaviour, which in a few cases differs from the type comments: aoeDmg,
  // aoeStatus and pushEnemies hit the whole enemy board, not just what's in
  // range.
  if (def.summonSpawn) {
    const { token, count, adjacentOnly, spawnRadius } = def.summonSpawn;
    const tokName = (() => { try { return getDef(token).name; } catch { return "token"; } })();
    passives.push(
      `On summon: brings ${count} ${tokName}${count > 1 ? "s" : ""} onto the board${adjacentOnly ? ", right beside it" : spawnRadius ? `, within ${spawnRadius} spaces of it` : ""}.`,
    );
  }
  if (def.alwaysHit)
    passives.push("Hot Shot: its attacks never miss — ignores its own BLIND and the target's EVASION.");
  if (def.basicHealsAllies)
    passives.push("Its basic attack can be aimed at a wounded ally to heal them for its DMG instead of striking.");
  if (def.healPerHit)
    named("healPerHit", `Liquification: heals ${def.healPerHit} HP for every basic hit it lands.`);
  if (def.onAllyHitShield)
    named("onAllyHitShield", `Pride Guardian: the first time each ally is hit, gives that ally +${def.onAllyHitShield} shield.`);
  if (def.summonScaleFromEnemy) {
    const sc = def.summonScaleFromEnemy;
    const gains = [sc.dmg && `+${sc.dmg} DMG`, sc.maxHp && `+${sc.maxHp} max HP`].filter(Boolean).join(" and ");
    passives.push(`Brightest Warrior: on summon, gains ${gains} for every ${sc.per} max HP the toughest opponent has.`);
  }
  if (def.weakBelowHp)
    named("weakBelowHp", 
      `Below ${def.weakBelowHp.hp} HP its basic attacks are weakened${def.weakBelowHp.dmgMult === 0.5 ? " to half damage" : ` (×${def.weakBelowHp.dmgMult} DMG)`}.`,
    );

  return passives;
}

// Plain-language blurb for each status kind, shown under a card's active effects.
const STATUS_TEXT: Record<StatusKind, string> = {
  ROOT: "Rooted — can't move.",
  BLEED: "Bleeding — takes damage each round.",
  BURN: "Burning — loses a shield (then HP) each round.",
  SCALD: "Scalded — takes damage each round.",
  DOT: "Damaged over time each round.",
  FREEZE: "Frozen — SP 0 and takes half damage dealt.",
  STUN: "Stunned — can't act.",
  WEAKEN: "Weakened — deals ~25% less damage.",
  PARALYZE: "Paralyzed — 50% chance to skip its action, and moves only 1 space (no effect on SP 7 and under).",
  MUTED: "Muted — can't fire its Special.",
  SLEEP: "Asleep — can't act until it wakes.",
  FRIGHTEN: "Frightened — retreats and can't move forward.",
  BLIND: "Blinded — attacks have a 50% chance to miss.",
  SEAL: "Bluflamed — cannot be healed.",
  ELECTRIFIED: "Electrified — BOLT cards deal +1 DMG to it.",
  STEALTH: "Stealthed — can't be targeted.",
  EVASION: "Evasive — 50% chance to dodge each hit.",
};

export function CardDetail(props: {
  game: GameState;
  card: CardInstance;
  viewer: PlayerId;
  canMove: boolean;
  onMove: () => void;
  onClose: () => void;
}) {
  const { game, card } = props;
  const def = getDef(card.defId);
  const mine = card.owner === props.viewer;
  const dmg = effectiveDmg(game, card);
  const hits = effectiveBasicHits(card);
  const sp = effectiveSp(game, card);
  const kws = Object.entries(def.keywords).map(([k, v]) =>
    v === true ? k : `${k} ${v}`,
  );

  // Passive one-liners derived from the card definition (shared with the
  // Deck Builder preview).
  const passives = describePassives(def);

  // Buffs this card is currently getting from standing in a friendly wall's row.
  const wallBuffs: string[] = [];
  for (const w of game.walls) {
    if (!w.allyBuff || w.owner !== card.owner || w.element !== def.element) continue;
    if (!card.pos || card.pos.row !== w.row) continue;
    const parts = [
      w.allyBuff.block && `+${w.allyBuff.block} BLOCK`,
      w.allyBuff.evasion && "EVASION",
      w.allyBuff.dmgReduction && `−${w.allyBuff.dmgReduction} incoming DMG`,
    ].filter(Boolean);
    wallBuffs.push(`${getSpell(w.spellId).name}: ${parts.join(", ")}`);
  }

  const specCd = card.specialCooldown > 0;
  const summonLock = card.summonedThisRound;

  return (
    <div className="overlay on-top" onClick={props.onClose}>
      <div className="modal cd-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cd-x" title="Close" onClick={props.onClose}>
          ✕
        </button>

        <div className="cd-body">
          <div className="cd-art" style={{ borderColor: EL_COLOR[def.element] }}>
            <img
              src={`/cards/${def.art ?? def.id}.png`}
              alt=""
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).classList.add(
                  "no-art",
                );
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="cd-cost">{def.cost}</span>
            <span className="cd-el-badge" style={{ borderColor: EL_COLOR[def.element] }}>
              <img src={EL_ICON[def.element]} alt={def.element} />
            </span>
          </div>

          <div className="cd-info">
            <div className="cd-name">{def.name}</div>
            <div className="cd-sub">
              <span
                className="cd-el"
                style={{ background: EL_COLOR[def.element] }}
              >
                {def.element}
              </span>
              <span>{def.cardClass}</span>
              <span>{def.attackType === "Melee" ? "🗡 Melee" : "🏹 Ranged"}</span>
              <span className={mine ? "cd-you" : "cd-opp"}>
                {mine ? "Yours" : "Opponent"}
              </span>
            </div>

            <div className="cd-stats">
              <div className="cd-stat" title="Live damage (printed value adjusted for Mid-row control & statuses)">
                <span className="cd-lbl">DMG</span>
                <span className="cd-val st-dmg">
                  ⚔{hits > 1 ? `${hits}× ` : ""}
                  {dmg}
                </span>
              </div>
              <div className="cd-stat" title="Current / max HP">
                <span className="cd-lbl">HP</span>
                <span className="cd-val st-hp">
                  ♥{card.curHp === effectiveMaxHp(game, card) ? card.curHp : `${card.curHp}/${effectiveMaxHp(game, card)}`}
                </span>
              </div>
              <div className="cd-stat" title="Shields">
                <span className="cd-lbl">SHIELD</span>
                <span className="cd-val st-sh">🛡{card.curShields}</span>
              </div>
              <div className="cd-stat" title="Speed — queue order & move reach">
                <span className="cd-lbl">SP</span>
                <span className="cd-val"><SpIcon />{sp}</span>
              </div>
            </div>

            {kws.length > 0 && (
              <div className="cd-kws">
                {kws.map((k) => (
                  <span key={k} className="cd-kw">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {def.special && (
          <div className="cd-section">
            <div className="cd-h">
              {def.special.talent ? "★" : "✦"} {def.special.name}
              <span className="cd-cost-pill">{def.special.talent ? "Talent" : `Magic ${effectiveSpecialCost(props.game, card, def.special.cost)}`}</span>
            </div>
            <p className="cd-text">{chipify(def.special.text)}</p>
            {def.special.talent && card.talentUsed && (
              <div className="cd-flag">Talent spent — once per game.</div>
            )}
            {!def.special.talent && (specCd || summonLock) && (
              <div className="cd-flag">
                {summonLock
                  ? "Can't fire the round it's summoned."
                  : `Recharging — ready in ${rounds(card.specialCooldown)}.`}
              </div>
            )}
          </div>
        )}

        {passives.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Passives</div>
            <ul className="cd-list">
              {passives.map((p, i) => (
                <li key={i}>{chipify(p)}</li>
              ))}
            </ul>
          </div>
        )}

        {wallBuffs.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Wall cover</div>
            <ul className="cd-list">
              {wallBuffs.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {card.statuses.length > 0 && (
          <div className="cd-section">
            <div className="cd-h">Active effects</div>
            <ul className="cd-list">
              {card.statuses.map((s) => (
                <li key={s.kind}>
                  <b>{s.kind}</b> ({s.duration} round{s.duration === 1 ? "" : "s"}) —{" "}
                  {STATUS_TEXT[s.kind]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cd-actions">
          {props.canMove && (
            <button className="lockin" onClick={props.onMove}>
              Move this card
            </button>
          )}
          <button className="ghost" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
