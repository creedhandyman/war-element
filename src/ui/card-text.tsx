/** Card rules, in English.
 *
 *  Everything here turns a card DEFINITION into readable text, and nothing here
 *  knows a match exists — no GameState, no CardInstance, no live values. That
 *  is the whole reason it is its own module: it is the half of the old
 *  CardDetail that both the in-match inspector and the collection browser need,
 *  and keeping it def-only is what lets one component serve both.
 *
 *  describePassives is the bulk of it and is covered by a whole-pool test
 *  (engine/__tests__/card-text.test.ts) that asserts every ability field the
 *  data can carry produces a line. Adding a passive without adding its sentence
 *  here fails that test rather than shipping a blank card panel.
 */
import type { ReactNode } from "react";
import type { CardDef, StatusKind } from "../engine";
import { BLINDING_STAR_MISS_PCT, ELEMENT_AURA, MISTY_FOG_MISS_PCT, WEAKEN_MAX_STACKS, WEAKEN_PCT_PER_STACK, getDef } from "../engine";
import { KEYWORD_STYLE, STATUS_STYLE } from "./shared";

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
}, vsTarget?: { tribe?: string; hpAbove?: number }, element = "same-element"): string {
  const p = os.params ?? {};
  const n = (k: string) => Number(p[k] ?? 0);
  // A pure self-status on-summon (Frostveil's Icy Mist — no target handler).
  if (!os.handler && os.selfStatus) {
    const dur = os.selfStatusDuration ? ` for ${rounds(os.selfStatusDuration)}` : "";
    const ext = os.extendSelfStatusOnKill ? ` (+${os.extendSelfStatusOnKill} round per kill while cloaked)` : "";
    return `On summon: gain ${os.selfStatus}${dur}${ext}.`;
  }
  const scope = () => {
    // Dragon's Bane ambush (Drakonbane): the nearest bane-worthy foe ANYWHERE
    // on the board — no range limit, mirroring DAWN's Awakening.
    if (Number(p.onlyVsTarget ?? 0) > 0 && vsTarget) {
      const who = [
        vsTarget.tribe ? `${vsTarget.tribe}` : "",
        vsTarget.hpAbove != null ? `a foe above ${vsTarget.hpAbove} HP` : "",
      ].filter(Boolean).join(" or ");
      return `the nearest ${who} on the board`;
    }
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
    case "surfsUp":
      return `On summon: a wave deals ${n("dmg")} DMG to the enemy row ahead and heals all allies ${n("heal")} HP.`;
    case "lockSpecials":
      return `On summon: opponents cannot use their Specials this round.`;
    case "spawn": {
      // Zipp's Swarm Deploy, Volta's Relay Network.
      const token = typeof p.token === "string" ? p.token : "";
      const count = n("count") || 1;
      if (!token) break;
      const who = getDef(token).name;
      return `On summon: deploy ${count > 1 ? `${count} ${who}s` : `a ${who}`}${n("radius") ? " in an adjacent slot" : ""}.`;
    }
    case "empowerElement": {
      // Trial by Fire (Magmadon): a tithe, not a gift — same-element allies pay
      // HP for the buff, so the cost has to be on the card face.
      const cost = n("hpCost");
      return `On summon: every ${element} ally ${cost ? `pays ${cost} HP for ` : "gains "}+${n("amount")} DMG for ${rounds(n("rounds") || 1)}.`;
    }
    case "rockslide": {
      // Each shot is its own coin; scatter spreads them over random targets.
      const shots = n("hits") || 1;
      return `On summon: hurl ${shots} rock${shots > 1 ? "s" : ""} of ${n("dmg")} DMG at ${n("scatter") ? "random opponents in range" : "one opponent"} — each rock rolls to land${n("shieldPerMiss") ? `, and every miss hardens +${n("shieldPerMiss")} shield` : ""}.`;
    }
  }
  return "Fires an effect the moment it's summoned.";
}

/** "1 round" / "2 rounds". The card face used to print a literal "round(s)" in
 *  eight places, which read like unfinished copy. */
/** 99 is the codebase's idiom for "does not expire" (Velvolt Knight's Live
 *  Current, Voltis' arrival volley). Printing it literally put "for 99 rounds"
 *  on the card face, which reads as a number the player is meant to count. */
export const rounds = (n: number) => (n >= 99 ? "the rest of the match" : `${n} round${n === 1 ? "" : "s"}`);

/** Passive one-liners derived purely from a card definition (no live state).
 *  The element aura (shared by every card of this element) leads the list.
 *  Shared by the in-game CardDetail and the Deck Builder's card preview. */
