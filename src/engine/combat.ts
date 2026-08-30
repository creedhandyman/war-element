// Combat pipeline + special-handler registry.
//
// Damage application order for a single hit (brief §5):
//   1. EVASION coin — dodge negates the hit entirely (no shield strip).
//   2. BLOCK X — flat reduction (min 0). Applies even to PEN.
//   3. Shield gate — toHp = max(0, remaining − curShields); a landed hit (even
//      a 0-damage one) strips shields on a sliding scale with the size of the
//      blow: shieldsBrokenBy takes 1, or 2 at 10+ damage, or 3 at 21+.
//      · Exostone (BORE) caps that at 1 however heavy the hit.
//      · PEN skips the gate: full remaining damage to HP, no shield stripped.
//      · CRIT does nothing while shields > 0; on an unshielded target it
//        doubles the hit BEFORE the gate math (basic attacks only).
//   4. Multi-hit (dmg × N) = N sequential sub-hits, each re-running 1–3
//      against the current shield count.
//   5. On-hit keywords: LIFESTEAL (basic), DRAIN (basic), REFLECT X.

import { CARDS, getDef } from "../data/cards";
import { chance, coin, pctChance, randInt } from "./rng";
import { RANGED_REACH, canTarget, shoveTarget, slotIsImpassable, validSpecialTargets, validTargets, domMap } from "./rules";
import { BLINDING_STAR_MISS_PCT, BOLT_VS_STATUS_DMG, PYRO_BURN_DURATION, DUSK_SHADE_DEATH_DIVISOR, DUSK_SHADE_MAX_STACKS, DUSK_SHADE_PCT, FOG_MISS_PCT, PYRO_BURN_STACK_CAP, WEAKEN_MAX_STACKS, hasElementAura, slipstreamPct } from "./auras";
import { LEAF_WATER_HEAL, applyMatchupDamage, dodgesByMatchup, matchupImmune, matchupStatusDuration } from "./matchups";
import { creditDamage, creditDeath, creditDebuff, creditKill, creditShielded } from "./stats";
import { auraHasPen, auraReflectBonus, boardCards, cardAt, chebyshev, effectiveDmg, effectiveMaxHp, effectiveSp, fieldBonus, fieldEvasion, fieldFlag, fieldPushBonus, fieldStatusExtend, gainMaxHp, hasStatus, hasTotemSpirit, healCard, isBloodfire, manhattan, removeCard, spawnTokens, summonCard, enemyCards } from "./state";
import type {
  CardDef,
  CardInstance,
  Element,
  GameState,
  OnHitByMeleeDef,
  OnKillDef,
  PlayerId,
  Pos,
  StatusKind,
} from "./types";
import { NEGATIVE_STATUSES, enemyOf, hillGivesHit, homeRow, isMidRow } from "./types";

/** Whether a card is standing on the ENEMY half of the board — two rows or more
 *  from its own home. Gates Squall's first-strike and Ravven's Shadow Haunter. */
export function onEnemySide(card: CardInstance, boardSize: number): boolean {
  return card.pos != null && Math.abs(card.pos.row - homeRow(card.owner, boardSize)) >= 2;
}

/** Does this card's own EVASION keyword apply right now? Usually just "does it
 *  have the keyword", but Ravven's is gated to the enemy battlefield. Both the
 *  dodge roll and the AI's threat estimate go through here so they can't drift
 *  apart — an AI that thinks a card dodges when it doesn't misplays every turn. */
export function hasEvasion(card: CardInstance, boardSize: number): boolean {
  const def = getDef(card.defId);
  if (!def.keywords.EVASION) return false;
  return def.evasionEnemySideOnly ? onEnemySide(card, boardSize) : true;
}

/** Midnight Shade's dodge chance for one card, as a percentage: 5 per fallen
 *  DUSK ally inside the live window, and 0 for anything that isn't DUSK or is
 *  standing after the shadows have lifted. Single source of truth so the roll
 *  and the card inspector can't disagree about what a card's odds are. */
export function shadeDodgePct(draft: GameState, card: CardInstance): number {
  if (!hasElementAura(getDef(card.defId), "DUSK")) return 0;
  const pl = draft.players[card.owner];
  if (draft.round > (pl.shadeUntilRound ?? -1)) return 0;
  return Math.min(DUSK_SHADE_MAX_STACKS, pl.shadeStacks ?? 0) * DUSK_SHADE_PCT;
}

/** Slipstream (GALE): a card's dodge chance from its own speed. Single source
 *  of truth so the roll and the card inspector cannot disagree, matching
 *  `shadeDodgePct` above. Reads EFFECTIVE SP, so Zephyr's per-round ramp and
 *  every haste effect feed it. */
export function slipstreamDodgePct(draft: GameState, card: CardInstance): number {
  if (!hasElementAura(getDef(card.defId), "GALE")) return 0;
  return slipstreamPct(effectiveSp(draft, card));
}

/** FLYING — the innate keyword OR a granted temporary flight (FireFly's BlastOff). */
export function isFlying(card: CardInstance): boolean {
  return Boolean(getDef(card.defId).keywords.FLYING) || (card.flyingRoundsLeft ?? 0) > 0;
}

/** Aurora's ORB kinds, in the recharge rotation. */
export const ORB_KINDS = ["blue", "green", "red"] as const;

/** Most Light Orbs Aurora may hold at once. The on-kill recharge below was
 *  UNBOUNDED: every opponent death, from any cause, pushed another orb, and each
 *  orb fully negates an incoming hit — so a long game compounded into a card
 *  that could not be attacked through. A ceiling, not a nerf to the payout: over
 *  1,120 measured matches this changed Aurora's win rate not at all, which is
 *  exactly why it is worth having as a guard rail rather than as a balance lever. */
export const ORB_CAP = 3;

/** Fire a burst Light Orb at whatever just attacked Aurora (Life Cycle). */
export function fireOrb(draft: GameState, aurora: CardInstance, attacker: CardInstance, orb: string): void {
  const el = getDef(aurora.defId).element;
  const live = () => attacker.curHp > 0 && draft.cards[attacker.instanceId];
  if (orb === "blue") {
    if (live()) { directDamage(draft, aurora, attacker, 3, false); if (live()) applyStatus(draft, attacker, "BLIND", 2, 0, el); }
    draft.log.push(`${label(draft, aurora)}'s blue orb bursts — 3 DMG + BLIND.`);
  } else if (orb === "green") {
    if (live()) directDamage(draft, aurora, attacker, 2, false);
    const allies = boardCards(draft, aurora.owner).filter((a) => a.curHp > 0);
    const lowest = allies.reduce<CardInstance | null>((b, a) => (!b || a.curHp < b.curHp ? a : b), null);
    if (lowest) healCard(draft, lowest, 7, aurora);
    draft.log.push(`${label(draft, aurora)}'s green orb bursts — 2 DMG + heals the weakest ally.`);
  } else {
    if (live()) applyStatus(draft, attacker, "DOT", 2, 2, el);
    draft.log.push(`${label(draft, aurora)}'s red orb bursts — POISON.`);
  }
}

/** Flat pre-shield damage reduction a card gains from standing in a friendly
 *  wall's row (Stone Wall BLOCK, Radiant Barrier −1). Same-element, wall owner's
 *  allies only; stacks additively with the card's own BLOCK keyword. */
export function wallFlatReduction(draft: GameState, card: CardInstance): number {
  if (!card.pos) return 0;
  const el = getDef(card.defId).element;
  let sum = 0;
  for (const w of draft.walls) {
    if (w.owner !== card.owner || !w.allyBuff || w.row !== card.pos.row || w.element !== el) continue;
    sum += Number(w.allyBuff.block ?? 0) + Number(w.allyBuff.dmgReduction ?? 0);
  }
  return sum;
}

/** Does this card gain EVASION from a friendly wall in its row (Veil of Shadows)? */
export function wallEvasion(draft: GameState, card: CardInstance): boolean {
  if (!card.pos) return false;
  const el = getDef(card.defId).element;
  return draft.walls.some(
    (w) => w.owner === card.owner && !!w.allyBuff?.evasion && w.row === card.pos!.row && w.element === el,
  );
}

/** Total basic hits including on-kill (Fenrir) and 1-turn (Flow Change) bonuses,
 *  plus the King-of-the-Hill mid-row bonus for multi-hit cards (they get +1 HIT
 *  in a mid row instead of the +1 DMG single-hit cards get — see effectiveDmg). */
export function effectiveBasicHits(card: CardInstance): number {
  const def = getDef(card.defId);
  // A loaded ambush (Dirt Driller) IS the attack — exactly its hit count, with
  // none of the usual stacking.
  if (card.loadedStrike) return card.loadedStrike.hits;
  // Power Grab (General): the equipped weapon sets the base hit count.
  const baseHits = def.weaponModes ? def.weaponModes[card.weaponMode ?? 0].hits : def.hits;
  // Timed hits (Totem's Rampage) sum in alongside the permanent and one-round
  // bonuses; the Cleanup tick that expires `buffs` takes them away for free.
  // NB not to be confused with CardDef.buffHits, Fenrir's permanent on-kill hit.
  const timedHits = (card.buffs ?? []).reduce((n, b) => n + (b.hits ?? 0), 0);
  let hits =
    baseHits + (card.hitsBonus ?? 0) + (card.hitsBonusRound ?? 0) + (card.loadedHits ?? 0) + timedHits;
  // King of the Hill, the +1 HIT half. hillGivesHit() is the single source of
  // truth — effectiveDmg takes the exact complement.
  if (hillGivesHit(def.dmg, def.hits) && card.pos && isMidRow(card.pos.row)) hits += 1;
  return hits;
}

export interface HitOptions {
  kind: "basic" | "special" | "reflect";
  dmg: number; // damage per sub-hit
  hits: number;
  pen: boolean;
  crit: boolean; // CRIT keyword in play (basic attacks only)
  lifesteal?: boolean; // conditional LIFESTEAL (vsStatus) beyond the keyword
  /** Incinerate (Sol): each consecutive hit on the same target deals +1 DMG.
   *  `incinerateBase` seeds the ramp with hits already landed this round. */
  incinerate?: boolean;
  incinerateBase?: number;
  /** This particular attack ignores accuracy checks (Fallow's Hunting Season).
   *  Card-level `alwaysHit` is the whole card; this is one Special. */
  alwaysHit?: boolean;
  /** This Special's CRIT skips the coin (Skeleeze's Piercing Arrow) — the
   *  deterministic form of `crit`. The OTHER crit gates still hold: pair it
   *  with card-level `critPen` to fire through shields, exactly as Hoax's
   *  guaranteed mark behaves on a basic. */
  critAlways?: boolean;
  /** Suppress the generic "X hits Y for N" line — the caller has better context
   *  and will log it itself (e.g. an on-opponent-summon reaction, which otherwise
   *  reads like an ordinary attack with no hint it fired off a summon). */
  silent?: boolean;
}

export interface AttackResult {
  landedHits: number;
  dodgedHits: number;
  totalToHp: number;
  /** Damage the target's shields ate. PEN bypasses the gate entirely, so a
   *  piercing hit always contributes 0 here. */
  totalShielded: number;
  targetDied: boolean;
  attackerDied: boolean; // via REFLECT
  critHits?: number; // hits that actually critted (Hastened Assault heal)
}

/**
 * Statuses: different kinds coexist on one card; re-applying the SAME kind
 * refreshes it (newest replaces) rather than stacking. Same-kind stacking
 * is reserved for cards that explicitly state it (none in alpha).
 */
export function applyStatus(
  draft: GameState,
  target: CardInstance,
  kind: StatusKind,
  duration: number,
  power: number,
  source: Element,
): void {
  if (getDef(target.defId).statusImmune) {
    draft.log.push(`${label(draft, target)} is immune to status (${kind} fizzles).`);
    return;
  }
  // Grounded Stone (BORE): ELECTRIFIED and PARALYZE do not take on stone. Here
  // with the other immunities rather than as a zero in the duration maths,
  // because a status that lands with 0 rounds on it is still a status — it sits
  // in the array, reads as "afflicted", and satisfies every `hasStatus` check
  // in the game for the rest of the round.
  if (matchupImmune(getDef(target.defId).element, kind)) {
    draft.log.push(`${label(draft, target)} earths the charge — ${kind} does not take.`);
    return;
  }
  // Equestrian's aura: allies are immune to stat reduction (WEAKEN) while a
  // living holder stands.
  if (kind === "WEAKEN" && boardCards(draft, target.owner).some((a) => a.curHp > 0 && getDef(a.defId).statDropImmuneAura)) {
    draft.log.push(`${label(draft, target)} shrugs off WEAKEN — Solar aura protects it.`);
    return;
  }
  // Purelight (Halo): a DAWN ally can't be BLINDed while a holder stands.
  if (kind === "BLIND" && getDef(target.defId).element === "DAWN" &&
      boardCards(draft, target.owner).some((a) => a.curHp > 0 && getDef(a.defId).purelightAura)) {
    draft.log.push(`${label(draft, target)} shrugs off BLIND — Purelight protects it.`);
    return;
  }
  // Surge Protector: while Electro Surge is armed, Surge shrugs off negatives.
  if (target.electroSurgeActive && NEGATIVE_STATUSES.includes(kind)) {
    draft.log.push(`${label(draft, target)}'s Surge Protector absorbs ${kind}.`);
    return;
  }
  // Radiant Ward (Solstice): one team-wide barrier eats the first negative
  // status to hit any ally each round — but only while a living ward-holder
  // (Solstice) is on the board. A stale flag left after Solstice dies is
  // cleared instead of absorbing.
  if (draft.players[target.owner].statusWard && NEGATIVE_STATUSES.includes(kind)) {
    const wardAlive = boardCards(draft, target.owner).some(
      (c) => c.curHp > 0 && getDef(c.defId).roundTick?.wardAllies,
    );
    draft.players[target.owner].statusWard = false; // spent, or cleared if stale
    if (wardAlive) {
      draft.log.push(`${label(draft, target)}'s team radiant ward absorbs the ${kind}.`);
      return;
    }
  }
  // Lushfield (LEAF field): the BLEED and ROOT its owner applies land with an
  // extra round on them. Added HERE so it covers every source at once — basics,
  // Specials, spells, walls and round-ticks all funnel through applyStatus.
  const extend = fieldStatusExtend(draft, target, kind);
  // Element matchup resistances (AQUA vs BURN, BORE vs ELECTRIFIED/PARALYZE,
  // GALE vs ELECTRIFIED). Applied to the PRINTED duration, before the field
  // extension, so Lushfield still adds its full round on top of a resisted
  // status rather than being halved along with it.
  const resisted = matchupStatusDuration(getDef(target.defId).element, kind, duration);
  const dur = resisted + extend;
  const fresh = { kind, duration: dur, power, source };
  const existing = target.statuses.findIndex((s) => s.kind === kind);
  // WEAKEN DEEPENS rather than refreshing. Handled here, in the one funnel every
  // source passes through — basics, Specials, spells, walls, round-ticks — so
  // stacking is a property of the STATUS and not something each of the dozen
  // cards that apply it has to opt into. They all pass power 0, so the depth is
  // counted rather than taken from the caller: existing stacks + 1, capped.
  //
  // Duration takes the longer of the two, like stackStatus: a fresh application
  // should never SHORTEN a debuff already running.
  if (kind === "WEAKEN" && existing >= 0) {
    const st = target.statuses[existing];
    const before = Math.max(1, st.power);
    st.power = Math.min(WEAKEN_MAX_STACKS, before + 1);
    st.duration = Math.max(st.duration, dur);
    st.source = source;
    draft.log.push(
      st.power > before
        ? `${label(draft, target)} is weakened further (WEAKEN x${st.power}).`
        : `${label(draft, target)} is already weakened to the bone (WEAKEN x${st.power}).`,
    );
    if (NEGATIVE_STATUSES.includes(kind)) creditDebuff(draft.stats, target);
    return;
  }
  // THE STRONGER ONE STICKS. A re-application used to overwrite wholesale, so
  // the weaker of two identical statuses won purely by landing second: a BURN 2
  // from a chip attack downgraded a BURN 5 already ticking, and a 1-round
  // application cut a 3-round one short. Nothing wanted that — it made a
  // heavy DOT worth less the more attacks followed it, which is backwards.
  //
  // Power and duration are taken independently, each keeping the better of the
  // two, because they are separate promises: a long weak BURN followed by a
  // short fierce one should leave you burning fiercely for the long time. That
  // is the same rule WEAKEN and `stackStatus` already use for duration —
  // "a fresh application should never SHORTEN a debuff already running" — now
  // applied in the one funnel every source passes through, so it is a property
  // of the STATUS rather than something each caller opts into.
  //
  // NOT stacking: `stackStatus` ADDS power (Thorn's cumulative BLEED) and stays
  // the opt-in for cards whose whole design is that wounds accumulate. This is
  // the default, and the default should be that hitting something twice does
  // not make its burn worse than either hit promised.
  let note = "";
  if (existing >= 0) {
    const st = target.statuses[existing];
    const grew = power > st.power || dur > st.duration;
    // Attribution follows the application that is actually doing the work, so
    // a weak re-application cannot quietly reassign a strong DOT's element.
    if (power >= st.power) st.source = source;
    st.power = Math.max(st.power, power);
    st.duration = Math.max(st.duration, dur);
    note = grew ? " (refreshed)" : " (already worse — held)";
  } else {
    target.statuses.push(fresh);
  }
  // Counted HERE, past every immunity / ward / fizzle gate above, so the report
  // reflects control that actually landed rather than control attempted.
  if (NEGATIVE_STATUSES.includes(kind)) creditDebuff(draft.stats, target);
  draft.log.push(
    `${label(draft, target)} is afflicted: ${kind}${power ? ` ${power}` : ""} (${dur}r)${resisted < duration ? " — resisted" : ""}${extend ? " +field" : ""}${note}.`,
  );
  // FRIGHTEN is a positioning effect: forced retreat 1 slot back toward the
  // target's own home row, if that slot is open (can also push an invader
  // off an uncaptured home slot — repelling without a kill).
  if (kind === "FRIGHTEN" && target.pos) {
    const back = target.owner === "P1" ? 1 : -1;
    const row = target.pos.row + back;
    if (
      row >= 0 &&
      row < draft.slots.length &&
      !draft.slots[row][target.pos.col].capturedBy &&
      !cardAt(draft, row, target.pos.col)
    ) {
      target.pos = { ...target.pos, row };
      draft.log.push(`${label(draft, target)} retreats in fright!`);
    }
  }
}

export function label(_draft: GameState, card: CardInstance): string {
  return `${getDef(card.defId).name} (${card.owner})`;
}

/** Defeat a card, honoring on-revive (Bearocks). Returns true if it was
 *  actually removed, false if it revived and survives. */
export function defeatCard(
  draft: GameState,
  card: CardInstance,
  cause: string,
  /** Who landed the blow, where the caller knows it. Only the disguise reveal
   *  needs it, so every other call site can go on ignoring it. */
  killer?: CardInstance,
): boolean {
  // RISES AS SOMETHING ELSE (Kato): this form does not die, the NEXT one takes
  // the field at full HP. Checked before the Siren revert below because the two
  // answer the same moment in opposite directions — that one sends a disguise
  // BACK to what it really was, this one carries a chain FORWARD — and a card
  // that did both would bounce between forms instead of advancing. It never sets
  // `transformedFrom`, which is what keeps them apart.
  const rise = getDef(card.defId).transformOnDefeat;
  const rises = rise?.into;
  if (rise && rises && card.pos) {
    const nd = getDef(rises);
    card.defId = rises;
    // A fresh shell by default (Kato's chain: each body is a whole new fight).
    // `hpPct` is for a boss that GETS BACK UP rather than becoming something
    // else — same creature, hurt, and angrier.
    card.maxHp = nd.hp;
    card.curHp = rise.hpPct != null ? Math.max(1, Math.round(nd.hp * rise.hpPct)) : nd.hp;
    card.curShields = nd.shields;
    card.dmgBonus = 0;
    card.spBonus = 0;
    card.hitsBonus = 0;
    card.buffs = [];
    card.statuses = [];
    card.killCount = 0;
    draft.log.push(`The ${cause} breaks the shell — ${nd.name} rises from the wreck!`);
    // THE SHOCKWAVE. Fired after the new form is on the board so its element is
    // the one that lands the status. The player has just committed everything
    // to putting this thing down, so their board is as close and as exposed as
    // it will ever be — which is exactly why the rise is worth answering.
    const burst = rise.burst;
    if (burst) {
      const caught = enemyCards(draft, card.owner).filter(
        (e) => e.curHp > 0 && e.pos
          && Math.max(Math.abs(e.pos.row - card.pos!.row), Math.abs(e.pos.col - card.pos!.col)) <= burst.reach,
      );
      for (const e of caught) applyStatus(draft, e, burst.status, burst.duration, 0, nd.element);
      if (caught.length)
        draft.log.push(`${nd.name} lands — ${caught.length} opponent(s) ${burst.status} for ${burst.duration}.`);
    }
    return false;
  }
  // Sea Terror (Siren): a transformed form doesn't die — it reverts to the
  // original card at full HP.
  if (card.transformedFrom && card.pos) {
    const orig = getDef(card.transformedFrom);
    card.defId = card.transformedFrom;
    card.transformedFrom = undefined;
    card.maxHp = orig.hp;
    card.curHp = orig.hp; // reverts at FULL HP
    card.curShields = orig.shields;
    card.dmgBonus = 0;
    card.spBonus = 0;
    card.hitsBonus = 0;
    card.buffs = [];
    card.statuses = [];
    card.transformed = false;
    // Nightfang: the Butler was never the card. Whoever pulled the mask off
    // takes the true form's Special to the face — free, and off cooldown. That
    // is the whole point of wearing one.
    const revealed = getDef(card.defId);
    if (revealed.disguise?.strikeKillerOnReveal && revealed.special && killer &&
        draft.cards[killer.instanceId] && killer.curHp > 0) {
      const h = SPECIAL_HANDLERS[revealed.special.handler];
      if (h) {
        draft.log.push(`${revealed.name} was never the butler — it turns on ${label(draft, killer)}.`);
        h(draft, card, [killer], revealed.special.params ?? {});
      }
    }
    draft.log.push(`The ${cause} shatters the form — ${label(draft, card)} returns at full HP!`);
    return false;
  }
  const def = getDef(card.defId);
  // Tail Drop (Gecko): a once-per-game cheat-death. The lethal blow leaves it at
  // 1 HP, cloaked in STEALTH, regenerating as the tail regrows.
  if (def.deathSave && !card.deathSaveUsed && card.pos) {
    card.deathSaveUsed = true;
    card.curHp = 1;
    if (def.deathSave.stealth) applyStatus(draft, card, "STEALTH", def.deathSave.stealth, 0, def.element);
    if (def.deathSave.regen) {
      card.regenPower = def.deathSave.regen.power;
      card.regenRoundsLeft = def.deathSave.regen.rounds;
    }
    draft.log.push(`${label(draft, card)} drops its tail and slips away at 1 HP!`);
    return false;
  }
  // Reanimation (Zombie Husk): comes back on EVERY death, each time weaker by
  // `decay` on DMG/HP/SP, until a base stat would hit 0 — then it stays dead.
  if (def.onRevive?.decay && card.pos) {
    const d = def.onRevive.decay;
    const nextCount = (card.reviveDecay ?? 0) + 1;
    const capped = nextCount > (def.onRevive.maxRevives ?? Infinity);
    if (!capped && Math.min(def.dmg, def.hp, def.sp) - d * nextCount > 0) {
      card.reviveDecay = nextCount;
      card.dmgBonus -= d;
      card.spBonus -= d;
      card.maxHp = Math.max(1, card.maxHp - d);
      card.curHp = card.maxHp;
      draft.log.push(`${label(draft, card)} reanimates, weaker (−${d} to all stats).`);
      return false;
    }
    // stats exhausted → it finally stays down (fall through to removal).
  } else if (def.onRevive && card.pos && (!card.revived || (def.onRevive.secondChance && !card.secondReviveUsed))) {
    // First revive is guaranteed; a second (Weeds Offspring) is a coin flip that
    // is only rolled once — win or lose, it never rolls again.
    let doRevive = true;
    if (card.revived) {
      card.secondReviveUsed = true;
      doRevive = pctChance(draft, def.onRevive.secondChance!);
      if (!doRevive) draft.log.push(`${label(draft, card)}'s offspring fails to take root.`);
    }
    if (doRevive) {
      card.revived = true;
      card.curHp = Math.max(1, Math.min(effectiveMaxHp(draft, card), def.onRevive.heal));
      if (def.onRevive.sleep) {
        // Self-inflicted downtime — bypasses statusImmune (Hibernation).
        card.statuses = card.statuses.filter((s) => s.kind !== "SLEEP");
        card.statuses.push({ kind: "SLEEP", duration: def.onRevive.sleep, power: 0, source: def.element });
      }
      draft.log.push(`${label(draft, card)} refuses to fall — it revives at ${card.curHp} HP!`);
      return false;
    }
  }
  // Undead Resilience (allyRevive): a living ally keeps this tribe's dead on
  // their feet. Sits past every SELF-revive above — a card that can save itself
  // does, and the keeper's grace is spent only when nothing else caught it.
  // Once per card per battle, capped on the REVIVED card (`allyRevived`) so the
  // cap survives the keeper falling later. In its own slot: the body never
  // left the board, it just refused to.
  if (card.pos && !card.allyRevived) {
    const keeper = boardCards(draft, card.owner).find((c) => {
      if (c.instanceId === card.instanceId || c.curHp <= 0) return false;
      const ar = getDef(c.defId).allyRevive;
      return !!ar && (!ar.tribe || tribeOf(card, ar.tribe));
    });
    if (keeper) {
      const ar = getDef(keeper.defId).allyRevive!;
      card.allyRevived = true;
      card.curHp = Math.max(1, Math.floor(effectiveMaxHp(draft, card) * ar.healFraction));
      draft.log.push(
        `${label(draft, keeper)} will not let ${label(draft, card)} fall — it rises at ${card.curHp} HP!`,
      );
      return false;
    }
  }
  // High Voltage Sentry (Voltcher): one last Thunderbird as it falls.
  if (def.firePassiveSpecial?.onDeath && card.pos) {
    draft.log.push(`${label(draft, card)}'s High Voltage Sentry discharges on death!`);
    fireCardSpecial(draft, card);
  }
  draft.log.push(`${label(draft, card)} is defeated (${cause}).`);
  // Midnight Shade, second half: the fallen DUSK card's shadow covers its
  // surviving DUSK allies. Granted here — past every cheat-death branch above —
  // so a Tail Drop, a revive or a Butler unmasking is not a "death" that pays.
  if (hasElementAura(def, "DUSK")) {
    const pl = draft.players[card.owner];
    // The count RESETS once the shadow has lifted. It used to only ever climb,
    // so `shadeStacks` was a lifetime tally of every DUSK card that had ever
    // died: after the fifth, the aura stopped being "+5% per death" and became
    // "+25%, on any death, for the rest of the match" — a single loss ten
    // rounds later restored the full ceiling. The dodge correctly fell to 0
    // between deaths, which is what hid it; the STACKS behind it never moved.
    const lapsed = draft.round > (pl.shadeUntilRound ?? -1);
    pl.shadeStacks = lapsed ? 1 : Math.min(DUSK_SHADE_MAX_STACKS, (pl.shadeStacks ?? 0) + 1);
    pl.shadeUntilRound = draft.round + 1;
    draft.log.push(
      `The shadows thicken — ${card.owner}'s DUSK cards dodge +${pl.shadeStacks * DUSK_SHADE_PCT}% for a round.`,
    );
  }
  // Mark of Hoax: a marked target's fall banks a guaranteed dodge for the Hoax
  // that marked it (if it still lives).
  if (card.hoaxMarked && card.hoaxMarkedBy) {
    const marker = draft.cards[card.hoaxMarkedBy];
    if (marker && marker.curHp > 0) {
      marker.guaranteedDodge = (marker.guaranteedDodge ?? 0) + 1;
      draft.log.push(`${label(draft, marker)}'s mark pays off — Blur banks a guaranteed dodge.`);
    }
  }
  // KaBoooom (Canister): as it dies, blast every card on the board (both sides)
  // except its own element.
  const bb = def.onDeath?.boardBlast;
  if (bb) {
    // A radius measures from where the body is standing, so a blast can only
    // catch what the bomb was actually next to. Without a position to measure
    // from there is no blast at all — a radius bomb that died off-board (never
    // summoned, already removed) must not fall back to hitting the whole board.
    const dp = card.pos;
    const inBlast = (c: CardInstance) =>
      bb.radius === undefined || (!!dp && !!c.pos && chebyshev(c.pos, dp) <= bb.radius);
    const victims = (bb.radius !== undefined && !dp ? [] : boardCards(draft)).filter(
      (c) =>
        c.instanceId !== card.instanceId &&
        c.curHp > 0 &&
        getDef(c.defId).element !== bb.exceptElement &&
        inBlast(c),
    );
    for (const v of victims) directDamage(draft, card, v, bb.dmg, false);
    if (victims.length) draft.log.push(`${label(draft, card)} goes KaBoooom — ${bb.dmg} to ${victims.length} non-${bb.exceptElement ?? ""} card(s).`);
  }
  // Unstable Core (Nitro): a final explosion across the whole enemy board, on
  // ANY death path (this is the one place every death funnels through).
  if (def.deathExplosion) {
    const foes = enemyCards(draft, card.owner).filter((e) => e.curHp > 0);
    for (const e of foes) directDamage(draft, card, e, def.deathExplosion, false);
    draft.log.push(`${label(draft, card)}'s Unstable Core detonates — ${def.deathExplosion} DMG to all opponents!`);
  }
  creditDeath(draft.stats, card);
  // A body left behind (WarPhant's rider outliving the mount, Zombie Husk's
  // Reanimation raising a Zombie). Spawned HERE, at the single removal
  // choke-point, rather than in resolveHit — there it only fired for deaths
  // caused by an attack, so a husk finished off by a DOT or a round tick left
  // nothing, and WarPhant's rider quietly failed to appear the same way.
  // Before removeCard, while the dying card still has a slot to spawn around.
  const st = def.onDeath?.spawnToken;
  if (st && card.pos) spawnTokens(draft, card, st.token, st.count);
  // Contagion — Zombination's AURA, not a tribe trait: a friendly Zombie's death
  // sprays each adjacent opponent, but ONLY while a Zombination lives to project
  // it. Gone the moment Zombination falls. Fires at the single death choke-point
  // so a Zombie killed by DOT or a tick bursts too, not just an attack.
  if (
    card.pos &&
    tribeOf(card, "Zombie") &&
    boardCards(draft, card.owner).some((c) => c.curHp > 0 && getDef(c.defId).contagionAura)
  ) {
    const dp = card.pos;
    const near = enemyCards(draft, card.owner).filter(
      (e) => e.curHp > 0 && e.pos && chebyshev(e.pos, dp) <= 1,
    );
    for (const e of near) directDamage(draft, card, e, CONTAGION_SPLASH, false);
    if (near.length)
      draft.log.push(`${getDef(card.defId).name} bursts — Contagion hits ${near.length} for ${CONTAGION_SPLASH}.`);
  }
  // Toxic Contagion (Venomarch): a body that dies STILL CARRYING the poison bursts
  // and splashes the cards around it. Gated on the DOT still being present —
  // that is what "dies while affected" means, so a target that outlives the
  // poison and dies later drops quietly.
  //
  // The splash hits the DYING card's OWN side: the victim is the caster's
  // enemy, so its neighbours are the enemies worth infecting. (Contagion above
  // reads the other way because there the dying body is the caster's own.)
  // Credited to the caster when it's still alive, so the damage lands on the
  // player who actually spent the Special rather than on the corpse.
  if (card.toxicSplash && card.pos && hasStatus(card, "DOT")) {
    const { dmg, by } = card.toxicSplash;
    const dp = card.pos;
    const source = draft.cards[by]?.curHp > 0 ? draft.cards[by] : card;
    const near = boardCards(draft, card.owner).filter(
      (a) => a.curHp > 0 && a.instanceId !== card.instanceId && a.pos && chebyshev(a.pos, dp) <= 1,
    );
    for (const a of near) directDamage(draft, source, a, dmg, false);
    if (near.length)
      draft.log.push(`${getDef(card.defId).name} bursts with poison — ${near.length} adjacent take ${dmg}.`);
  }
  // Prism: the enchantment outlives the enchanter. Handed to the ally with the
  // most damage behind it — the charge is a single swing, so it is worth most
  // on whoever hits hardest. Passes on what Prism actually had armed, falling
  // back to the declared mode when it died with an empty weapon.
  if (def.onDeath?.passEnchant) {
    const heir = boardCards(draft, card.owner)
      .filter((c) => c.curHp > 0 && c.instanceId !== card.instanceId && !c.enchant)
      .sort((a, b) => effectiveDmg(draft, b) - effectiveDmg(draft, a))[0];
    if (heir) {
      heir.enchant = card.enchant ?? def.onDeath.passEnchant;
      draft.log.push(`${label(draft, card)} passes its ${heir.enchant} enchantment to ${label(draft, heir)}.`);
    }
  }
  // Meteor (Cosmic): a dying card flags a strike that lands at the END of the
  // NEXT round — 3 DMG to every opponent, fired from Cleanup (see doCleanupPhase).
  if (def.onDeath?.roundEndAoe) {
    const owner = draft.players[card.owner];
    (owner.pendingMeteors ??= []).push({ round: draft.round + 1, dmg: def.onDeath.roundEndAoe, source: card });
    draft.log.push(`${label(draft, card)} calls down a meteor — it strikes at the end of next round.`);
  }
  // Carnage (Zhunk): every living card that feeds on this tribe grows a little.
  // At the death choke-point, so a Zombie lost to a DOT or a tick counts too.
  for (const c of boardCards(draft)) {
    const ot = getDef(c.defId).onTribeDeath;
    if (!ot || c.curHp <= 0 || c.instanceId === card.instanceId || !tribeOf(card, ot.tribe)) continue;
    if (ot.max != null && (c.tribeFeedStacks ?? 0) >= ot.max) continue;
    c.tribeFeedStacks = (c.tribeFeedStacks ?? 0) + 1;
    if (ot.dmg) c.dmgBonus += ot.dmg;
    if (ot.sp) c.spBonus += ot.sp;
    if (ot.hp) c.curHp += gainMaxHp(c, ot.hp);
    draft.log.push(`${label(draft, c)} feeds on the fallen ${ot.tribe}.`);
  }
  // Last Light (Ariel): an opponent falling anywhere is a cue. Hooked at the
  // death choke-point so a kill made by a DOT or a round tick counts too, and
  // aimed at the nearest surviving opponent.
  for (const c of boardCards(draft)) {
    const od = getDef(c.defId).onOpponentDeath;
    if (!od?.dmg || c.curHp <= 0 || c.owner === card.owner || !c.pos) continue;
    const prey = boardCards(draft, card.owner)
      .filter((e) => e.curHp > 0 && e.pos && e.instanceId !== card.instanceId)
      .sort((x, y) => manhattan(c.pos!, x.pos!) - manhattan(c.pos!, y.pos!))[0];
    if (prey) {
      draft.log.push(`${label(draft, c)} answers the fall (${od.dmg} DMG).`);
      directDamage(draft, c, prey, od.dmg, false);
    }
  }
  // Salvage (Vulture): any card's death feeds the scavenger's max HP.
  for (const c of boardCards(draft)) {
    const salDef = getDef(c.defId);
    const sal = salDef.salvageOnDeath;
    const salCapped = salDef.salvageMax != null && (c.salvageStacks ?? 0) >= salDef.salvageMax;
    if (sal && !salCapped && c.curHp > 0 && c.instanceId !== card.instanceId) {
      c.salvageStacks = (c.salvageStacks ?? 0) + 1;
      c.curHp += gainMaxHp(c, sal);
    }
  }
  // Blood Moon (Vesper): an opponent's death heals it and its allies.
  for (const c of boardCards(draft)) {
    const dh = getDef(c.defId).deathHealAura;
    if (dh && c.curHp > 0 && c.owner !== card.owner) {
      for (const a of boardCards(draft, c.owner)) if (a.curHp > 0) healCard(draft, a, dh, c);
      draft.log.push(`${label(draft, c)} feeds on the fallen — the team heals +${dh}.`);
    }
  }
  // Diamond Kingdom (Adamant): an allied BORE card's fall hardens the weakest
  // survivor — the lowest-HP ally gains a one-round BLOCK.
  for (const c of boardCards(draft)) {
    const bd = getDef(c.defId).blockOnAllyDeath;
    if (!bd || c.curHp <= 0 || c.owner !== card.owner || c.instanceId === card.instanceId) continue;
    if (bd.element && getDef(card.defId).element !== bd.element) continue;
    const allies = boardCards(draft, c.owner).filter((a) => a.curHp > 0);
    if (allies.length === 0) continue;
    const weakest = allies.reduce((lo, a) => (a.curHp < lo.curHp ? a : lo), allies[0]);
    weakest.blockPower = Math.max(weakest.blockPower ?? 0, bd.block);
    weakest.blockRoundsLeft = Math.max(weakest.blockRoundsLeft ?? 0, bd.rounds);
    draft.log.push(`${label(draft, c)}'s Diamond Kingdom hardens ${label(draft, weakest)} (BLOCK ${bd.block} for ${bd.rounds}r).`);
  }
  // Life Cycle (Aurora): an opponent's death recharges one Light Orb (cycling
  // blue -> green -> red).
  for (const c of boardCards(draft)) {
    if (getDef(c.defId).lightOrbs && c.curHp > 0 && c.owner !== card.owner) {
      c.orbs ??= [];
      if (c.orbs.length >= ORB_CAP) continue; // refills toward a ceiling, not forever
      const idx = (c.orbCycle ?? 0) % ORB_KINDS.length;
      c.orbs.push(ORB_KINDS[idx]);
      c.orbCycle = idx + 1;
      draft.log.push(`${label(draft, c)} draws a new ${ORB_KINDS[idx]} orb from the fallen.`);
    }
  }
  // Graveyard tally (feeds Destro): count this card among its side's fallen.
  draft.players[card.owner].deaths = (draft.players[card.owner].deaths ?? 0) + 1;
  removeCard(draft, card.instanceId);
  return true;
}

/** Bog Ambush: haul `victim` into `row`. Prefers the column it already stands
 *  in — straight back through the water — and otherwise takes the nearest free
 *  column in that row. A full row means no drag; the damage still lands, which
 *  is the right failure: the Special should never be a dead cast.
 *
 *  The inverse of pushBack, which only ever moves a card AWAY. Returns whether
 *  it actually moved. */
export function dragInto(draft: GameState, victim: CardInstance, row: number): boolean {
  if (!victim.pos || row < 0 || row >= draft.boardSize) return false;
  if (victim.pos.row === row) return false;
  const free = (c: number) => !cardAt(draft, row, c) && !draft.slots[row][c].capturedBy;
  const cols = [...Array(draft.boardSize).keys()].sort(
    (a, b) => Math.abs(a - victim.pos!.col) - Math.abs(b - victim.pos!.col),
  );
  const dest = cols.find(free);
  if (dest == null) return false;
  victim.pos = { row, col: dest };
  return true;
}

/** Add a timed DMG/SP/hits modifier (team buff or −SP debuff).
 *
 *  `hits` is trailing and optional so the existing call sites are untouched — and
 *  it counts toward "is this buff worth pushing", or a pure +1-hit buff would be
 *  thrown away as empty. */
export function applyTimedBuff(
  card: CardInstance, dmg: number, sp: number, rounds: number, hits = 0, pen = false,
): void {
  if (rounds <= 0 || (dmg === 0 && sp === 0 && hits === 0)) return;
  card.buffs.push({ dmg, sp, rounds, ...(hits !== 0 ? { hits } : {}), ...(pen ? { pen: true } : {}) });
}

/** Turret Mode volley (GigaVolt): deal `dmg` to every ELECTRIFIED opponent on
 *  the board. Shared by the Special (first shot) and the Cleanup tick. */
export function fireElectrifiedVolley(draft: GameState, card: CardInstance, dmg: number): number {
  if (card.curHp <= 0 || dmg <= 0) return 0;
  const zapped = enemyCards(draft, card.owner).filter((e) => e.curHp > 0 && hasStatus(e, "ELECTRIFIED"));
  for (const e of zapped) tickDamage(draft, card, e, dmg, false);
  if (zapped.length) draft.log.push(`${label(draft, card)}'s turret fires — ${zapped.length} Electrified opponent(s) take ${dmg}.`);
  return zapped.length;
}

/** Blow a card back toward its OWN home row up to `steps` open slots (Mighty
 *  Winds / Wind Guardian). Stops at its home row, a captured, or occupied slot. */
/** Blow `card` away. `pusher` is the side or the CARD causing the push (never
 *  the victim) — Jetstream adds +1 space to everything its owner shoves, and
 *  that bonus has to be read from the pusher's fields, never the target's.
 *
 *  GIVEN A PUSHING CARD THIS IS `reelToCaster` RUN BACKWARDS: the target is
 *  shoved directly away from the thing that hit it, along both axes, a king-step
 *  at a time, stepping around a blocked square rather than stopping dead at it.
 *
 *  It used to walk the victim toward its own HOME ROW, which is a direction with
 *  two problems. On a 7x7 Domination board there are no home rows — the
 *  objectives sit in four corners — so "back" was a fiction, an east-west
 *  engagement produced no push at all, and a card standing on the row that
 *  happened to be its home could not be pushed by anything. And on every board
 *  it pointed at the victim's home rather than away from the attacker, so a
 *  shove could pull a card TOWARD the card that shoved it; Eagon's Special
 *  carries a comment recording exactly that, having had to be rewritten as a
 *  pull to do anything at all.
 *
 *  A push with no pushing card — a spell, cast by a player from nowhere in
 *  particular — has no position to be away FROM, and keeps the old home-row
 *  behaviour. */
export function pushBack(
  draft: GameState,
  card: CardInstance,
  steps: number,
  pusher?: PlayerId | CardInstance,
): void {
  if (getDef(card.defId).pushImmune) return; // Braced Stance: it doesn't budge
  const from = pusher && typeof pusher !== "string" ? pusher.pos : undefined;
  const side: PlayerId | undefined =
    pusher == null ? undefined : typeof pusher === "string" ? pusher : pusher.owner;
  const total = steps + (side ? fieldPushBonus(draft, side) : 0);
  const blocked = (row: number, col: number) =>
    row < 0 || row >= draft.boardSize || col < 0 || col >= draft.boardSize ||
    draft.slots[row][col].capturedBy || !!cardAt(draft, row, col) ||
    slotIsImpassable(draft, row, col);
  let moved = 0;
  if (from) {
    for (let i = 0; i < total; i++) {
      const pos = card.pos;
      if (!pos) break;
      // Recomputed every step, from the pusher's square: a shove radiates
      // outward, so stepping around an obstacle on one axis bends the rest of
      // the push rather than committing it to the original diagonal.
      const dr = Math.sign(pos.row - from.row), dc = Math.sign(pos.col - from.col);
      const tries: [number, number][] = [[dr, dc], [dr, 0], [0, dc]];
      let stepped = false;
      for (const [r, c] of tries) {
        if (!r && !c) continue;
        const row = pos.row + r, col = pos.col + c;
        if (blocked(row, col)) continue;
        card.pos = { row: row as Pos["row"], col: col as Pos["col"] };
        stepped = true;
        moved++;
        break;
      }
      if (!stepped) break;
    }
  } else {
    const dir = card.owner === "P1" ? 1 : -1; // toward own home (P1 = row 3, P2 = row 0)
    const home = homeRow(card.owner, draft.boardSize);
    for (let i = 0; i < total; i++) {
      const pos = card.pos;
      if (!pos || pos.row === home) break;
      if (blocked(pos.row + dir, pos.col)) break;
      card.pos = { row: (pos.row + dir) as Pos["row"], col: pos.col };
      moved++;
    }
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} is blown back ${moved} slot(s).`);
}

/** The inverse of pushBack: drag `card` toward the puller's home row (i.e.
 *  toward the attacker), one column-aligned step at a time. Stops at the board
 *  edge or the first occupied/captured slot — so it reels a target in until it
 *  bumps up against the puller's line. Used by Harpoon Hook / Sucker Sword. */
export function pullToward(
  draft: GameState,
  card: CardInstance,
  steps: number,
  puller: PlayerId,
): void {
  if (getDef(card.defId).pushImmune) return; // Braced Stance: can't be reeled either
  const dir = puller === "P1" ? 1 : -1; // toward the puller's home (P1 = row 3, P2 = row 0)
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos;
    if (!pos) break;
    const row: number = pos.row + dir;
    if (row < 0 || row >= draft.boardSize) break;
    if (draft.slots[row][pos.col].capturedBy || cardAt(draft, row, pos.col)) break;
    if (slotIsImpassable(draft, row, pos.col)) break; // a citadel is not a slot
    card.pos = { row: row as Pos["row"], col: pos.col };
    moved++;
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} is dragged in ${moved} slot(s).`);
}

/** Reel `card` in toward the PULLER ITSELF, a king-step at a time, from any
 *  direction — the lasso.
 *
 *  Distinct from `pullToward`, which drags toward the puller's HOME ROW along
 *  the target's own column and so can only ever close the row axis: a target off
 *  to one side was hauled up the board but never any nearer the thing that
 *  roped it. This closes both axes, so a rope thrown sideways or backwards pulls
 *  the way a rope actually does.
 *
 *  Stops when it is standing beside the puller (chebyshev 1) — it is reeled in,
 *  not dragged through. Blocked squares are stepped AROUND: the straight line is
 *  tried first, then each single axis, so a body in the way costs the diagonal
 *  rather than the whole pull. Braced Stance still refuses, like every push. */
export function reelToCaster(
  draft: GameState,
  card: CardInstance,
  steps: number,
  puller: CardInstance,
): void {
  if (getDef(card.defId).pushImmune) return;
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos, to = puller.pos;
    if (!pos || !to || chebyshev(pos, to) <= 1) break;
    const dr = Math.sign(to.row - pos.row), dc = Math.sign(to.col - pos.col);
    // Straight at the puller first, then one axis at a time.
    const tries: [number, number][] = [[dr, dc], [dr, 0], [0, dc]];
    let stepped = false;
    for (const [r, c] of tries) {
      if (!r && !c) continue;
      const row = pos.row + r, col = pos.col + c;
      if (row < 0 || row >= draft.boardSize || col < 0 || col >= draft.boardSize) continue;
      if (draft.slots[row][col].capturedBy || cardAt(draft, row, col)) continue;
      if (slotIsImpassable(draft, row, col)) continue; // a citadel is not a slot
      card.pos = { row: row as Pos["row"], col: col as Pos["col"] };
      stepped = true;
      moved++;
      break;
    }
    if (!stepped) break;
  }
  if (moved > 0)
    draft.log.push(`${label(draft, puller)} ropes ${getDef(card.defId).name} in ${moved} slot(s).`);
}

/** HP-threshold transform (Skelider Dismount): fires once when the card first
 *  drops below its threshold. */
export function checkLowHpTransform(draft: GameState, card: CardInstance): void {
  const def = getDef(card.defId);
  if (!def.onLowHp || card.onLowHpFired || card.curHp <= 0) return;
  if (card.curHp >= def.onLowHp.threshold) return;
  card.onLowHpFired = true;
  const o = def.onLowHp;
  // Skelider Dismount: it genuinely transforms — loses its Special (transformed),
  // sheds SP, and strikes the nearest enemy. (A positive surge does NOT set
  // `transformed`, so Kraken keeps Black Wave Crash.)
  if (o.loseSp || o.dmg || o.loseSpecial) {
    card.transformed = true;
    draft.log.push(`${label(draft, card)} dismounts — it fights on as a common skeleton.`);
    if (o.loseSp) card.spBonus -= o.loseSp;
    if (o.dmg) {
      const foes = enemyCards(draft, card.owner).filter((c) => c.curHp > 0);
      const foe = card.pos
        ? foes.reduce<CardInstance | null>((best, c) => (c.pos && (!best || manhattan(card.pos!, c.pos) < manhattan(card.pos!, best.pos!)) ? c : best), null)
        : foes[0] ?? null;
      if (foe) directDamage(draft, card, foe, o.dmg, false);
    }
  }
  // From the Deep (Kraken): one-time permanent surge on first dropping low.
  if (o.buffDmg || o.buffSp || o.gainShields) {
    if (o.buffDmg) card.dmgBonus += o.buffDmg;
    if (o.buffSp) card.spBonus += o.buffSp;
    if (o.gainShields) card.curShields += o.gainShields;
    draft.log.push(
      `${label(draft, card)} surges from the deep (+${o.buffDmg ?? 0} DMG / +${o.buffSp ?? 0} SP / +${o.gainShields ?? 0} shield).`,
    );
  }
}

/** Shield-breaking power scales with the hit: a hit of 9 or less shatters one
 *  shield, 10–20 shatters two, over 20 shatters three — per hit. */
export function shieldsBrokenBy(dmg: number): number {
  return dmg <= 9 ? 1 : dmg <= 20 ? 2 : 3;
}

/** How many recent hits the floating-damage readout keeps per card. Deep enough
 *  for the longest volley in the game plus a tick or two of DOT landing in the
 *  same step; anything older has already floated away. */
export const FX_DMG_KEEP = 8;

/** Record HP lost for the floating damage numbers over a token.
 *
 *  Purely cosmetic — call it wherever `curHp` actually goes DOWN, and nowhere
 *  else. Shields absorbing a hit is not damage to show here (the shield pip
 *  already fell), and neither is a max-HP drain.
 */
export function noteDamageFx(card: CardInstance, amount: number): void {
  if (!(amount > 0)) return;
  const hits = [...(card.fxDmgHits ?? []), Math.round(amount)];
  card.fxDmgHits = hits.length > FX_DMG_KEEP ? hits.slice(-FX_DMG_KEEP) : hits;
  card.fxDmgSeq = (card.fxDmgSeq ?? 0) + 1;
}

/**
 * Resolve one attack (basic / special / reflect) from attacker onto target.
 * Handles the full pipeline including multi-hit, keywords, and deaths.
 */