export function describePassives(def: CardDef): string[] {
  const passives: string[] = [];
  // The card's own element aura, plus any it borrows (SirCrest's PYRO + AQUA).
  for (const el of [def.element, ...(def.elementAuras ?? [])]) {
    const a = ELEMENT_AURA[el];
    passives.push(`${el} aura — ${a.name}: ${a.desc}`);
  }

  /** Push a line, prefixed with the card's own name for that passive when it
   *  has one. `key` is the def field the line was derived from. */
  // Where each named ability's line already sits, so a SECOND mechanic under the
  // same name joins it instead of starting a new line with the same prefix.
  //
  // Cards routinely split one named ability across several def fields — RIP's
  // Dead Clock is four (roundTick, selfHpCost, spawnTriggerAt, spawnMaxAlive) —
  // and each used to print its own "Dead Clock — …" line. Four consecutive lines
  // with an identical prefix reads as a rendering fault, not as one ability with
  // four clauses, and it buried the clause that actually mattered.
  const namedAt = new Map<string, number>();
  /** Title a line from the FIRST of `keys` the card actually declares.
   *
   *  Cards name a composite ability under whichever sub-field reads best —
   *  Whintey files Frosty Bites under `rootZeroSp`, Efy files Nature's
   *  Protection under `refreshShieldsTo`, Storm files Supercell under
   *  `buffDmgEveryN` — while the renderer only ever looked up the PARENT key.
   *  Nineteen cards declared a name that reached nothing as a result. */
  const namedAny = (keys: string[], text: string) =>
    named(keys.find((k) => def.passiveNames?.[k]) ?? keys[0], text);
  /** One LINE can carry more than one named ability: Season's roundTick holds
   *  both Grounded and Evera's Bloom, and picking the first would have silently
   *  dropped the other. Titles the line with every distinct name it covers. */
  const namedAll = (keys: string[], text: string) => {
    const all = [...new Set(keys.map((k) => def.passiveNames?.[k]).filter(Boolean) as string[])];
    if (all.length <= 1) return namedAny(keys, text);
    passives.push(`${all.join(" / ")} — ${text}`);
  };
  const named = (key: string, text: string) => {
    const n = def.passiveNames?.[key];
    if (!n) { passives.push(text); return; }
    // Some descriptions already open with the ability's name (Regenerative,
    // Hastened Assault, Obsidian Claws…). Prefixing those produced
    // "Regenerative — Regenerative: …", so strip it before prefixing once.
    const body = text.startsWith(n) ? text.slice(n.length).replace(/^\s*[—:-]\s*/, "") : text;
    const at = namedAt.get(n);
    if (at == null) {
      namedAt.set(n, passives.length);
      passives.push(`${n} — ${body}`);
      return;
    }
    // Joined with a semicolon, and the clause de-capitalised so it reads as a
    // continuation — unless it opens on an ACRONYM (ROOT, BURN, DMG, PEN), where
    // lowercasing would corrupt a game term.
    const first = body.split(/\s/)[0] ?? "";
    const cont = /^[A-Z]{2,}$/.test(first.replace(/[^A-Za-z]/g, ""))
      ? body
      : body.charAt(0).toLowerCase() + body.slice(1);
    passives[at] = `${passives[at].replace(/\.\s*$/, "")}; ${cont}`;
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
  if (def.onHitSpawn) {
    const sp = def.onHitSpawn;
    named(
      "onHitSpawn",
      `A landed basic has a ${sp.chance}% chance to put another ${getDef(sp.token).name} on the board ` +
        `beside it — up to ${sp.max}. Copies cannot spread further.`,
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
      v.pen && "PEN",
    ].filter(Boolean);
    // anyStatus means it triggers off ANY status, not the named one — saying
    // "Vs PARALYZE targets" would understate it badly. bloodfire is the
    // leaf_pyro payoff: only a target that's BLEEDING and BURNING at once.
    named("vsStatus",
      `Vs ${v.bloodfire ? "a BLOODFIRE target (bleeding AND burning)" : v.anyStatus ? "any target carrying a status" : `${v.status} targets`}, basics gain ${parts.join(" · ")}.`,
    );
  }
  if (def.onHitByMelee) {
    const m = def.onHitByMelee;
    const bits = [m.dmg && `${m.dmg} DMG`, m.status && m.status.kind, m.spDrain && `−${m.spDrain} SP`].filter(Boolean).join(" + ");
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
      k.healSelf && `heal ${k.healSelf} HP`,
      k.gainShields && `+${k.gainShields} shields`,
      k.aoeDmg && `${k.aoeDmg} to all enemies`,
      k.blindInRange && `BLIND nearby opponents for ${k.blindInRange} round${k.blindInRange > 1 ? "s" : ""}`,
      k.nearestVolley && `${k.nearestVolley.dmg}×${k.nearestVolley.hits} to the closest opponent`,
      k.lowestHpDmg && `${k.lowestHpDmg} DMG to the lowest-HP opponent`,
      k.aoeDmgElectrified && `${k.aoeDmgElectrified} to all electrified (statused) enemies, once/round`,
      // Name the Special outright and say it stacks — "Special costs 1 less"
      // read as a flat, one-off, possibly team-wide discount.
      k.reduceSpecialCost &&
        `permanently shaves ${k.reduceSpecialCost} off its own ${def.special?.name ?? "Special"} cost, stacking (King Me)`,
      k.setTrap &&
        `lays a trap where the victim fell — the next enemy to step on it takes ${k.setTrap.dmg} DMG${k.setTrap.rootDuration ? `, ROOT ${k.setTrap.rootDuration}` : ""}${k.setTrap.lifesteal ? " and is LIFESTEALED" : ""}`,
      // Was missing, so Splint and Driftwraith both read "On a kill: ." — their
      // only on-kill payoff is the cloak.
      k.grantStealth && `STEALTH for ${k.grantStealth} round${k.grantStealth > 1 ? "s" : ""}`,
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
      t.randomEnemyDmg && `${t.randomEnemyDmg} DMG to a random opponent`,
      t.randomEnemyStatus && `${t.randomEnemyStatus.kind} a random opponent for ${t.randomEnemyStatus.duration} round${t.randomEnemyStatus.duration > 1 ? "s" : ""}`,
      t.pokeStatus && `${t.pokeStatus.kind} the closest opponent for ${forR(t.pokeStatus.duration)}`,
      t.pushEnemies && `push every opponent back ${t.pushEnemies} slot${t.pushEnemies > 1 ? "s" : ""}`,
      t.healAllies && `heal every ally ${t.healAllies} HP`,
      t.healLowestAlly && `heal the most wounded ally ${t.healLowestAlly} HP`,
      t.healHomeRow && `heal home-row allies ${t.healHomeRow} HP`,
      t.healHomeRowElement && `heal same-element home-row allies ${t.healHomeRowElement} HP`,
      t.healSelfToFull && `restore itself to full HP`,
      t.roundHealElement &&
        `heal every ${t.roundHealElement.element} ally ${t.roundHealElement.amount} HP`,
      t.spawn && `raise ${t.spawn.count} ${getDef(t.spawn.token).name}${t.spawn.count > 1 ? "s" : ""}`,
      t.drainAdjacent && `drain ${t.drainAdjacent} HP from an adjacent opponent`,
      t.pokeAheadAdvance && `gore the enemy directly ahead for ${t.pokeAheadAdvance} (advance into its slot on a kill)`,
      t.overheatDmg && `${t.overheatDmg} DMG to the closest opponent (2× on a repeat target)`,
      t.healWoundedAllies && `heal allies under ${t.healWoundedAllies.underHp} HP by +${t.healWoundedAllies.amount}`,
      t.rootZeroSp && `ROOT an opponent with 0 SP for ${t.rootZeroSp} rounds`,
      t.lockEnemySpecials && `bind ${t.lockEnemySpecials} opponents — their Specials are disabled next round`,
      t.drainMaxAdjacent && `DRAIN ${t.drainMaxAdjacent} max HP from every adjacent opponent`,
      t.rootFastest && `ROOT the fastest opponent for ${t.rootFastest} rounds`,
      t.refreshShieldsTo != null && `refresh shields back up to ${t.refreshShieldsTo}`,
      t.rootedStatus && `apply ${t.rootedStatus.kind} ${t.rootedStatus.power} to every ROOTed opponent`,
      t.paralyzeLowHp &&
        `PARALYZE every opponent at or under ${t.paralyzeLowHp.underHp} HP for ${forR(t.paralyzeLowHp.rounds)}`,
      t.selfBurnForDmg &&
        `burn ${t.selfBurnForDmg.hp} of its own HP to hit +${t.selfBurnForDmg.dmg} harder next round`,
    ].filter(Boolean);
    // Not an every-round effect, so it gets its own line — "Each round: every 3
    // rounds…" reads as a contradiction.
    if (t.buffDmgEveryN)
      namedAny(["buffDmgEveryN", "roundTick"],
        `Every ${t.buffDmgEveryN.n} rounds: permanently gains ${[t.buffDmgEveryN.amount ? `+${t.buffDmgEveryN.amount} DMG` : "", t.buffDmgEveryN.sp ? `+${t.buffDmgEveryN.sp} SP` : "", t.buffDmgEveryN.hp ? `+${t.buffDmgEveryN.hp} HP` : ""].filter(Boolean).join(", ")} (stacking).`,
      );
    // Some roundTick fields (selfShields, rowAheadDmg, ward/cleanse…) get their
    // own dedicated line below — don't emit an empty "Each round: ." for those.
    // "Each round" would be a lie for a firstRoundOnly tick — it fires once.
    if (bits.length)
      namedAll(
        ["roundTick", ...Object.keys(t)],
        t.firstRoundOnly
          ? `Once, at the end of the round it lands: ${bits.join(" · ")}.`
          : `Each round: ${bits.join(" · ")}.`,
      );
  }
  for (const a of [def.aura, ...(def.auras ?? [])]) {
    if (!a) continue;
    // An `element` filter narrows the scope, so it has to reach the wording too
    // — "adjacent allies" would be a lie on a BOLT-only conduit.
    const el = a.element ? `${a.element} ` : "";
    const who =
      a.scope === "element" ? `${a.match ?? def.element} allies` :
      a.scope === "tribe" ? `${el}${a.match} allies` :
      a.scope === "class" ? `${el}${a.match} allies` :
      a.scope === "adjacent" ? `adjacent ${el}allies` : `all ${el}allies`;
    const bits = [
      a.dmg && `+${a.dmg} DMG`,
      a.sp && `+${a.sp} SP`,
      a.maxHp && `+${a.maxHp} max HP`,
      a.shields && `+${a.shields} shields`,
      a.reflect && `REFLECT ${a.reflect}`,
      a.pen && "PEN on basics",
    ].filter(Boolean);
    // Named, when the card names it. Twelve-plus cards declare an aura name in
    // passiveNames.aura — Volcanic, Skyborn, Cavernous, Suns, Stars, Vapor,
    // Forged Tech, Arc — and every one of them was thrown away here, so the
    // player saw a generic "Aura —" while the card's own text elsewhere talked
    // about the ability by a name that appeared nowhere.
    //
    // Only `def.aura` takes the name; the extra `def.auras` entries are a second
    // effect on the same card (Kloud's Mage and Ranger lines) and would be
    // wrong to file under the first one's title.
    const auraName = a === def.aura ? def.passiveNames?.aura : undefined;
    passives.push(`${auraName ?? "Aura"} — ${who} gain ${bits.join(" / ")}.`);
  }
  if (def.weaponFromShields)
    passives.push(`Icicle Weapon: its basic attack damage equals its current shield count.`);
  if (def.shatterFrozen)
    passives.push(`Shatter: a basic that lands on a FROZEN target splashes ${def.shatterFrozen} to every enemy adjacent to it.`);
  if (def.onEnemySpecial)
    passives.push(`Bounty: when an opponent fires a Special, they take ${def.onEnemySpecial.status.kind}${def.onEnemySpecial.status.power ? ` ${def.onEnemySpecial.status.power}` : ""} for ${def.onEnemySpecial.status.duration} round(s).`);
  if (def.graveyardDmg)
    passives.push(`Graveyard: +1 DMG for every allied card that has died this game.`);
  if (def.allyKillBuff)
    passives.push(`Gaslighting: when an ally lands a kill, that ally gains +${def.allyKillBuff.dmg} DMG for ${def.allyKillBuff.rounds} round(s).`);
  if (def.bonusVsClass)
    named("bonusVsClass", `Explosive Power: basic attacks deal ${def.bonusVsClass.mult}× damage against ${def.bonusVsClass.classes.join(" / ")} targets.`);
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
        : `Revives when defeated at ${def.onRevive.heal} HP${def.onRevive.secondChance ? `, with a ${def.onRevive.secondChance}% chance to revive a second time` : " once"}${def.onRevive.sleep ? `, then sleeps ${rounds(def.onRevive.sleep)}` : ""}.`,
    );
  if (def.deathSave)
    named(
      "deathSave",
      `Tail Drop: the first lethal hit leaves it at 1 HP${def.deathSave.stealth ? ` with STEALTH ${rounds(def.deathSave.stealth)}` : ""}${def.deathSave.regen ? ` and REGEN ${def.deathSave.regen.power} for ${rounds(def.deathSave.regen.rounds)}` : ""}. Once per game.`,
    );
  if (def.onLowHp) {
    const l = def.onLowHp;
    // The one-time SURGE half (Kraken's From the Deep) was missing, so a card
    // whose low-HP effect is purely positive rendered "Below 17 HP: ." — a label
    // with nothing after it.
    const bits = [
      l.dmg && `deal ${l.dmg}`,
      l.loseSp && `−${l.loseSp} SP`,
      l.loseSpecial && "loses its Special",
      l.buffDmg && `+${l.buffDmg} DMG`,
      l.buffSp && `+${l.buffSp} SP`,
      l.gainShields && `+${l.gainShields} shields`,
    ].filter(Boolean);
    named("onLowHp", `Below ${l.threshold} HP: ${bits.join(" · ")}.`);
  }
  if (def.onOppSummon) {
    const o = def.onOppSummon;
    const bits = [o.dmg && `${o.dmg} DMG`, o.status && o.status.kind].filter(Boolean).join(" + ");
    named(
      "onOppSummon",
      o.spawnToken
        ? `When an enemy is summoned, spawns a ${getDef(o.spawnToken).name} in the closest empty adjacent slot and hits it with ${bits}.`
        : `When an enemy is summoned${o.chase ? ", hops to the closest empty adjacent slot and" : o.boardWide ? " ANYWHERE on the board," : " within range,"} hits it with ${bits}.`,
    );
  }
  if (def.onAllyKilled) {
    const o = def.onAllyKilled;
    const bits = [o.dmg && `${o.dmg} DMG`, o.status && `${o.status.kind} ${o.status.duration}r`].filter(Boolean).join(" + ");
    const nm = def.passiveNames?.onAllyKilled ?? "Brightling Ball";
    const cadence = o.oncePerRound ? " (once per round)" : o.oneUse ? " (once per game)" : "";
    passives.push(`${nm}: when an ally is killed, answers the killer with ${bits}${cadence}.`);
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
      b.flat && `+${b.flat} on every basic`,
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
  if (def.boomer)
    named("boomer", `Boomer: base damage the first strike on a target, then double on every strike after.`);
  if (def.pushImmune)
    named("pushImmune", `immune to knockback, push, and pull effects — planted where it stands.`);
  if (def.falseHead)
    named("falseHead", `once per game, the first BASIC attack against it hits a decoy head and deals no damage. Specials go through.`);
  if (def.flyingArrow)
    named("flyingArrow", `Flying Arrow: also attacks whatever the ally directly behind it strikes with a basic attack.`);
  if (def.skyScout)
    named("skyScout", `Sky Scout: when it enters a Mid row, allies' basic attacks hit +1 adjacent target for the round.`);
  if (def.critPen)
    named("critPen", `its CRIT can fire even at a shielded target — and when it lands, the shot pierces the shield instead of being stopped by it.`);
  if (def.potionOnHit)
    named("potionOnHit", `Magic Potion: a landed basic hurls a random potion — poison (DOT 1), 3 damage, or FRIGHTEN 2.`);
  if (def.electroSurge)
    named("electroSurge", `Electro Surge: armed on summon. While armed it's immune to status; the next hit it takes PARALYZEs the attacker ${def.electroSurge.paralyze} rounds and deactivates.`);
  if (def.firePassiveSpecial) {
    const f = def.firePassiveSpecial;
    const when = [f.onFirstHit && "the first time it hits", f.onKill && "on a kill", f.onDeath && "when it dies"].filter(Boolean).join(", ");
    named("firePassiveSpecial", `Auto-fires its Special for free ${when}${f.grantFlyingRounds ? `, then gains FLYING for ${f.grantFlyingRounds} rounds` : ""}.`);
  }
  if (def.jackpot)
    named("jackpot", `Jackpot: a basic CRIT fires its Special for free; ${def.jackpot.critsForBonus} crits in one round grant +${def.jackpot.bonusHp} HP and +${def.jackpot.bonusDmg} DMG.`);
  if (def.blockVsClasses)
    named("blockVsClasses", `Iron Ore: takes half damage from ${def.blockVsClasses.join(" and ")} attackers.`);
  if (def.bonusVsShield)
    named("bonusVsShield", `Diamond's Edge: basic attacks deal ${def.bonusVsShield}× damage against a shielded target.`);
  if (def.onSpecialUse)
    named("onSpecialUse", `Golden Resonance: each Special use grants +${def.onSpecialUse.shields} shields and +${def.onSpecialUse.dmg} DMG (stacking).`);
  if (def.onCritDebuff)
    named("onCritDebuff", `Brutal: a basic CRIT saps ${def.onCritDebuff} DMG off the target's own attacks for the round.`);
  if (def.onCritBonus)
    named("onCritBonus", `Twin Strike: on a CRIT, chain a bonus ${def.onCritBonus.hits}×${def.onCritBonus.dmg} CRIT strike at the same target — once per round.`);
  if (def.evadeVsSlower)
    named("evadeVsSlower", `Unpredictable: a slower attacker (lower SP) has only a 50% chance to hit it.`);
  if (def.summonSelfBuff)
    named("summonSelfBuff", `Ride or Die: enters play with +${def.summonSelfBuff.dmg} DMG and +${def.summonSelfBuff.hp} HP.`);
  if (def.lure)
    named("lure", `Lure: on summon, attackers have −${def.lure.pct}% accuracy against it for ${def.lure.rounds} round${def.lure.rounds > 1 ? "s" : ""}.`);
  if (def.lowHpNova)
    named("lowHpNova", `Mega Push: while below ${def.lowHpNova.belowHp} HP, a landed basic also deals ${def.lowHpNova.dmg} to every opponent and pushes them back ${def.lowHpNova.push}.`);
  if (def.salvageOnDeath)
    named("salvageOnDeath", `Salvage: whenever any card dies, gain +${def.salvageOnDeath} max HP.`);
  if (def.deathHealAura)
    named("deathHealAura", `Blood Moon: when an opponent dies, heal it and all allies +${def.deathHealAura} HP.`);
  if (def.blockOnAllyDeath)
    named("blockOnAllyDeath", `when a${def.blockOnAllyDeath.element ? " " + def.blockOnAllyDeath.element : "n ally"} ally falls, the lowest-HP survivor gains BLOCK ${def.blockOnAllyDeath.block} for ${def.blockOnAllyDeath.rounds} round(s).`);
  if (def.boom)
    named("boom", `Boom: a time bomb — after ${def.boom.afterRounds} rounds it detonates for ${def.boom.dmg} DMG to every enemy, then dies.`);
  if (def.deathExplosion)
    named("deathExplosion", `On death: a final explosion — ${def.deathExplosion} DMG to every opponent on the board.`);
  if (def.spawnOnHitTaken)
    named(
      "spawnOnHitTaken",
      `Acorn Drop: ${def.spawnOnHitTaken.oncePerRound ? "the first hit it takes each round" : "every hit it takes"} sprouts ${def.spawnOnHitTaken.count} ${getDef(def.spawnOnHitTaken.token).name}.`,
    );
  if (def.basicSplash)
    named(
      "basicSplash",
      `Rainstorm: basic attacks splash ${def.basicSplash} DMG to ${
        def.splashAll ? "every opponent adjacent to the target" : "one adjacent opponent"
      }.`,
    );
  if (def.lightOrbs)
    named("lightOrbs", `Life Cycle: each incoming hit is absorbed by a Light Orb that bursts at the attacker, then disappears. Every opponent death recharges one orb.`);
  if (def.onHitDeflect)
    named("onHitDeflect", `Vision Guard: ${def.onHitDeflect}% chance when hit to take half damage and deal that much back to the attacker.`);
  if (def.onOppSummonSelfBuff)
    named("onOppSummonSelfBuff", `King of the Wild: once per round, when an opponent is summoned, gain +${def.onOppSummonSelfBuff.shields} shields and +${def.onOppSummonSelfBuff.dmg} DMG for the round.`);
  if (def.weaponModes)
    named("weaponModes", `Power Grab: on move (once/round), cycle its Basic Attack Weapon — ${def.weaponModes.map((w) => `${w.name} ${w.dmg}×${w.hits}`).join(", ")}.`);
  if (def.roundTick?.rowAheadDmg)
    namedAny(["rowAheadDmg", "roundTick"],
      `End of round: deals ${def.roundTick.rowAheadDmg} DMG to opponents in the row directly ahead.`,
    );
  if (def.roundTick?.inRangeStatus)
    passives.push(
      `When battle begins: applies ${def.roundTick.inRangeStatus.kind} for ${def.roundTick.inRangeStatus.duration} round(s) to every opponent in range.`,
    );
  if (def.roundTick?.inRangeDmg)
    namedAny(["inRangeDmg", "roundTick"],
      `End of round: deals ${def.roundTick.inRangeDmg} DMG to every opponent in range${def.roundTick.inRangeDmgPen ? " (pierces shields)" : ""}.`,
    );
  if (def.roundTick?.selfShields)
    namedAny(["selfShields", "roundTick"], `Gains +${def.roundTick.selfShields} shield at the end of each round.`);
  if (def.roundTick?.allyInRangeShields)
    namedAny(["allyInRangeShields", "roundTick"],
      `End of round: grants +${def.roundTick.allyInRangeShields} shield` +
      `${def.roundTick.allyInRangeShields === 1 ? "" : "s"} to every ally within range.`,
    );
  if (def.roundTick?.advance)
    named("roundTick", `Seed Roll: rolls ${def.roundTick.advance} slot${def.roundTick.advance === 1 ? "" : "s"} forward toward the enemy home at the end of each round (until blocked).`);
  if (def.advanceOnBasic)
    named("advanceOnBasic", `after each basic attack it rolls ${def.advanceOnBasic} slot${def.advanceOnBasic === 1 ? "" : "s"} further toward the enemy home.`);
  if (def.summonAdvance)
    named("summonAdvance", `On summon: rolls ${def.summonAdvance} slot${def.summonAdvance === 1 ? "" : "s"} forward toward the enemy home (until blocked).`);
  if (def.healReceivedMult && def.healReceivedMult !== 1)
    named("healReceivedMult", `Root Growth: all healing it receives is multiplied ${def.healReceivedMult}×.`);
  if (def.onTribeDeath)
    named("onTribeDeath", `whenever any ${def.onTribeDeath.tribe} dies, gains ${[def.onTribeDeath.dmg && `+${def.onTribeDeath.dmg} DMG`, def.onTribeDeath.hp && `+${def.onTribeDeath.hp} HP`, def.onTribeDeath.sp && `+${def.onTribeDeath.sp} SP`].filter(Boolean).join(" / ")} permanently.`);
  if (def.roundTick?.pokeParalyzedDmg)
    passives.push(
      `End of round: deals ${def.roundTick.pokeParalyzedDmg} DMG to a PARALYZED opponent in range.`,
    );
  if (def.shieldPerHitTaken)
    named("shieldPerHitTaken", 
      `Regenerative: at the end of each round, grows +${def.shieldPerHitTaken.shields} shield for every enemy hit it took that round${def.shieldPerHitTaken.maxShields ? ` (max ${def.shieldPerHitTaken.maxShields})` : ""}.`,
    );
  if (def.highSpeedImpact)
    named("highSpeedImpact", `High Speed Impact: +1 DMG for every point of SP above 10`
      + (def.highSpeedImpact.cap === undefined ? "." : `, up to +${def.highSpeedImpact.cap}.`));
  if (def.speedDmgTiered)
    named("speedDmgTiered", `Apex Predator: +1 DMG for every ${def.speedDmgTiered.per} SP above ${def.speedDmgTiered.above}.`);
  if (def.lurk)
    named("lurk", `Lurk: while hidden in STEALTH, +${def.lurk.dmg} DMG and +${def.lurk.sp} SP. Attacking breaks STEALTH (Lurk ends); Bloody Waters' kill re-enters it.`);
  if (def.onHitRampUntilSpecial)
    named("onHitRampUntilSpecial", `Volcanic Fury: each landed basic grants +${def.onHitRampUntilSpecial} DMG, building until the Special is used (then it resets).`);
  if (def.stealthWhenIdle)
    named("stealthWhenIdle", "Buried in the muck: hidden and untargetable each round it neither moves nor attacks — doing either gives it up until the next round it stays still.");
  if (def.hiveAbsorb)
    named("hiveAbsorb", `Living ${def.hiveAbsorb.tribe} allies soak up to ${def.hiveAbsorb.pct}% of the damage aimed at this card, as far as their own HP stretches.`);
  if (def.contagionAura)
    named("contagionAura", "Aura: while this card lives, every one of your Zombies that dies deals 2 DMG to each opponent beside it.");
  if (def.startsWithFreeSpecial)
    named("startsWithFreeSpecial", "Arrives with its Special already charged — the first cast is free.");
  if (def.vsTarget?.bonusDmg) {
    const vt = def.vsTarget;
    const who = [vt.tribe ? `${vt.tribe}s` : "", vt.hpAbove != null ? `anything above ${vt.hpAbove} HP` : ""]
      .filter(Boolean)
      .join(" and ");
    named("vsTarget", `Basic attacks deal +${vt.bonusDmg} DMG against ${who}.`);
  }
  if (def.intimidate)
    named(
      "intimidate",
      `Aura: opponents within ${def.intimidate.rows === 1 ? "one row" : `${def.intimidate.rows} rows`} whose DMG is lower than this card's CURRENT DMG lose ${def.intimidate.dmg} DMG from their basic attacks.`,
    );
  if (def.blindingStar)
    named("blindingStar", `Blinding Star (Aura): while it lives, every opponent's basic attacks have a ${BLINDING_STAR_MISS_PCT}% chance to miss.`);
  if (def.splashAura)
    // Phrased to PARALLEL `basicSplash` above when it is a flat number, because
    // that is what it now is — the same splash, granted to the whole team.
    // "Clips one extra adjacent target" describes the full-damage version
    // (Totem Spirit) and reads as something bigger than 1 damage.
    named(
      "splashAura",
      typeof def.splashAura === "number"
        ? `Aura: while it lives, allied basic attacks splash ${def.splashAura} DMG to ${
            def.splashAll ? "every opponent adjacent to their target" : "one adjacent opponent"
          }.`
        : `Aura: while it lives, allied basic attacks also clip one extra adjacent target for full damage.`,
    );
  if (def.statDropImmuneAura)
    named("statDropImmuneAura", `Aura: while it lives, allies are immune to stat reduction (WEAKEN).`);
  if (def.purelightAura)
    named("purelightAura", `Purelight (Aura): while it lives, DAWN allies are immune to BLIND and their attacks pierce enemy EVASION.`);
  if (def.totemSpiritAura)
    named(
      "totemSpiritAura",
      `Aura: while it lives, allied basic attacks cannot miss — and they can target through STEALTH and into the enemy Home row from anywhere.`,
    );
  if (def.penWhileAlly)
    named("penWhileAlly", `Overcharge: its basic attacks gain PEN while an allied ${def.penWhileAlly.map((id) => getDef(id).name).join(" / ")} is on the board.`);
  if (def.blocksRangedChance) {
    const nm = def.passiveNames?.blocksRangedChance ?? "Rocky Force Field";
    passives.push(def.blocksRangedChance >= 100
      ? `${nm}: immune to Ranged attacks.`
      : `${nm}: ${def.blocksRangedChance}% chance to deflect a ranged attacker's hit.`);
  }
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
  if (def.shoveWeaker)
    passives.push(
      "Trample Through: in Prep it can step onto an adjacent opponent with less max HP, shoving it back a slot and taking the square (needs the slot behind it open).",
    );
  if (def.mounted)
    passives.push(
      "Mounted: moves like a chess king — a diagonal step costs 1, not 2 (lost if it dismounts).",
    );
  if (def.basicLineReach)
    named(
      "basicLineReach",
      `Basic attacks reach up to ${def.basicLineReach} slots straight ahead, behind, or to either side (not diagonally). An enemy in the lane blocks it.`,
    );
  if (def.targetsOnSound)
    named("targetsOnSound", `Blind — it aims by sound. Its basic attack can only hit an enemy in king reach (right beside it) or one that MOVED this round; a stationary far enemy is silent and can't be targeted. Its board-wide Special is felt through the ground and ignores this.`);
  if (def.onlyAdjacentAttackers)
    passives.push(`Shadow: can only be attacked by adjacent opponents — ranged shots from afar miss.`);
  if (def.firstStrikeBonus && def.firstStrikeEnemySideOnly)
    named("firstStrikeBonus", `On the enemy battlefield: +${def.firstStrikeBonus} DMG on the first strike against each opponent.`);
  // What a broken shield does, in one place. It used to live INSIDE the
  // summonSelfShields branch, so a card that breaks a shield it did not raise on
  // summon — Velvolt Knight, Bastion — printed nothing at all about the payoff
  // its whole design is built on.
  const sb = def.onShieldBreak;
  let breakClause = "";
  if (sb) {
    const gains: string[] = [];
    if (sb.dmg) gains.push(`+${sb.dmg} DMG`);
    if (sb.sp) gains.push(`+${sb.sp} SP`);
    if (sb.status)
      breakClause = `${sb.status.kind}s the attacker${sb.status.duration ? ` for ${rounds(sb.status.duration)}` : ""}`;
    else if (gains.length) breakClause = `gains ${gains.join(" / ")} permanently`;
  }
  if (def.summonSelfShields)
    named(
      "summonSelfShields",
      `On summon, raises a ${def.summonSelfShields}-shield barrier${breakClause ? `; when it breaks, ${breakClause}` : ""}.`,
    );
  else if (breakClause)
    named("onShieldBreak", `The first time its shields are broken, it ${breakClause}.`);
  if (def.summonFog)
    named("summonFog", `On summon, fog rolls over your battlefield for ${rounds(def.summonFog)} — every enemy basic aimed at your cards has a ${MISTY_FOG_MISS_PCT}% chance to whiff (flat, no status).`);
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
      `It won't raise another while ${def.roundTick.spawnMaxAlive} of its bodies still stand — clear one before it breeds again.`,
    );
  if (def.roundTick?.wardAllies)
    passives.push(`Radiant Ward: each round, allies get a barrier that absorbs the next negative status.`);
  if (def.roundTick?.cleanseAllies)
    passives.push(`Crowned: cleanses all negative statuses from allies each round.`);
  if (def.special?.params?.freeRecastOnKill)
    passives.push(
      `On Kill, its Special recasts free next round (ignores cost & cooldown).`,
    );
  // Through `named`, not a raw push: Hunter's Trapper, Scorch's Wildfire and
  // Velvolt Knight's Live Current all name their on-summon half in the data, and
  // the name was silently dropped here — so the same ability appeared once
  // titled and once anonymous, which read as two unrelated passives.
  if (def.onSummon) named("onSummon", describeOnSummon(def.onSummon, def.vsTarget, def.element));
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
    if (od.aoeDmg) parts.push(`bursts for ${od.aoeDmg} DMG to every opponent`);
    if (od.boardBlast)
      parts.push(
        `explodes for ${od.boardBlast.dmg} DMG to every card ` +
          (od.boardBlast.radius === undefined
            ? "on the board"
            : od.boardBlast.radius === 1
              ? "beside it"
              : `within ${od.boardBlast.radius} squares`) +
          (od.boardBlast.exceptElement ? ` except ${od.boardBlast.exceptElement}` : ""),
      );
    if (od.farRowStatus) parts.push(`applies ${od.farRowStatus.kind} ${od.farRowStatus.power} to opponents in their far row for ${rounds(od.farRowStatus.duration)}`);
    if (od.roundEndAoe) parts.push(`calls down a meteor — ${od.roundEndAoe} DMG to every opponent at the end of next round`);
    if (od.passEnchant) parts.push("hands its armed Enchantment to the ally with the highest DMG");
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
    named("onHitPush", def.onHitPush >= 5
      ? "Every landed hit blows the target all the way back to its own Home row (as far as open slots allow)."
      : `Every landed hit shoves the victim back ${def.onHitPush} slot (if open).`);
  if (def.roundTick?.enemyHomeRowStatus) {
    const st = def.roundTick.enemyHomeRowStatus;
    // Keyed on `roundTick`, which is what the DATA declares (Scorch names its
    // Wildfire that). Looking up "enemyHomeRowStatus" found nothing, so the
    // line rendered anonymous while the on-summon half carried the title — one
    // ability appearing as two, which is the shape this whole pass is removing.
    named(
      "roundTick",
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
    named(
      "summonSpawn",
      `On summon: brings ${count} ${tokName}${count > 1 ? "s" : ""} onto the board${adjacentOnly ? ", right beside it" : spawnRadius ? `, within ${spawnRadius} spaces of it` : ""}.`,
    );
  }
  // Neither of these produced a line of any kind — not an unnamed one either.
  // A card entering play wearing another card's face is the single most
  // surprising thing that can happen to a player, and it was undocumented.
  if (def.disguise)
    named(
      "disguise",
      `Enters play disguised as ${(() => { try { return getDef(def.disguise.as).name; } catch { return "another card"; } })()}. When the disguise is killed it does not die — it reverts to its true form at full HP${def.disguise.strikeKillerOnReveal ? " and casts its Special at whoever unmasked it, free" : ""}.`,
    );
  if (def.onOpponentDeath)
    named("onOpponentDeath", `Whenever an opponent dies, deals ${def.onOpponentDeath.dmg} DMG to the closest remaining foe.`);
  if (def.alwaysHit)
    passives.push("Hot Shot: its attacks never miss — ignores its own BLIND and the target's EVASION.");
  if (def.basicHealsAllies)
    passives.push("Its basic attack can be aimed at a wounded ally to heal them for its DMG instead of striking.");
  if (def.basicHealsTeam)
    named("basicHealsTeam", `Raising Star: a landed basic attack also heals every ally +${def.basicHealsTeam} HP.`);
  if (def.idleBuff)
    named("idleBuff", `Liquid Serenity: on a round it doesn't attack, heals +${def.idleBuff.heal} and gains +${def.idleBuff.dmg} DMG next round.`);
  if (def.pullOnAttack)
    named("pullOnAttack", `${def.id === "aqua_octoirate" ? "Sucker Sword" : "Harpoon Hook"}: a landed basic drags the struck enemy ${def.pullOnAttack} slot${def.pullOnAttack > 1 ? "s" : ""} toward it.`);
  if (def.healPerHit)
    named("healPerHit", `Liquification: heals ${def.healPerHit} HP for every basic hit it lands.`);
  if (def.onAllyHitShield)
    named("onAllyHitShield", `the first time each ally is hit, gives that ally +${def.onAllyHitShield} shield.`);
  if (def.summonScaleFromEnemy) {
    const sc = def.summonScaleFromEnemy;
    const gains = [sc.dmg && `+${sc.dmg} DMG`, sc.maxHp && `+${sc.maxHp} max HP`].filter(Boolean).join(" and ");
    passives.push(`Brightest Warrior: on summon, gains ${gains} for every ${sc.per} max HP the toughest opponent has.`);
  }
  if (def.furyBelowHp)
    named("furyBelowHp", `Below ${def.furyBelowHp.hp} HP it attacks for +${def.furyBelowHp.dmg} DMG.`);
  if (def.weakBelowHp)
    named("weakBelowHp", 
      `Below ${def.weakBelowHp.hp} HP its basic attacks are weakened${def.weakBelowHp.dmgMult === 0.5 ? " to half damage" : ` (×${def.weakBelowHp.dmgMult} DMG)`}.`,
    );

  if (def.windWarp)
    named(
      "windWarp",
      "Moves to any open slot on the board, at any distance — but still cannot cross from its own Home row to the enemy's in one move.",
    );
  if (def.diesAfterAttacking)
    named("diesAfterAttacking", "A one-shot: it dies at the end of any round it attacks.");

  return passives;
}

// Plain-language blurb for each status kind, shown under a card's active effects.
export const STATUS_TEXT: Record<StatusKind, string> = {
  ROOT: "Rooted — can't move.",
  BLEED: "Bleeding — takes damage each round.",
  BURN: "Burning — loses a shield (then HP) each round.",
  SCALD: "Scalded — takes damage each round.",
  DOT: "Damaged over time each round.",
  FREEZE: "Frozen — SP 0 and takes half damage dealt.",
  STUN: "Stunned — can't act.",
  WEAKEN: `Weakened — deals ${WEAKEN_PCT_PER_STACK}% less damage per stack (compounding, max ${WEAKEN_MAX_STACKS}). Re-applying deepens it instead of refreshing.`,
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