export function resolveHit(
  draft: GameState,
  attacker: CardInstance,
  target: CardInstance,
  opts: HitOptions,
): AttackResult {
  const tDef = getDef(target.defId);
  const aDef = getDef(attacker.defId);
  // A WALL SLOWS A SIEGE; IT DOES NOT BLUNT ONE. Every point of damage a BOSS
  // deals to something that `guardsHomeRow` pierces its shields.
  //
  // Here rather than on the basic-attack path, because that was the version
  // written first and it missed the half that mattered: shields block per HIT,
  // so Hoarfell's Aurora Break — 10 damage to three gates at once — was doing
  // ZERO to every one of them, and the Special is where a slow boss's output
  // actually lives. Basics alone moved Permafrost 6.3% -> 8.3% and Hoarfell
  // 12.5% -> 10.4%; the Specials were the missing half.
  //
  // Scoped to bosses and to gates, so nothing about how a boss fights the
  // player's real cards changes and the tower's tuning against those stands.
  if (aDef.boss && tDef.guardsHomeRow) opts = { ...opts, pen: true };
  const result: AttackResult = {
    landedHits: 0,
    dodgedHits: 0,
    totalToHp: 0,
    totalShielded: 0,
    targetDied: false,
    attackerDied: false,
    critHits: 0,
  };
  let reflectBack = 0;

  // "This attack cannot miss." Read once — neither source can change mid-volley
  // — and consulted by every roll-to-hit below.
  //
  // TWO sources: Blazing Sun (the DAWN field) and Totem Spirit (a living Totem on
  // this side). Folded into ONE flag because the cascade below already keys on
  // this single variable; a second parallel flag would have to be threaded
  // through ten branches with a real chance of missing one.
  //
  // Stronger than card-level `alwaysHit`, deliberately — see Rocky Force Field
  // below, which alwaysHit does NOT beat.
  const neverMiss = fieldFlag(draft, attacker, "neverMiss") || hasTotemSpirit(draft, attacker);
  // First Guard (firstAttackMisses): the first basic ATTACK against this card
  // each round misses — the whole volley, since one attack is one attempt. The
  // ATTEMPT springs the guard whatever happens: alwaysHit and Blazing Sun still
  // connect, but the guard is spent either way, so leading with the sure hit is
  // real sequencing rather than a wasted counter. Computed once, above the hit
  // loop, or a 2-hit volley would miss its first hit and land its second.
  let firstGuard = false;
  if (opts.kind === "basic" && getDef(target.defId).firstAttackMisses && !target.firstGuardUsedRound) {
    target.firstGuardUsedRound = true;
    firstGuard = !aDef.alwaysHit && !opts.alwaysHit && !neverMiss;
  }
  // AND IT SAYS SO WHEN IT SAVES ONE.
  //
  // Blazing Sun promises DAWN allies "cannot miss" and delivered it in total
  // silence: the branches below simply do not fire, so nothing is logged, and
  // the card goes on wearing its BLIND pip with no sign the field is ignoring
  // it. Reported as the spell being broken — which is the right conclusion from
  // the only evidence the game was offering.
  //
  // Announced once per ATTACK rather than per hit (this sits above the hit
  // loop), and only when something would actually have been shrugged off —
  // a line every swing would be noise. Consumes no RNG, so replays are
  // unaffected.
  if (neverMiss && opts.kind === "basic" && !aDef.alwaysHit) {
    const wouldHaveMissed =
      hasStatus(attacker, "BLIND")
      || (draft.players[target.owner].foggedRounds ?? 0) > 0
      || draft.fields.some((f) => f.owner !== attacker.owner && f.enemyMissChance)
      || (attacker.attackMissRounds ?? 0) > 0
      || enemyCards(draft, attacker.owner).some((e) => e.curHp > 0 && getDef(e.defId).blindingStar);
    if (wouldHaveMissed) {
      attacker.fxNeverMiss = (attacker.fxNeverMiss ?? 0) + 1;
      draft.log.push(
        `${label(draft, attacker)} sees clear and strikes true — ${
          fieldFlag(draft, attacker, "neverMiss") ? "Blazing Sun" : "Totem Spirit"
        } holds.`,
      );
    }
  }
  // False Head (Thorny Ripper): ONE free dodge for the whole game, against a
  // BASIC attack. The first basic it takes strikes the decoy and deals nothing,
  // and the decoy is then gone for good.
  //
  // Basics only. A guaranteed dodge that could also blank a Mythic's Special was
  // too much on a cost-2 body — the Ripper is a blocker, and what a blocker
  // should turn away is a swing, not someone's once-a-game payoff.
  //
  // `kind === "basic"` also excludes reflect damage by construction, which
  // matters: reflect is not an attack, and without that the Ripper's own
  // REFLECT would spend the dodge on the first thing that merely touched it.
  //
  // Decided once, before the hit loop, so a multi-hit volley is blanked whole
  // rather than losing only its opening hit — it is one ATTACK that missed.
  if (
    tDef.falseHead &&
    !target.falseHeadUsed &&
    opts.kind === "basic"
  ) {
    target.falseHeadUsed = true;
    result.dodgedHits += opts.hits;
    target.fxMiss = (target.fxMiss ?? 0) + 1;
    draft.log.push(`${aDef.name} strikes ${label(draft, target)}'s false head — no damage.`);
    return result;
  }
  for (let i = 0; i < opts.hits; i++) {
    if (target.curHp <= 0) break;
    // A dead attacker does not finish its swing. Eagon's Vision Guard deflects
    // half the blow back and can kill mid-volley (see onHitDeflect below); the
    // loop only ever checked the TARGET, so the corpse kept landing the rest of
    // its hits and could still be credited the kill.
    //
    // Keyed on "died during THIS volley", not on `attacker.curHp <= 0`: a dying
    // card's parting shot (Crock's Deathroll, Bird Bomb) is a legitimate attack
    // made from 0 HP, and the broader test cancelled those outright.
    if (result.attackerDied) break;

    // First Guard — see above the loop. No roll: the first attack simply
    // misses, and the card text says exactly that.
    if (firstGuard) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, target)} slips the first blow of the round.`);
      continue;
    }
    // 0. BLIND — −50% accuracy, rolled PER HIT on a basic attack (so a blinded
    //    multi-hit lands some and whiffs others). Specials auto-hit.
    // Dense Fog (AQUA): the ENEMY's field makes this attack roll to miss, on the
    // same coin BLIND uses. Read from the OPPONENT's fields, not the attacker's
    // — it is the only field in the game that debuffs the other side.
    const fogged =
      opts.kind === "basic" &&
      !aDef.alwaysHit &&
      !neverMiss &&
      draft.fields.some((f) => f.owner !== attacker.owner && f.enemyMissChance);
    if (fogged && !coin(draft)) {
      result.dodgedHits = (result.dodgedHits ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} loses the shot in the fog.`);
      continue;
    }
    // Fog Settlement (Misty) / Smog (Aftermath): attacks aimed at a fogged
    // player's cards whiff — board-wide, flat, uncleansable. Rolled per hit
    // like BLIND, and at whatever thickness the source laid it at.
    if (
      opts.kind === "basic" &&
      !aDef.alwaysHit &&
      !neverMiss &&
      (draft.players[target.owner].foggedRounds ?? 0) > 0 &&
      pctChance(draft, draft.players[target.owner].foggedPct ?? FOG_MISS_PCT)
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} loses the shot in the fog.`);
      continue;
    }
    if (opts.kind === "basic" && !aDef.alwaysHit && !neverMiss && hasStatus(attacker, "BLIND") && !coin(draft)) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} misses (BLIND).`);
      continue;
    }
    // Blinding Star (Supernova): a living enemy holder glares the whole board
    // down — every enemy basic rolls to miss. Board-wide and range-free, unlike
    // the fields above, because the star is a light source and not a weather
    // front. Cheap to test (one predicate over the enemy side) and only reached
    // when the attack is a basic that can miss at all.
    if (
      opts.kind === "basic" && !aDef.alwaysHit && !neverMiss &&
      enemyCards(draft, attacker.owner).some((e) => e.curHp > 0 && getDef(e.defId).blindingStar) &&
      pctChance(draft, BLINDING_STAR_MISS_PCT)
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} is dazzled by the Blinding Star and misses.`);
      continue;
    }
    // Shell Tuck (Tide): a flat self-inflicted accuracy penalty on its own basics
    // — the trade for tucking up behind 6 shields.
    if (
      opts.kind === "basic" && !aDef.alwaysHit && !neverMiss &&
      (attacker.attackMissRounds ?? 0) > 0 && pctChance(draft, attacker.attackMissPct ?? 0)
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} swings wide, tucked in.`);
      continue;
    }
    // A standing accuracy penalty printed on the CARD (Havoc's 85%). Rolled per
    // hit like BLIND, so a multi-hit volley lands some and whiffs others rather
    // than being all-or-nothing — and it sits below the timed penalties so a
    // card carrying both rolls both, which is the honest reading of two
    // separate sources of inaccuracy.
    if (
      opts.kind === "basic" && !aDef.alwaysHit && !neverMiss &&
      (aDef.basicMissPct ?? 0) > 0 && pctChance(draft, aDef.basicMissPct ?? 0)
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)}'s shot goes wide.`);
      continue;
    }

    // Life Cycle (Aurora): a Light Orb intercepts the hit like a shield, then
    // bursts its effect at the attacker and disappears. One orb per hit.
    if (opts.kind !== "reflect" && (target.orbs?.length ?? 0) > 0) {
      const orb = target.orbs!.shift()!;
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, target)}'s ${orb} orb absorbs ${aDef.name}'s attack.`);
      fireOrb(draft, target, attacker, orb);
      continue;
    }

    // 0. Blur (Hoax): a banked guaranteed dodge — the next incoming attack
    //    misses outright, no coin, beating even alwaysHit. One charge per hit.
    if (opts.kind !== "reflect" && (target.guaranteedDodge ?? 0) > 0) {
      target.guaranteedDodge = (target.guaranteedDodge ?? 0) - 1;
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, target)} blurs away — ${aDef.name}'s attack finds nothing.`);
      continue;
    }
    // 1. EVASION — innate or granted by a friendly wall (Veil). Not re-checked
    //    for reflect damage (no dodge chains). Hot Shot (alwaysHit) ignores it.
    // Standing EVASION — innate, a friendly wall (Veil), or the granted status.
    // These re-roll on every hit.
    const standingEvasion =
      hasEvasion(target, draft.boardSize) || wallEvasion(draft, target) || hasStatus(target, "EVASION");
    // Nightfall's is NOT standing: it covers the FIRST hit taken each round
    // only. Checked after the standing sources so a card that already dodges
    // everything doesn't burn the field's one cover for nothing, and spent on
    // the attempt whether or not the coin comes good.
    const fieldEva =
      !standingEvasion && !target.fieldEvasionUsed && fieldEvasion(draft, target);
    // Purelight (Halo): a DAWN attacker's hits pierce EVASION while a holder stands.
    const purelightPierce =
      aDef.element === "DAWN" &&
      boardCards(draft, attacker.owner).some((a) => a.curHp > 0 && getDef(a.defId).purelightAura);
    if (opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !neverMiss && !purelightPierce && (standingEvasion || fieldEva)) {
      if (fieldEva) target.fieldEvasionUsed = true;
      if (coin(draft)) {
        result.dodgedHits++;
        target.fxMiss = (target.fxMiss ?? 0) + 1;
        draft.log.push(`${label(draft, target)} evades a hit from ${aDef.name}.`);
        continue;
      }
    }
    // Midnight Shade (DUSK aura): the shadows left by fallen DUSK allies. Rolled
    // after EVASION so a card that already dodges doesn't waste the check, and
    // respecting alwaysHit/neverMiss like every other dodge in this list.
    if (opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !neverMiss) {
      const shade = shadeDodgePct(draft, target);
      if (shade > 0 && pctChance(draft, shade)) {
        result.dodgedHits++;
        target.fxMiss = (target.fxMiss ?? 0) + 1;
        draft.log.push(`${label(draft, target)} melts into the shadows — ${aDef.name} finds nothing.`);
        continue;
      }
    }
    // Slipstream (GALE aura): too fast to be where the blow lands. Rolled after
    // the shadows for the same reason those are rolled after EVASION — a card
    // already dodging does not need a second check — and under the same
    // alwaysHit/neverMiss rules as every dodge above it.
    if (opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !neverMiss) {
      const slip = slipstreamDodgePct(draft, target);
      if (slip > 0 && pctChance(draft, slip)) {
        result.dodgedHits++;
        target.fxMiss = (target.fxMiss ?? 0) + 1;
        draft.log.push(`${label(draft, target)} slips the wind — ${aDef.name}'s attack passes through.`);
        continue;
      }
    }
    // Unpredictable (Ender): a SLOWER attacker has only a 50% chance to connect.
    if (
      opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !neverMiss &&
      tDef.evadeVsSlower && effectiveSp(draft, attacker) < effectiveSp(draft, target) && coin(draft)
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, target)} is too unpredictable — ${aDef.name} misses.`);
      continue;
    }
    // Lure (Anglerfish): its glow disorients attackers — a flat accuracy debuff.
    if (
      opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !neverMiss &&
      (target.incomingMissRounds ?? 0) > 0 && pctChance(draft, target.incomingMissPct ?? 0)
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${aDef.name} loses ${label(draft, target)} in its lure.`);
      continue;
    }

    // 1a. Untouchable (GALE vs BORE): the wind slips the stone. A matchup dodge
    // rather than a keyword, so it stacks with nothing and re-rolls per hit.
    // Reflect isn't an attack, and the usual alwaysHit/neverMiss overrides beat
    // it like every other dodge above.
    if (
      opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !neverMiss &&
      pctChance(draft, dodgesByMatchup(aDef.element, tDef.element))
    ) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, target)} rides the wind clear of ${aDef.name}'s attack.`);
      continue;
    }

    // 1b. Rocky Force Field (Rhyolite): coin-flip chance to shrug off a RANGED hit.
    if (
      opts.kind !== "reflect" &&
      !neverMiss && // Blazing Sun and Totem Spirit beat it; card-level alwaysHit
      // does NOT — those cards print "ignores BLIND and EVASION", and widening
      // that here would silently rebalance Hot Shot and Hunting Season.
      tDef.blocksRangedChance &&
      aDef.attackType === "Ranged" &&
      pctChance(draft, tDef.blocksRangedChance)
    ) {
      result.dodgedHits++;
      draft.log.push(`${label(draft, target)}'s force field deflects ${aDef.name}'s shot.`);
      continue;
    }

    // 2. BLOCK — flat reduction, applies before shields and even to PEN. Adds
    //    the card's own BLOCK to any friendly wall reduction (Stone/Radiant).
    // Element matchup swing (DAWN↔DUSK, +25% each way). Applied to the base
    // damage before every flat rider below, so the bonus scales the printed
    // attack rather than the accumulated total.
    let remaining = applyMatchupDamage(aDef.element, tDef.element, opts.dmg);
    // See `CardInstance.statScale`. A Special's damage is a hardcoded number on
    // the def that never passes through `effectiveDmg`, so the two existing
    // damage multipliers in this game (WEAKEN and FREEZE) do not touch Specials
    // at all — a "half strength" body built on that pattern would swing for half
    // and then cast at full. This is the one line both paths share.
    //
    // BASICS ARE EXCLUDED because they arrive here already scaled: their number
    // came from `effectiveDmg`, which applies the multiplier itself so the token
    // on the board shows the halved figure. Scaling again here would quarter it.
    if (opts.kind !== "basic" && attacker.statScale != null && attacker.statScale !== 1)
      remaining = Math.max(0, Math.floor(remaining * attacker.statScale));
    // War Mount (Cragrider): the mount mauls whatever the Ranger stands beside —
    // its BASIC hits an ADJACENT target for extra. Applied here rather than in
    // effectiveDmg because it depends on the TARGET's distance, which
    // effectiveDmg has no way to see.
    if (
      opts.kind === "basic" &&
      aDef.meleeBonusDmg &&
      attacker.pos &&
      target.pos &&
      chebyshev(attacker.pos, target.pos) <= 1
    )
      remaining += aDef.meleeBonusDmg;
    // Incinerate ramp: +1 per consecutive landed hit on this target (this volley
    // + hits already landed on it this round).
    if (opts.incinerate) remaining += (opts.incinerateBase ?? 0) + result.landedHits;
    const tempBlk = (target.blockRoundsLeft ?? 0) > 0 ? (target.blockPower ?? 0) : 0;
    const block = Number(tDef.keywords.BLOCK ?? 0) + wallFlatReduction(draft, target) + fieldBonus(draft, target, "block") + tempBlk;
    if (block > 0) remaining = Math.max(0, remaining - block);
    // Iron Ore (Bolder): half damage (round down) from Ranger/Assassin attackers.
    if (tDef.blockVsClasses?.includes(getDef(attacker.defId).cardClass)) remaining = Math.floor(remaining / 2);
    // Vision Guard (Eagon): a coin-flip deflect — take half, throw half back.
    if (tDef.onHitDeflect && opts.kind !== "reflect" && remaining > 0 && pctChance(draft, tDef.onHitDeflect)) {
      remaining = Math.floor(remaining / 2);
      draft.log.push(`${label(draft, target)} deflects ${aDef.name}'s blow.`);
      if (remaining > 0 && attacker.curHp > 0 && directDamage(draft, target, attacker, remaining, false)) result.attackerDied = true;
    }

    // 3. Shield gate.
    let toHp: number;
    // Crack Shot (Sling): a crushing shot both DOUBLES and PIERCES on the coin.
    // `critPen` lets the crit fire even against a shielded target (and then skips
    // the shield); a plain CRIT still needs an unshielded target. Gated on
    // !opts.pen so an ordinary piercing hit behaves exactly as before.
    let pierces = opts.pen;
    // Mark of Hoax: a basic against a marked target CRITs guaranteed (skips the
    // coin). Everything else still rolls the usual 50%.
    const guaranteedCrit =
      (opts.kind === "basic" && Boolean(target.hoaxMarked)) || Boolean(opts.critAlways);
    if (opts.crit && !opts.pen && (target.curShields === 0 || aDef.critPen) && (guaranteedCrit || coin(draft))) {
      remaining *= 2;
      result.critHits = (result.critHits ?? 0) + 1;
      target.fxCrit = (target.fxCrit ?? 0) + 1;
      draft.log.push(`${aDef.name} CRITS ${tDef.name}!`);
      if (aDef.critPen) pierces = true;
      // Jackpot (Highroller): EVERY crit counts toward the streak — basics AND the
      // crits Purple Strikes rolls — so a lucky run loops into the bonus.
      if (aDef.jackpot && opts.kind !== "reflect") {
        const before = attacker.critsThisRound ?? 0;
        attacker.critsThisRound = before + 1;
        if (before < aDef.jackpot.critsForBonus && attacker.critsThisRound >= aDef.jackpot.critsForBonus) {
          attacker.curHp += gainMaxHp(attacker, aDef.jackpot.bonusHp);
          attacker.dmgBonus += aDef.jackpot.bonusDmg;
          draft.log.push(`${label(draft, attacker)} jackpots ${aDef.jackpot.critsForBonus} crits (+${aDef.jackpot.bonusHp} HP, +${aDef.jackpot.bonusDmg} DMG)!`);
        }
      }
    }
    if (pierces) {
      toHp = remaining; // no shield stripped
    } else {
      toHp = Math.max(0, remaining - target.curShields);
      // What the armour actually stopped. Measured BEFORE the shield is stripped
      // below, since the strip changes curShields for the next hit.
      result.totalShielded += remaining - toHp;
      if (target.curShields > 0) {
        // Exostone (BORE): dense stone chips ONE plate at a time. Everyone else
        // loses shields on a sliding scale with the size of the blow —
        // shieldsBrokenBy takes 2 at 10+ damage and 3 at 21+ — which fell
        // hardest on the element built out of shields: BORE carries the most
        // armour in the game (avg 2.64 a card) and a single heavy hit could
        // strip most of it. Now a big swing takes one plate, same as a small one.
        const broke = hasElementAura(tDef, "BORE") ? 1 : shieldsBrokenBy(remaining);
        target.curShields = Math.max(0, target.curShields - broke);
        // REMOVED: Exostone used to hand the attacker +1 shield for every plate
        // its hit broke off an opponent — "the stone takes what it breaks". It
        // was added as the aura's offensive half, on the reading that BORE holds
        // its board and never converts.
        //
        // It converted far too well. BORE measured 60.1% at the top of an
        // otherwise 15.8-point field, four clear of second and ten clear of
        // third, and this was the compounding piece: BORE already carries the
        // most armour in the game (2.64 a card) and already caps its own losses
        // at one plate a hit, so looting on top meant attacking INTO it and
        // being attacked BY it both fed the same stat. Nothing else in the game
        // gains a defensive resource for landing an ordinary basic.
        //
        // Kept: the rarity-tiered arrival plating and the one-plate loss cap.
        // Those are what make BORE the armour element; this was what made
        // trading with it a losing proposition on both sides of the swing.
        // Gate Keeper (Veil): the first time the shield wall breaks, harden up.
        if (target.curShields === 0 && tDef.onShieldBreak && !target.shieldBroken) {
          target.shieldBroken = true;
          if (tDef.onShieldBreak.dmg) target.dmgBonus += tDef.onShieldBreak.dmg;
          if (tDef.onShieldBreak.sp) target.spBonus += tDef.onShieldBreak.sp;
          // Buzz's Electro Shield: the shatter discharges into the attacker.
          const brk = tDef.onShieldBreak.status;
          if (brk && attacker.curHp > 0)
            applyStatus(draft, attacker, brk.kind, brk.duration, brk.power, tDef.element);
          draft.log.push(`${label(draft, target)}'s shield shatters${brk ? ` — ${brk.kind} discharge!` : " — it hardens."}`);
        }
      }
    }
    // Hive Mind: the swarm eats part of the hit. Between the shield gate and
    // the HP, so it divides real damage rather than damage the armour was
    // already going to stop.
    // Every source, not just attacks: directDamage (auras, ticks, splash,
    // retaliation) runs as kind "reflect", and excluding it meant the swarm sat
    // and watched Keeper take chip damage it was summoned to eat.
    const hive = tDef.hiveAbsorb;
    if (hive && toHp > 0) {
      let quota = Math.floor((toHp * hive.pct) / 100);
      const swarm = boardCards(draft, target.owner).filter(
        (c) => c.curHp > 0 && c.instanceId !== target.instanceId && tribeOf(c, hive.tribe),
      );
      for (const bot of swarm) {
        if (quota <= 0) break;
        // The swarm SHARES the blow; it does not die on it. Each bot soaks down
        // to 1 HP and no further.
        //
        // It used to absorb to the death, which made Hive Mind a liability
        // rather than a defence: a Beebot has 3 HP, so any hit of 6+ on Keeper
        // diverted 3 into a bee and killed it outright — spending a whole body
        // (a sting is 2 DMG plus DOT 2 for 2 rounds, ~6 damage) to save Keeper
        // 3 HP, on essentially every hit. Measured by ablation, BOLT won 6.8
        // points MORE with Keeper cut from the deck entirely; feeding its own
        // win condition into the shredder is the main reason why.
        const canTake = bot.curHp - 1;
        if (canTake <= 0) continue;
        const eaten = Math.min(quota, canTake);
        bot.curHp -= eaten;
        noteDamageFx(bot, eaten); // the bee that soaked it shows the number, not Keeper
        quota -= eaten;
        toHp -= eaten;
        creditDamage(draft.stats, null, attacker.owner, eaten, bot);
        draft.log.push(`${getDef(bot.defId).name} takes ${eaten} for ${label(draft, target)}.`);
      }
    }
    target.curHp -= toHp;
    noteDamageFx(target, toHp);
    result.landedHits++;
    result.totalToHp += toHp;

    // Well Watered (LEAF vs AQUA): the rain feeds it. Drunk per LANDED hit,
    // after the damage, and only while it's still standing — a killing blow
    // doesn't water a corpse back up.
    if (tDef.element === "LEAF" && aDef.element === "AQUA" && target.curHp > 0) {
      const drank = healCard(draft, target, LEAF_WATER_HEAL, target);
      if (drank > 0) draft.log.push(`${label(draft, target)} drinks in ${aDef.name}'s water (+${drank} HP).`);
    }

    // 5 (per landed hit). REFLECT accumulates; resolved after the volley.
    const grantedReflect = (target.reflectRoundsLeft ?? 0) > 0 ? (target.reflectPower ?? 0) : 0;
    const reflect = Number(tDef.keywords.REFLECT ?? 0) + fieldBonus(draft, target, "reflect")
      + auraReflectBonus(draft, target) + grantedReflect;
    if (reflect > 0 && opts.kind !== "reflect") reflectBack += reflect;
  }

  if (result.landedHits > 0) {
    if (!opts.silent)
      draft.log.push(
        `${label(draft, attacker)} hits ${label(draft, target)} for ${result.totalToHp} (${result.landedHits} hit${result.landedHits > 1 ? "s" : ""}).`,
      );
    // Any hit wakes a sleeper (SLEEP removed the moment it's struck) — unless
    // the attacker ignores that rule (Dunewraith's Nightmare).
    if (hasStatus(target, "SLEEP") && target.curHp > 0 && !aDef.ignoresSleepWake) {
      target.statuses = target.statuses.filter((s) => s.kind !== "SLEEP");
      draft.log.push(`${label(draft, target)} is jolted awake!`);
    }
    // Trapper aura (Fallow): a real AURA — EVERY ally's hits can pin, not just
    // the holder's own, so it is sourced from the board rather than from aDef.
    //
    // Gated on the volley actually CRITting. It briefly fired on any landed
    // hit, which made every ally a pinner and the ROOT close to guaranteed. The
    // crit gate is the cost of that reach: the roll needs an unshielded target
    // and then a coin flip, and an ally with no CRIT of its own never rolls.
    // This block sits AFTER the per-hit loop, so it reads the volley-level
    // critHits tally rather than any single hit.
    //
    // `kind !== "reflect"` keeps it to real attacks. Trapper's own end-of-round
    // tick resolves as reflect, so without this the aura would re-pin everything
    // Trapper just hit, every round, forever.
    if ((result.critHits ?? 0) > 0 && opts.kind !== "reflect" && target.curHp > 0) {
      const pinner = boardCards(draft, attacker.owner).find((c) => {
        const d = getDef(c.defId);
        return c.curHp > 0 && d.critStatus && d.keywords.CRIT;
      });
      if (pinner) {
        const pd = getDef(pinner.defId);
        const cs = pd.critStatus!;
        applyStatus(draft, target, cs.kind, cs.duration, cs.power, pd.element);
      }
    }
  }

  // Tally HP damage dealt to an enemy (basics, specials, and directDamage all
  // funnel through here) for the post-match stats.
  if (result.totalToHp > 0 && target.owner !== attacker.owner)
    creditDamage(draft.stats, attacker, attacker.owner, result.totalToHp, target);
  // Armour that held. Credited even on a hit that dealt no HP damage at all —
  // a fully-absorbed hit is the shield doing its whole job, and counting only
  // HP loss is what made shield elements unmeasurable.
  if (result.totalShielded > 0 && target.owner !== attacker.owner)
    creditShielded(draft.stats, target, result.totalShielded);

  // Count enemy hits TAKEN (Squanch's Regenerative cashes these in at Cleanup).
  // Counts the hit, not the damage — one fully absorbed by shields still landed.
  if (result.landedHits > 0 && target.owner !== attacker.owner)
    target.hitsTakenThisRound += result.landedHits;
  // HP actually lost this round (Bolder's Vengeance reflects it back).
  if (result.totalToHp > 0 && target.owner !== attacker.owner)
    target.dmgTakenThisRound = (target.dmgTakenThisRound ?? 0) + result.totalToHp;

  // 5. On-hit keywords — basic attacks only. (onHitStatus riders + vsStatus
  //    heals are applied by basicAttack, which knows the per-target gating.)
  if (opts.kind === "basic" && result.landedHits > 0) {
    // DRAIN runs BEFORE the heal, deliberately. It raises the attacker's max HP,
    // and healCard caps at effectiveMaxHp — so draining first means the new
    // ceiling is already in place and the heal can actually use it. The other
    // order silently clipped the last points of every drain-heal.
    // Endless Night can GRANT drain to a whole element for the rest of the game,
    // so the keyword is read through the player record as well as the card.
    const granted = draft.players[attacker.owner].elementPerm;
    const hasDrain =
      aDef.keywords.DRAIN || (granted?.drain && granted.element === aDef.element);
    if (hasDrain) drainMaxHp(draft, attacker, target, 1);
    // DRAIN is LIFESTEAL that also grows — but it feeds at HALF rate: it heals
    // for half the damage dealt, on top of the 1 max HP it just took. LIFESTEAL
    // still returns the full amount, and a card carrying both takes the better
    // (full) rate rather than the two cancelling out.
    const drains = aDef.keywords.LIFESTEAL || hasDrain || opts.lifesteal;
    if (drains && result.totalToHp > 0) {
      const fullRate = Boolean(aDef.keywords.LIFESTEAL || opts.lifesteal);
      // floor, matching every other halving in the game (DAWN's Awakening,
      // FREEZE's damage cut) — so a 1-damage drain returns nothing.
      const amount = fullRate ? result.totalToHp : Math.floor(result.totalToHp / 2);
      const healed = amount > 0 ? healCard(draft, attacker, amount, attacker) : 0; // SEAL blocks it
      if (healed > 0)
        draft.log.push(`${aDef.name} ${fullRate ? "lifesteals" : "drains"} ${healed} HP.`);
    }
  }

  if (target.curHp <= 0) {
    const deathPos = target.pos ? { ...target.pos } : null;
    const deadOwner = target.owner;
    const removed = defeatCard(draft, target, `${aDef.name}'s ${opts.kind}`, attacker);
    if (!removed) return result; // revived — no kill/on-death triggers
    result.targetDied = true;
    if (target.owner !== attacker.owner) creditKill(draft.stats, attacker, attacker.owner);
    // On-kill trigger for the attacker (basic/special kills only).
    // Masonry feeds nothing — see `noKillReward`. Checked before BOTH the rider
    // and the counter, so a Fortress Gate cannot grow Vulcanyx, raise a wolf for
    // Thunderfangs, bloom a crystal for Cryovex, or tick anyone toward a second
    // form on its way down.
    const feeds = !tDef.noKillReward;
    if ((opts.kind === "basic" || opts.kind === "special") && attacker.curHp > 0 && feeds) {
      if (aDef.onKill) applyOnKill(draft, attacker, aDef.onKill, deathPos);
      registerKill(draft, attacker);
      // Gaslighting (Liza): an allied enabler spurs whoever lands the kill.
      for (const gl of boardCards(draft, attacker.owner)) {
        const akb = getDef(gl.defId).allyKillBuff;
        if (gl.curHp > 0 && akb) {
          applyTimedBuff(attacker, akb.dmg, 0, akb.rounds);
          draft.log.push(`${label(draft, gl)}'s Gaslighting spurs ${label(draft, attacker)} (+${akb.dmg} DMG for ${akb.rounds}r).`);
        }
      }
      // BlastOff (FireFly): a kill fires its Special for free and lifts it into
      // the air. The autoFiring guard stops a BlastOff kill from recursing.
      if (aDef.firePassiveSpecial?.onKill) {
        draft.log.push(`${aDef.name} blasts off — free Flying Flame Strike!`);
        fireCardSpecial(draft, attacker);
        if (aDef.firePassiveSpecial.grantFlyingRounds && draft.cards[attacker.instanceId] && attacker.curHp > 0)
          attacker.flyingRoundsLeft = aDef.firePassiveSpecial.grantFlyingRounds;
      }
      // Frostveil's Icy Mist: a kill while cloaked extends the STEALTH window.
      const ext = aDef.onSummon?.extendSelfStatusOnKill;
      const selfSt = aDef.onSummon?.selfStatus;
      if (ext && selfSt) {
        const st = attacker.statuses.find((s) => s.kind === selfSt);
        if (st) st.duration += ext;
      }
    }
    // Brightling Ball: the dead card's surviving ALLIES answer the killer.
    // Gated off `reflect` so a retaliation kill can't set off another round of
    // retaliation, and the answer itself goes out as reflect for the same reason.
    if (opts.kind !== "reflect" && attacker.curHp > 0 && target.owner !== attacker.owner) {
      for (const ally of boardCards(draft, deadOwner)) {
        const aoDef = getDef(ally.defId).onAllyKilled;
        if (!aoDef || ally.curHp <= 0) continue;
        if (aoDef.oneUse && ally.allyKilledFired) continue;
        if (aoDef.oncePerRound && ally.allyKilledFiredRound) continue;
        ally.allyKilledFired = true;
        ally.allyKilledFiredRound = true;
        draft.log.push(`${label(draft, ally)} answers for ${tDef.name}!`);
        if (aoDef.dmg && directDamage(draft, ally, attacker, aoDef.dmg, false)) {
          result.attackerDied = true;
          break; // killer is gone; nothing left to punish
        }
        if (aoDef.status && attacker.curHp > 0 && draft.cards[attacker.instanceId]) {
          const st = aoDef.status;
          applyStatus(draft, attacker, st.kind, st.duration, st.power, getDef(ally.defId).element);
        }
      }
    }
    // Last Waltz: fires on ANY death, killer or not — the ballroom dances on.
    // Runs before the damage-retaliation branch below so the tribe buff lands
    // even when the same onDeath also strikes back.
    if (tDef.onDeath?.allyTribeBuffDmg) {
      const { tribe, dmg } = tDef.onDeath.allyTribeBuffDmg;
      const kin = boardCards(draft, deadOwner).filter((a) => {
        const t = getDef(a.defId).tribe;
        return a.curHp > 0 && (Array.isArray(t) ? t.includes(tribe) : t === tribe);
      });
      for (const a of kin) a.dmgBonus += dmg;
      if (kin.length)
        draft.log.push(`${tDef.name}'s last waltz lifts ${kin.length} ${tribe}(s) (+${dmg} DMG, permanently).`);
    }
    if (tDef.onDeath?.frightenInRange && deathPos) {
      const scared = enemyCards(draft, deadOwner).filter(
        (e) => e.curHp > 0 && e.pos && chebyshev(e.pos, deathPos) <= 1,
      );
      for (const e of scared)
        applyStatus(draft, e, "FRIGHTEN", tDef.onDeath.frightenInRange, 0, tDef.element);
      if (scared.length) draft.log.push(`The dread of her passing drives ${scared.length} back.`);
    }
    // SHATTER: it bursts open as it dies and the burst catches whatever is
    // standing next to it. Placed with frightenInRange rather than inside the
    // block below because, like that one, it fires however the card died —
    // killing the crystal is not an escape from it.
    if (tDef.onDeath?.inRangeStatus && deathPos) {
      const st = tDef.onDeath.inRangeStatus;
      const caught = enemyCards(draft, deadOwner).filter(
        (e) => e.curHp > 0 && e.pos && chebyshev(e.pos, deathPos) <= 1,
      );
      for (const e of caught) applyStatus(draft, e, st.kind, st.duration, st.power, tDef.element);
      draft.log.push(caught.length
        ? `${tDef.name} bursts — ${st.kind} on ${caught.length} in range.`
        : `${tDef.name} bursts with nothing in range.`);
    }
    // On-death effects.
    if (tDef.onDeath && opts.kind !== "reflect") {
      // Pop (Florence): an immediate burst across the whole enemy board.
      if (tDef.onDeath.aoeDmg) {
        const foes = enemyCards(draft, deadOwner).filter((e) => e.curHp > 0);
        for (const e of foes) directDamage(draft, target, e, tDef.onDeath.aoeDmg, false);
        draft.log.push(`${tDef.name} pops — ${tDef.onDeath.aoeDmg} DMG to every opponent.`);
      }
      // Out with a Bang (Taper): scorch the enemy's far (home) row on the way out.
      if (tDef.onDeath.farRowStatus) {
        const fr = tDef.onDeath.farRowStatus;
        const home = homeRow(enemyOf(deadOwner), draft.boardSize);
        const back = enemyCards(draft, deadOwner).filter((e) => e.curHp > 0 && e.pos?.row === home);
        for (const e of back) applyStatus(draft, e, fr.kind, fr.duration, fr.power, tDef.element);
        if (back.length) draft.log.push(`${tDef.name} goes out with a bang — ${fr.kind} on ${back.length} far-row foe(s).`);
      }
      // Bird Bomb: a detonation, not a grudge. Everything the corpse could still
      // have reached takes the blast, whoever pulled the trigger — so a sniper
      // is safe only by standing outside the reach, not by being the killer.
      // Same reach rule as inRangeOnly below (king-move for Melee, RANGED_REACH
      // otherwise), measured from the slot it fell on.
      if (tDef.onDeath.inRangeDmg && deathPos) {
        const reach = tDef.attackType === "Melee" ? 1 : RANGED_REACH;
        const caught = enemyCards(draft, deadOwner).filter(
          (e) => e.curHp > 0 && e.pos && chebyshev(e.pos, deathPos) <= reach,
        );
        for (const e of caught)
          directDamage(draft, target, e, tDef.onDeath.inRangeDmg, Boolean(tDef.onDeath.pen));
        draft.log.push(
          caught.length
            ? `${tDef.name} goes off — ${tDef.onDeath.inRangeDmg} DMG to ${caught.length} in reach.`
            : `${tDef.name} goes off with nothing in reach.`,
        );
      }
      if (tDef.onDeath.rowAhead && deathPos) {
        // Burnout: blast the enemy row directly ahead of where it fell.
        onDeathRowAhead(draft, target, deadOwner, deathPos, tDef.onDeath.dmg, Boolean(tDef.onDeath.pen));
      } else if (attacker.curHp > 0) {
        // Lingering Venom (Widowbite): a melee grudge can't reach a killer who
        // never came close. Measured from the slot it fell on, using the dying
        // card's OWN reach, so a sniper walks away clean.
        const reachable =
          !tDef.onDeath.inRangeOnly ||
          (deathPos != null &&
            attacker.pos != null &&
            chebyshev(deathPos, attacker.pos) <=
              (tDef.attackType === "Melee" ? 1 : RANGED_REACH));
        if (reachable) {
          // Bird Bomb: retaliate on the killer directly. A venom carries no
          // impact damage, so only announce a hit when there is one.
          if (tDef.onDeath.dmg > 0) {
            draft.log.push(`${tDef.name} retaliates from the grave (${tDef.onDeath.dmg} DMG)!`);
            const r = resolveHit(draft, target, attacker, {
              kind: "reflect",
              dmg: tDef.onDeath.dmg,
              hits: 1,
              pen: Boolean(tDef.onDeath.pen),
              crit: false,
            });
            if (r.targetDied) result.attackerDied = true;
          }
          // The venom outlives the spider — applied even if the bite dealt 0.
          const ks = tDef.onDeath.killerStatus;
          if (ks && draft.cards[attacker.instanceId] && attacker.curHp > 0) {
            applyStatus(draft, attacker, ks.kind, ks.duration, ks.power, tDef.element);
            draft.log.push(
              `${tDef.name}'s venom lingers — ${label(draft, attacker)} takes ${ks.kind} ${ks.power} for ${ks.duration} rounds.`,
            );
          }
        }
      }
    } else if (hasElementAura(tDef, "DUSK") && opts.kind !== "reflect" && attacker.curHp > 0) {
      // Midnight Shade (DUSK aura): a dying card deals its FULL DMG back to the
      // killer. Only when the card has no stronger card-specific onDeath.
      //
      // A third, then a half, now all of it — see DUSK_SHADE_DEATH_DIVISOR for
      // the reasoning and for why the DODGE half of the aura stays capped. The
      // trade is legible at full: what a DUSK card hits for is what removing it
      // costs, readable off the card before committing to the swing.
      // At least 1 — a dying DUSK card always bites back, even a 0-DMG support.
      const back = Math.max(1, Math.floor(tDef.dmg / DUSK_SHADE_DEATH_DIVISOR));
      {
        draft.log.push(`${tDef.name} lashes out from the shadows (${back} DMG).`);
        // Telegraph on the KILLER, not the source: defeatCard has already
        // removed the dying card from state.cards, so there is nothing left on
        // the board to animate. The recoil on whoever landed the killing blow is
        // the only place this can be shown.
        attacker.fxRecoil = (attacker.fxRecoil ?? 0) + 1;
        const r = resolveHit(draft, target, attacker, { kind: "reflect", dmg: back, hits: 1, pen: false, crit: false });
        if (r.targetDied) result.attackerDied = true;
      }
    }
  }

  // Skelider Dismount: transform the first time it drops below its HP threshold.
  if (target.curHp > 0) checkLowHpTransform(draft, target);

  // Thorns: retaliate when a surviving card is struck. Melee-only by default;
  // `anyAttacker` cards answer shooters as well.
  if (
    opts.kind !== "reflect" &&
    result.landedHits > 0 &&
    target.curHp > 0 &&
    attacker.curHp > 0 &&
    (aDef.attackType === "Melee" || tDef.onHitByMelee?.anyAttacker) &&
    tDef.onHitByMelee
  ) {
    const r = applyOnHitByMelee(draft, target, attacker, tDef.onHitByMelee);
    if (r) result.attackerDied = true;
  }

  // Acorn Drop (Oak): a landed hit it takes sprouts a fresh Acorn — once per
  // round when `oncePerRound` is set, otherwise once per landed HIT (so a
  // multi-hit attacker used to sprout one per swing of the volley).
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && tDef.spawnOnHitTaken && target.pos) {
    const once = tDef.spawnOnHitTaken.oncePerRound;
    if (!once || !target.hitSpawnFiredRound) {
      if (once) target.hitSpawnFiredRound = true;
      spawnTokens(
        draft, target, tDef.spawnOnHitTaken.token,
        once ? tDef.spawnOnHitTaken.count : tDef.spawnOnHitTaken.count * result.landedHits,
      );
    }
  }

  // Electro Surge (Surge): being hit while armed discharges — PARALYZE the
  // attacker, deal damage back, and deactivate. Any attacker, once per charge.
  if (
    opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 &&
    tDef.electroSurge && target.electroSurgeActive
  ) {
    target.electroSurgeActive = false;
    if (attacker.curHp > 0 && draft.cards[attacker.instanceId]) {
      applyStatus(draft, attacker, "PARALYZE", tDef.electroSurge.paralyze, 0, tDef.element);
      draft.log.push(`${label(draft, target)}'s Electro Surge discharges — ${getDef(attacker.defId).name} is PARALYZED!`);
    }
  }

  // Pride Guardian (Monger): the first time each ally takes a hit, its guardian
  // throws it a shield. Once per ally for the game, tracked on the ally so two
  // guardians can't double up on the same teammate.
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && !target.guardedByPride) {
    const guardian = boardCards(draft, target.owner).find(
      (c) => c.instanceId !== target.instanceId && c.curHp > 0 && getDef(c.defId).onAllyHitShield,
    );
    if (guardian) {
      const n = getDef(guardian.defId).onAllyHitShield!;
      target.guardedByPride = true;
      target.curShields += n;
      draft.log.push(`${label(draft, guardian)} shields ${label(draft, target)} (+${n}).`);
    }
  }

  // Jelly Shock: a struck survivor discharges into the attacker AND everything
  // enemy standing next to it. Skipped for `reflect` hits — that's the kind
  // directDamage uses, so the discharge can't set off another discharge.
  // Wind Wake (Zephyra): every landed hit shoves the victim back a slot. Gated on
  // a real landed hit so a fully-dodged volley moves nobody.
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && aDef.onHitPush)
    pushBack(draft, target, aDef.onHitPush, attacker);
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && tDef.onHitZap) {
    if (applyOnHitZap(draft, target, attacker, tDef.onHitZap)) result.attackerDied = true;
  }
  // Gale Riposte: only a HEAVY blow gets answered, and the answer is ground
  // rather than damage. Same `reflect` exemption as the discharge above, so a
  // bounce cannot set off a second riposte.
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && tDef.onHeavyHit)
    applyHeavyHit(draft, target, tDef.onHeavyHit, result.totalToHp + result.totalShielded);

  // REFLECT — plain damage back through the attacker's BLOCK + shield gate.
  // No EVASION/CRIT/REFLECT on the bounce (no chains).
  if (reflectBack > 0 && attacker.curHp > 0) {
    draft.log.push(`${tDef.name} reflects ${reflectBack} back at ${aDef.name}.`);
    const r = resolveHit(draft, target, attacker, {
      kind: "reflect",
      dmg: reflectBack,
      hits: 1,
      pen: false,
      crit: false,
    });
    if (r.targetDied) result.attackerDied = true;
  }

  return result;
}

/**
 * A full basic attack: BLIND accuracy check, then the pipeline.
 * `target` may be one instanceId (full volley on it) or an ordered pick list —
 * one hit per entry, repeats stack ("dmg × N hits up to N targets").
 */
/** Ethereal Trade's self-cost: pay hpCost HP once per attack action (basic or an
 *  offensive Special). Can be lethal — the ghost strains itself. The +DMG half is
 *  applied in the damage path (basicAttack / barrage). */
export function payAttackTrade(draft: GameState, card: CardInstance): void {
  const def = getDef(card.defId);
  if (!def.attackTrade || !draft.cards[card.instanceId] || card.curHp <= 0) return;
  const cost = def.attackTrade.hpCost;
  if (cost <= 0) return;
  card.curHp -= cost;
  draft.log.push(`${label(draft, card)} pays ${cost} HP (Ethereal Trade).`);
  if (card.curHp <= 0) defeatCard(draft, card, "Ethereal Trade");
}

/** Cards currently mid auto-cast — a transient guard so an on-kill free-Special
 *  (FireFly's BlastOff) can't recurse into itself forever. */
const autoFiring = new Set<string>();

/** Fire a card's OWN Special for free (no magic cost, no targeting UI) — used by
 *  passives that auto-cast (Voltcher's High Voltage Sentry, Highroller's Jackpot,
 *  FireFly's BlastOff). */
export function fireCardSpecial(draft: GameState, card: CardInstance): void {
  const sp = getDef(card.defId).special;
  if (!sp) return;
  if (autoFiring.has(card.instanceId)) return; // re-entrancy guard (BlastOff)
  const handler = SPECIAL_HANDLERS[sp.handler];
  if (!handler) return;
  autoFiring.add(card.instanceId);
  try {
    fireCardSpecialInner(draft, card, sp, handler);
  } finally {
    autoFiring.delete(card.instanceId);
  }
}

function fireCardSpecialInner(
  draft: GameState,
  card: CardInstance,
  sp: NonNullable<CardDef["special"]>,
  handler: SpecialHandler,
): void {
  // ENEMY targets come through the SAME door as a manual cast.
  //
  // This used to hand the handler every living enemy on the board, which meant
  // `reach` did nothing at all on the auto-fire path — and the auto-fire path is
  // the only one a boss ever uses (its Special fires on `fireSpecialEveryN` and
  // `canFireSpecial` refuses a manual cast outright). Measured: a card FOUR
  // squares from Hoarfell took exactly the same 9 damage as one standing next to
  // it, and the same for Thunderfangs, Smolder, Rotroot and Vulcanyx. Every
  // "to every opponent within 2 spaces" on the tower was a board-wide nova
  // wearing a radius in its text.
  //
  // `validSpecialTargets` is what the manual path uses, so the two now agree —
  // and it reads `reach`, `ranged`, `chargeFirst` and the Home-Slot exemption
  // the same way the on-board preview does, which is what makes the telegraph
  // honest. Specials that really are board-wide say so themselves: Permafrost's
  // Whiteout declares `ranged`, Umbranova's Meteor Fall is `smite` and ignores
  // range by design.
  const targets = sp.targetSide === "enemy"
    ? validSpecialTargets(draft, card.instanceId)
    : sp.targetSide === "ally"
      ? boardCards(draft, card.owner).filter((a) => a.curHp > 0)
      : [];
  handler(draft, card, targets, sp.params ?? {});
}

export function basicAttack(
  draft: GameState,
  attackerId: string,
  target: string | string[],
  fromFollowup = false,
): AttackResult | null {
  const attacker = draft.cards[attackerId];
  if (!attacker) return null;
  const picks = Array.isArray(target) ? target : [target];
  if (picks.length === 0) return null;
  const aDef = getDef(attacker.defId);
  attacker.attackedThisRound = true; // STEALTH breaks even on a miss
  // Spend a pocketed ranged shot — but ONLY if the shot is what reached.
  //
  // It used to spend on any basic at all, which meant charging Surge and then
  // hitting the card standing next to it burned the charge on a swing that
  // needed no reach whatsoever: no extra damage, no message, and the shot you
  // were saving for something across the board was simply gone. The card
  // promises "its next attack strikes at RANGE"; an attack already inside melee
  // reach is not that attack.
  //
  // Asked of the rule rather than re-derived here, so FLYING, the sight screen
  // and the Home-slot rule all get their say: could this target have been
  // picked WITHOUT the stored shot? The shot is set aside for the question and
  // put straight back — `canTarget` reads `rangedShotsLeft` to decide whether
  // this basic counts as ranged, so it is the one honest way to ask.
  //
  // Spent on the ATTEMPT, not the hit: it was already loosed by the time
  // anything rolled to dodge, and refunding a miss would quietly make the grant
  // unlimited against an evasive target. `fromFollowup` volleys are riders on
  // an attack that already paid, so they never spend a second one.
  if (!fromFollowup && (attacker.rangedShotsLeft ?? 0) > 0) {
    const stored = attacker.rangedShotsLeft ?? 0;
    attacker.rangedShotsLeft = 0;
    const meleeAlone = picks.every((id) => {
      const t = draft.cards[id];
      return t != null && canTarget(draft, attacker, t, false, true);
    });
    attacker.rangedShotsLeft = stored;
    if (!meleeAlone) {
      attacker.rangedShotsLeft = stored - 1;
      draft.log.push(`${label(draft, attacker)} looses its stored charge from range.`);
    }
  }

  // Morning Dew (Vernal): aimed at an ALLY, the basic is a heal for its DMG —
  // no hit roll, no statuses, no riders. Checked before anything else so none of
  // the combat machinery below ever sees a friendly target.
  if (aDef.basicHealsAllies) {
    const first = draft.cards[picks[0]];
    if (first && first.owner === attacker.owner && first.instanceId !== attackerId) {
      const healed = healCard(draft, first, effectiveDmg(draft, attacker), attacker.owner);
      draft.log.push(`${label(draft, attacker)} tends ${label(draft, first)} (+${healed} HP).`);
      return { landedHits: 0, dodgedHits: 0, totalToHp: 0, totalShielded: 0, targetDied: false, attackerDied: false };
    }
  }

  const missed: AttackResult = {
    landedHits: 0, dodgedHits: 0, totalToHp: 0, totalShielded: 0, targetDied: false, attackerDied: false,
  };
  // (BLIND accuracy is rolled per hit inside resolveHit now.)
  // PARALYZE: 50% chance to attack at all.
  if (hasStatus(attacker, "PARALYZE") && !chance(draft, 50)) {
    draft.log.push(`${label(draft, attacker)} is paralyzed and can't attack.`);
    // Say so ON THE CARD as well. This was a log line and nothing else: the
    // turn simply produced no numbers, which reads as a bug rather than as the
    // coin PARALYZE is. Cosmetic only — the return below is the behaviour.
    attacker.fxParalyzed = (attacker.fxParalyzed ?? 0) + 1;
    return missed;
  }

  // Allocate the volley: one pick takes every hit (incl. permanent on-kill hit
  // bonuses); multiple picks take one hit each (consecutive repeats of the same
  // target merge into one gated volley).
  const groups: { targetId: string; hits: number }[] = [];
  if (picks.length === 1) {
    groups.push({ targetId: picks[0], hits: effectiveBasicHits(attacker) });
  } else {
    for (const id of picks) {
      const last = groups[groups.length - 1];
      if (last && last.targetId === id) last.hits++;
      else groups.push({ targetId: id, hits: 1 });
    }
  }

  // Boon Striker (Sticks): a one-shot, statusless flat DMG penalty on this
  // attack, consumed here so it never lingers.
  let atkDebuff = attacker.nextAttackDmgDebuff ?? 0;
  if (atkDebuff) attacker.nextAttackDmgDebuff = undefined;

  const agg: AttackResult = { ...missed };
  for (const g of groups) {
    const t = draft.cards[g.targetId];
    if (!t || attacker.curHp <= 0) continue; // target fell / attacker died to REFLECT

    // Conditional keyword vs the target's status (Gnashing Bite, Precision
    // Strike, etc.): fold into this group's hit options.
    // A loaded ambush replaces the printed damage outright (Dirt Driller's 6×2).
    let dmg = attacker.loadedStrike ? attacker.loadedStrike.dmg : effectiveDmg(draft, attacker);
    // Prism's Enchantment: spent by THIS swing, whoever is carrying it. Cleared
    // up front so a mid-volley death or a re-entrant call can't spend it twice.
    const ench = attacker.enchant;
    if (ench) {
      attacker.enchant = undefined;
      // Burning is a DOT rider now (applied on the landed hit below), not flat
      // damage — only Sharpen touches the swing's number.
      if (ench === "sharpen") dmg += 5;
      draft.log.push(`${label(draft, attacker)}'s weapon flares — ${ench}.`);
    }
    if (atkDebuff) { dmg = Math.max(0, dmg - atkDebuff); atkDebuff = 0; } // Boon Striker, once
    let crit = Boolean(aDef.keywords.CRIT);
    // Hastened Assault (WolfBane): CRIT only while faster than the target.
    if (aDef.critIfFaster && effectiveSp(draft, attacker) > effectiveSp(draft, t)) crit = true;
    // Mark of Hoax: any basic against a marked target is crit-eligible (the
    // guarantee — skipping the coin — is enforced in resolveHit).
    if (t.hoaxMarked) crit = true;
    let lifesteal = false;
    let vsPen = false; // Stingray's Piercing Pulse — PEN vs an Electrified foe
    let healOnHit = 0;
    const vs = aDef.vsStatus;
    const vsMatch = vs != null && (
      vs.bloodfire ? isBloodfire(t) :
      vs.anyStatus ? t.statuses.length > 0 :
      hasStatus(t, vs.status)
    );
    // Damage AMPLIFIERS do not compound — the largest applicable one applies and
    // the rest are ignored.
    //
    // They used to multiply in sequence, which is only invisible while no card
    // carries two. Two do. Dynomight's Explosive Power is printed as "2x vs a
    // shielded target OR vs a Warrior/Tank" and was quietly dealing 4x to a
    // shielded Tank; Firecrack pairs Bloodfire Detonator with Shell Cracker and
    // reached 4x — 20 off a 2-cost body — against a bleeding, burning, shielded
    // target. Taking the best rather than the product is one rule for both, and
    // it is the rule the cards were written to.
    //
    // Computed here, at the point vsStatus used to multiply, so the two cards
    // with only ONE amplifier (Dunewraith, Kimberlite) and the one card pairing
    // a multiplier with the Rager PENALTY (Twins) keep their exact arithmetic —
    // penalties are not amplifiers and stay where they are, below.
    let amp = 1;
    // Boomer: base damage the first time it strikes a given target, then a
    // doubled detonation on every strike after. The bookkeeping runs whether or
    // not this ends up being the winning multiplier. (No card ships with this
    // today; kept wired so it behaves if one does.)
    if (aDef.boomer) {
      attacker.boomerStruck ??= [];
      if (attacker.boomerStruck.includes(t.instanceId)) amp = Math.max(amp, 2);
      else attacker.boomerStruck.push(t.instanceId);
    }
    // Diamond's Edge (Kimberlite) / Shell Cracker (Firecrack): harder into armour.
    if (aDef.bonusVsShield && t.curShields > 0) amp = Math.max(amp, aDef.bonusVsShield);
    // Explosive Power (Dynomight): harder into a listed cardClass.
    if (aDef.bonusVsClass && aDef.bonusVsClass.classes.includes(getDef(t.defId).cardClass))
      amp = Math.max(amp, aDef.bonusVsClass.mult);
    if (vs && vsMatch) {
      if (vs.dmgMult) amp = Math.max(amp, vs.dmgMult);
      if (vs.crit) crit = true;
      if (vs.lifesteal) lifesteal = true;
      if (vs.pen) vsPen = true;
      healOnHit = vs.healOnHit ?? 0;
    }
    if (amp !== 1) dmg = Math.floor(dmg * amp);
    // vsStatus's flat bonus is added AFTER its multiplier, exactly as before.
    if (vs && vsMatch && vs.bonusDmg) dmg += vs.bonusDmg;
    // DEEP FREEZE: the longer the target has been held, the harder this lands.
    // Reads the VICTIM's frozenRounds, which Cleanup keeps and a broken freeze
    // resets, so the counter is the fight rather than a stat.
    const ramp = aDef.vsFrozenRamp;
    if (ramp && hasStatus(t, "FREEZE"))
      dmg += Math.min(ramp.max, ramp.per * (t.frozenRounds ?? 0));
    // Dragon's Bane: the same shape as vsStatus above, but matched on the
    // target's tribe / size rather than a status it happens to be carrying.
    if (aDef.vsTarget?.bonusDmg && matchesVsTarget(aDef, t)) dmg += aDef.vsTarget.bonusDmg;
    // Electrify (BOLT aura): bonus DMG vs any statused opponent, plus Power
    // Grid's field bonus. See BOLT_VS_STATUS_DMG for why this came back down
    // from 2 — with the self-enabling half below, the rider is on for every
    // hit after the first, so it is base damage wearing a condition.
    if (hasElementAura(aDef, "BOLT") && t.statuses.length > 0) {
      dmg += BOLT_VS_STATUS_DMG + fieldBonus(draft, attacker, "electrify");
    }
    // Harsh Winds / Shadow: bonus DMG the first time this card strikes a given
    // opponent. Squall's version only counts while it stands on the enemy side.
    const fsEligible = Boolean(aDef.firstStrikeBonus) && (!aDef.firstStrikeEnemySideOnly || onEnemySide(attacker, draft.boardSize));
    const firstStrike = fsEligible && !attacker.struckEver.includes(t.instanceId);
    if (firstStrike) dmg += aDef.firstStrikeBonus!;
    // Ethereal Trade: +DMG on the attack (the HP cost is paid once per action).
    if (aDef.attackTrade) dmg += aDef.attackTrade.bonusDmg;
    // Rager (Twins): a rage downside — while below the HP line, DMG is halved.
    if (aDef.weakBelowHp && attacker.curHp < aDef.weakBelowHp.hp)
      dmg = Math.floor(dmg * aDef.weakBelowHp.dmgMult);

    // Boomer / Diamond's Edge / Explosive Power used to each multiply here, in
    // sequence. They are folded into the single `amp` above so two of them on
    // one card can no longer compound.
    const struckBefore = attacker.struckThisRound[t.instanceId] ?? 0;
    const r = resolveHit(draft, attacker, t, {
      kind: "basic",
      dmg,
      hits: g.hits,
      pen: Boolean(aDef.keywords.PEN) || auraHasPen(draft, attacker) || vsPen ||
        // A timed buff can carry PEN for its duration (Ariel's 100,000°).
        (attacker.buffs ?? []).some((b) => b.pen) ||
        Boolean(aDef.penWhileAlly && boardCards(draft, attacker.owner).some((a) => a.curHp > 0 && aDef.penWhileAlly!.includes(getDef(a.defId).id))), // Overcharge (Volta)
      crit,
      lifesteal,
      incinerate: aDef.incinerate, // Sol: consecutive same-target hits ramp +1
      incinerateBase: struckBefore,
    });
    if (r.landedHits > 0) {
      // The two enchantments that ride the TARGET rather than the damage. Only
      // on a landed hit — an enchanted swing that whiffs still spends the
      // charge (it was consumed above) but lands nothing, which is the same
      // deal every other on-hit rider gets.
      if (ench === "freezing" && t.curHp > 0) applyTimedBuff(t, 0, -5, 2);
      if (ench === "burning" && t.curHp > 0)
        applyStatus(draft, t, "DOT", 2, 2, getDef(attacker.defId).element); // 2 DOT for 2 rounds
      if (ench === "sleeping" && t.curHp > 0)
        applyStatus(draft, t, "SLEEP", 1, 0, getDef(attacker.defId).element);
      attacker.struckThisRound[t.instanceId] = struckBefore + r.landedHits;
      if (firstStrike) attacker.struckEver.push(t.instanceId);
      applyOnHitRider(draft, attacker, t, struckBefore, r.landedHits);
      // Spread (Weeds): a landed basic may put another body up beside this one.
      // Rolled ONCE per attack rather than per hit — a multi-hit carrier would
      // otherwise get several rolls off one action — and only on a hit that
      // actually landed, so a whiffed or fully-dodged swing spreads nothing.
      const spread = aDef.onHitSpawn;
      if (spread && r.landedHits > 0) {
        const already = attacker.spawnedOnHit ?? 0;
        if (already < spread.max && pctChance(draft, spread.chance)) {
          const born = spawnTokens(draft, attacker, spread.token, 1);
          if (born.length) {
            attacker.spawnedOnHit = already + 1;
            // Sterile: the copy's counter starts spent, so a 15% roll cannot
            // compound generation on generation into a board full of them.
            for (const b of born) b.spawnedOnHit = spread.max;
            draft.log.push(`${label(draft, attacker)} spreads — another ${getDef(spread.token).name} takes root.`);
          }
        }
      }
      // Scorch (PYRO aura): every basic feeds the fire. A fresh target catches
      // BURN 1; one already burning has its BURN STACK by 1, up to the cap.
      //
      // It used to skip a target that already had BURN entirely, so PYRO's own
      // repeat attacks — and its card-specific BURN riders — did nothing for
      // each other. Stacking ADDS to whatever is there rather than replacing it,
      // so a stronger card BURN is still never overwritten, only built on.
      if (hasElementAura(aDef, "PYRO") && t.curHp > 0) {
        const burning = t.statuses.find((x) => x.kind === "BURN");
        if (!burning) applyStatus(draft, t, "BURN", PYRO_BURN_DURATION, 1, "PYRO");
        else if (burning.power < PYRO_BURN_STACK_CAP) {
          burning.power += 1;
          // REFRESHED to the full duration, not merely kept alive at 1. Stacking
          // a burn that is about to expire and leaving it about to expire is
          // most of why Scorch did nothing once the attacker stopped swinging.
          burning.duration = Math.max(burning.duration, PYRO_BURN_DURATION);
          draft.log.push(`${label(draft, t)}'s burn deepens (BURN ${burning.power}).`);
        }
      }
      // Electrify (BOLT aura), second half: a basic hit leaves the target
      // ELECTRIFIED, so the aura SETS UP its own payoff instead of waiting on
      // another card to apply a status first.
      //
      // BOLT measured worst on offence despite the SECOND-best printed damage
      // per cost, which is the same shape LEAF had: the cards were fine, the
      // aura was not. +1 DMG "vs a statused opponent" did nothing on the opening
      // hit of any exchange, and PYRO's equivalent has always done its own
      // setup. Applied only when the target carries NO status yet, so it never
      // overwrites a real debuff with an inert marker.
      if (hasElementAura(aDef, "BOLT") && t.curHp > 0 && t.statuses.length === 0) {
        applyStatus(draft, t, "ELECTRIFIED", 1, 0, "BOLT");
      }
      // Magic Potion (Hexvial): a landed basic hurls a random flask at the target.
      if (aDef.potionOnHit && t.curHp > 0 && draft.cards[t.instanceId]) {
        const roll = randInt(draft, 3);
        if (roll === 0) {
          applyStatus(draft, t, "DOT", 2, 1, aDef.element);
          draft.log.push(`${label(draft, attacker)}'s potion splashes poison (DOT 1).`);
        } else if (roll === 1) {
          draft.log.push(`${label(draft, attacker)}'s potion bursts for 3.`);
          if (directDamage(draft, attacker, t, 3, false)) agg.targetDied = true;
        } else {
          applyStatus(draft, t, "FRIGHTEN", 2, 0, aDef.element);
          draft.log.push(`${label(draft, attacker)}'s potion terrifies (FRIGHTEN 2).`);
        }
      }
      if (healOnHit > 0 && attacker.curHp > 0) healCard(draft, attacker, healOnHit, attacker);
      // Raising Star (Star): a landed basic bathes the whole team in light.
      if (aDef.basicHealsTeam) {
        for (const a of boardCards(draft, attacker.owner)) if (a.curHp > 0) healCard(draft, a, aDef.basicHealsTeam, attacker);
      }
      // Liquification (Bahari): flat heal per landed basic hit.
      if (aDef.healPerHit && attacker.curHp > 0) healCard(draft, attacker, aDef.healPerHit * r.landedHits, attacker);
      // Brutal (Brute): a CRIT saps the target's own attacks for the round.
      if (aDef.onCritDebuff && r.critHits && t.curHp > 0) applyTimedBuff(t, -aDef.onCritDebuff, 0, 1);
      // Hastened Assault: heal per critical hit landed.
      if (aDef.healPerCrit && r.critHits && attacker.curHp > 0) {
        const h = healCard(draft, attacker, aDef.healPerCrit * r.critHits, attacker);
        if (h > 0) draft.log.push(`${label(draft, attacker)} feeds on the frenzy (+${h} HP).`);
      }
      // Twin Strike (Twinbolt): a CRIT chains a bonus CRIT strike at the same target,
      // once per round. Set the guard BEFORE the follow-up so it can't recurse.
      if (aDef.onCritBonus && r.critHits && !attacker.twinStrikeFiredRound &&
          attacker.curHp > 0 && t.curHp > 0 && draft.cards[t.instanceId]) {
        attacker.twinStrikeFiredRound = true;
        draft.log.push(`${label(draft, attacker)}'s Twin Strike chains a bonus volley!`);
        resolveHit(draft, attacker, t, {
          kind: "special", dmg: aDef.onCritBonus.dmg, hits: aDef.onCritBonus.hits, pen: false, crit: true,
        });
      }
    }
    agg.landedHits += r.landedHits;
    agg.dodgedHits += r.dodgedHits;
    agg.totalToHp += r.totalToHp;
    agg.critHits = (agg.critHits ?? 0) + (r.critHits ?? 0);
    agg.targetDied = agg.targetDied || r.targetDied;
    agg.attackerDied = agg.attackerDied || r.attackerDied;
  }

  // Dunewraith's Nightmare: a flat bonus added ONCE after the volley resolves (not
  // per hit), landing on the primary target.
  const bonus = aDef.basicBonus;
  if (bonus && agg.landedHits > 0 && attacker.curHp > 0) {
    const primary = draft.cards[groups[0].targetId];
    let extra = 0;
    if (bonus.flat) extra += bonus.flat; // Quartz Hound: an added 2-DMG strike
    if (bonus.midLane && attacker.pos && isMidRow(attacker.pos.row)) extra += bonus.midLane;
    if (bonus.midLaneFull && boardCards(draft).filter((c) => c.pos && isMidRow(c.pos.row)).length >= 4)
      extra += bonus.midLaneFull;
    if (bonus.vsSleeping && primary && hasStatus(primary, "SLEEP")) extra += bonus.vsSleeping;
    if (extra > 0 && primary && primary.curHp > 0) {
      draft.log.push(`${label(draft, attacker)}'s nightmare deals +${extra} bonus damage.`);
      if (directDamage(draft, attacker, primary, extra, false)) agg.targetDied = true;
    }
  }
  // Flaming Slasher: a status riding the next few attacks. Spent per ATTACK, not
  // per hit, and only when something actually landed.
  const lit = attacker.loadedOnHit;
  if (lit && agg.landedHits > 0) {
    for (const g of groups) {
      const t = draft.cards[g.targetId];
      if (t && t.curHp > 0) applyStatus(draft, t, lit.kind, lit.duration, lit.power, aDef.element);
    }
    lit.attacks -= 1;
    if (lit.attacks <= 0) attacker.loadedOnHit = undefined;
  }
  attacker.loadedHits = 0; // loaded darts are spent on this attack (Bleed Out)
  // Lurk (Liquark): breaking cover to swing ends the STEALTH (and its +DMG/+SP).
  if (getDef(attacker.defId).lurk)
    attacker.statuses = attacker.statuses.filter((s) => s.kind !== "STEALTH");
  // Dirt Driller: the ambush is spent, and breaking cover ends the STEALTH that
  // set it up — "until next attack" is literal.
  if (attacker.loadedStrike) {
    attacker.loadedStrike = undefined;
    attacker.statuses = attacker.statuses.filter((s) => s.kind !== "STEALTH");
  }
  // Bad Temper (Volcanon) / Rager Twins: a landed basic attack permanently grows
  // the attacker's DMG.
  const osb = aDef.onHitSelfBuff;
  if (osb && agg.landedHits > 0 && attacker.curHp > 0) {
    const gain = cappedSelfGrowth(attacker, osb.dmg);
    if (gain > 0) {
      attacker.dmgBonus += gain;
      draft.log.push(`${label(draft, attacker)}'s temper flares (+${gain} DMG).`);
    } else if (osb.max != null) {
      draft.log.push(`${label(draft, attacker)}'s temper is already at its peak (+${osb.max}).`);
    }
  }
  // Volcanic Fury (Valcana): a landed basic ramps DMG that her Special resets.
  if (aDef.onHitRampUntilSpecial && agg.landedHits > 0 && attacker.curHp > 0) {
    attacker.rampDmg = (attacker.rampDmg ?? 0) + aDef.onHitRampUntilSpecial;
    draft.log.push(`${label(draft, attacker)}'s Volcanic Fury builds (+${aDef.onHitRampUntilSpecial} DMG until Special).`);
  }
  // Sky Scout (Sightwing): while the owner's scout buff is up, a single-target
  // basic also clips ONE enemy adjacent to the primary target. Not for the
  // follow-up shots themselves (no chains).
  // A team splash aura: a living ally holder grants the whole side the extra
  // adjacent target, standing (no timer).
  //
  // Blinding Star used to cancel this. It no longer does — the aura is a flat
  // accuracy penalty now (see BLINDING_STAR_MISS_PCT), which costs a splashing
  // attacker its extra target on the same roll that costs it the primary hit.
  // Nothing else in the game answers a splash aura, so this is a real, if
  // narrow, loss: Supernova was the only counter to Totem Spirit and Downpour.
  //
  // Two strengths. `true` is a second FULL basic hit (Totem Spirit); a number is
  // a flat chip (Cloudburst's Downpour). The strongest source on the board wins,
  // and the timed team buff from a spell counts as full — it is bought for a
  // round, so it should not be quietly downgraded by a 1-damage aura standing
  // next to it.
  const auraHolders = boardCards(draft, attacker.owner)
    .filter((a) => a.curHp > 0 && getDef(a.defId).splashAura);
  const timedSplash = (draft.players[attacker.owner].basicSplashRounds ?? 0) > 0;
  const auraFull = timedSplash || auraHolders.some((a) => getDef(a.defId).splashAura === true);
  const auraFlat = auraHolders.reduce((best, a) => {
    const v = getDef(a.defId).splashAura;
    return typeof v === "number" && v > best ? v : best;
  }, 0);
  if (
    !fromFollowup && agg.landedHits > 0 && attacker.curHp > 0 &&
    (auraFull || auraFlat > 0)
  ) {
    const primary = draft.cards[groups[0]?.targetId];
    if (primary?.pos) {
      const neighbours = enemyCards(draft, attacker.owner).filter(
        (e) => e.curHp > 0 && e.instanceId !== primary.instanceId && e.pos != null && chebyshev(e.pos, primary.pos!) <= 1,
      );
      // Which holder is actually granting this decides both the log name and
      // whether the storm covers the whole neighbourhood. This used to read
      // "(Sky Scout)" for every source — Sightwing's passive, unrelated to any
      // of them.
      const src = auraHolders.find((a) =>
        auraFull ? getDef(a.defId).splashAura === true : typeof getDef(a.defId).splashAura === "number");
      const srcName = src ? getDef(src.defId).passiveNames?.splashAura ?? getDef(src.defId).name : "a team aura";
      const hit = src && getDef(src.defId).splashAll ? neighbours : neighbours.slice(0, 1);
      for (const splash of hit) {
        if (!draft.cards[splash.instanceId] || splash.curHp <= 0) continue;
        resolveHit(draft, attacker, splash, {
          kind: "basic",
          dmg: auraFull ? effectiveDmg(draft, attacker) : auraFlat,
          hits: 1, pen: false, crit: false,
        });
        draft.log.push(`${label(draft, attacker)}'s shot clips ${label(draft, splash)} (${srcName}).`);
      }
    }
  }
  // Flying Arrow (Ollie): an allied Ollie standing directly AHEAD of this
  // attacker looses its own shot at the same target — the bird takes its cue
  // from the ally BEHIND it, so it screens forward rather than trailing.
  // Guarded so a follow-up can't chain.
  if (!fromFollowup && agg.landedHits > 0 && attacker.pos) {
    const primary = draft.cards[groups[0]?.targetId];
    if (primary && primary.curHp > 0) {
      const archers = boardCards(draft, attacker.owner).filter(
        (a) =>
          a.instanceId !== attacker.instanceId && a.curHp > 0 && getDef(a.defId).flyingArrow &&
          a.pos != null && attacker.pos != null && a.pos.col === attacker.pos.col &&
          rowAhead(attacker.owner, attacker.pos.row) === a.pos.row,
      );
      for (const archer of archers) {
        if (primary.curHp > 0 && draft.cards[primary.instanceId])
          basicAttack(draft, archer.instanceId, primary.instanceId, true);
      }
    }
  }
  // High Voltage Sentry (Voltcher): the first landed hit auto-fires Thunderbird.
  if (aDef.firePassiveSpecial?.onFirstHit && !attacker.autoSpecialFired && agg.landedHits > 0 && attacker.curHp > 0) {
    attacker.autoSpecialFired = true;
    draft.log.push(`${label(draft, attacker)}'s High Voltage Sentry triggers Thunderbird!`);
    fireCardSpecial(draft, attacker);
  }
  // Jackpot (Highroller): a BASIC crit auto-fires Purple Strikes for free. The crit
  // STREAK (incl. the crits Purple Strikes then rolls) is tallied in resolveHit,
  // so it can loop into the bonus. Fires the Special only on basic crits, so a
  // Purple Strikes crit can't recast itself.
  if (aDef.jackpot && (agg.critHits ?? 0) > 0 && attacker.curHp > 0) {
    draft.log.push(`${label(draft, attacker)} hits the Jackpot — Purple Strikes fires free!`);
    fireCardSpecial(draft, attacker);
  }
  // Rainstorm (Cloudburst): a landed basic splashes onto one enemy adjacent to the
  // primary target.
  if (aDef.basicSplash && agg.landedHits > 0 && attacker.curHp > 0) {
    const primary = draft.cards[groups[0]?.targetId];
    if (primary?.pos) {
      const neighbours = enemyCards(draft, attacker.owner).filter(
        (e) => e.curHp > 0 && e.instanceId !== primary.instanceId && e.pos != null && chebyshev(e.pos, primary.pos!) <= 1,
      );
      for (const splash of aDef.splashAll ? neighbours : neighbours.slice(0, 1)) {
        if (!draft.cards[splash.instanceId] || splash.curHp <= 0) continue;
        directDamage(draft, attacker, splash, aDef.basicSplash, false);
      }
    }
  }
  // Shatter (Coilblade): a landed hit on a FROZEN target cracks the ice — splash
  // to every enemy adjacent to it.
  if (aDef.shatterFrozen && agg.landedHits > 0 && attacker.curHp > 0) {
    const primary = draft.cards[groups[0]?.targetId];
    if (primary?.pos && hasStatus(primary, "FREEZE")) {
      let hit = 0;
      for (const e of enemyCards(draft, attacker.owner))
        if (e.curHp > 0 && e.instanceId !== primary.instanceId && e.pos && chebyshev(e.pos, primary.pos) <= 1) {
          directDamage(draft, attacker, e, aDef.shatterFrozen, false); hit++;
        }
      if (hit) draft.log.push(`${label(draft, attacker)} shatters the ice — ${aDef.shatterFrozen} to ${hit} nearby.`);
    }
  }
  // Mega Push (Megair): a desperation nova while it's nearly dead.
  if (aDef.lowHpNova && agg.landedHits > 0 && attacker.curHp > 0 && attacker.curHp < aDef.lowHpNova.belowHp) {
    const foes = enemyCards(draft, attacker.owner).filter((e) => e.curHp > 0);
    for (const e of foes) directDamage(draft, attacker, e, aDef.lowHpNova.dmg, false);
    for (const e of foes) pushBack(draft, e, aDef.lowHpNova.push, attacker);
    if (foes.length) draft.log.push(`${label(draft, attacker)} unleashes Mega Push (${aDef.lowHpNova.dmg} + knockback to all).`);
  }
  // Harpoon Hook (Harp) / Sucker Sword (Octoirate): reel each struck enemy in
  // toward the attacker. Only when something landed and the attacker is still
  // standing; allies (Morning-Dew-style friendly aims) are never dragged.
  if (aDef.pullOnAttack && agg.landedHits > 0 && attacker.curHp > 0) {
    const seen = new Set<string>();
    for (const g of groups) {
      if (seen.has(g.targetId)) continue;
      seen.add(g.targetId);
      const t = draft.cards[g.targetId];
      if (t && t.curHp > 0 && t.owner !== attacker.owner) pullToward(draft, t, aDef.pullOnAttack, attacker.owner);
    }
  }
  // Rolling Start (Rumbler): the boulder keeps rolling — every basic carries it a
  // slot further toward the enemy home. Skipped for a follow-up shot so a chained
  // attack can't double-roll it, and chargeForward already stops at a body, a
  // captured slot or the board edge.
  if (aDef.advanceOnBasic && !fromFollowup && attacker.curHp > 0 && attacker.pos)
    chargeForward(draft, attacker, aDef.advanceOnBasic);
  return agg;
}

/** Apply a card's basic-attack status rider, honoring the printed gating
 *  (chance %, first-hit-only, on-second-hit). `struckBefore` = hits landed on
 *  this target earlier in the round; `landedNow` = hits from this attack. */
function applyOnHitRider(
  draft: GameState,
  attacker: CardInstance,
  target: CardInstance,
  struckBefore: number,
  landedNow: number,
): void {
  const rider = getDef(attacker.defId).onHitStatus;
  if (!rider || target.curHp <= 0 || !draft.cards[target.instanceId]) return;
  if (rider.firstHitOnly && struckBefore > 0) return; // already struck this round
  if (rider.onSecondHit && struckBefore + landedNow < 2) return; // needs the 2nd hit
  if (rider.chance != null && !pctChance(draft, rider.chance)) return;
  const el = getDef(attacker.defId).element;
  if (rider.stack)
    // A STACKING rider deepens once PER LANDED HIT, not once per attack. This
    // hook fires a single time for the whole volley, so a 4-hit card like
    // Stickers was building exactly as much wound as a 1-hit one — its four
    // jabs left BLEED 1 between them. Only Thorn and Stickers stack, and Thorn
    // is single-hit, so this is a no-op everywhere but the card it was for.
    stackStatus(draft, target, rider.kind, rider.duration, rider.power * landedNow, rider.stackCap ?? 99, el);
  else applyStatus(draft, target, rider.kind, rider.duration, rider.power, el);
}

// ── special-handler registry ────────────────────────────────────────────────
// Adding a new special = a data entry in cards.ts + (only if it's a genuinely
// new kind of effect) one handler here. Handlers receive validated targets.

export type SpecialHandler = (
  draft: GameState,
  attacker: CardInstance,
  targets: CardInstance[], // pre-validated by rules.ts; [0] = chosen target
  params: Record<string, number | string>,
) => void;

function num(params: Record<string, number | string>, key: string, fallback = 0): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

/** Is `target` what this card is built to hunt? (Drakonbane's Dragon's Bane.)
 *  Shared by the basic-attack bonus, the Special's damage split, and the
 *  on-summon ambush, so the three can never disagree about what counts. */
export function matchesVsTarget(def: CardDef, target: CardInstance): boolean {
  const vt = def.vsTarget;
  if (!vt) return false;
  const tDef = getDef(target.defId);
  if (vt.tribe != null) {
    const tribe = tDef.tribe;
    const has = Array.isArray(tribe) ? tribe.includes(vt.tribe) : tribe === vt.tribe;
    if (has) return true;
  }
  if (vt.maxHpFrom != null && target.maxHp >= vt.maxHpFrom) return true;
  return false;
}

/** Does a card carry `tribe`? Cards may hold several (Ravven is Dark AND
 *  Avian), so this has to handle both shapes. */
/** Contagion: a dying Zombie sprays every adjacent opponent. */
export const CONTAGION_SPLASH = 2;

/** Raise tokens, but never past a standing-count ceiling.
 *
 *  `spawnMaxAlive` already leashes the round-tick spawn and the onOppSummon one
 *  (phases.ts); this is the same ceiling for the SPECIAL paths, which are the
 *  ones that repeat on a cooldown and so compound hardest. Buzzard is the
 *  cautionary tale the field was invented for — "one a round across a fifteen
 *  round match is fifteen drones, and the only way one leaves the board is by
 *  dying" — and a repeatable Special is that with fewer steps.
 *
 *  Counts LIVING tokens of this id on the caster's side, so the ceiling is a
 *  STOCK and not a per-game allowance: kill one and the next cast refills it,
 *  which keeps the answer to a swarm being "clear it" rather than "wait". */
function spawnCapped(
  draft: GameState,
  attacker: CardInstance,
  token: string,
  count: number,
  radius: number | undefined,
  maxAlive: number,
): void {
  let want = count;
  if (maxAlive !== Infinity) {
    const alive = boardCards(draft, attacker.owner)
      .filter((c) => c.curHp > 0 && c.defId === token).length;
    want = Math.max(0, Math.min(want, maxAlive - alive));
    if (want === 0) {
      draft.log.push(`${label(draft, attacker)} — its brood is already at full strength.`);
      return;
    }
  }
  if (want > 0) spawnTokens(draft, attacker, token, want, radius);
}

function tribeOf(card: CardInstance, tribe: string): boolean {
  const t = getDef(card.defId).tribe;
  return Array.isArray(t) ? t.includes(tribe) : t === tribe;
}

/** Apply a status that STACKS its power onto an existing one of the same kind
 *  (capped) instead of replacing it — Thorn's cumulative BLEED. Duration is
 *  refreshed to the longer of the two. Falls back to a plain apply when nothing
 *  is there yet. */
function stackStatus(
  draft: GameState,
  target: CardInstance,
  kind: StatusKind,
  duration: number,
  power: number,
  cap: number,
  element: Element,
): void {
  const existing = target.statuses.find((st) => st.kind === kind);
  if (existing) {
    existing.power = Math.min(cap, existing.power + power);
    existing.duration = Math.max(existing.duration, duration);
    draft.log.push(`${label(draft, target)}'s ${kind} deepens (${kind} ${existing.power}).`);
  } else {
    applyStatus(draft, target, kind, duration, power, element);
  }
}

function maybeStatus(
  draft: GameState,
  attacker: CardInstance,
  target: CardInstance,
  params: Record<string, number | string>,
): void {
  const kind = params.statusKind as StatusKind | undefined;
  if (!kind || target.curHp <= 0 || !draft.cards[target.instanceId]) return;
  // statusChance (Ice Wall's Rapid Shot / Frostbite): the status only lands on a
  // roll — each hit gets its own independent chance. Absent = always applies.
  const chance = num(params, "statusChance");
  if (chance > 0 && !pctChance(draft, chance)) return;
  const el = getDef(attacker.defId).element;
  // statusStack (Thorn's Blood on the Petals): the Special's BLEED stacks too,
  // so a basic-stacked wound isn't reset when the sweep re-fires.
  if (num(params, "statusStack") > 0) {
    stackStatus(draft, target, kind, num(params, "statusDuration", 1), num(params, "statusPower", 0), num(params, "statusStackCap", 99), el);
    return;
  }
  // statusRoundsStack (PolarBear's Ice Crash Claw): the ROUNDS add up when one
  // target eats more than one strike of the same volley — two claws on one body
  // is four rounds frozen, not two rounds applied twice.
  //
  // Deliberately NOT stackStatus, which deepens a DOT's POWER (Thorn's BLEED)
  // and keeps the LONGER of the two durations rather than summing them. FREEZE
  // carries no power at all, so that helper would have done nothing here.
  //
  // Capped, so a second cast on a still-frozen target tops the lock back up
  // instead of extending it without limit. The cap is what the card can reach
  // in one volley, and it is stated on the card.
  //
  // The first application still goes through applyStatus and takes its element
  // resistances and field extensions; the rounds added on top of an existing
  // status do not. That only matters when a resisted target is struck twice,
  // and the cap bounds the difference to one volley's worth.
  if (num(params, "statusRoundsStack") > 0) {
    const add = num(params, "statusDuration", 1);
    const existing = target.statuses.find((st) => st.kind === kind);
    if (existing) {
      const cap = num(params, "statusRoundsCap", add * 2);
      const before = existing.duration;
      existing.duration = Math.min(cap, existing.duration + add);
      if (existing.duration > before)
        draft.log.push(`${label(draft, target)}'s ${kind} deepens — ${existing.duration}r.`);
      return;
    }
    applyStatus(draft, target, kind, add, num(params, "statusPower", 0), el);
    return;
  }
  applyStatus(draft, target, kind, num(params, "statusDuration", 1), num(params, "statusPower", 0), el);
}

/** Advance a card up to `steps` open slots toward the enemy home row (the
 *  reposition half of a move-and-strike special). Stops at a captured/occupied
 *  slot; can end on an uncaptured enemy home slot (a capture push). */
/** Resolve a TRAMPLE shove: the victim is driven to `dest`, and a card that
 *  CRUSHES (`trampleDmg`) hurts it on the way through.
 *
 *  Shared by the Prep move and the round-tick gait so the two cannot drift —
 *  they already resolved the destination from the same `shoveTarget`, and the
 *  damage has to come from one place for the same reason. */
export function applyShove(
  draft: GameState,
  mover: CardInstance,
  shove: { victim: CardInstance; dest: Pos },
): void {
  shove.victim.pos = { ...shove.dest };
  const crush = getDef(mover.defId).trampleDmg ?? 0;
  if (crush > 0)
    tickDamage(draft, mover, shove.victim, crush, true); // pen: masonry is not armour to a juggernaut
}

export function chargeForward(draft: GameState, card: CardInstance, steps: number): void {
  const dir = card.owner === "P1" ? -1 : 1;
  const enemyHome = homeRow(enemyOf(card.owner), draft.boardSize);
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos;
    if (!pos) break;
    const row: number = pos.row + dir;
    if (row < 0 || row >= draft.boardSize) break;
    if (draft.slots[row][pos.col].capturedBy) break;
    const blocker = cardAt(draft, row, pos.col);
    if (blocker) {
      // A JUGGERNAUT SHOVES. A TRAMPLE card walking into a lighter body drives
      // it back and takes the square, exactly as `shoveTarget` does in Prep —
      // the gait had no such rule, so Hoarfell's advance simply STOPPED at the
      // first thing in front of it, and stopping is what resets Avalanche. Put
      // a wall in front of a boss whose entire threat is an uninterrupted run
      // and the threat is not slowed, it is deleted: 12.5% against the Fortress
      // Gates, with the ramp never building once in a whole fight.
      const shove = shoveTarget(draft, card, { row, col: pos.col } as Pos);
      if (!shove) break;
      draft.log.push(`${label(draft, card)} bulls through ${getDef(shove.victim.defId).name}.`);
      applyShove(draft, card, shove);
    }
    card.pos = { row: row as Pos["row"], col: pos.col };
    moved++;
    if (row === enemyHome) break; // stop on the enemy home row
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} charges forward ${moved} slot(s).`);
}

/** Roll Through (Tumbleweed): advance toward the enemy home PAST occupied slots,
 *  landing in the first open one at least `minSteps` forward — a phase-through,
 *  not a stop-at-the-first-body. Plain chargeForward stalled the instant the
 *  struck enemy stood directly ahead, so a talent literally called "Roll
 *  Through" never moved against the target it just hit. Still can't stop on a
 *  captured slot or leave the board; may land ON the enemy home (its whole
 *  direction is toward it). */
function chargeThrough(draft: GameState, card: CardInstance, minSteps: number): void {
  if (!card.pos) return;
  const dir = card.owner === "P1" ? -1 : 1;
  const enemyHome = homeRow(enemyOf(card.owner), draft.boardSize);
  const col = card.pos.col;
  let row = card.pos.row;
  let stepped = 0;
  while (true) {
    const next = row + dir;
    if (next < 0 || next >= draft.boardSize) break; // off the board
    if (draft.slots[next][col].capturedBy) break; // can't stop on / pass a locked slot
    row = next;
    stepped++;
    if (!cardAt(draft, row, col) && stepped >= minSteps) {
      card.pos = { row: row as Pos["row"], col };
      draft.log.push(`${label(draft, card)} rolls through — ${stepped} slot(s) forward.`);
      return;
    }
    if (row === enemyHome) break; // don't roll past the enemy home row
  }
  // nowhere open to land: it stays put (still dealt its damage).
}

/** Charge that HOMES IN on the slot it struck instead of ploughing straight up
 *  its own column — it may move horizontally and diagonally to get there. A
 *  column-locked charge simply stalled whenever anything stood in the lane, so
 *  a rider whose victim was one column over never moved at all. Pulls up
 *  BESIDE a living target (it closes to melee, it doesn't trample through);
 *  if the strike killed the target the vacated slot is fair game to land on. */
function chargeToward(
  draft: GameState,
  card: CardInstance,
  steps: number,
  dest: Pos,
  /** Trample (Shadow Horsemen): every enemy the rider passes CLOSE TO on its way
   *  takes this much, PEN, once each. Charges route AROUND bodies rather than
   *  through them, so "passed" means adjacent to a slot the rider entered — not
   *  trampled underfoot, which the movement rules do not allow. The destination
   *  is excluded: it eats the full strike instead. */
  trampleDmg = 0,
  /** Let a GROUND charger cut corners. Normally only FLYING may step
   *  diagonally, matching how prep movement charges a ground card two points
   *  for a diagonal — a charge that ignored that would out-manoeuvre the move
   *  rules. A card can opt out of that per-Special (Shadow Charge does: the
   *  horse rides where it likes). */
  diagonal = false,
): void {
  const enemyHome = homeRow(enemyOf(card.owner), draft.boardSize);
  const run = trampleDmg > 0 ? new Set<string>() : null;
  // Same geometry the PREP move uses: FLYING walks like a chess king, everyone
  // else is orthogonal, so a ground rider spends two of its steps to cut a
  // corner. A charge that ignored this would out-manoeuvre normal movement.
  const canDiagonal = diagonal || isFlying(card);
  const open = (r: number, c: number) =>
    r >= 0 && r < draft.boardSize && c >= 0 && c < draft.boardSize &&
    !draft.slots[r][c].capturedBy && !cardAt(draft, r, c);
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos;
    if (!pos) break;
    const gapR = dest.row - pos.row;
    const gapC = dest.col - pos.col;
    if (gapR === 0 && gapC === 0) break; // standing on it (target died here)
    // Already beside a target that is still standing — close enough, stop.
    if (Math.max(Math.abs(gapR), Math.abs(gapC)) <= 1 && cardAt(draft, dest.row, dest.col)) break;
    const dr = Math.sign(gapR);
    const dc = Math.sign(gapC);
    // Prefer the diagonal, then close the wider gap first. If all of those are
    // blocked, take a DETOUR that still makes progress on the long axis — a
    // body parked directly ahead used to stop the charge dead, which is the
    // most common case there is.
    const tries: Array<[number, number]> = [];
    if (canDiagonal && dr !== 0 && dc !== 0) tries.push([dr, dc]);
    if (Math.abs(gapR) >= Math.abs(gapC)) {
      if (dr !== 0) tries.push([dr, 0]);
      if (dc !== 0) tries.push([0, dc]);
    } else {
      if (dc !== 0) tries.push([0, dc]);
      if (dr !== 0) tries.push([dr, 0]);
    }
    // Detours around a blocker: a flyer cuts the corner, a ground rider has to
    // sidestep and then resume.
    if (canDiagonal) {
      if (dr !== 0) tries.push([dr, 1], [dr, -1]);
      else tries.push([1, dc], [-1, dc]);
    } else if (dr !== 0) tries.push([0, 1], [0, -1]);
    else tries.push([1, 0], [-1, 0]);
    const seen = new Set<string>();
    const step = tries
      .filter(([sr, sc]) => (seen.has(`${sr},${sc}`) ? false : (seen.add(`${sr},${sc}`), true)))
      .find(([sr, sc]) => open(pos.row + sr, pos.col + sc));
    if (!step) break;
    card.pos = { row: pos.row + step[0], col: pos.col + step[1] };
    moved++;
    if (run) {
      // Collect as we go, damage after the ride — resolving mid-move could kill
      // a blocker and change the lane the rider is still walking.
      for (const e of enemyCards(draft, card.owner)) {
        if (!e.pos || (e.pos.row === dest.row && e.pos.col === dest.col)) continue;
        if (chebyshev(e.pos, card.pos) <= 1) run.add(e.instanceId);
      }
    }
    if (card.pos.row === enemyHome) break; // a charge ends on the enemy home row
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} charges ${moved} slot(s) to close the gap.`);
  if (run && run.size > 0) {
    let hit = 0;
    for (const id of run) {
      const e = draft.cards[id];
      if (!e || e.curHp <= 0) continue;
      directDamage(draft, card, e, trampleDmg, true); // PEN — hooves ignore armour
      hit++;
    }
    if (hit > 0)
      draft.log.push(`${label(draft, card)} tramples ${hit} opponent(s) on the ride (${trampleDmg} PEN each).`);
  }
}

/** Row directly ahead (toward the enemy home) of a given position. */
export function rowAhead(owner: CardInstance["owner"], row: number): number {
  return owner === "P1" ? row - 1 : row + 1;
}

/** Direct, trigger-free damage to a single card (used by on-kill / on-death /
 *  round-tick AoEs). Returns true if it killed the target. */
/**
 * Sourceless damage from a Spell (no attacker card). Honours BLOCK and the
 * shield gate, wakes a struck sleeper, and resolves death via defeatCard.
 * Skips EVASION and on-death "retaliate on the killer" chains — a Spell has no
 * card to reflect back onto. Returns true if the target died.
 */
export function spellHit(
  draft: GameState,
  target: CardInstance,
  dmg: number,
  pen: boolean,
  by?: PlayerId,
): boolean {
  const t = draft.cards[target.instanceId];
  if (!t || t.curHp <= 0) return false;
  const tDef = getDef(t.defId);
  let remaining = dmg;
  const tempBlk = (t.blockRoundsLeft ?? 0) > 0 ? (t.blockPower ?? 0) : 0;
  const block = Number(tDef.keywords.BLOCK ?? 0) + wallFlatReduction(draft, t) + fieldBonus(draft, t, "block") + tempBlk;
  if (block > 0) remaining = Math.max(0, remaining - block); // BLOCK applies even to PEN
  let toHp: number;
  if (pen) {
    toHp = remaining;
  } else {
    toHp = Math.max(0, remaining - t.curShields);
    if (t.curShields > 0) t.curShields = Math.max(0, t.curShields - shieldsBrokenBy(remaining));
  }
  t.curHp -= toHp;
  noteDamageFx(t, toHp);
  if (by) creditDamage(draft.stats, null, by, toHp, target); // spell damage → caster's side total
  draft.log.push(`${label(draft, t)} takes ${toHp} spell damage.`);
  if (hasStatus(t, "SLEEP") && t.curHp > 0) {
    t.statuses = t.statuses.filter((s) => s.kind !== "SLEEP");
    draft.log.push(`${label(draft, t)} is jolted awake!`);
  }
  if (t.curHp <= 0) {
    if (by) creditKill(draft.stats, null, by);
    defeatCard(draft, t, "a spell");
    return true;
  }
  checkLowHpTransform(draft, t);
  return false;
}

/** How far a param-driven spawn may reach. ABSENT means "prefer adjacent, then
 *  anywhere open" — the `spawnTokens` default — not "adjacent only".
 *
 *  This used to default to 1, which tethered every Special that never thought to
 *  mention a radius. SkullKing was the clearest casualty: it raises two skeletons
 *  a round to a standing cap of six, so its OWN tokens crowd it, and then King's
 *  SkullDrake had nowhere to land. A card should not be able to lock itself out
 *  of its own Special by working correctly. */
function spawnRadiusOf(params: Record<string, string | number>): number | undefined {
  return params.spawnRadius == null ? undefined : num(params, "spawnRadius", 1);
}

/** Cards a spawn may ESCALATE into — read off the real card list rather than
 *  written out, so a DAWN epic added later joins the pool without anyone having
 *  to remember this exists. Tokens are excluded by construction: they live in
 *  `TOKENS`, not `CARDS`. Sorted so the roll is reproducible from the seed
 *  whatever order the file happens to be in. */
function escalationPool(element: string, rarity: string): string[] {
  return CARDS
    // Never a boss: Imperator's crown reaching higher must not raise Rotroot.
    .filter((c) => !c.boss)
    .filter((c) => (!element || c.element === element) && (!rarity || c.rarity === rarity))
    .map((c) => c.id)
    .sort();
}

/** How much permanent self-DMG growth a card may still take. Uncapped (no
 *  `onHitSelfBuff.max`) returns the full amount, which is every card but the one
 *  that asks for a ceiling. */
function cappedSelfGrowth(card: CardInstance, want: number): number {
  const max = getDef(card.defId).onHitSelfBuff?.max;
  if (max == null) return want;
  const gained = card.selfBuffGained ?? 0;
  const gain = Math.max(0, Math.min(want, max - gained));
  if (gain > 0) card.selfBuffGained = gained + gain;
  return gain;
}

export function directDamage(
  draft: GameState,
  source: CardInstance,
  target: CardInstance,
  dmg: number,
  pen: boolean,
  crit = false,
  silent = false,
): boolean {
  if (!draft.cards[target.instanceId] || target.curHp <= 0) return false;
  const r = resolveHit(draft, source, target, { kind: "reflect", dmg, hits: 1, pen, crit, silent });
  return r.targetDied;
}

/** DUSK lifesteal: move `amount` MAX HP from target to attacker. Never takes the
 *  last point — a card drained to 0 max HP would be unkillable-by-drain nonsense.
 *  Shared by the DRAIN keyword (basics) and drain-riding Specials (Bat Swarm). */
export function drainMaxHp(
  draft: GameState,
  attacker: CardInstance,
  target: CardInstance,
  amount: number,
): number {
  // Nightfall (DUSK field): "all DRAIN steals +1 max HP per instance". Applied
  // HERE, at the one choke-point every drain funnels through — the keyword on a
  // basic and the `drain` param on a Special both land here, so neither can be
  // missed and a future third caller inherits it automatically.
  if (target.curHp <= 0) return 0;
  const boosted = amount + fieldBonus(draft, attacker, "drainBonus");
  const taken = Math.max(0, Math.min(boosted, target.maxHp - 1));
  if (taken <= 0) return 0;
  target.maxHp -= taken;
  target.curHp = Math.min(target.curHp, target.maxHp); // the ceiling drop shrinks its usable pool
  // The stolen point heals the drainer for HALF (round down) — usable HP, but
  // trimmed so DUSK's board-wide DRAIN doesn't out-sustain everything. Raise the
  // ceiling first; healCard respects SEAL.
  gainMaxHp(attacker, taken);
  healCard(draft, attacker, Math.floor(taken / 2), attacker);
  draft.log.push(`${label(draft, attacker)} drains ${taken} HP from ${label(draft, target)}.`);
  return taken;
}

/** End-of-round tick damage (Black Smoke, Radiation, Complete Circuit, Trapper).
 *  Same as directDamage, but a kill fires the ticking card's onKill. The main
 *  death path gates onKill to basic/special kills, which would leave a 0-DMG
 *  card like Smog — whose only kill route IS its tick — unable to ever trigger
 *  its own on-kill passive. Returns true if the target died. */
export function tickDamage(
  draft: GameState,
  source: CardInstance,
  target: CardInstance,
  dmg: number,
  pen: boolean,
): boolean {
  const died = directDamage(draft, source, target, dmg, pen);
  if (died && source.curHp > 0) {
    const def = getDef(source.defId);
    if (!getDef(target.defId).noKillReward) {
      if (def.onKill) applyOnKill(draft, source, def.onKill);
      registerKill(draft, source);
    }
  }
  return died;
}

/** Burnout: a dying card blasts the enemy cards in the row directly ahead. */
function onDeathRowAhead(
  draft: GameState,
  dead: CardInstance,
  deadOwner: CardInstance["owner"],
  pos: Pos,
  dmg: number,
  pen: boolean,
): void {
  const row = rowAhead(deadOwner, pos.row);
  if (row < 0 || row >= draft.boardSize) return;
  const victims = enemyCards(draft, deadOwner).filter((c) => c.pos?.row === row);
  if (victims.length === 0) return;
  draft.log.push(`${getDef(dead.defId).name} erupts on death — ${dmg} DMG to the row ahead!`);
  for (const v of victims) directDamage(draft, dead, v, dmg, pen);
}

/** Thorns: a struck card hits its melee attacker back with damage and/or a
 *  status. Returns true if the retaliation killed the attacker. */
function applyOnHitByMelee(
  draft: GameState,
  defender: CardInstance,
  attacker: CardInstance,
  def: OnHitByMeleeDef,
): boolean {
  if (def.chance != null && !pctChance(draft, def.chance)) return false;
  let killed = false;
  if (def.dmg && def.dmg > 0) {
    draft.log.push(`${label(draft, defender)} retaliates — ${def.dmg} DMG to ${getDef(attacker.defId).name}.`);
    killed = directDamage(draft, defender, attacker, def.dmg, Boolean(def.pen));
  }
  if (def.status && attacker.curHp > 0 && draft.cards[attacker.instanceId]) {
    applyStatus(draft, attacker, def.status.kind, def.status.duration, def.status.power, getDef(defender.defId).element);
  }
  // Fountain (Oxin): the spring saps the attacker's momentum.
  if (def.spDrain && attacker.curHp > 0) {
    attacker.spBonus -= def.spDrain;
    draft.log.push(`${label(draft, defender)}'s fountain saps ${def.spDrain} SP from ${getDef(attacker.defId).name}.`);
  }
  // Hot Hot (Spitfire): double the power of every BURN already on the attacker.
  if (def.doubleBurn && attacker.curHp > 0) {
    let boosted = false;
    for (const st of attacker.statuses) if (st.kind === "BURN") { st.power *= 2; boosted = true; }
    if (boosted) draft.log.push(`${getDef(defender.defId).name}'s heat doubles the BURN on ${getDef(attacker.defId).name}.`);
  }
  return killed;
}

/** Jelly Shock (Jellyfish): the defender discharges after surviving a hit —
 *  `dmg` to whoever struck it, plus every enemy in the 8 slots around it. The
 *  attacker is zapped even from range, which is the whole point: thorns only
 *  answer melee, this answers everyone. Returns true if the attacker died. */
function applyOnHitZap(
  draft: GameState,
  defender: CardInstance,
  attacker: CardInstance,
  def: NonNullable<CardDef["onHitZap"]>,
): boolean {
  const zapped: CardInstance[] = [];
  if (attacker.curHp > 0 && draft.cards[attacker.instanceId]) zapped.push(attacker);
  if (defender.pos) {
    for (const e of enemyCards(draft, defender.owner)) {
      if (!e.pos || e.curHp <= 0) continue;
      if (e.instanceId === attacker.instanceId) continue; // already in the list
      const dr = Math.abs(e.pos.row - defender.pos.row);
      const dc = Math.abs(e.pos.col - defender.pos.col);
      if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) zapped.push(e);
    }
  }
  if (zapped.length === 0) return false;
  draft.log.push(`${label(draft, defender)} discharges — ${def.dmg} to ${zapped.length} target(s).`);
  let attackerDied = false;
  for (const e of zapped) {
    const died = directDamage(draft, defender, e, def.dmg, false);
    if (died && e.instanceId === attacker.instanceId) attackerDied = true;
    if (def.status && !died && draft.cards[e.instanceId] && e.curHp > 0) {
      applyStatus(draft, e, def.status.kind, def.status.duration, def.status.power, getDef(defender.defId).element);
    }
  }
  return attackerDied;
}

/** Gale Riposte: a blow big enough to be worth answering gets answered.
 *
 *  The threshold reads the WHOLE swing — what reached HP plus what the shields
 *  ate — rather than HP damage alone. A 20-damage hit soaked entirely by
 *  shields is still a 20-damage hit, and gating on HP would have made stacking
 *  shields onto the carrier the way to switch its own passive off.
 *
 *  Deals no damage on purpose. It repositions: everything close is pushed out
 *  of reach and WEAKENed, so landing one big hit costs the attacker the ground
 *  it was standing on. Chip damage slips under it untouched, which is the
 *  decision the printed threshold exists to offer. */
function applyHeavyHit(
  draft: GameState,
  defender: CardInstance,
  def: NonNullable<CardDef["onHeavyHit"]>,
  dealt: number,
): void {
  if (dealt <= def.over || !defender.pos) return;
  const caught = enemyCards(draft, defender.owner).filter((e) => {
    if (!e.pos || e.curHp <= 0) return false;
    return Math.max(Math.abs(e.pos.row - defender.pos!.row),
                    Math.abs(e.pos.col - defender.pos!.col)) <= def.reach;
  });
  if (caught.length === 0) return;
  const name = getDef(defender.defId).passiveNames?.onHeavyHit ?? "Riposte";
  draft.log.push(`${label(draft, defender)} — ${name}: ${dealt} was too much, and the wind answers ${caught.length}.`);
  for (const e of caught) {
    if (def.status)
      applyStatus(draft, e, def.status, def.statusDuration ?? 1, 0, getDef(defender.defId).element);
    // Pushed AFTER the status, so a shove that carries a card out of reach
    // cannot cost it the debuff it had already earned by standing there.
    if (def.push && def.push > 0 && draft.cards[e.instanceId] && e.curHp > 0)
      pushBack(draft, e, def.push, defender);
  }
}

/** On-kill: buff the killer / heal / blast. */
/** Count a kill on the killer and, if its def names a second form, grow into it.
 *
 *  Called at BOTH kill sites (the basic/special path and `tickDamage`), and
 *  deliberately outside the `if (def.onKill)` guard beside each: the count is
 *  about the killer, not about whether it happens to carry an on-kill rider. */
function registerKill(draft: GameState, killer: CardInstance): void {
  killer.killCount = (killer.killCount ?? 0) + 1;
  const t = getDef(killer.defId).transformAtKills;
  if (!t || killer.killCount < t.kills || killer.defId === t.into) return;

  // IT GROWS — IT DOES NOT HEAL. `transform` takes the new form's FRESH body,
  // which is right for a Special that turns into something else and badly wrong
  // for a second form earned mid-fight: Thunderfangs whittled to 4 of 50 came
  // back as 60 of 60 with full shields the instant it landed its fifth kill.
  // Reported from the device as "Thunderfangs never dies, it just comes back",
  // and it is the worst possible moment for a full heal — the player had done
  // the work and the kill that undid it was free.
  //
  // So the wound carries over and only the INCREASE is granted: at +20% on a 50
  // HP body that is +10 max and +10 current, so 4/50 becomes 14/60. Same for
  // shields. Fixed HERE rather than in the handler, because the handler is
  // shared with cards whose transformation IS meant to be a new body.
  const hpWas = killer.curHp, maxWas = killer.maxHp, shieldsWas = killer.curShields;
  SPECIAL_HANDLERS.transform(draft, killer, [], { into: t.into });
  killer.curHp = Math.max(1, Math.min(killer.maxHp, hpWas + Math.max(0, killer.maxHp - maxWas)));
  const shieldsGained = Math.max(0, getDef(t.into).shields - getDef(killer.transformedFrom ?? "").shields);
  killer.curShields = Math.min(killer.curShields, shieldsWas + shieldsGained);
}

function applyOnKill(draft: GameState, killer: CardInstance, def: OnKillDef, deathPos?: Pos | null): void {
  const name = getDef(killer.defId).name;
  // Dark Hunting (Nightbriar): lay a trap on the slot the victim just vacated. The
  // next opponent to walk onto it springs the same payload as his Special —
  // reuses the trap-spell infrastructure (triggerTrapOnMove), so every movement
  // path that already sets off spell traps sets this off too.
  if (def.setTrap && deathPos &&
      !draft.traps.some((t) => t.pos.row === deathPos.row && t.pos.col === deathPos.col)) {
    const kd = getDef(killer.defId);
    draft.traps.push({
      owner: killer.owner,
      label: `${kd.name}'s Dark Hunting trap`,
      element: kd.element,
      pos: { ...deathPos },
      dmg: def.setTrap.dmg,
      status: def.setTrap.rootDuration > 0
        ? { kind: "ROOT", duration: def.setTrap.rootDuration, power: 0 }
        : undefined,
      lifesteal: def.setTrap.lifesteal,
      sourceId: killer.instanceId,
    });
    draft.log.push(`${name} hides a trap where its prey fell.`);
  }
  if (def.buffDmg) {
    killer.dmgBonus += def.buffDmg;
    draft.log.push(`${name} grows stronger (+${def.buffDmg} DMG) on the kill.`);
  }
  if (def.buffDmgRound) killer.dmgBonusRound += def.buffDmgRound;
  if (def.buffSp) killer.spBonus += def.buffSp;
  // `everyNKills`: only on every Nth kill. `killCount` has not been bumped for
  // THIS kill yet (registerKill runs after this), so count it in here.
  const everyN = def.spawnToken?.everyNKills ?? 0;
  const killNo = (killer.killCount ?? 0) + 1;
  if (def.spawnToken && (everyN <= 0 || killNo % everyN === 0)) {
    // Harvester: the fallen get up again on her side.
    //
    // `maxAlive` is a CEILING on how many of the token may stand at once, the
    // same shape the `spawn` Special already uses, and Thunderfangs is why it
    // exists: raising a wolf on every kill, with Pack Law turning each wolf
    // back into damage, snowballs. It measured a flat 100% win rate with 98% of
    // those ending in an overrun, because the pack simply filled the board. A
    // pack is a pack, not a tide.
    const cap = def.spawnToken.maxAlive;
    if (cap == null) {
      const raised = spawnTokens(draft, killer, def.spawnToken.token, def.spawnToken.count);
      if (raised.length) draft.log.push(`${name} harvests the fallen — ${raised.length} rise.`);
    } else {
      spawnCapped(draft, killer, def.spawnToken.token, def.spawnToken.count, undefined, cap);
    }
  }
  // Quadruple Strike (Birch): the kill flows into the nearest survivor.
  if (def.nearestVolley && killer.pos && killer.curHp > 0) {
    const prey = enemyCards(draft, killer.owner)
      .filter((e) => e.curHp > 0 && e.pos)
      .sort((a, b) => manhattan(killer.pos!, a.pos!) - manhattan(killer.pos!, b.pos!))[0];
    if (prey) {
      draft.log.push(`${name} strikes on — ${def.nearestVolley.dmg}×${def.nearestVolley.hits} to ${getDef(prey.defId).name}.`);
      resolveHit(draft, killer, prey, { kind: "special", dmg: def.nearestVolley.dmg, hits: def.nearestVolley.hits, pen: false, crit: false });
    }
  }
  // Infinite Serpent (Hydrogon): the kill snaps to the weakest survivor.
  if (def.lowestHpDmg && killer.curHp > 0) {
    const prey = enemyCards(draft, killer.owner)
      .filter((e) => e.curHp > 0)
      .sort((a, b) => a.curHp - b.curHp)[0];
    if (prey) {
      draft.log.push(`${name} strikes the weakest — ${def.lowestHpDmg} DMG to ${getDef(prey.defId).name}.`);
      directDamage(draft, killer, prey, def.lowestHpDmg, false);
    }
  }
  if (def.buffHits) {
    killer.hitsBonus += def.buffHits;
    draft.log.push(`${name} gains +${def.buffHits} hit on its basic attack.`);
  }
  if (def.buffMaxHp) {
    killer.curHp += gainMaxHp(killer, def.buffMaxHp);
    draft.log.push(`${name} feeds on the kill (+${def.buffMaxHp} HP).`);
  }
  if (def.coinBonusDmg) {
    const bonus = coin(draft) ? def.coinBonusDmg : def.coinBonusDmg - 1;
    killer.dmgBonus += bonus;
    draft.log.push(`${name} claims the spoils (+${bonus} DMG).`);
  }
  // King of Sunfall Harbor: the spoils are armour OR teeth, never both, and the
  // card does not choose. Permanent either way, so a long-lived Scallywag drifts
  // toward whichever the coin has favoured rather than growing on a fixed line.
  if (def.coinShieldOrDmg) {
    const c = def.coinShieldOrDmg;
    if (coin(draft)) {
      killer.curShields += c.shields;
      draft.log.push(`${name} takes the harbour's plate (+${c.shields} shield).`);
    } else {
      killer.dmgBonus += c.dmg;
      draft.log.push(`${name} takes the harbour's steel (+${c.dmg} DMG).`);
    }
  }
  if (def.healSelf) {
    const h = healCard(draft, killer, def.healSelf, killer);
    if (h > 0) draft.log.push(`${name} heals ${h} on the kill.`);
  }
  if (def.gainShields) killer.curShields += def.gainShields;
  // Perpetual Fog (Driftwraith): a kill cloaks it and same-row kin in STEALTH.
  if (def.grantStealth) {
    applyStatus(draft, killer, "STEALTH", def.grantStealth, 0, getDef(killer.defId).element);
    if (killer.pos) for (const a of boardCards(draft, killer.owner)) {
      if (a.instanceId !== killer.instanceId && a.curHp > 0 && a.pos?.row === killer.pos.row && getDef(a.defId).element === getDef(killer.defId).element)
        applyStatus(draft, a, "STEALTH", def.grantStealth, 0, getDef(killer.defId).element);
    }
    draft.log.push(`${name}'s fog thickens — STEALTH covers the kill.`);
  }
  // Perpetual Fog (Driftwraith): the fog closes around the killer itself — a
  // dodge window, not a cloak. Self only; the same-row half belongs to
  // grantStealth above.
  if (def.grantEvasion) {
    applyStatus(draft, killer, "EVASION", def.grantEvasion, 0, getDef(killer.defId).element);
    draft.log.push(`${name} slips into the fog — EVASION for ${def.grantEvasion} round(s).`);
  }
  // Star Blaster (Zenith): a kill BLINDs nearby opponents for the round.
  if (def.blindInRange && killer.pos) {
    const near = enemyCards(draft, killer.owner).filter(
      (e) => e.curHp > 0 && e.pos && chebyshev(e.pos, killer.pos!) <= 1,
    );
    for (const e of near) applyStatus(draft, e, "BLIND", def.blindInRange, 0, getDef(killer.defId).element);
    if (near.length) draft.log.push(`${name}'s Star Blaster BLINDs ${near.length} nearby foe(s).`);
  }
  if (def.extendStatus) {
    const { kind, rounds } = def.extendStatus;
    let n = 0;
    for (const e of enemyCards(draft, killer.owner)) {
      const st = e.statuses.find((s) => s.kind === kind);
      if (st) { st.duration += rounds; n++; }
    }
    if (n > 0) draft.log.push(`${name} deepens ${kind} on ${n} foe(s) (+${rounds}r).`);
  }
  if (def.reduceSpecialCost) {
    killer.specialCostReduction += def.reduceSpecialCost;
    draft.log.push(`${name} tightens its grip (King Me — Special costs ${def.reduceSpecialCost} less).`);
  }
  if (def.aoeDmg) {
    for (const e of enemyCards(draft, killer.owner))
      directDamage(draft, killer, e, def.aoeDmg, false);
    draft.log.push(`${name} discharges ${def.aoeDmg} to all enemies!`);
  }
  // Powertrip (Voltogon): once per round, jolt every ELECTRIFIED (statused) enemy.
  if (def.aoeDmgElectrified && !killer.onKillAoeFiredRound) {
    const shocked = enemyCards(draft, killer.owner).filter((e) => e.statuses.length > 0);
    if (shocked.length > 0) {
      killer.onKillAoeFiredRound = true;
      for (const e of shocked) directDamage(draft, killer, e, def.aoeDmgElectrified, false);
      draft.log.push(`${name} discharges ${def.aoeDmgElectrified} to all electrified enemies!`);
    }
  }
}

/** Post-special self buffs shared by handlers: +max HP, ±SP. */
function applySelfRiders(
  draft: GameState,
  caster: CardInstance,
  params: Record<string, number | string>,
): void {
  const maxHp = num(params, "selfMaxHp");
  if (maxHp > 0) {
    caster.curHp += gainMaxHp(caster, maxHp);
    draft.log.push(`${label(draft, caster)} gains +${maxHp} max HP.`);
  }
  const sp = num(params, "selfSp");
  if (sp !== 0) caster.spBonus += sp;
  const shields = num(params, "selfShields"); // Timberer: brace behind the felled tree
  if (shields > 0) {
    caster.curShields += shields;
    draft.log.push(`${label(draft, caster)} braces (+${shields} shield).`);
  }
  // Permanent +DMG per use (Volcanon's Bad Temper). Routed through the SAME cap
  // as the on-hit passive, because on Volcanon they are one ability with two
  // triggers — capping only the passive would move the whole ramp onto Eruption.
  // Cards whose def declares no cap are unaffected and gain the full amount.
  const dmg = num(params, "selfDmg");
  if (dmg !== 0) {
    const gain = dmg > 0 ? cappedSelfGrowth(caster, dmg) : dmg;
    if (gain !== 0) {
      caster.dmgBonus += gain;
      draft.log.push(`${label(draft, caster)} grows hotter (+${gain} DMG).`);
    }
  }
  // WITHDRAW (Kato, Stormwing): after the pass, pull back toward its OWN home
  // row, staying in the column it fired down. The jet arrives wherever the
  // panther died — `takeSpotOnKill` regularly leaves that shell deep in the
  // player's half — so this is the half of the move that gets it out again:
  // strike, then break off toward friendly air.
  //
  // Deterministic and blocked by bodies: it stops at the first occupied or
  // captured square rather than phasing through one, so a player who parks
  // something behind it can pin the jet forward where they can reach it. That
  // is the counter-play the rider exists to create.
  const back = num(params, "retreatHome");
  if (back > 0 && caster.pos) {
    const home = homeRow(caster.owner, draft.boardSize);
    const dir = Math.sign(home - caster.pos.row);
    let moved = 0;
    const col = caster.pos.col;
    let row: number = caster.pos.row;
    while (dir !== 0 && moved < back) {
      const r = row + dir;
      if (r < 0 || r >= draft.boardSize) break;
      if (cardAt(draft, r, col) || draft.slots[r][col].capturedBy) break;
      row = r;
      caster.pos = { row: row as Pos["row"], col };
      moved++;
    }
    if (moved > 0)
      draft.log.push(`${label(draft, caster)} breaks off and climbs back ${moved} slot(s).`);
  }
  if (num(params, "selfMirror") > 0 && caster.pos) {
    const row = caster.pos.row;
    const want = draft.boardSize - 1 - caster.pos.col;
    // Its OWN square counts as free — it is vacating it. Without that, a jet in
    // the middle column of an odd board (whose mirror is itself) saw itself in
    // the way and hopped sideways to a slot that is not the mirror of anything.
    const free = (c: number) =>
      c >= 0 && c < draft.boardSize && !draft.slots[row][c].capturedBy
      && (c === caster.pos!.col || !cardAt(draft, row, c));
    let dest = -1;
    for (let d = 0; d < draft.boardSize && dest < 0; d++)
      for (const c of [want - d, want + d]) if (free(c)) { dest = c; break; }
    if (dest >= 0 && dest !== caster.pos.col) {
      caster.pos = { row: row as Pos["row"], col: dest as Pos["col"] };
      draft.log.push(`${label(draft, caster)} banks hard across the board — column ${dest}.`);
    }
  }
  // (selfStatus is applied once per Special in performBattleAction, so it works
  // for every handler — barrage included — not just strike.)
}

/** Per-target special riders: forced push-back and a timed −SP debuff
 *  (Mighty Winds, Purple Wind Surge). */
function applyDebuffRiders(
  draft: GameState,
  target: CardInstance,
  params: Record<string, number | string>,
  attacker?: CardInstance,
): void {
  if (!draft.cards[target.instanceId] || target.curHp <= 0) return;
  const push = num(params, "push");
  if (push > 0) pushBack(draft, target, push, attacker);
  // The opposite direction, and the only one that can move a card standing on
  // its OWN home row: pushBack shoves a card toward its own home, so a Special
  // aimed at the enemy home row (Eagon's Dark Wind Wave) was shoving cards into
  // a wall and moving nothing at all. A pull drags them out toward the caster —
  // which is what "toward the near row" says, and what a wind that reaches
  // across the board should do.
  const pull = num(params, "pull");
  if (pull > 0 && attacker) pullToward(draft, target, pull, attacker.owner);
  // The LASSO: toward the caster itself rather than toward its home row, so the
  // rope closes sideways and backwards too. See `reelToCaster`.
  const rope = num(params, "pullToCaster");
  if (rope > 0 && attacker) reelToCaster(draft, target, rope, attacker);
  const spDebuff = num(params, "spDebuff");
  if (spDebuff > 0) applyTimedBuff(target, 0, -spDebuff, num(params, "spDebuffRounds", 1));
}

/** Apply a status to every enemy in the 8 slots adjacent to the caster
 *  (Squanch's Bushwhacker ROOT). */
function adjacentCasterStatus(
  draft: GameState,
  caster: CardInstance,
  params: Record<string, number | string>,
): void {
  const kind = params.adjStatusKind as StatusKind | undefined;
  if (!kind || !caster.pos) return;
  for (const e of enemyCards(draft, caster.owner)) {
    if (!e.pos) continue;
    const dr = Math.abs(e.pos.row - caster.pos.row);
    const dc = Math.abs(e.pos.col - caster.pos.col);
    if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
      applyStatus(draft, e, kind, num(params, "adjStatusDuration", 1), num(params, "adjStatusPower", 0), getDef(caster.defId).element);
    }
  }
}

/** Handlers that aim at NOTHING — they work off the caster's own position, or
 *  the whole enemy board, and never read the target list.
 *
 *  This lives beside the handlers rather than at the call site because it is a
 *  fact ABOUT the handlers, and keeping it anywhere else is how it went stale
 *  twice: the on-summon path gates on "did we find a target", which silently
 *  did nothing for every one of these whenever no enemy was in the summoner's
 *  reach — the normal case for a card dropped into its own home row.
 *
 *  A handler belongs here if its body ignores `targets` (spawn, surfsUp) or
 *  treats them as a mere preference with a whole-board fallback (lockSpecials).
 *  A test asserts the first kind can't be forgotten.
 */
// `stormCall` picks its own victims from the boss's post-swap position, and in
// its other branch has no victims at all — asking the caster to nominate one
// would be asking about a slot the boss has not moved to yet.
// `boulderThrow` picks its own victim at random, board-wide — there is no
// slot for a caster to nominate.
export const TARGETLESS_HANDLERS = new Set(["spawn", "surfsUp", "lockSpecials", "stormCall", "boulderThrow"]);

export const SPECIAL_HANDLERS: Record<string, SpecialHandler> = {
  /** Reroot (Oak): a pure reposition — advance up to `charge` open slots toward
   *  the enemy home, no attack. Lets a planted SP-0 body uproot and march. */
  reposition(draft, attacker, _targets, params) {
    chargeForward(draft, attacker, num(params, "charge", 1));
  },
  /** Turret Mode (GigaVolt): pin the whole board with ELECTRIFIED for the
   *  turret's duration (so it always has targets, and BOLT allies capitalize),
   *  fire a volley now, and keep firing at each Cleanup for `rounds` rounds. */
  turretMode(draft, attacker, _targets, params) {
    const dmg = num(params, "dmg", 3);
    const rounds = num(params, "rounds", 3);
    const el = getDef(attacker.defId).element;
    for (const e of enemyCards(draft, attacker.owner))
      if (e.curHp > 0) applyStatus(draft, e, "ELECTRIFIED", rounds, 0, el);
    attacker.turretDmg = dmg;
    fireElectrifiedVolley(draft, attacker, dmg); // round 1 fires immediately
    attacker.turretRoundsLeft = Math.max(0, rounds - 1); // the rest at Cleanup
  },
  /** Spawn N token cards near the caster (Imperator's Strike of Dawn → Heir). */
  spawn(draft, attacker, _targets, params) {
    // `radius` tethers the bodies to the summoner (RIP's Horde), so the burst
    // can't drop husks across the board while the round-tick is leashed.
    const radius = params.radius == null ? undefined : num(params, "radius", 1);
    // No token named → nothing to raise. Magmadon's Meltdown routes through here
    // because its whole effect is a rider (the row-ahead eruption + the
    // channel), and an unguarded getDef("") threw mid-battle.
    let token = String(params.token ?? "");
    if (!token) return;
    // ESCALATION. Imperator's Strike of Dawn raises an Heir — and once one is
    // standing, raising a second one is the least interesting thing the crown
    // could do with a 5-cost 3-round special. So when the body it would spawn
    // is already on the field, the summons reaches further instead: a random
    // DAWN epic, whatever is in the set.
    //
    // The caster's OWN side, deliberately. This is about the Heir your Imperator
    // already crowned having made the ordinary cast redundant; an enemy Heir in
    // a mirror match is a reason to raise yours, not to skip it.
    const already = String(params.escalateIfPresent ?? "");
    if (already && boardCards(draft, attacker.owner).some((c) => c.curHp > 0 && c.defId === already)) {
      const pool = escalationPool(
        String(params.escalateElement ?? ""),
        String(params.escalateRarity ?? ""),
      );
      if (pool.length) {
        token = pool[randInt(draft, pool.length)];
        draft.log.push(
          `${label(draft, attacker)} — ${getDef(already).name} already stands; the crown calls higher.`,
        );
      }
    }
    // STOCK CAP. `spawnMaxAlive` already leashes the round-tick spawn and the
    // onOppSummon one (see phases.ts); the SPECIAL was the one spawn path with
    // no ceiling, and on a repeatable cast that is the Buzzard problem again —
    // two a cast forever, and the only way a body leaves the board is by dying.
    // Overclock's Production Run fires free every 3 rounds, so uncapped it just
    // buried the board. Counts LIVING tokens of this id on the caster's side.
    spawnCapped(draft, attacker, token, num(params, "count", 1), radius,
      params.maxAlive == null ? Infinity : num(params, "maxAlive", 0));
    // Grove's Blessing: the same burst that raises the tree tops up every ally
    // on the caster's side (Sylvane's Emergence). Element-agnostic — heals all.
    const healAmt = num(params, "healAllies");
    if (healAmt > 0 && attacker.curHp > 0) {
      let touched = 0;
      for (const a of boardCards(draft, attacker.owner))
        if (healCard(draft, a, healAmt, attacker.owner) > 0) touched++;
      if (touched) draft.log.push(`${label(draft, attacker)} heals ${touched} ally(ies) (+${healAmt} HP).`);
    }
    // Commanding Strike (Imperator's Strike of Dawn): the same command that
    // raises Heir orders the whole army to swing — every living ally (the caster
    // included) auto-fires a basic at the nearest enemy it can reach. Snapshot
    // the roster first: a kill mid-command can spawn/remove bodies.
    if (num(params, "commandAllies") > 0) {
      draft.log.push(`${label(draft, attacker)} commands the charge — every ally strikes!`);
      const roster = boardCards(draft, attacker.owner).filter((a) => a.curHp > 0).map((a) => a.instanceId);
      for (const id of roster) {
        const ally = draft.cards[id];
        if (!ally || ally.curHp <= 0 || !ally.pos) continue;
        const foe = enemyCards(draft, ally.owner)
          .filter((e) => e.curHp > 0 && e.pos && canTarget(draft, ally, e, false, true))
          .sort((a, b) => manhattan(ally.pos!, a.pos!) - manhattan(ally.pos!, b.pos!))[0];
        if (foe) basicAttack(draft, ally.instanceId, foe.instanceId);
      }
    }
  },
  /** An escalating combo (Elecdroid's Light Slasher): a sequence of `hits` that
   *  stays on a target until it dies, then chains to the next enemy. Each KILL
   *  raises the remaining hits by `killBoost` — a SPECIAL-only tally that resets
   *  when the combo ends (the last hit uses `finisherDmg`). */
  combo(draft, attacker, targets, params) {
    const hits = num(params, "hits", 1);
    const base = num(params, "dmg");
    const finisher = num(params, "finisherDmg", base);
    const killBoost = num(params, "killBoost");
    // `ramp` grows each successive strike (Slugger's Roll Out: 1→2→3→4).
    const ramp = num(params, "ramp", 0);
    const pen = num(params, "pen") > 0;
    const queue = targets.slice(); // picked target first, then the rest
    let boost = 0; // escalation — local, so it lasts only for this combo
    for (let i = 0; i < hits; i++) {
      if (attacker.curHp <= 0) break; // died to REFLECT mid-combo
      const target = queue.find((t) => {
        const c = draft.cards[t.instanceId];
        return c && c.curHp > 0;
      });
      if (!target) break; // nothing left to hit
      const dmg = (i === hits - 1 ? finisher : base) + boost + i * ramp;
      const r = resolveHit(draft, attacker, target, { kind: "special", dmg, hits: 1, pen, crit: false });
      if (r.targetDied) {
        boost += killBoost;
        draft.log.push(`${label(draft, attacker)}'s combo surges (+${killBoost} to the next hit).`);
      }
    }
  },
  /** Single-target damage w/ optional pen, self-damage, self-heal, status. */
  strike(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target) return;
    // Devour (Snapmaw): a Special that only bites what is already held. barrage
    // has filtered on `requireStatus` for a long time; strike could not, so a
    // single-target conditional had to be written as a passive instead of as
    // the ability the card prints. Refused out loud — a Special that costs
    // magic and silently does nothing is the worst version of this.
    const needs = String(params.requireStatus ?? "");
    if (needs && !hasStatus(target, needs as StatusKind)) {
      draft.log.push(
        `${label(draft, attacker)} finds nothing to sink into — ${getDef(target.defId).name} is not ${needs}.`,
      );
      return;
    }
    const center = target.pos ? { ...target.pos } : null; // splash centre (target may die)
    // Rover (Rumbler): the roll comes BEFORE the bash — it closes the distance and
    // THEN hits, rather than striking from where it stood and repositioning
    // after. `chargeFirst` chooses which side of the strike the movement lands
    // on; without it `charge` keeps its original after-the-hit behaviour, which
    // is what every existing charger (Skelider, Shadow Horsemen, Skyrend) wants.
    const chargeFirst = num(params, "chargeFirst") > 0;
    if (chargeFirst && num(params, "charge") > 0 && center) {
      if (num(params, "chargeLateral") > 0)
        chargeToward(
          draft, attacker, num(params, "charge"), center,
          num(params, "trampleDmg"), num(params, "chargeDiagonal") > 0,
        );
      else chargeForward(draft, attacker, num(params, "charge"));
    }
    // Sunlight Strike: a bigger number against what this card hunts. Read
    // through the SAME matcher as the passive, so "vs Dragons" means one thing.
    // Snapshotted before the strike, or ThunderShot's conditional would be
    // satisfied by the PARALYZE the same cast just applied.
    const alreadyAfflicted = target.statuses.some((s) => NEGATIVE_STATUSES.includes(s.kind));
    const baneDmg = num(params, "dmgVsTarget");
    const dmgNow =
      baneDmg > 0 && matchesVsTarget(getDef(attacker.defId), target) ? baneDmg : num(params, "dmg");
    const r = resolveHit(draft, attacker, target, {
      kind: "special",
      dmg: dmgNow,
      hits: num(params, "hits", 1),
      pen: num(params, "pen") > 0,
      crit: false,
    });
    // TAKE THE SPOT. A charge that kills what it crashed into should end up
    // WHERE it crashed into — the ram stops in the hole it made, the dive lands
    // on the perch it just cleared. Without it both specials shoved a body one
    // slot short of its target and then stood there, which reads as the charge
    // stopping politely at the door.
    //
    // `center` is the target's position snapshotted BEFORE the strike, because
    // `defeatCard` deletes the instance — by the time we know it died there is
    // nothing left to ask where it stood.
    //
    // Guarded on the slot being genuinely free: a captured slot is off limits to
    // everyone, and something else can already be standing there (a splash kill
    // that shuffled bodies, a spawn-on-death filling its own corpse's square).
    if (num(params, "takeSpotOnKill") > 0 && r.targetDied && center
        && attacker.curHp > 0 && attacker.pos
        && !draft.slots[center.row][center.col].capturedBy
        && !cardAt(draft, center.row, center.col)) {
      attacker.pos = { row: center.row as Pos["row"], col: center.col };
      draft.log.push(`${label(draft, attacker)} takes the ground it cleared.`);
    }
    const killShields = num(params, "onKillSelfShields");
    if (r.targetDied && killShields > 0 && attacker.curHp > 0) {
      attacker.curShields += killShields;
      draft.log.push(`${label(draft, attacker)} basks in the kill (+${killShields} shield).`);
    }
    // …and the same trigger can pay in HP. Through `healCard`, not a raw add, so
    // it honours SEAL and cannot lift the attacker past its own maximum — the
    // two things every other heal in the game respects.
    const killHeal = num(params, "onKillSelfHeal");
    if (r.targetDied && killHeal > 0 && attacker.curHp > 0) {
      const got = healCard(draft, attacker, killHeal, attacker);
      if (got > 0) draft.log.push(`${label(draft, attacker)} drinks the kill (+${got} HP).`);
    }
    // Self-buff status only if the strike KILLED (Jungle Culling → STEALTH on kill).
    const onKillStatus = params.onKillSelfStatus;
    if (r.targetDied && typeof onKillStatus === "string" && onKillStatus && attacker.curHp > 0) {
      applyStatus(draft, attacker, onKillStatus as StatusKind, num(params, "onKillSelfStatusDuration", 1), 0, getDef(attacker.defId).element);
    }
    // Culling the Weak (Trinezer): a kill made BY this Special lifts the whole
    // side, permanently and cumulatively. Lives on the Special's params rather
    // than the card's onKill so it can't also fire off a basic attack.
    // …and in permanent DMG on the caster (Devour). The sibling of
    // onKillSelfShields/onKillSelfHeal above, and deliberately on the SPECIAL's
    // params rather than the card's `onKill`, so it cannot also fire off a
    // basic attack — Devour grows by devouring, not by plinking.
    const killDmg = num(params, "onKillSelfDmg");
    if (r.targetDied && killDmg > 0 && attacker.curHp > 0) {
      // A CEILING on permanent growth. Unbounded it is the Aurora pattern the
      // balance notes single out — a number that only ever goes up, on a card
      // that also creates its own prey (Snare Garden ROOTs, Devour reaches
      // anywhere) and heals off it. Nothing in a match stops the loop except
      // running out of match, which is not a limit, it is a duration.
      //
      // The cap is on the ACCUMULATED bonus rather than the number of kills, so
      // it reads the same however the rider is priced later.
      const cap = params.onKillSelfDmgMax == null
        ? Infinity : num(params, "onKillSelfDmgMax", 0);
      const room = cap - attacker.dmgBonus;
      const gain = Math.max(0, Math.min(killDmg, room));
      if (gain > 0) {
        attacker.dmgBonus += gain;
        draft.log.push(`${label(draft, attacker)} swallows it whole (+${gain} DMG, permanently).`);
      } else {
        draft.log.push(`${label(draft, attacker)} is glutted — it can grow no further.`);
      }
    }
    const cullBuff = num(params, "onKillAllyBuffDmg");
    if (r.targetDied && cullBuff > 0) {
      const kin = boardCards(draft, attacker.owner).filter((a) => a.curHp > 0);
      for (const a of kin) a.dmgBonus += cullBuff;
      if (kin.length)
        draft.log.push(
          `${getDef(attacker.defId).name} culls the weak — ${kin.length} ally(s) gain +${cullBuff} DMG, permanently.`,
        );
    }
    maybeStatus(draft, attacker, target, params);
    // A SECOND status alongside the primary (Bark's Night Spear = ROOT + MUTED).
    // barrage has long supported this rider; strike now matches it.
    const strikeDebuff = params.debuffStatus;
    if (typeof strikeDebuff === "string" && strikeDebuff && draft.cards[target.instanceId] && target.curHp > 0)
      applyStatus(draft, target, strikeDebuff as StatusKind, num(params, "debuffStatusRounds", 1), 0, getDef(attacker.defId).element);
    // ThunderShot (Havoc): a rider that only lands on a target ALREADY carrying
    // something. BOLT's whole identity is punishing the afflicted (its aura
    // reads "+1 DMG vs any statused target"), and this is the same idea spent
    // on control instead of damage — hit something clean and it is a paralyse,
    // hit something already held and it is silenced too. Checked BEFORE the
    // primary status is applied would make it self-satisfying, so it reads the
    // board as the Special found it.
    const ifStatused = params.statusIfAlready;
    if (
      typeof ifStatused === "string" && ifStatused && alreadyAfflicted
      && draft.cards[target.instanceId] && target.curHp > 0
    ) {
      applyStatus(draft, target, ifStatused as StatusKind, num(params, "statusIfAlreadyRounds", 1), 0, getDef(attacker.defId).element);
    }
    // Shared per-target riders (push, timed −SP). barrage has always called
    // these; strike had not, so a single-target Special could not sap speed.
    applyDebuffRiders(draft, target, params, attacker);
    // statusSplash (Fenix's Phoenix Blast): the applied status also spreads to
    // enemies adjacent (chess-king) to the struck slot.
    if (params.statusSplash && typeof params.statusKind === "string" && center) {
      const kind = params.statusKind as StatusKind;
      for (const e of enemyCards(draft, attacker.owner)) {
        if (e.instanceId === target.instanceId || !e.pos || e.curHp <= 0) continue;
        if (Math.max(Math.abs(e.pos.row - center.row), Math.abs(e.pos.col - center.col)) === 1)
          applyStatus(draft, e, kind, num(params, "statusDuration", 1), num(params, "statusPower"), getDef(attacker.defId).element);
      }
    }
    // Bog Ambush: haul the target into the caster's row BEFORE anything that
    // reads position, then blind it. Both riders are statusless on purpose.
    if (num(params, "dragToCaster") > 0 && attacker.pos && draft.cards[target.instanceId] && target.curHp > 0) {
      if (dragInto(draft, target, attacker.pos.row))
        draft.log.push(`${label(draft, attacker)} drags ${getDef(target.defId).name} into the bog.`);
    }
    // Bog Ambush: a PERMANENT speed cut — the muck clings. spBonus is the
    // permanent SP modifier, so this sticks for the game (no round countdown).
    const spPerm = num(params, "spDebuffPerm");
    if (spPerm > 0 && draft.cards[target.instanceId] && target.curHp > 0) {
      target.spBonus -= spPerm;
      draft.log.push(`${getDef(target.defId).name} is mired — ${spPerm} SP, permanently.`);
    }
    // Boon Striker (Sticks): sap the target's NEXT basic attack by N (statusless).
    const nextDebuff = num(params, "nextAtkDebuff");
    if (nextDebuff > 0 && draft.cards[target.instanceId] && target.curHp > 0)
      target.nextAttackDmgDebuff = nextDebuff;
    // Blinding light (Ariel's Dawning Assault): shake the target's aim — its own
    // attacks miss `targetAttackMissPct`% for `targetAttackMissRounds` rounds.
    const tMissPct = num(params, "targetAttackMissPct");
    if (tMissPct > 0 && draft.cards[target.instanceId] && target.curHp > 0) {
      target.attackMissPct = tMissPct;
      target.attackMissRounds = num(params, "targetAttackMissRounds", 1);
    }
    // Splash: reduced damage to enemies adjacent (chess-king) to the struck slot
    // (Dive Bomb 11, Shadow Charge 9).
    const splash = num(params, "splash");
    if (splash > 0 && center) {
      for (const e of enemyCards(draft, attacker.owner)) {
        if (e.instanceId === target.instanceId || !e.pos) continue;
        if (Math.max(Math.abs(e.pos.row - center.row), Math.abs(e.pos.col - center.col)) === 1) {
          directDamage(draft, attacker, e, splash, num(params, "pen") > 0);
          // splashStatus (Stormfang's Whirling Missile): the blast's rider lands
          // on everyone it catches, not just the card it was aimed at. Opt-in,
          // because every existing splash is damage-only and silently adding a
          // status to all of them would re-tune cards nobody touched.
          if (num(params, "splashStatus") > 0) maybeStatus(draft, attacker, e, params);
        }
      }
    }
    // splashAll (Valcana's Magma Rock Burst): a lesser burst to EVERY other
    // opponent on the board, not just the ones adjacent to the primary.
    const splashAll = num(params, "splashAll");
    if (splashAll > 0) {
      for (const e of enemyCards(draft, attacker.owner))
        if (e.instanceId !== target.instanceId && e.curHp > 0) directDamage(draft, attacker, e, splashAll, false);
    }
    const selfDamage = num(params, "selfDamage");
    if (selfDamage > 0 && attacker.curHp > 0) {
      attacker.curHp -= selfDamage;
      draft.log.push(`${label(draft, attacker)} pays ${selfDamage} HP.`);
      if (attacker.curHp <= 0) defeatCard(draft, attacker, "self-damage");
      else checkLowHpTransform(draft, attacker);
    }
    // Recoil: the caster takes back a % of the HP damage this strike dealt to the
    // main target (Skyrend's Dive Bomb). Self-inflicted and lethal — a dive that
    // lands hard enough can finish an already-wounded caster.
    const recoilPct = num(params, "recoilPct");
    if (recoilPct > 0 && r.totalToHp > 0 && attacker.curHp > 0) {
      const recoil = Math.round((r.totalToHp * recoilPct) / 100);
      if (recoil > 0) {
        attacker.curHp -= recoil;
        noteDamageFx(attacker, recoil);
        draft.log.push(`${label(draft, attacker)} takes ${recoil} recoil.`);
        if (attacker.curHp <= 0) defeatCard(draft, attacker, "recoil");
        else checkLowHpTransform(draft, attacker);
      }
    }
    const healSelf = num(params, "healSelf");
    if (healSelf > 0 && attacker.curHp > 0) healCard(draft, attacker, healSelf, attacker);
    // Lifesteal: heal the caster for the HP damage this strike dealt (Nightbriar's
    // Dark Hunting) — specials don't auto-lifesteal like basics do.
    if (num(params, "lifesteal") > 0 && r.totalToHp > 0 && attacker.curHp > 0)
      healCard(draft, attacker, r.totalToHp, attacker);
    if (attacker.curHp > 0) {
      adjacentCasterStatus(draft, attacker, params); // ROOT all adjacent (Squanch)
      applySelfRiders(draft, attacker, params);
    }
    // Charge: a move-and-strike special advances the attacker toward the enemy
    // home (up to `charge` open steps) after it hits — its reach came from the
    // ranged flag; this is the repositioning half of "move up to N and strike".
    // `chargeLateral` rides toward the slot it struck (sideways and diagonals
    // allowed) instead of straight up its own column.
    if (!chargeFirst && attacker.curHp > 0) {
      if (num(params, "rollThrough") > 0) chargeThrough(draft, attacker, num(params, "rollThrough"));
      else if (num(params, "charge") > 0) {
        if (num(params, "chargeLateral") > 0 && center)
          chargeToward(draft, attacker, num(params, "charge"), center);
        else chargeForward(draft, attacker, num(params, "charge"));
      }
    }
    // POUNCE AGAIN (Kato, Prowlform): spring a second time, re-picking the
    // target from where it LANDED rather than from where it started. That is the
    // whole point of a double pounce — the second leap is chosen by the board the
    // first one left behind, so killing the first target sends the cat somewhere
    // you did not expect.
    //
    // Nearest surviving enemy, ties by instanceId, so it is deterministic like
    // everything else in this mode. `pounceAgain` is STRIPPED from the params it
    // recurses with, which is what bounds this at exactly two.
    if (num(params, "pounceAgain") > 0 && attacker.curHp > 0 && attacker.pos) {
      const here = attacker.pos;
      const first = targets[0]?.instanceId;
      const next = enemyCards(draft, attacker.owner)
        .filter((e) => e.curHp > 0 && e.pos && draft.cards[e.instanceId])
        // A FRESH victim outranks distance: two pounces onto the same card is
        // just a big single hit, and the whole read of the move is the cat
        // bouncing between two of your cards. The one it already mauled is only
        // chosen when nothing else is left standing.
        .sort((a, b) =>
          Number(a.instanceId === first) - Number(b.instanceId === first)
          || chebyshev(here, a.pos!) - chebyshev(here, b.pos!)
          || a.instanceId.localeCompare(b.instanceId))[0];
      if (next) {
        const { pounceAgain: _drop, ...once } = params as Record<string, number | string>;
        void _drop;
        draft.log.push(`${label(draft, attacker)} lands and springs again.`);
        SPECIAL_HANDLERS.strike(draft, attacker, [next], once);
      }
    }
  },

  /** Battle Charge (WarPhant): rumble forward, then hit the column it is facing
   *  in two tiers — the FIRST opponent in the lane takes `dmg` and is driven
   *  back a slot, and every opponent packed CONTIGUOUSLY behind it takes
   *  `chainDmg`. The chain stops at the first gap: this is a mass of muscle
   *  shunting a stack, so it travels only as far as bodies are actually
   *  touching, not down the whole column. */
  battleCharge(draft, attacker, _targets, params) {
    if (num(params, "charge") > 0) chargeForward(draft, attacker, num(params, "charge"));
    const pos = attacker.pos;
    if (!pos) return;
    const dir = attacker.owner === "P1" ? -1 : 1; // toward the enemy home row
    // Everything ahead in this column, nearest first.
    const lane = enemyCards(draft, attacker.owner)
      .filter((e) => e.pos && e.pos.col === pos.col && (e.pos.row - pos.row) * dir > 0)
      .sort((a, b) => (a.pos!.row - pos.row) * dir - (b.pos!.row - pos.row) * dir);
    if (lane.length === 0) return;
    // Contiguous run: each next body must sit directly against the previous one.
    const run = [lane[0]];
    for (let i = 1; i < lane.length; i++) {
      if (Math.abs(lane[i].pos!.row - run[run.length - 1].pos!.row) !== 1) break;
      run.push(lane[i]);
    }
    const chain = num(params, "chainDmg");
    // Back to front, so a body shunted backwards cannot land on one that has
    // not been dealt with yet.
    for (let i = run.length - 1; i >= 1; i--)
      if (chain > 0) directDamage(draft, attacker, run[i], chain, num(params, "pen") > 0);
    const first = run[0];
    if (draft.cards[first.instanceId] && first.curHp > 0) {
      directDamage(draft, attacker, first, num(params, "dmg"), num(params, "pen") > 0);
      // Shoved AFTER the damage — a victim that died is already gone, and the
      // survivor gets driven off the slot the charge just claimed.
      if (draft.cards[first.instanceId] && first.curHp > 0)
        pushBack(draft, first, num(params, "push", 1), attacker);
    }
    draft.log.push(
      `${label(draft, attacker)} rumbles through ${run.length} opponent(s) in the lane.`,
    );
  },

  /** Damage to up to N valid enemy targets (chosen target first). Optional
   *  hits (dmg × hits per target), pen, crit, and a statusKind applied to each
   *  surviving target (FREEZE/BLIND/SCALD/PARALYZE nova). */
  barrage(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    // Rover (see strike): move BEFORE the volley. Deliberately above the target
    // filters below, so "everyone straight ahead" is read from where the charger
    // ENDS UP rather than where it started. Forward-only — `chargeLateral` has no
    // meaning for a volley with many targets, and neither barrage charger wants it.
    const chargeFirst = num(params, "chargeFirst") > 0;
    if (chargeFirst && num(params, "charge") > 0)
      chargeForward(draft, attacker, num(params, "charge"));
    // Timberer (Lumberjack): scope the volley to the row directly ahead — the
    // tree falls forward, it doesn't scatter across the board.
    // Wildfire (Scorch): scope the volley to the enemy's own home row.
    if (num(params, "enemyHomeRow") > 0) {
      const row = homeRow(enemyOf(attacker.owner), draft.boardSize);
      targets = targets.filter((t) => t.pos?.row === row);
    }
    // Battle Charge (WarPhant): "straight ahead" is the card's own column.
    if (num(params, "sameColumn") > 0 && attacker.pos) {
      const col = attacker.pos.col;
      targets = targets.filter((t) => t.pos?.col === col);
    }
    if (num(params, "rowAhead") > 0 && attacker.pos) {
      const row = rowAhead(attacker.owner, attacker.pos.row);
      targets = targets.filter((t) => t.pos?.row === row);
    }
    // requireStatus (Sentry's Static Blaster): only foes carrying the named
    // status are eligible — a paralyze-payoff nuke, not an unconditional AoE.
    const req = typeof params.requireStatus === "string" ? params.requireStatus : "";
    const pool = req ? targets.filter((t) => hasStatus(t, req as StatusKind)) : targets;
    // scaleDmg: fold the caster's permanent DMG bonus into each hit (Autumnal's
    // Fall's Emergence boosts Leaf Storm too).
    // Volatile Formula (Nitro): a coin flip on the whole volley — on the proc,
    // every hit lands for double.
    const dblPct = num(params, "doubleChance");
    const doubleProc = dblPct > 0 && pctChance(draft, dblPct);
    const dmg =
      (num(params, "dmg") +
        (num(params, "scaleDmg") > 0 ? attacker.dmgBonus : 0) +
        (getDef(attacker.defId).attackTrade?.bonusDmg ?? 0)) * // Ethereal Trade rides the Special too
      (doubleProc ? 2 : 1);
    if (doubleProc) draft.log.push(`${label(draft, attacker)}'s volatile formula goes critical — DOUBLE damage!`);
    // Timberer: ROOT only the FIRST target the volley lands on, not the row.
    const firstOnly = num(params, "firstOnlyStatus") > 0;
    // closest (Highroller's Purple Strikes): pick the N NEAREST foes rather than
    // whatever order the pool arrived in.
    const ordered =
      num(params, "closest") > 0 && attacker.pos
        ? [...pool].sort((a, b) => manhattan(attacker.pos!, a.pos!) - manhattan(attacker.pos!, b.pos!))
        : pool;
    let struck = 0;
    for (const target of ordered.slice(0, n)) {
      if (!draft.cards[target.instanceId]) continue;
      resolveHit(draft, attacker, target, {
        kind: "special",
        dmg,
        hits: num(params, "hits", 1),
        pen: num(params, "pen") > 0,
        crit: num(params, "crit") > 0,
        // Hunting Season: the volley is aimed, not sprayed — EVASION doesn't save you.
        alwaysHit: num(params, "alwaysHit") > 0,
        critAlways: num(params, "critAlways") > 0,
        // Incinerate (Sol) rides the Special too, not just basics. Seeded with
        // hits already landed on this target this round, same as basicAttack —
        // the ramp is "consecutive hits on the same target within a round",
        // and it shouldn't reset just because the hits came from a Special.
        incinerate: getDef(attacker.defId).incinerate,
        incinerateBase: attacker.struckThisRound[target.instanceId] ?? 0,
      });
      // pctMaxHpDmg (Dyna's Demolition Charge): a bomb sized to the target —
      // extra damage equal to a % of its MAX HP.
      //
      // MAX, not current, and the difference is the whole point. Off current HP
      // this landed after the flat damage and so read a body that was already
      // shrinking, which made it strongest against the healthiest target on the
      // board and negligible against a finished one. Off max HP it is a constant
      // the target cannot walk away from — the charge does not care how the
      // demolition is going.
      const pctHp = num(params, "pctMaxHpDmg");
      if (pctHp > 0 && draft.cards[target.instanceId] && target.curHp > 0)
        directDamage(draft, attacker, target, Math.floor((target.maxHp * pctHp) / 100), false);
      if (!firstOnly || struck === 0) maybeStatus(draft, attacker, target, params);
      struck++;
      // Bat Swarm: the volley feeds. DRAIN the keyword only rides basics, so a
      // Special that should drain has to ask for it.
      // NOTE this is max-HP theft ONLY, no lifesteal — unlike the DRAIN keyword.
      // Bat Swarm's text promises exactly that ("DRAIN 1 max HP from each") and
      // it fires at every target on the board, so healing per target would be a
      // different card.
      if (num(params, "drain") > 0 && draft.cards[target.instanceId] && target.curHp > 0)
        drainMaxHp(draft, attacker, target, num(params, "drain"));
      applyDebuffRiders(draft, target, params, attacker); // −SP (Angale, sinkhole)
      // A SECOND status alongside the primary (sinkhole = DOT + BLIND).
      const db = params.debuffStatus;
      if (typeof db === "string" && db && draft.cards[target.instanceId] && target.curHp > 0)
        applyStatus(draft, target, db as StatusKind, num(params, "debuffStatusRounds", 1), 0, getDef(attacker.defId).element);
      if (attacker.curHp <= 0) break; // died to REFLECT mid-volley
    }
    // Charging Tusks: the boar doesn't stop where it hit — it keeps going.
    // rollThrough phases PAST the body it just struck — chargeForward would stall
    // on it (the same trap Tumbleweed's Roll Through hit); plain `charge` keeps the
    // stop-at-first-body form for anything that wants it.
    if (!chargeFirst && attacker.curHp > 0) {
      if (num(params, "rollThrough") > 0) chargeThrough(draft, attacker, num(params, "rollThrough"));
      else if (num(params, "charge") > 0) chargeForward(draft, attacker, num(params, "charge"));
    }
    // Root Spring: the same burst that snares the enemy waters its own side.
    const healEl = typeof params.healAlliesElement === "string" ? params.healAlliesElement : "";
    const healAmt = num(params, "healAllies");
    if (healEl && healAmt > 0 && attacker.curHp > 0) {
      let touched = 0;
      for (const a of boardCards(draft, attacker.owner))
        if (getDef(a.defId).element === healEl && healCard(draft, a, healAmt, attacker.owner) > 0) touched++;
      if (touched) draft.log.push(`${label(draft, attacker)} waters ${touched} ${healEl} ally(ies) (+${healAmt} HP).`);
    }
    // farRowDmg (Aftermath's Explosion): a lesser burst on the row BEYOND the
    // adjacent one, so the blast reaches the enemy's back line too.
    const farRowDmg = num(params, "farRowDmg");
    const farRowStatus = num(params, "farRowStatus"); // reuse the volley's statusKind on the far row (Evera)
    const farStatusKind = typeof params.statusKind === "string" ? (params.statusKind as StatusKind) : null;
    if ((farRowDmg > 0 || (farRowStatus > 0 && farStatusKind)) && attacker.pos) {
      const far = rowAhead(attacker.owner, rowAhead(attacker.owner, attacker.pos.row));
      for (const e of enemyCards(draft, attacker.owner)) {
        if (e.curHp <= 0 || e.pos?.row !== far) continue;
        if (farRowDmg > 0) directDamage(draft, attacker, e, farRowDmg, false);
        if (farRowStatus > 0 && farStatusKind && draft.cards[e.instanceId] && e.curHp > 0)
          applyStatus(draft, e, farStatusKind, num(params, "statusDuration", 1), num(params, "statusPower"), getDef(attacker.defId).element);
      }
    }
    // farRowRootNext (Evera): the roots snake on — a DELAYED ROOT lands on the
    // far row at the START of next round (fired from Cleanup).
    if (num(params, "farRowRootNext") > 0) {
      (draft.players[attacker.owner].pendingFarRoots ??= []).push({
        roundsLeft: 1, // fires at the next Cleanup, rooting the far row for next round
        source: attacker,
        count: num(params, "farRowRootCount", 4),
        duration: num(params, "farRowRootDuration", 1),
      });
    }
    // stealShields (Ironclad's Magnetic Steel): pull up to N shields off each
    // struck foe and bank them onto the caster's own armour.
    //
    // `stealRowAheadOnly` narrows the THEFT to the row directly ahead while the
    // damage still lands board-wide — the magnet only reaches the rank it is
    // standing against, but the shockwave carries. Without it the steal follows
    // the same pool as the damage, which is how every other rider here behaves.
    const stealSh = num(params, "stealShields");
    if (stealSh > 0) {
      const aheadOnly = num(params, "stealRowAheadOnly") > 0 && attacker.pos != null;
      const reach = aheadOnly ? rowAhead(attacker.owner, attacker.pos!.row) : null;
      let stolen = 0;
      for (const t of pool.slice(0, n)) {
        if (reach !== null && t.pos?.row !== reach) continue;
        if (draft.cards[t.instanceId] && t.curShields > 0) {
          const got = Math.min(stealSh, t.curShields);
          t.curShields -= got; attacker.curShields += got; stolen += got;
        }
      }
      if (stolen) draft.log.push(`${label(draft, attacker)} magnetizes ${stolen} shield(s) away.`);
    }
    // spawnToken (SkullKing's King's SkullDrake): raise a token alongside the volley.
    if (typeof params.spawnToken === "string" && params.spawnToken)
      spawnTokens(draft, attacker, params.spawnToken, num(params, "spawnCount", 1), spawnRadiusOf(params));
    // cleanseAllies (Siphon's Cyclone): the winds scrub debuffs off the whole team.
    if (num(params, "cleanseAllies") > 0) {
      let cleaned = 0;
      for (const a of boardCards(draft, attacker.owner))
        if (a.curHp > 0 && a.statuses.length) { a.statuses = []; cleaned++; }
      if (cleaned) draft.log.push(`${label(draft, attacker)}'s cyclone clears ${cleaned} ally(ies).`);
    }
    // Shimmering Featherrows: loose the volley, then vanish back into the light.
    if (num(params, "stealthRounds") > 0 && attacker.curHp > 0)
      applyStatus(draft, attacker, "STEALTH", num(params, "stealthRounds"), 0, getDef(attacker.defId).element);
    // Self-cost (Kraken's Black Wave Crash: "Lose 5 HP") — can dip the caster
    // low enough to trip its own From the Deep surge.
    const selfDamage = num(params, "selfDamage");
    if (selfDamage > 0 && attacker.curHp > 0) {
      attacker.curHp -= selfDamage;
      draft.log.push(`${label(draft, attacker)} pays ${selfDamage} HP.`);
      if (attacker.curHp <= 0) defeatCard(draft, attacker, "self-damage");
      else checkLowHpTransform(draft, attacker);
    }
    // Self-riders (Timberer's brace, Volcanon's ramp) — barrage never applied
    // these, so any `self*` param on a barrage Special was silently inert.
    applySelfRiders(draft, attacker, params);
  },

  /** Apply a status to up to N valid enemy targets (unique — stacking a
   *  status on one target is meaningless, newest overwrites). */
  statusNova(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    const seen = new Set<string>();
    for (const target of targets) {
      if (seen.has(target.instanceId)) continue;
      if (seen.size >= n) break;
      seen.add(target.instanceId);
      maybeStatus(draft, attacker, target, params);
      // A SECOND status alongside the primary (Soul Snare = SLEEP + WEAKEN).
      // strike and barrage have both carried this rider for a while; statusNova
      // is the pure-status handler and was the one that could not stack two.
      const novaSecond = params.debuffStatus;
      if (typeof novaSecond === "string" && novaSecond && draft.cards[target.instanceId] && target.curHp > 0)
        applyStatus(draft, target, novaSecond as StatusKind, num(params, "debuffStatusRounds", 1), 0, getDef(attacker.defId).element);
      applyDebuffRiders(draft, target, params, attacker); // Mighty Winds push + −SP
      // Bluflames (Sarra): mark the target so it can't be healed.
      const sealR = num(params, "sealRounds");
      if (sealR > 0 && target.curHp > 0 && draft.cards[target.instanceId])
        applyStatus(draft, target, "SEAL", sealR, 0, getDef(attacker.defId).element);
    }
    // Solara's Blinding Sunrise also calls another Radiant Guardian to her side.
    const spawnTok = typeof params.spawnToken === "string" ? params.spawnToken : "";
    if (spawnTok && attacker.curHp > 0)
      spawnCapped(draft, attacker, spawnTok, num(params, "spawnCount", 1), spawnRadiusOf(params),
        params.spawnMaxAlive == null ? Infinity : num(params, "spawnMaxAlive", 0));
    applySelfRiders(draft, attacker, params); // e.g. Dreadgaze's +5 max HP
  },
  /** Thunder Strike (Storm): pure damage to every opponent carrying a required
   *  status (ELECTRIFIED) — ignores range, so it reaches whatever BOLT has
   *  already lit up. */
  smite(draft, attacker, _targets, params) {
    const dmg = num(params, "dmg");
    const need = String(params.requireStatus ?? "");
    const pen = num(params, "pen") > 0;
    const foes = enemyCards(draft, attacker.owner).filter(
      (e) => e.curHp > 0 && (!need || hasStatus(e, need as StatusKind)),
    );
    for (const f of foes) {
      if (attacker.curHp <= 0) break;
      directDamage(draft, attacker, f, dmg, pen);
    }
    draft.log.push(`${label(draft, attacker)}'s Thunder Strike hits ${foes.length} ${need ? need.toLowerCase() : "enemy"}(s) for ${dmg}.`);
  },
  /** 5 Wicked Frag (Wick's Talent): a heavy hit on the chosen target and a
   *  smaller splash to every other opponent. */
  fragBlast(draft, attacker, targets, params) {
    const dmg = num(params, "dmg");
    const splash = num(params, "splash");
    const primary = targets[0];
    if (primary && primary.curHp > 0) directDamage(draft, attacker, primary, dmg, false);
    for (const e of enemyCards(draft, attacker.owner)) {
      if (e.curHp > 0 && e.instanceId !== primary?.instanceId) directDamage(draft, attacker, e, splash, false);
    }
    draft.log.push(`${label(draft, attacker)}'s frag bursts (${dmg} to the target, ${splash} to the rest).`);
  },
  /**
   * STORM CALL / EYE OF THE STORM (Skybreaker): one Special with two faces,
   * chosen by whether the storm is already on the board.
   *
   *   · no hurricane standing -> CALL one. It arrives and does what it does on
   *     arrival; this handler does not duplicate that, it just puts it there.
   *   · a hurricane standing  -> EYE OF THE STORM. Trade places with it, run
   *     its Wind Wake again from wherever it now stands, and blast everything
   *     within `reach` of Skybreaker's NEW slot for `dmg`, PARALYZED.
   *
   * The teleport is the whole design. Skybreaker never walks — it has no
   * movement tick at all — so the hurricane IS its movement, and the player
   * decides where the boss ends up by deciding where to let the storm sit.
   * Killing the hurricane strands the boss at home; leaving it alive hands the
   * boss a blink into your line. That is the puzzle, and both answers cost
   * something, which is what keeps it from having a correct answer.
   *
   * `escalateIfPresent` on the stock `spawn` handler is the same SHAPE and not
   * the same thing: that swaps which TOKEN is raised, and this swaps the whole
   * effect.
   */
  stormCall(draft, attacker, _targets, params) {
    const token = String(params.token ?? "");
    if (!token) return;
    const mine = boardCards(draft, attacker.owner);
    const storm = mine.find((c) => c.curHp > 0 && c.defId === token && c.pos);

    if (!storm) {
      // GATHERING STORM, and it has to be gated here or it never happens at all.
      // The boss's `spawnOnRound` promises the hurricane forms on a named round
      // — the card text calls it "the one thing in this fight a player can plan
      // around exactly" — but the clock fires this Special on round THREE, this
      // face called a storm then, and the round-6 tick therefore always found
      // one already alive. Measured: `spawnOnRound` fired 0 times in 48 fights
      // while this handler ran 327 times. A named passive that never once ran,
      // and a boss that got its legs three rounds early.
      //
      // Read from the boss's OWN roundTick rather than a param, so the round
      // lives in exactly one place and the two halves cannot drift apart again.
      const gathersOn = getDef(attacker.defId).roundTick?.spawnOnRound?.round ?? 0;
      if (draft.round < gathersOn) {
        draft.log.push(`${label(draft, attacker)} reaches for the storm — it has not gathered yet.`);
        return;
      }
      const born = spawnTokens(draft, attacker, token, 1);
      draft.log.push(
        born.length
          ? `${label(draft, attacker)} calls the storm — ${getDef(token).name} forms.`
          : `${label(draft, attacker)} reaches for the storm, but there is nowhere for it to form.`,
      );
      return;
    }

    // EYE OF THE STORM. Swap first: the blast is measured from where the boss
    // ENDS UP, which is the entire reason to cast it.
    if (!attacker.pos || !storm.pos) return;
    const tmp = attacker.pos;
    attacker.pos = storm.pos;
    storm.pos = tmp;
    draft.log.push(`${label(draft, attacker)} steps into the eye — it and ${getDef(token).name} trade places.`);

    // Wind Wake again, from THE HURRICANE's new footing — `storm`, which the
    // swap above has just put where the boss was standing. Not the boss: a push
    // now blows a body away from the card causing it, and the boss is standing
    // on the blast centre, so waking from the boss scatters the field out of
    // the very blast that follows and Eye of the Storm reliably hits nothing.
    // That is the melee version's self-defeat, back again by another door.
    //
    // Waking from the hurricane is also just what the line always claimed to
    // do. Under the old rule a push was aimed by the VICTIM's home row, so the
    // pusher was only ever a source of Jetstream bonuses and the comment could
    // not be wrong; now the pusher names a direction, and the two halves of the
    // Special blow the field toward each other exactly as designed.
    const wake = getDef(token).roundTick?.pushEnemies ?? 0;
    if (wake > 0) {
      for (const e of enemyCards(draft, attacker.owner))
        if (e.curHp > 0) pushBack(draft, e, wake, storm);
      draft.log.push(`${getDef(token).name}'s wind wake breaks over the field.`);
    }

    const dmg = num(params, "dmg");
    const reach = num(params, "reach", 1);
    const rounds = num(params, "statusDuration", 2);
    let caught = 0;
    for (const e of enemyCards(draft, attacker.owner)) {
      if (e.curHp <= 0 || !e.pos || !attacker.pos) continue;
      if (chebyshev(e.pos, attacker.pos) > reach) continue;
      resolveHit(draft, attacker, e, { kind: "special", dmg, hits: 1, pen: false, crit: false });
      // Status AFTER the hit: a body that died to the blast is not paralysed,
      // it is dead, and `applyStatus` on a corpse is a line in the log nobody
      // can act on.
      if (draft.cards[e.instanceId] && draft.cards[e.instanceId].curHp > 0) {
        applyStatus(draft, draft.cards[e.instanceId], "PARALYZE", rounds, 0, getDef(attacker.defId).element);
        caught++;
      }
    }
    draft.log.push(`The eye passes — ${caught} opponent(s) held for ${rounds} round(s).`);
  },

  /**
   * ROLLING BOULDER (Continental): lob a rock at ONE opponent, anywhere on the
   * board, for `dmg`.
   *
   * Random rather than chosen, and range-free rather than aimed — which makes
   * it the one thing in this fight the player cannot position against. Every
   * other threat Continental carries is answered by standing somewhere: the
   * boulders roll in straight lines, the giant walks at your biggest hitter,
   * and both can be read a round ahead. This cannot, so a line that has solved
   * the rest of the fight is still taking chip damage.
   *
   * The RNG is the match's seeded stream, so it is deterministic — a replay is
   * a replay. `chanceProblems` is untroubled because that rule forbids a card
   * PRINTING a percentage, not seeded selection; `randomEnemyDmg` (Elephlora)
   * is the same idea as a round-tick.
   */
  boulderThrow(draft, attacker, _targets, params) {
    const live = enemyCards(draft, attacker.owner).filter((e) => e.curHp > 0 && e.pos);
    if (!live.length) return;
    const victim = live[randInt(draft, live.length)];
    const dmg = num(params, "dmg");
    // WHERE IT WAS STANDING, read BEFORE the hit — a defeated card's `pos` is
    // gone by the time `resolveHit` returns, and the square is the whole point
    // of the rider below.
    const where = victim.pos ? { ...victim.pos } : null;
    const name = label(draft, victim);
    resolveHit(draft, attacker, victim, { kind: "special", dmg, hits: 1, pen: false, crit: false });
    draft.log.push(`${label(draft, attacker)} hurls a boulder at ${name} (${dmg}).`);

    // THE ROCK STAYS WHERE IT LANDED. On a kill the boulder is not spent — it
    // settles in the hole the body left and rolls on from there, so every kill
    // this Special makes becomes a permanent piece of board the player has to
    // deal with rather than a one-off 35 damage.
    //
    // Guarded on the square actually being FREE: the victim's slot is vacated
    // by `defeatCard`, but a captured slot, or a body shoved into the gap by
    // something resolving first, would make this an overwrite.
    const spawn = String(params.spawnOnKill ?? "");
    const dead = !draft.cards[victim.instanceId] || draft.cards[victim.instanceId].curHp <= 0;
    // ...UP TO A CEILING. Rockfall prints `spawnMaxAlive` and the round tick
    // honours it, but this rider never did, so the cap bound one of the two
    // sources and the other poured rocks in over the top of it — which is why
    // moving that cap 3 -> 1 measured nothing at all. `maxAlive` is its own
    // param rather than a read of the tick's: the two are different taps and a
    // shared number would tie them together by accident rather than on purpose.
    // Absent = uncapped, so no other caller changes.
    const cap = num(params, "maxAlive", 0);
    const rolling = cap > 0
      ? boardCards(draft, attacker.owner).filter((c) => c.curHp > 0 && c.defId === spawn).length
      : 0;
    if (spawn && dead && where && (cap <= 0 || rolling < cap)
        && !draft.slots[where.row][where.col].capturedBy
        && !boardCards(draft).some((c) => c.pos?.row === where.row && c.pos.col === where.col)) {
      const born = summonCard(draft, attacker.owner, spawn, where as never);
      born.summonedThisRound = false;
      // It rolls from the NEXT round like every other loosed boulder — see
      // `rollHeld`. A rock that appeared and immediately moved would never be
      // seen in the square it was supposed to take.
      born.rollHeld = true;
      draft.log.push(`The boulder settles where ${name} stood.`);
    }
  },

  /** Search and Rescue (Stone's Talent): swap board positions with a chosen
   *  ally — pull a hurt teammate out of the line, or dive in yourself. */
  swapAlly(draft, attacker, targets, _params) {
    const ally = targets.find(
      (t) => t.owner === attacker.owner && t.instanceId !== attacker.instanceId && t.curHp > 0 && t.pos,
    );
    if (!ally || !attacker.pos || !ally.pos) return;
    const tmp = attacker.pos;
    attacker.pos = ally.pos;
    ally.pos = tmp;
    draft.log.push(`${label(draft, attacker)} trades places with ${label(draft, ally)}.`);
  },
  /** Surfs Up (Tide): a wave that hits the enemy row directly ahead and buoys
   *  the whole crew. */
  surfsUp(draft, attacker, _targets, params) {
    const dmg = num(params, "dmg");
    const heal = num(params, "heal");
    if (attacker.pos) {
      const row = rowAhead(attacker.owner, attacker.pos.row);
      for (const e of enemyCards(draft, attacker.owner))
        if (e.curHp > 0 && e.pos?.row === row)
          resolveHit(draft, attacker, e, { kind: "special", dmg, hits: 1, pen: false, crit: false });
    }
    if (heal > 0) for (const a of boardCards(draft, attacker.owner)) if (a.curHp > 0) healCard(draft, a, heal, attacker);
    draft.log.push(`${label(draft, attacker)} sends a wave ahead (${dmg}) and buoys the crew (+${heal} HP).`);
  },
  /** Shell Tuck (Tide's Talent): plate up hard, at the cost of a couple of rounds
   *  of shaky aim. */
  shellTuck(draft, attacker, _targets, params) {
    const sh = num(params, "shields");
    attacker.curShields += sh;
    attacker.attackMissPct = num(params, "missPct");
    attacker.attackMissRounds = num(params, "missRounds");
    draft.log.push(`${label(draft, attacker)} tucks into its shell (+${sh} shields, aim shaken ${attacker.attackMissRounds}r).`);
  },
  /** Electro Surge (Surge): re-arm the reactive charge, plate up, and surge with
   *  a timed DMG boost. */
  electroSurge(draft, attacker, _targets, _params) {
    const es = getDef(attacker.defId).electroSurge;
    attacker.electroSurgeActive = true;
    // The stored charge has to go somewhere. Casting is this round's whole
    // action, so the shot is necessarily thrown on a LATER round — "one ranged
    // attack on the next turn" falls out of that without a round counter.
    // Set, not added: re-arming early does not stockpile shots.
    if (es?.rangedShots) {
      attacker.rangedShotsLeft = es.rangedShots;
      draft.log.push(
        `${label(draft, attacker)} stores a charge — its next attack strikes at range.`,
      );
    }
    if (es?.shield) attacker.curShields += es.shield;
    if (es?.dmgBoost) applyTimedBuff(attacker, es.dmgBoost, 0, es.boostRounds);
    draft.log.push(`${label(draft, attacker)} charges its Electro Surge (+${es?.shield ?? 0} shield, +${es?.dmgBoost ?? 0} DMG for ${es?.boostRounds ?? 0}r).`);
  },
  /** Spraying Thunder (General): rake the row directly ahead with the currently
   *  equipped Basic Attack Weapon (its dmg × hits). */
  sprayWeapon(draft, attacker, _targets, _params) {
    if (!attacker.pos) return;
    // The NEAREST `targets` opponents anywhere on the board, not the row ahead.
    //
    // A row-scoped spray on a Ranged card was hostage to how the enemy happened
    // to be arranged: against a column, or against anything not standing in the
    // single row in front of it, General's whole Special hit nobody at all. The
    // nearest-N shape always finds a target while still rewarding position —
    // closing the distance is what decides who is caught.
    const n = num(_params, "targets", 3);
    const foes = enemyCards(draft, attacker.owner)
      .filter((e) => e.curHp > 0 && e.pos)
      .sort((a, b) => manhattan(attacker.pos!, a.pos!) - manhattan(attacker.pos!, b.pos!))
      .slice(0, n);
    const dmg = effectiveDmg(draft, attacker);
    const hits = effectiveBasicHits(attacker);
    // Re-checked per target: the weapon fires several times and an earlier
    // volley can kill a body or the attacker (REFLECT, thorns) mid-spray.
    for (const e of foes) {
      if (attacker.curHp <= 0 || !draft.cards[e.instanceId] || e.curHp <= 0) continue;
      resolveHit(draft, attacker, e, { kind: "special", dmg, hits, pen: false, crit: false });
    }
    draft.log.push(`${label(draft, attacker)} sprays thunder across ${foes.length} foe(s) (${dmg}×${hits}).`);
  },
  /** Flying Flame Strike (FireFly): a spray of 1-DMG hits across up to N distinct
   *  opponents, then a forward reposition. */
  flameStrike(draft, attacker, targets, params) {
    const dmg = num(params, "dmg", 1);
    const n = num(params, "targets", 8);
    // Random targeting: shuffle the eligible opponents with the game RNG
    // (Math.random is banned in the engine) and spray the first N.
    const pool = targets.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(draft, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let hit = 0;
    for (const t of pool.slice(0, n)) {
      if (draft.cards[t.instanceId] && t.curHp > 0 && attacker.curHp > 0) {
        resolveHit(draft, attacker, t, { kind: "special", dmg, hits: 1, pen: false, crit: false });
        hit++;
      }
    }
    if (num(params, "move") > 0 && attacker.curHp > 0) chargeForward(draft, attacker, num(params, "move"));
    draft.log.push(`${label(draft, attacker)}'s Flying Flame Strike scorches ${hit} target(s).`);
  },
  /** Dark Warp (Ender): swap places with an opponent and blast it. */
  darkWarp(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target || !target.pos || !attacker.pos) return;
    const tmp = attacker.pos;
    attacker.pos = target.pos;
    target.pos = tmp;
    draft.log.push(`${label(draft, attacker)} warps in, swapping with ${label(draft, target)}.`);
    resolveHit(draft, attacker, target, { kind: "special", dmg: num(params, "dmg", 8), hits: 1, pen: false, crit: false });
  },
  /** Bloody Exchange (Violet): DRAIN 2 max HP from every card on the board and
   *  bank the whole total onto Violet's own max HP. */
  bloodyExchange(draft, attacker, _targets, params) {
    const per = num(params, "amount", 2);
    let total = 0;
    for (const c of boardCards(draft)) {
      if (c.instanceId === attacker.instanceId || c.curHp <= 0) continue;
      const take = Math.min(per, c.maxHp - 1);
      if (take > 0) {
        c.maxHp -= take;
        c.curHp = Math.min(c.curHp, c.maxHp);
        total += take;
      }
    }
    if (total > 0) {
      gainMaxHp(attacker, total);
      healCard(draft, attacker, Math.floor(total / 2), attacker); // heal for HALF the drained total
      draft.log.push(`${label(draft, attacker)}'s Bloody Exchange drains ${total} HP to itself.`);
    }
  },
  /** Orbital Shot (Zenith): mark a target; a 14-DMG arrow falls on it next round. */
  orbitalShot(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target) return;
    const arrows = (draft.players[attacker.owner].pendingArrows ??= []);
    arrows.push({ round: draft.round + 1, dmg: num(params, "dmg", 14), targetId: target.instanceId, source: attacker });
    draft.log.push(`${label(draft, attacker)} paints ${label(draft, target)} — an arrow falls next round.`);
  },
  /** Lacing Knots (Tether): reap every opponent still bound by Magic Ropes (i.e. with
   *  locked Specials). */
  lacingKnots(draft, attacker, _targets, params) {
    const dmg = num(params, "dmg", 8);
    const roped = enemyCards(draft, attacker.owner).filter((e) => e.curHp > 0 && (e.specialLockedRounds ?? 0) > 0);
    for (const e of roped) resolveHit(draft, attacker, e, { kind: "special", dmg, hits: 1, pen: false, crit: false });
    draft.log.push(`${label(draft, attacker)} yanks the knots — ${dmg} DMG to ${roped.length} bound foe(s).`);
  },
  /** Sweep (Brute): swing at every opponent in the row directly ahead with a
   *  basic attack, gaining shields per kill. */
  sweep(draft, attacker, _targets, params) {
    if (!attacker.pos) return;
    // EVERY opponent in range, not the row ahead. `validTargets` is the same
    // list the basic attack itself offers, so the sweep reaches exactly what
    // Brute could have hit one at a time — and inherits FLYING, STEALTH and the
    // Home-Slot rule instead of re-deriving them. The row-ahead version missed
    // anything standing beside it and swung at an empty row when the enemy had
    // stepped off the lane.
    const foes = validTargets(draft, attacker.instanceId)
      .filter((e) => e.curHp > 0 && e.owner !== attacker.owner);
    const per = num(params, "shieldPerKill", 2);
    let kills = 0;
    for (const foe of foes) {
      if (!draft.cards[foe.instanceId] || foe.curHp <= 0 || attacker.curHp <= 0) continue;
      const r = basicAttack(draft, attacker.instanceId, foe.instanceId);
      if (r?.targetDied) kills++;
    }
    if (kills > 0) {
      attacker.curShields += per * kills;
      draft.log.push(`${label(draft, attacker)} sweeps ${kills} down (+${per * kills} shields).`);
    }
  },
  /** Diagnosis / Red Shift (Plaguecrow + its RedRaven): quarantine opponents out
   *  of their Specials for the round. */
  lockSpecials(draft, attacker, targets, params) {
    const n = num(params, "count", 99);
    const rounds = num(params, "rounds", 1);
    const pool = targets.length ? targets : enemyCards(draft, attacker.owner);
    let locked = 0;
    for (const e of pool) {
      if (e.curHp > 0 && e.owner !== attacker.owner && locked < n) {
        e.specialLockedRounds = Math.max(e.specialLockedRounds ?? 0, rounds);
        locked++;
      }
    }
    draft.log.push(`${label(draft, attacker)} locks ${locked} opponent(s) out of their Specials.`);
  },
  /** Vengeance (Bolder): hurl back the damage it soaked this round (with PEN) and
   *  SLEEP an opponent. */
  vengeance(draft, attacker, targets, params) {
    const dmg = attacker.dmgTakenThisRound ?? 0;
    const primary = targets[0];
    if (primary && primary.curHp > 0 && dmg > 0) {
      draft.log.push(`${label(draft, attacker)} avenges ${dmg} damage (PEN).`);
      directDamage(draft, attacker, primary, dmg, true);
    }
    const sleepTarget = targets.find((t) => t.curHp > 0 && draft.cards[t.instanceId]);
    if (sleepTarget) applyStatus(draft, sleepTarget, "SLEEP", num(params, "sleep", 2), 0, getDef(attacker.defId).element);
  },
  /** Diamond Assault (Kimberlite): 5 DMG to two opponents, then bank shields equal to
   *  the amount broken. */
  diamondAssault(draft, attacker, targets, params) {
    const dmg = num(params, "dmg", 5);
    const n = num(params, "targets", 2);
    let broken = 0;
    for (const target of targets.slice(0, n)) {
      if (!draft.cards[target.instanceId] || target.curHp <= 0) continue;
      const before = target.curShields;
      resolveHit(draft, attacker, target, { kind: "special", dmg, hits: 1, pen: false, crit: false });
      broken += Math.max(0, before - (draft.cards[target.instanceId]?.curShields ?? 0));
    }
    if (broken > 0) {
      attacker.curShields += broken;
      draft.log.push(`${label(draft, attacker)} hardens (+${broken} shields from the break).`);
    }
  },
  /** Scoped 50GAL (Cloudburst): load extra shots onto the NEXT basic so it can spread
   *  across up to N targets (Bleed Out's loaded-darts mechanic). */
  scopeUp(draft, attacker, _targets, params) {
    attacker.loadedHits += num(params, "hits", 2);
    draft.log.push(`${label(draft, attacker)} scopes in — its next shot spreads to up to ${getDef(attacker.defId).hits + attacker.loadedHits} targets.`);
  },
  /** Light Orb Creation (Aurora): conjure the three orbs (blue/green/red). */
  spawnOrbs(draft, attacker, _targets, _params) {
    attacker.orbs = [...ORB_KINDS];
    draft.log.push(`${label(draft, attacker)} conjures 3 Light Orbs (blue · green · red).`);
  },
  /** Sea Terror (Siren): transform into another card. It takes on the new form's
   *  stats and fires that form's On Summon; when the form dies it reverts (see
   *  defeatCard). */
  transform(draft, attacker, _targets, params) {
    const into = String(params.into ?? "");
    if (!into) return;
    const newDef = getDef(into);
    attacker.transformedFrom = attacker.defId;
    attacker.defId = into;
    // Take the new form's fresh body; wipe the old form's stat mods.
    attacker.maxHp = newDef.hp;
    attacker.curHp = newDef.hp;
    attacker.curShields = newDef.shields;
    attacker.dmgBonus = 0;
    attacker.spBonus = 0;
    attacker.hitsBonus = 0;
    attacker.buffs = [];
    draft.log.push(`${label(draft, attacker)} erupts — it transforms into ${newDef.name}!`);
    // Fire the new form's On Summon (Krakler's Abyssal Grasp).
    const os = newDef.onSummon;
    if (os?.handler) {
      const handler = SPECIAL_HANDLERS[os.handler];
      if (handler) handler(draft, attacker, enemyCards(draft, attacker.owner).filter((e) => e.curHp > 0), os.params ?? {});
    }
  },
  /** Grand Finally (Dynomight): a two-tier blast — big to the adjacent row,
   *  smaller to everyone else — paid for with a chunk of its own HP. */
  grandFinally(draft, attacker, _targets, params) {
    const near = num(params, "nearDmg", 6);
    const far = num(params, "farDmg", 4);
    const row = attacker.pos ? rowAhead(attacker.owner, attacker.pos.row) : -99;
    for (const e of enemyCards(draft, attacker.owner)) {
      if (e.curHp <= 0) continue;
      resolveHit(draft, attacker, e, { kind: "special", dmg: e.pos?.row === row ? near : far, hits: 1, pen: false, crit: false });
    }
    const cost = num(params, "selfDamage", 2);
    if (cost > 0) {
      attacker.curHp = Math.max(0, attacker.curHp - cost);
      draft.log.push(`${label(draft, attacker)}'s grand finale costs it ${cost} HP.`);
      if (attacker.curHp <= 0 && draft.cards[attacker.instanceId]) defeatCard(draft, attacker, "Grand Finally recoil");
    }
  },
  /** Dragon's Dance (Rubyscale): an escalating 1 → 2 → 4 flurry split across up to 3
   *  targets, a burst of SP, and — while a Greegon still guards it — a heavy
   *  finishing blow (Ancient Protection). */
  dragonDance(draft, attacker, targets, params) {
    const steps = [num(params, "d1", 1), num(params, "d2", 2), num(params, "d3", 4)];
    for (let i = 0; i < steps.length; i++) {
      if (attacker.curHp <= 0) break;
      const pool = targets.filter((t) => draft.cards[t.instanceId] && t.curHp > 0);
      const t = pool[i] ?? pool[0];
      if (!t) break;
      resolveHit(draft, attacker, t, { kind: "special", dmg: steps[i], hits: 1, pen: false, crit: false });
    }
    if (num(params, "sp") > 0) applyTimedBuff(attacker, 0, num(params, "sp"), 1);
    const gtok = String(params.greegonToken ?? "");
    if (
      num(params, "greegonBonus") > 0 && gtok && attacker.curHp > 0 &&
      boardCards(draft, attacker.owner).some((a) => a.curHp > 0 && a.defId === gtok)
    ) {
      const foe = enemyCards(draft, attacker.owner).find((e) => e.curHp > 0);
      if (foe) {
        draft.log.push(`${label(draft, attacker)}'s ancient protector strikes for ${num(params, "greegonBonus")}!`);
        directDamage(draft, attacker, foe, num(params, "greegonBonus"), false);
      }
    }
  },
  /** Toxic Contagion (Venomarch): SLEEP a target and rot it with a DOT. */
  toxicContagion(draft, attacker, targets, params) {
    const t = targets[0];
    if (!t || t.curHp <= 0) return;
    const el = getDef(attacker.defId).element;
    applyStatus(draft, t, "SLEEP", num(params, "sleep", 1), 0, el);
    applyStatus(draft, t, "DOT", num(params, "dotDuration", 2), num(params, "dotPower", 3), el);
    // Arm the burst. It fires from defeatCard (the single death choke-point) so
    // it pays out however the body finally drops — the poison tick itself, a
    // later attack, a round effect — rather than only on an immediate kill.
    const splash = num(params, "deathSplash");
    if (splash > 0) t.toxicSplash = { dmg: splash, by: attacker.instanceId };
    draft.log.push(`${label(draft, attacker)} infects ${label(draft, t)} — SLEEP + POISON.`);
  },
  /** Smog (Aftermath): lay a smoke screen — attacks on the owner's cards start
   *  whiffing (reuses the fog mechanic). */
  smokeScreen(draft, attacker, _targets, params) {
    draft.players[attacker.owner].foggedRounds = num(params, "rounds", 2);
    // Written explicitly, not left to the default: Misty may have laid a
    // thinner fog earlier in the match, and a paid Special must not inherit it.
    draft.players[attacker.owner].foggedPct = num(params, "missPct", FOG_MISS_PCT);
    draft.log.push(`${label(draft, attacker)} blankets the field in smoke (${num(params, "rounds", 2)}r).`);
  },
  /** Golden Guardian (Leo): a sustained heal-over-time — +N HP each round for a
   *  stretch (reuses the shared regen tick). */
  regenBuff(draft, attacker, _targets, params) {
    attacker.regenRoundsLeft = num(params, "rounds", 7);
    attacker.regenPower = num(params, "power", 5);
    draft.log.push(`${label(draft, attacker)} basks in golden light (+${attacker.regenPower} HP/round for ${attacker.regenRoundsLeft}r).`);
  },
  /** Leafy Cloak (Splint): vanish into STEALTH and regenerate for a few rounds. */
  cloak(draft, attacker, _targets, params) {
    applyStatus(draft, attacker, "STEALTH", num(params, "stealth", 3), 0, getDef(attacker.defId).element);
    attacker.regenRoundsLeft = num(params, "regenRounds", 3);
    attacker.regenPower = num(params, "regen", 3);
    draft.log.push(`${label(draft, attacker)} slips into a leafy cloak (STEALTH + REGEN).`);
  },
  /** Flash Squad (Sunbanner): order the allies in the row ahead to each fire a
   *  basic attack. */
  flashSquad(draft, attacker, _targets, _params) {
    if (!attacker.pos) return;
    // The squad is the line Sunbanner is standing IN plus the line directly
    // ahead of it — the rank beside it and the rank it is pushing forward. The
    // caster is excluded: it is spending its turn on the order, not swinging.
    //
    // Sunbanner is a Melee Tank that wants to be at the front, and commanding
    // only the row ahead meant the further forward it got the fewer allies were
    // left ahead of it to command — the Special did least exactly when the card
    // was doing its job.
    const ahead = rowAhead(attacker.owner, attacker.pos.row);
    const rows = new Set([attacker.pos.row, ahead]);
    // Snapshot by ID, then re-look-up: a kill mid-command can remove bodies from
    // draft.cards or spawn new ones, and a held object reference would go stale.
    const squad = boardCards(draft, attacker.owner)
      .filter((a) => a.instanceId !== attacker.instanceId && a.curHp > 0 && a.pos != null && rows.has(a.pos.row))
      .map((a) => a.instanceId);
    let acted = 0;
    for (const id of squad) {
      const a = draft.cards[id];
      if (!a || a.curHp <= 0 || !a.pos) continue;
      // NEAREST reachable foe, not the first one the board happens to list.
      // Arbitrary picks matter more now that the squad is twice the size, and
      // this is what the sibling mechanic (Imperator's commandAllies) already
      // does — two "order your army to swing" effects should aim alike.
      const prey = enemyCards(draft, attacker.owner)
        .filter((e) => e.curHp > 0 && e.pos && canTarget(draft, a, e))
        .sort((x, y) => manhattan(a.pos!, x.pos!) - manhattan(a.pos!, y.pos!))[0];
      if (prey) { basicAttack(draft, a.instanceId, prey.instanceId); acted++; }
    }
    draft.log.push(`${label(draft, attacker)} calls the Flash Squad — ${acted} ally(ies) open fire.`);
  },
  /** Fryer (Blackout): 2×2 to every opponent, recomputed per target so the caster's
   *  DMG bonuses — including Overcharge's +1-for-the-round earned on a kill mid-
   *  Fryer — carry onto the opponents struck after. */
  fryer(draft, attacker, targets, params) {
    const base = num(params, "dmg", 2);
    const hits = num(params, "hits", 2);
    const paraBonus = num(params, "paralyzeBonus"); // Shock: +DMG vs PARALYZED foes
    // Blackout: the surge takes the lights out — everything struck is MUTED,
    // i.e. cannot fire a Special, for `mute` rounds. Applied AFTER the hit so a
    // target that died to the volley is not handed a status on the way out.
    const mute = num(params, "mute");
    const el = getDef(attacker.defId).element;
    let struck = 0;
    for (const t of targets) {
      if (!draft.cards[t.instanceId] || t.curHp <= 0 || attacker.curHp <= 0) continue;
      const bonus = paraBonus > 0 && hasStatus(t, "PARALYZE") ? paraBonus : 0;
      const dmg = base + attacker.dmgBonus + attacker.dmgBonusRound + bonus;
      resolveHit(draft, attacker, t, { kind: "special", dmg, hits, pen: false, crit: false });
      if (mute > 0 && draft.cards[t.instanceId] && t.curHp > 0)
        applyStatus(draft, t, "MUTED", mute, 0, el);
      struck++;
    }
    draft.log.push(
      `${label(draft, attacker)} fries ${struck} opponent(s) (${base}×${hits})${mute > 0 ? " — the lights go out" : ""}.`,
    );
  },
  /** Polar Shift (Polar King): FREEZE the weak and plate the whole team. */
  polarShift(draft, attacker, _targets, params) {
    const underHp = num(params, "underHp", 4);
    const freezeR = num(params, "freeze", 2);
    const el = getDef(attacker.defId).element;
    for (const e of enemyCards(draft, attacker.owner))
      if (e.curHp > 0 && e.curHp <= underHp) applyStatus(draft, e, "FREEZE", freezeR, 0, el);
    const shield = num(params, "allyShield", 1);
    for (const a of boardCards(draft, attacker.owner)) if (a.curHp > 0) a.curShields += shield;
    draft.log.push(`${label(draft, attacker)}'s Polar Shift freezes the frail and shields the team.`);
  },
  /** Feather Fan (Fanwing): lift every SLOWER teammate up to Fanwing's SP for a round. */
  featherFan(draft, attacker, _targets, _params) {
    const mySp = effectiveSp(draft, attacker);
    let n = 0;
    for (const a of boardCards(draft, attacker.owner)) {
      if (a.instanceId === attacker.instanceId || a.curHp <= 0) continue;
      const gap = mySp - effectiveSp(draft, a);
      if (gap > 0) { applyTimedBuff(a, 0, gap, 1); n++; }
    }
    draft.log.push(`${label(draft, attacker)} fans ${n} slower teammate(s) up to SP ${mySp}.`);
  },
  /** Mind Bubble Channeling (Serenos): arm a sustained self-buff that pays out each
   *  Cleanup for `rounds` — +DMG, a heal, and a self-cleanse. */
  channelBuff(draft, attacker, _targets, params) {
    attacker.channelBuffDmg = num(params, "dmg");
    attacker.channelBuffHeal = num(params, "heal");
    attacker.channelBuffRounds = num(params, "rounds", 2);
    draft.log.push(`${label(draft, attacker)} withdraws into a bubble of calm.`);
  },
  /** Mega Icicle (Cryo): 5 DMG to a 2×2 block anchored on the target; a target
   *  already FROZEN has its remaining FREEZE doubled (Cryo Freeze). */
  areaBlast(draft, attacker, targets, params) {
    const dmg = num(params, "dmg");
    const target = targets[0];
    if (!target?.pos) return;
    const { row, col } = target.pos;
    // WHICH WAY THE 2x2 FALLS.
    //
    // It was always down-and-right from the target, whoever threw it and
    // whatever the board looked like. On a board you cross that is merely
    // arbitrary; in Domination it is a real loss, because the enemy can be in
    // any direction and a fixed quadrant spends half its area off the side of
    // the fight — or off the board entirely, when the target is near the far
    // edge, at which point a 2x2 hits one card.
    //
    // Aimed, it falls AWAY from the caster: the target is the near corner and
    // the ice shatters onward through the squares behind it, which is both what
    // the throw looks like and the half of the area a shooter can actually see.
    // Predictable rather than clever — the player picks a victim and knows what
    // else is going to be caught, which a hit-the-most rule would not give them.
    const dm = attacker.pos && draft.domination ? domMap(draft) : undefined;
    const rStep = dm ? (Math.sign(row - attacker.pos!.row) || 1) : 1;
    const cStep = dm ? (Math.sign(col - attacker.pos!.col) || 1) : 1;
    const cells = [
      [row, col], [row, col + cStep], [row + rStep, col], [row + rStep, col + cStep],
    ];
    const hit = new Set<string>();
    for (const [r, c] of cells) {
      const victim = enemyCards(draft, attacker.owner).find(
        (e) => e.curHp > 0 && e.pos?.row === r && e.pos?.col === c && !hit.has(e.instanceId),
      );
      if (!victim) continue;
      hit.add(victim.instanceId);
      resolveHit(draft, attacker, victim, { kind: "special", dmg, hits: 1, pen: false, crit: false });
      if (num(params, "freezeDouble") > 0 && draft.cards[victim.instanceId] && victim.curHp > 0) {
        const fz = victim.statuses.find((s) => s.kind === "FREEZE");
        if (fz) { fz.duration *= 2; draft.log.push(`${label(draft, victim)}'s freeze deepens (${fz.duration}r).`); }
      }
    }
    draft.log.push(`${label(draft, attacker)} shatters a 2×2 zone (${hit.size} hit).`);
  },
  /** Whinter's Bundle (Hibernal): deepen the frost — extend a named status on
   *  every opponent already carrying it. */
  extendStatusAll(draft, attacker, _targets, params) {
    const kind = String(params.status ?? "ROOT") as StatusKind;
    const add = num(params, "addRounds", 2);
    let n = 0;
    for (const e of enemyCards(draft, attacker.owner)) {
      const st = e.statuses.find((s) => s.kind === kind);
      if (st && e.curHp > 0) { st.duration += add; n++; }
    }
    draft.log.push(`${label(draft, attacker)} deepens the ${kind} on ${n} opponent(s) (+${add}r).`);
  },
  /** War Cry (Gilden): a rallying shout — the caster plates up and the whole team
   *  hits harder for the round. */
  /** Bloody Waters (Liquark): strike the lowest-HP opponent; a kill heals and
   *  slips Liquark back into Lurk (re-STEALTH). */
  bloodyWaters(draft, attacker, _targets, params) {
    const prey = enemyCards(draft, attacker.owner)
      .filter((e) => e.curHp > 0)
      .sort((a, b) => a.curHp - b.curHp)[0];
    if (!prey) return;
    const r = resolveHit(draft, attacker, prey, { kind: "special", dmg: num(params, "dmg", 4), hits: 1, pen: false, crit: false });
    if (r.targetDied && attacker.curHp > 0) {
      healCard(draft, attacker, num(params, "healOnKill", 5), attacker);
      applyStatus(draft, attacker, "STEALTH", num(params, "lurkDuration", 99), 0, getDef(attacker.defId).element);
      draft.log.push(`${label(draft, attacker)} feeds and slips back into Lurk (+${num(params, "healOnKill", 5)} HP, STEALTH).`);
    }
  },
  /** Magnetic Shield (Magnetite): grant every ally IN RANGE a timed REFLECT — they
   *  bounce a bite back at whoever hits them. Reads the passed `targets`
   *  (targetSide "ally", params.targets 99) rather than sweeping a fixed row, so
   *  reach is validated by rules.ts like every other AOE. Was row-directly-ahead
   *  only, which missed anyone standing beside or behind the caster. The
   *  `targets` cap is kept general so the same handler can serve a capped
   *  version later. */
  magneticShield(draft, attacker, targets, params) {
    const power = num(params, "reflect", 1);
    const rounds = num(params, "rounds", 2);
    const allies = targets.slice(0, num(params, "targets", 99)).filter((a) => a.curHp > 0);
    for (const a of allies) {
      a.reflectPower = Math.max(a.reflectPower ?? 0, power);
      a.reflectRoundsLeft = Math.max(a.reflectRoundsLeft ?? 0, rounds);
    }
    draft.log.push(`${label(draft, attacker)} magnetizes ${allies.length} ally(ies) (REFLECT ${power} for ${rounds}r).`);
  },
  /** Ultra Power Gauntlets (Velvolt Knight): a timed loadout — +DMG, FLIGHT, and
   *  basics clip one extra adjacent target, all for `rounds`. */
  powerGauntlets(draft, attacker, _targets, params) {
    const dmg = num(params, "dmg", 2);
    const rounds = num(params, "rounds", 3);
    applyTimedBuff(attacker, dmg, 0, rounds);
    attacker.flyingRoundsLeft = Math.max(attacker.flyingRoundsLeft ?? 0, rounds);
    draft.players[attacker.owner].basicSplashRounds = Math.max(draft.players[attacker.owner].basicSplashRounds ?? 0, rounds);
    draft.log.push(`${label(draft, attacker)} charges its gauntlets (+${dmg} DMG, FLYING, +1 splash target for ${rounds}r).`);
  },
  /** Igniter (Liza): find a DOT on the target and double both its power and its
   *  remaining duration — turn a smoulder into an inferno. */
  igniter(draft, attacker, targets, _params) {
    const t = targets[0];
    if (!t) return;
    const DOTS: StatusKind[] = ["BURN", "BLEED", "SCALD", "DOT"];
    const dot = t.statuses.find((s) => DOTS.includes(s.kind));
    if (!dot) { draft.log.push(`${label(draft, attacker)} finds nothing to ignite on ${label(draft, t)}.`); return; }
    dot.power *= 2;
    dot.duration *= 2;
    draft.log.push(`${label(draft, attacker)} ignites the ${dot.kind} on ${label(draft, t)} — ${dot.power} for ${dot.duration}r.`);
  },
  /** Mark of Hoax: brand one opponent — while marked, EVERY basic attack against
   *  it is a guaranteed CRIT, and its death banks Hoax a guaranteed dodge. */
  markTarget(draft, attacker, targets, params) {
    const t = targets[0];
    if (!t) return;
    t.hoaxMarked = true;
    t.hoaxMarkedBy = attacker.instanceId;
    draft.log.push(`${label(draft, attacker)} marks ${label(draft, t)} — every basic against it now CRITS.`);
    // Through the shared status path rather than hard-coding one: the mark is a
    // BRAND, and what the brand carries belongs on the card, not in here. Hoax
    // declares SEAL; a later marker can declare something else without this
    // handler learning about it.
    maybeStatus(draft, attacker, t, params);
  },
  /** Adamantize (Adamant): crystallize the team's armour — every living ally gains
   *  a timed BLOCK, stacking with their own. */
  diamallize(draft, attacker, _targets, params) {
    const block = num(params, "block", 2);
    const rounds = num(params, "rounds", 2);
    const allies = boardCards(draft, attacker.owner).filter((a) => a.curHp > 0);
    for (const a of allies) {
      a.blockPower = Math.max(a.blockPower ?? 0, block);
      a.blockRoundsLeft = Math.max(a.blockRoundsLeft ?? 0, rounds);
    }
    draft.log.push(`${label(draft, attacker)} crystallizes the team's armour (BLOCK ${block} to ${allies.length} ally(ies) for ${rounds}r).`);
  },
  warCry(draft, attacker, _targets, params) {
    const sh = num(params, "selfShields");
    const buffDmg = num(params, "buffDmg");
    const rounds = num(params, "buffRounds", 1);
    if (sh) attacker.curShields += sh;
    const allies = boardCards(draft, attacker.owner).filter((a) => a.curHp > 0);
    if (buffDmg > 0) for (const a of allies) applyTimedBuff(a, buffDmg, 0, rounds);
    draft.log.push(`${label(draft, attacker)} lets out a War Cry (+${sh} shields, +${buffDmg} DMG to ${allies.length} all(y/ies) for ${rounds}r).`);
  },
  /** Silk Chase (Sarachnid): every allied Spider takes a swing; each opponent
   *  struck is FRIGHTENed, and the caster feeds on the hunt. */
  tribeSwarm(draft, attacker, targets, params) {
    const tribe = String(params.tribe ?? "");
    const frightenR = num(params, "frighten");
    const healPer = num(params, "healPerHit");
    // tribeOf, not `tribe === tribe`: a card can carry SEVERAL tribes (Fenrir is
    // Dragon/Wolf/Volcanic), and strict equality silently excluded all of them.
    const swarm = boardCards(draft, attacker.owner).filter(
      (c) => c.curHp > 0 && tribeOf(c, tribe),
    );
    // spawnOnKill (Sarachnid): every kill the hunt lands nests another body.
    const nestToken = String(params.spawnOnKill ?? "");
    let hits = 0;
    let kills = 0;
    for (const sp of swarm) {
      if (sp.curHp <= 0) continue;
      const prey = targets.find((t) => t.curHp > 0 && canTarget(draft, sp, t))
        ?? enemyCards(draft, attacker.owner).find((e) => e.curHp > 0 && canTarget(draft, sp, e));
      if (!prey) continue;
      const r = basicAttack(draft, sp.instanceId, prey.instanceId);
      if (r && r.landedHits > 0) {
        hits += r.landedHits;
        if (r.targetDied) kills++;
        if (frightenR > 0 && prey.curHp > 0 && draft.cards[prey.instanceId])
          applyStatus(draft, prey, "FRIGHTEN", frightenR, 0, getDef(attacker.defId).element);
      }
    }
    if (healPer > 0 && hits > 0 && attacker.curHp > 0) healCard(draft, attacker, healPer * hits, attacker);
    if (nestToken && kills > 0 && attacker.curHp > 0) {
      const born = spawnTokens(draft, attacker, nestToken, kills);
      if (born.length) draft.log.push(`The hunt feeds the nest — ${born.length} more ${tribe || "body"}(s) hatch.`);
    }
    draft.log.push(`Silk Chase: ${swarm.length} ${tribe || "ally"}(s) strike (${hits} hit(s)).`);
  },
  /** Opaque Realm (Spectra): cloak the caster and whoever stands directly behind
   *  it in EVASION for a couple of rounds. */
  veilBehind(draft, attacker, _targets, params) {
    const rounds = num(params, "rounds", 2);
    const behindRow = attacker.pos ? attacker.pos.row + (attacker.owner === "P1" ? 1 : -1) : -99;
    const crew = boardCards(draft, attacker.owner).filter(
      (a) => a.curHp > 0 && (a.instanceId === attacker.instanceId || a.pos?.row === behindRow),
    );
    for (const a of crew) applyStatus(draft, a, "EVASION", rounds, 0, getDef(attacker.defId).element);
    draft.log.push(`${label(draft, attacker)} draws the Opaque Realm over ${crew.length} all(y/ies) (EVASION ${rounds}r).`);
  },
  /**
   * Blue Wind Spiral (Zephyra): a shot that ricochets. It lands on the target,
   * then leaps to any not-yet-hit opponent within one slot of the LAST one it
   * struck, up to `bounces` times.
   *
   * Each landing is a normal hit, so Wind Wake's shove fires on every one of
   * them — which is the point: the spiral scatters a clustered board. Capped
   * and no-repeat, so a packed board can't loop it forever.
   */
  spiral(draft, attacker, targets, params) {
    const dmg = num(params, "dmg");
    const maxHops = num(params, "bounces", 3);
    const hit = new Set<string>();
    let current = targets[0];
    for (let i = 0; i <= maxHops && current; i++) {
      if (attacker.curHp <= 0) break;
      const live = draft.cards[current.instanceId];
      if (!live || live.curHp <= 0) break;
      hit.add(current.instanceId);
      const from = live.pos;
      resolveHit(draft, attacker, live, { kind: "special", dmg, hits: 1, pen: false, crit: false });
      if (!from) break;
      // Next link: nearest un-hit opponent within one slot of where this one WAS
      // (it may have just been shoved by Wind Wake).
      current = enemyCards(draft, attacker.owner).find(
        (e) => !hit.has(e.instanceId) && e.curHp > 0 && e.pos != null && chebyshev(e.pos, from) <= 1,
      )!;
    }
    draft.log.push(`${label(draft, attacker)}'s spiral touches ${hit.size} opponent(s).`);
  },

  /**
   * Static Pressure Overload (Dynamo): a conditional two-way nova — already
   * PARALYZED opponents have it EXTENDED, everyone else is merely marked
   * ELECTRIFIED. statusNova can't express this because it applies one status to
   * everything; the whole point here is that the two groups get different
   * treatment, which is what makes it scale with a board you've already locked.
   */
  overload(draft, attacker, targets, params) {
    const extend = num(params, "paralyzeExtend", 1);
    const markRounds = num(params, "markRounds", 1);
    const el = getDef(attacker.defId).element;
    let deepened = 0;
    let marked = 0;
    for (const t of targets) {
      if (t.curHp <= 0 || !draft.cards[t.instanceId]) continue;
      const par = t.statuses.find((st) => st.kind === "PARALYZE");
      if (par) {
        par.duration += extend;
        deepened++;
      } else {
        applyStatus(draft, t, "ELECTRIFIED", markRounds, 0, el);
        marked++;
      }
    }
    draft.log.push(
      `${label(draft, attacker)} overloads the grid — ${deepened} held longer, ${marked} marked.`,
    );
  },

  /** Permanently steal max HP from one enemy (DUSK's Jacked-style theft). */
  drainMax(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target) return;
    const amount = num(params, "amount", 1);
    // `deleteOnly` (Nightfang's Soul Slash): destroy the max HP instead of
    // taking it. The caster gains nothing, so the swing is the amount itself
    // rather than double it, and the assassin does not inflate its own HP bar
    // every cast. It also carves LETHALLY — a target whose whole max HP fits
    // inside the cut is carved away entirely.
    //
    // The transfer path keeps its 1-max-HP floor: a card you are draining has
    // to survive to be drained again, and an unkillable-by-drain card is the
    // nonsense that floor was written for. Deleting is a different act.
    const deleteOnly = num(params, "deleteOnly") > 0;
    if (deleteOnly && target.maxHp <= amount) {
      target.maxHp = 0;
      target.curHp = 0;
      draft.log.push(`${label(draft, attacker)} carves ${label(draft, target)} out of existence.`);
      defeatCard(draft, target, `${getDef(attacker.defId).name}'s soul slash`);
      applySelfRiders(draft, attacker, params);
      return;
    }
    const stolen = Math.min(amount, target.maxHp - 1); // never below 1 max HP
    if (stolen > 0) {
      target.maxHp -= stolen;
      // Transfer drains ACTIVE HP too and heals the caster; deleteOnly just carves
      // the ceiling (Nightfang's Soul Slash keeps its destroy-only identity).
      target.curHp = Math.min(target.curHp, target.maxHp);
      if (!deleteOnly) {
        gainMaxHp(attacker, stolen);
        healCard(draft, attacker, Math.floor(stolen / 2), attacker); // theft heals HALF
      }
      draft.log.push(
        deleteOnly
          ? `${label(draft, attacker)} carves ${stolen} max HP out of ${label(draft, target)} — gone for good.`
          : `${label(draft, attacker)} drains ${stolen} HP from ${label(draft, target)}.`,
      );
    }
    const selfShields = num(params, "selfShields", 0);
    if (selfShields > 0) {
      attacker.curShields += selfShields;
      draft.log.push(`${label(draft, attacker)} gains +${selfShields} shields.`);
    }
  },

  /** Grant shields to one ally — or, with `nearby`, to every ally touching the
   *  caster (Smith's Reforged), optionally with a timed DMG buff on top. */
  grantShield(draft, attacker, targets, params) {
    const amount = num(params, "amount", 1);
    const heal = num(params, "heal");
    const buffDmg = num(params, "buffDmg");
    const buffRounds = num(params, "buffRounds", 1);
    // nearby: the 8 slots around the caster (itself included — it forged the
    // plates, it wears some too). Otherwise the single chosen ally.
    const crew =
      num(params, "nearby") > 0 && attacker.pos
        ? boardCards(draft, attacker.owner).filter(
            (a) => a.curHp > 0 && a.pos && chebyshev(attacker.pos!, a.pos) <= 1,
          )
        : [targets[0] ?? attacker]; // self-shield specials pass no enemy
    for (const target of crew) {
      target.curShields += amount;
      if (heal > 0) healCard(draft, target, heal, attacker); // Roosting Wing Shield
      if (buffDmg > 0) applyTimedBuff(target, buffDmg, 0, buffRounds);
    }
    const who = crew.length === 1 ? label(draft, crew[0]) : `${crew.length} nearby ally(ies)`;
    draft.log.push(
      `${label(draft, attacker)} grants +${amount} shields${heal > 0 ? ` and +${heal} HP` : ""}${buffDmg > 0 ? ` and +${buffDmg} DMG for ${buffRounds}r` : ""} to ${who}.`,
    );
  },

  /** Heal up to N allies (chosen first), optionally cleansing them and/or
   *  granting a timed team DMG/SP buff (Golden Courage, Daybreak). */
  heal(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    const amount = num(params, "amount", 0);
    const doCleanse = num(params, "cleanse", 0) > 0;
    const buffDmg = num(params, "buffDmg");
    const buffSp = num(params, "buffSp");
    const buffRounds = num(params, "buffRounds", 1);
    let healed = 0;
    // cleanse wipes everything; cleanseNegatives (Halo's Mending Horn) strips
    // only negative statuses + negative timed stat changes, keeping ally buffs.
    const cleanseNeg = num(params, "cleanseNegatives", 0) > 0;
    for (const ally of targets.slice(0, n)) {
      // Cleanse BEFORE healing. A BURNing card heals at 75% (the PYRO matchup),
      // and an effect whose whole job is to strip that burn shouldn't be taxed
      // by the burn it is in the middle of removing — put the fire out, then
      // treat the wound.
      if (doCleanse && ally.statuses.length) ally.statuses = [];
      else if (cleanseNeg) {
        ally.statuses = ally.statuses.filter((st) => !NEGATIVE_STATUSES.includes(st.kind));
        ally.buffs = ally.buffs.filter((b) => b.dmg >= 0 && b.sp >= 0);
        if (ally.dmgBonusRound < 0) ally.dmgBonusRound = 0;
        if (ally.spBonusRound < 0) ally.spBonusRound = 0;
      }
      if (amount > 0 && healCard(draft, ally, amount, attacker) > 0) healed++;
      if (buffDmg > 0 || buffSp > 0) applyTimedBuff(ally, buffDmg, buffSp, buffRounds);
    }
    if (buffDmg > 0 || buffSp > 0)
      draft.log.push(
        `${label(draft, attacker)} rallies the team (${buffDmg ? `+${buffDmg} DMG ` : ""}${buffSp ? `+${buffSp} SP ` : ""}for ${buffRounds}r).`,
      );
    draft.log.push(
      `${label(draft, attacker)} restores allies (+${amount} HP${doCleanse ? ", CLEANSE" : ""}, ${healed} healed).`,
    );
  },

  /** Permanent self-buff (Heir's Crowned): +DMG / +max HP / +SP to the caster. */
  /** Flaming Slasher (Emberclaw): light the blade. The next `attacks` basic attacks
   *  leave the named status on whatever they hit. */
  loadOnHit(draft, attacker, targets, params) {
    attacker.loadedOnHit = {
      kind: String(params.statusKind ?? "BURN") as StatusKind,
      duration: num(params, "statusDuration", 1),
      power: num(params, "statusPower"),
      attacks: num(params, "attacks", 1),
    };
    draft.log.push(`${label(draft, attacker)} sets its blade alight.`);
    // The cast IS the first swing: strike now, and that hit spends the first
    // charge itself. Ordering matters — the load has to be in place before the
    // attack resolves or the opening hit would land without the burn.
    if (num(params, "strikeOnCast") > 0 && targets[0] && attacker.curHp > 0) {
      basicAttack(draft, attacker.instanceId, targets[0].instanceId);
    }
  },

  /** Rock Slide (Monger): a volley of boulders, each an independent coin flip.
   *  Every one that misses is a boulder still in hand — it becomes shielding
   *  instead, so a bad roll arms the tank rather than wasting the Special. */
  rockslide(draft, attacker, targets, params) {
    const shots = num(params, "hits", 1);
    const dmg = num(params, "dmg");
    const perMiss = num(params, "shieldPerMiss", 2);
    // scatter (Pebble): each rock lands on a RANDOM in-range opponent instead of
    // pounding one target (Monger). Every rock is still a coin to land. NOT
    // named `spread` — the onSummon sourcing reads that as forward-area columns.
    const spread = num(params, "scatter") > 0;
    let hit = 0;
    let missed = 0;
    for (let i = 0; i < shots; i++) {
      if (attacker.curHp <= 0) break;
      const live = spread
        ? targets.filter((c) => draft.cards[c.instanceId] && c.curHp > 0)
        : (targets[0] && draft.cards[targets[0].instanceId] && targets[0].curHp > 0 ? [targets[0]] : []);
      if (live.length === 0) break;
      const t = spread ? live[randInt(draft, live.length)] : live[0];
      if (coin(draft)) {
        resolveHit(draft, attacker, t, { kind: "special", dmg, hits: 1, pen: false, crit: false });
        hit++;
      } else {
        missed++;
      }
    }
    if (missed > 0 && attacker.curHp > 0) {
      attacker.curShields += missed * perMiss;
      draft.log.push(`${label(draft, attacker)} keeps ${missed} boulder(s) — +${missed * perMiss} shields.`);
    }
    if (hit > 0) draft.log.push(`${label(draft, attacker)} lands ${hit} of ${shots} boulders.`);
  },

  /** Dirt Driller (Obsidian): drop underground — STEALTH for up to `stealthRounds`
   *  — and load the ambush that comes up out of it. The damage lands on the NEXT
   *  basic attack, which is also what ends the STEALTH. */
  burrow(draft, attacker, _targets, params) {
    const rounds = num(params, "stealthRounds", 2);
    applyStatus(draft, attacker, "STEALTH", rounds, 0, getDef(attacker.defId).element);
    attacker.loadedStrike = { dmg: num(params, "dmg"), hits: num(params, "hits", 1) };
    draft.log.push(
      `${label(draft, attacker)} burrows out of sight — next strike hits for ${num(params, "dmg")}×${num(params, "hits", 1)}.`,
    );
  },

  /** Storm Swarm (Keeper): raise one Beebot per ELECTRIFIED opponent, then set
   *  the whole swarm on the board. The spawn scales off the enemy's status, so
   *  the Special is worth nothing until BOLT has done its job first. */
  stormSwarm(draft, attacker, targets, params) {
    const token = String(params.token ?? "");
    const marked = enemyCards(draft, attacker.owner).filter(
      (e) => e.curHp > 0 && e.statuses.length > 0,
    ).length;
    if (marked > 0 && token) spawnTokens(draft, attacker, token, marked);
    // ...then every Beebot still standing takes a swing, the new ones included.
    const swarm = boardCards(draft, attacker.owner).filter(
      (c) => c.curHp > 0 && c.defId === token,
    );
    let stung = 0;
    for (const bot of swarm) {
      const prey = targets.find((t) => t.curHp > 0 && canTarget(draft, bot, t))
        ?? enemyCards(draft, attacker.owner).find((e) => e.curHp > 0 && canTarget(draft, bot, e));
      if (!prey) continue;
      basicAttack(draft, bot.instanceId, prey.instanceId);
      stung++;
    }
    draft.log.push(`Storm Swarm: ${marked} raised, ${stung} Beebot(s) sting.`);
  },

  empower(draft, attacker, _targets, params) {
    const dmg = num(params, "selfDmg");
    const hp = num(params, "selfMaxHp");
    const sp = num(params, "selfSp");
    // selfHits buys extra BASIC hits rather than damage (Totem's Rampage).
    const hits = num(params, "selfHits");
    // buffRounds turns the grant TEMPORARY (Ravven's Night Stalk). Without it
    // the buff is permanent, as Heir's Crowned has always been.
    const rounds = num(params, "buffRounds");
    if (rounds > 0) {
      applyTimedBuff(attacker, dmg, sp, rounds, hits, num(params, "selfPen") > 0);
      // selfRangedShots: the charged blow also fires at RANGE (Ariel's
      // 100,000°). Reuses `rangedShotsLeft`, the pocket already built for
      // Surge's Electro Surge, rather than inventing a second way to be
      // temporarily ranged — canTarget and basicAttack both read it, so the
      // grant lands on every path a basic takes without touching either.
      const shots = num(params, "selfRangedShots");
      if (shots > 0) {
        attacker.rangedShotsLeft = (attacker.rangedShotsLeft ?? 0) + shots;
        draft.log.push(`${label(draft, attacker)} takes aim — its next blow carries.`);
      }
      // Was hardcoded to Ravven's "+N DMG" flavour, which read as "+0 DMG" for
      // any timed buff that grants SP instead (Stormquill's Glide Rush).
      const parts = [dmg ? `+${dmg} DMG` : "", sp ? `+${sp} SP` : "",
        hits ? `+${hits} hit${hits === 1 ? "" : "s"}` : ""].filter(Boolean);
      draft.log.push(`${label(draft, attacker)} surges (${parts.join(", ")} for ${rounds} rounds).`);
      return;
    }
    if (dmg) attacker.dmgBonus += dmg;
    if (hp > 0) attacker.curHp += gainMaxHp(attacker, hp);
    if (sp) attacker.spBonus += sp;
    if (hits) attacker.hitsBonus = (attacker.hitsBonus ?? 0) + hits;
    draft.log.push(`${label(draft, attacker)} is Crowned (+${dmg} DMG, +${hp} HP, +${sp} SP)!`);
  },

  /**
   * Accelerator (Scorch): fan the flames. For `rounds`, every BURN this side has
   * on an opponent deals double, and same-element allies pick up +SP. Neither
   * half fits empower (self-only) or statusNova (one status, to enemies).
   */
  accelerate(draft, attacker, _targets, params) {
    const rounds = num(params, "rounds", 2);
    const sp = num(params, "allySp");
    draft.players[attacker.owner].burnBoostRounds = rounds;
    const el = getDef(attacker.defId).element;
    const kin = boardCards(draft, attacker.owner).filter(
      (a) => a.curHp > 0 && getDef(a.defId).element === el,
    );
    // `permanentSp` banks the speed on `spBonus` instead of a countdown, so the
    // acceleration outlives the burn window it came with. The double-BURN half
    // still expires — that is the part that is meant to be a burst.
    const permanent = num(params, "permanentSp") > 0;
    if (sp > 0) {
      for (const a of kin) {
        if (permanent) a.spBonus += sp;
        else applyTimedBuff(a, 0, sp, rounds);
      }
    }
    draft.log.push(
      `${label(draft, attacker)} accelerates the burn (2x BURN for ${rounds}r, +${sp} SP` +
      `${permanent ? " permanently" : ""} to ${kin.length} ${el} all(y/ies)).`,
    );
  },

  /** Powder Keg (Scallywag): mine the enemy row directly ahead — one concealed
   *  keg per free slot, armed rather than detonated.
   *
   *  Skips slots that already hold a trap (one charge per square, the same rule
   *  Dark Hunting follows) and slots that are permanently captured, since a
   *  locked square is not somewhere anything will ever step. */
  trapRow(draft, attacker, _targets, params) {
    if (!attacker.pos) return;
    const row = rowAhead(attacker.owner, attacker.pos.row);
    if (row < 0 || row >= draft.boardSize) return;
    const def = getDef(attacker.defId);
    const dmg = num(params, "dmg", 4);
    const power = num(params, "statusPower");
    const duration = num(params, "statusDuration", 2);
    const kind = params.statusKind;
    let laid = 0;
    for (let col = 0; col < draft.boardSize; col++) {
      if (draft.slots[row][col].capturedBy) continue;
      if (draft.traps.some((t) => t.pos.row === row && t.pos.col === col)) continue;
      draft.traps.push({
        owner: attacker.owner,
        label: `${def.name}'s Powder Keg`,
        element: def.element,
        pos: { row, col },
        dmg,
        status: typeof kind === "string" && kind
          ? { kind: kind as StatusKind, duration, power }
          : undefined,
        sourceId: attacker.instanceId,
      });
      laid++;
    }
    draft.log.push(
      laid > 0
        ? `${label(draft, attacker)} mines the row ahead — ${laid} powder keg(s) laid.`
        : `${label(draft, attacker)} finds nowhere to lay a keg.`,
    );
  },

  /** CLEANSE up to N allies — strip all negative statuses (DAWN). */
  cleanse(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    for (const ally of targets.slice(0, n)) {
      if (ally.statuses.length) {
        ally.statuses = [];
        draft.log.push(`${label(draft, attacker)} cleanses ${label(draft, ally)}.`);
      }
    }
  },
};
