// Combat pipeline + special-handler registry.
//
// Damage application order for a single hit (brief §5):
//   1. EVASION coin — dodge negates the hit entirely (no shield strip).
//   2. BLOCK X — flat reduction (min 0). Applies even to PEN.
//   3. Shield gate — toHp = max(0, remaining − curShields); strip exactly 1
//      shield on any landed hit (even a 0-damage one).
//      · PEN skips the gate: full remaining damage to HP, no shield stripped.
//      · CRIT does nothing while shields > 0; on an unshielded target it
//        doubles the hit BEFORE the gate math (basic attacks only).
//   4. Multi-hit (dmg × N) = N sequential sub-hits, each re-running 1–3
//      against the current shield count.
//   5. On-hit keywords: LIFESTEAL (basic), DRAIN (basic), REFLECT X.

import { getDef } from "../data/cards";
import { chance, coin, pctChance } from "./rng";
import { RANGED_REACH } from "./rules";
import { creditDamage, creditDeath, creditDebuff, creditKill } from "./stats";
import { auraHasPen, boardCards, cardAt, chebyshev, effectiveDmg, effectiveMaxHp, effectiveSp, fieldBonus, fieldEvasion, fieldFlag, fieldPushBonus, fieldStatusExtend, hasStatus, healCard, manhattan, removeCard, spawnTokens } from "./state";
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
 *  from its own home. Gates Vaga's first-strike and Ravven's Shadow Haunter. */
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
  let hits = def.hits + (card.hitsBonus ?? 0) + (card.hitsBonusRound ?? 0) + (card.loadedHits ?? 0);
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
}

export interface AttackResult {
  landedHits: number;
  dodgedHits: number;
  totalToHp: number;
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
  const dur = duration + extend;
  const fresh = { kind, duration: dur, power, source };
  const existing = target.statuses.findIndex((s) => s.kind === kind);
  if (existing >= 0) target.statuses[existing] = fresh;
  else target.statuses.push(fresh);
  // Counted HERE, past every immunity / ward / fizzle gate above, so the report
  // reflects control that actually landed rather than control attempted.
  if (NEGATIVE_STATUSES.includes(kind)) creditDebuff(draft.stats, target);
  draft.log.push(
    `${label(draft, target)} is afflicted: ${kind}${power ? ` ${power}` : ""} (${dur}r)${extend ? " +field" : ""}${existing >= 0 ? " (refreshed)" : ""}.`,
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
export function defeatCard(draft: GameState, card: CardInstance, cause: string): boolean {
  const def = getDef(card.defId);
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
  } else if (def.onRevive && !card.revived && card.pos) {
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
  draft.log.push(`${label(draft, card)} is defeated (${cause}).`);
  creditDeath(draft.stats, card);
  removeCard(draft, card.instanceId);
  return true;
}

/** Add a timed DMG/SP modifier (team buff or −SP debuff). */
export function applyTimedBuff(card: CardInstance, dmg: number, sp: number, rounds: number): void {
  if (rounds <= 0 || (dmg === 0 && sp === 0)) return;
  card.buffs.push({ dmg, sp, rounds });
}

/** Blow a card back toward its OWN home row up to `steps` open slots (Mighty
 *  Winds / Wind Guardian). Stops at its home row, a captured, or occupied slot. */
/** Blow `card` back toward its own home. `pusher` is the side CAUSING the push
 *  (not the victim) — Jetstream adds +1 space to everything its owner shoves,
 *  and that bonus has to be read from the pusher's fields, never the target's. */
export function pushBack(
  draft: GameState,
  card: CardInstance,
  steps: number,
  pusher?: PlayerId,
): void {
  const dir = card.owner === "P1" ? 1 : -1; // toward own home (P1 = row 3, P2 = row 0)
  const home = homeRow(card.owner, draft.boardSize);
  const total = steps + (pusher ? fieldPushBonus(draft, pusher) : 0);
  let moved = 0;
  for (let i = 0; i < total; i++) {
    const pos = card.pos;
    if (!pos || pos.row === home) break;
    const row: number = pos.row + dir;
    if (row < 0 || row >= draft.boardSize) break;
    if (draft.slots[row][pos.col].capturedBy || cardAt(draft, row, pos.col)) break;
    card.pos = { row: row as Pos["row"], col: pos.col };
    moved++;
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} is blown back ${moved} slot(s).`);
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
      const foes = boardCards(draft, enemyOf(card.owner)).filter((c) => c.curHp > 0);
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
  const result: AttackResult = {
    landedHits: 0,
    dodgedHits: 0,
    totalToHp: 0,
    targetDied: false,
    attackerDied: false,
    critHits: 0,
  };
  let reflectBack = 0;

  // Blazing Sun (DAWN field): "their attacks cannot miss". Read once — it can't
  // change mid-volley — and applied to every roll-to-hit below.
  const fieldNeverMiss = fieldFlag(draft, attacker, "neverMiss");
  for (let i = 0; i < opts.hits; i++) {
    if (target.curHp <= 0) break;

    // 0. BLIND — −50% accuracy, rolled PER HIT on a basic attack (so a blinded
    //    multi-hit lands some and whiffs others). Specials auto-hit.
    if (opts.kind === "basic" && !aDef.alwaysHit && !fieldNeverMiss && hasStatus(attacker, "BLIND") && !coin(draft)) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} misses (BLIND).`);
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
    if (opts.kind !== "reflect" && !aDef.alwaysHit && !opts.alwaysHit && !fieldNeverMiss && (standingEvasion || fieldEva)) {
      if (fieldEva) target.fieldEvasionUsed = true;
      if (coin(draft)) {
        result.dodgedHits++;
        target.fxMiss = (target.fxMiss ?? 0) + 1;
        draft.log.push(`${label(draft, target)} evades a hit from ${aDef.name}.`);
        continue;
      }
    }

    // 1b. Rocky Force Field (Rhe): coin-flip chance to shrug off a RANGED hit.
    if (
      opts.kind !== "reflect" &&
      !fieldNeverMiss && // Blazing Sun beats it; card-level alwaysHit does NOT —
      // those cards print "ignores BLIND and EVASION", and widening that here
      // would silently rebalance Hot Shot and Hunting Season.
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
    let remaining = opts.dmg;
    // War Mount (RohoJohn): the mount mauls whatever the Ranger stands beside —
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
    const block = Number(tDef.keywords.BLOCK ?? 0) + wallFlatReduction(draft, target) + fieldBonus(draft, target, "block");
    if (block > 0) remaining = Math.max(0, remaining - block);

    // 3. Shield gate.
    let toHp: number;
    if (opts.pen) {
      toHp = remaining; // no shield stripped
    } else {
      if (opts.crit && target.curShields === 0) {
        if (coin(draft)) {
          remaining *= 2;
          result.critHits = (result.critHits ?? 0) + 1;
          target.fxCrit = (target.fxCrit ?? 0) + 1;
          draft.log.push(`${aDef.name} CRITS ${tDef.name}!`);
        }
      }
      toHp = Math.max(0, remaining - target.curShields);
      if (target.curShields > 0) {
        target.curShields--;
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
    target.curHp -= toHp;
    result.landedHits++;
    result.totalToHp += toHp;

    // 5 (per landed hit). REFLECT accumulates; resolved after the volley.
    const reflect = Number(tDef.keywords.REFLECT ?? 0) + fieldBonus(draft, target, "reflect");
    if (reflect > 0 && opts.kind !== "reflect") reflectBack += reflect;
  }

  if (result.landedHits > 0) {
    draft.log.push(
      `${label(draft, attacker)} hits ${label(draft, target)} for ${result.totalToHp} (${result.landedHits} hit${result.landedHits > 1 ? "s" : ""}).`,
    );
    // Any hit wakes a sleeper (SLEEP removed the moment it's struck) — unless
    // the attacker ignores that rule (Sandman's Nightmare).
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

  // Count enemy hits TAKEN (Squanch's Regenerative cashes these in at Cleanup).
  // Counts the hit, not the damage — one fully absorbed by shields still landed.
  if (result.landedHits > 0 && target.owner !== attacker.owner)
    target.hitsTakenThisRound += result.landedHits;

  // 5. On-hit keywords — basic attacks only. (onHitStatus riders + vsStatus
  //    heals are applied by basicAttack, which knows the per-target gating.)
  if (opts.kind === "basic" && result.landedHits > 0) {
    // DRAIN runs BEFORE the heal, deliberately. It raises the attacker's max HP,
    // and healCard caps at effectiveMaxHp — so draining first means the new
    // ceiling is already in place and the heal can actually use it. The other
    // order silently clipped the last points of every drain-heal.
    if (aDef.keywords.DRAIN) drainMaxHp(draft, attacker, target, 1);
    // DRAIN is LIFESTEAL that also grows — but it feeds at HALF rate: it heals
    // for half the damage dealt, on top of the 1 max HP it just took. LIFESTEAL
    // still returns the full amount, and a card carrying both takes the better
    // (full) rate rather than the two cancelling out.
    const drains = aDef.keywords.LIFESTEAL || aDef.keywords.DRAIN || opts.lifesteal;
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
    const removed = defeatCard(draft, target, `${aDef.name}'s ${opts.kind}`);
    if (!removed) return result; // revived — no kill/on-death triggers
    result.targetDied = true;
    if (target.owner !== attacker.owner) creditKill(draft.stats, attacker, attacker.owner);
    // On-kill trigger for the attacker (basic/special kills only).
    if ((opts.kind === "basic" || opts.kind === "special") && attacker.curHp > 0) {
      if (aDef.onKill) applyOnKill(draft, attacker, aDef.onKill);
      // IcyNinza's Icy Mist: a kill while cloaked extends the STEALTH window.
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
        ally.allyKilledFired = true;
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
    if (tDef.onDeath?.spawnToken && deathPos) {
      // WarPhant: the rider outlives the mount. Spawned from the dead card, so
      // it lands around where it fell.
      const st = tDef.onDeath.spawnToken;
      spawnTokens(draft, target, st.token, st.count);
    }
    if (tDef.onDeath?.frightenInRange && deathPos) {
      const scared = boardCards(draft, enemyOf(deadOwner)).filter(
        (e) => e.curHp > 0 && e.pos && chebyshev(e.pos, deathPos) <= 1,
      );
      for (const e of scared)
        applyStatus(draft, e, "FRIGHTEN", tDef.onDeath.frightenInRange, 0, tDef.element);
      if (scared.length) draft.log.push(`The dread of her passing drives ${scared.length} back.`);
    }
    // On-death effects.
    if (tDef.onDeath && opts.kind !== "reflect") {
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
    } else if (tDef.element === "DUSK" && opts.kind !== "reflect" && attacker.curHp > 0) {
      // Midnight Shade (DUSK aura): a dying card deals a THIRD of its DMG to the
      // killer. Only when the card has no stronger card-specific onDeath.
      //
      // Cut from a half. Measured at ~10 procs a game, it is the only aura in
      // the game that pays out for LOSING cards — which is precisely the
      // disposable-body strategy DUSK is already best at: 7 of its cards cost 2
      // or less, two of them are spawnable tokens, and it fields and loses more
      // bodies than any other element. Free damage on every one of those deaths,
      // with no cost, cooldown or counterplay, is what made attacking into DUSK
      // a losing trade even when the individual cards were not tough.
      const back = Math.floor(tDef.dmg / 3);
      if (back > 0) {
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
  // Wind Wake (Wista): every landed hit shoves the victim back a slot. Gated on
  // a real landed hit so a fully-dodged volley moves nobody.
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && aDef.onHitPush)
    pushBack(draft, target, aDef.onHitPush, attacker.owner);
  if (opts.kind !== "reflect" && result.landedHits > 0 && target.curHp > 0 && tDef.onHitZap) {
    if (applyOnHitZap(draft, target, attacker, tDef.onHitZap)) result.attackerDied = true;
  }

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

export function basicAttack(
  draft: GameState,
  attackerId: string,
  target: string | string[],
): AttackResult | null {
  const attacker = draft.cards[attackerId];
  if (!attacker) return null;
  const picks = Array.isArray(target) ? target : [target];
  if (picks.length === 0) return null;
  const aDef = getDef(attacker.defId);
  attacker.attackedThisRound = true; // STEALTH breaks even on a miss

  // Morning Dew (Sprinu): aimed at an ALLY, the basic is a heal for its DMG —
  // no hit roll, no statuses, no riders. Checked before anything else so none of
  // the combat machinery below ever sees a friendly target.
  if (aDef.basicHealsAllies) {
    const first = draft.cards[picks[0]];
    if (first && first.owner === attacker.owner && first.instanceId !== attackerId) {
      const healed = healCard(draft, first, effectiveDmg(draft, attacker), attacker.owner);
      draft.log.push(`${label(draft, attacker)} tends ${label(draft, first)} (+${healed} HP).`);
      return { landedHits: 0, dodgedHits: 0, totalToHp: 0, targetDied: false, attackerDied: false };
    }
  }

  const missed: AttackResult = {
    landedHits: 0, dodgedHits: 0, totalToHp: 0, targetDied: false, attackerDied: false,
  };
  // (BLIND accuracy is rolled per hit inside resolveHit now.)
  // PARALYZE: 50% chance to attack at all.
  if (hasStatus(attacker, "PARALYZE") && !chance(draft, 50)) {
    draft.log.push(`${label(draft, attacker)} is paralyzed and can't attack.`);
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
    if (atkDebuff) { dmg = Math.max(0, dmg - atkDebuff); atkDebuff = 0; } // Boon Striker, once
    let crit = Boolean(aDef.keywords.CRIT);
    // Hastened Assault (WolfBane): CRIT only while faster than the target.
    if (aDef.critIfFaster && effectiveSp(draft, attacker) > effectiveSp(draft, t)) crit = true;
    let lifesteal = false;
    let healOnHit = 0;
    const vs = aDef.vsStatus;
    const vsMatch = vs != null && (vs.anyStatus ? t.statuses.length > 0 : hasStatus(t, vs.status));
    if (vs && vsMatch) {
      if (vs.dmgMult) dmg = Math.floor(dmg * vs.dmgMult);
      if (vs.bonusDmg) dmg += vs.bonusDmg;
      if (vs.crit) crit = true;
      if (vs.lifesteal) lifesteal = true;
      healOnHit = vs.healOnHit ?? 0;
    }
    // Electrify (BOLT aura): +2 DMG vs any statused opponent — +3 under Power
    // Grid. Raised from +1: even once the aura was made self-enabling (see the
    // ELECTRIFIED rider below) a single point moved BOLT's win rate 38% -> 39%,
    // i.e. not at all. On BOLT's ~5-damage cards +1 is a rounding error.
    if (aDef.element === "BOLT" && t.statuses.length > 0) dmg += 2 + fieldBonus(draft, attacker, "electrify");
    // Harsh Winds / Shadow: bonus DMG the first time this card strikes a given
    // opponent. Vaga's version only counts while it stands on the enemy side.
    const fsEligible = Boolean(aDef.firstStrikeBonus) && (!aDef.firstStrikeEnemySideOnly || onEnemySide(attacker, draft.boardSize));
    const firstStrike = fsEligible && !attacker.struckEver.includes(t.instanceId);
    if (firstStrike) dmg += aDef.firstStrikeBonus!;
    // Ethereal Trade: +DMG on the attack (the HP cost is paid once per action).
    if (aDef.attackTrade) dmg += aDef.attackTrade.bonusDmg;
    // Rager (Twins): a rage downside — while below the HP line, DMG is halved.
    if (aDef.weakBelowHp && attacker.curHp < aDef.weakBelowHp.hp)
      dmg = Math.floor(dmg * aDef.weakBelowHp.dmgMult);

    const struckBefore = attacker.struckThisRound[t.instanceId] ?? 0;
    const r = resolveHit(draft, attacker, t, {
      kind: "basic",
      dmg,
      hits: g.hits,
      pen: Boolean(aDef.keywords.PEN) || auraHasPen(draft, attacker), // Blood Ruby
      crit,
      lifesteal,
      incinerate: aDef.incinerate, // Sol: consecutive same-target hits ramp +1
      incinerateBase: struckBefore,
    });
    if (r.landedHits > 0) {
      attacker.struckThisRound[t.instanceId] = struckBefore + r.landedHits;
      if (firstStrike) attacker.struckEver.push(t.instanceId);
      applyOnHitRider(draft, attacker, t, struckBefore, r.landedHits);
      // Scorch (PYRO aura): apply BURN 1 (1r) if the target has no BURN yet, so
      // it never overwrites a stronger card-specific BURN rider.
      if (aDef.element === "PYRO" && t.curHp > 0 && !hasStatus(t, "BURN")) {
        applyStatus(draft, t, "BURN", 1, 1, "PYRO");
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
      if (aDef.element === "BOLT" && t.curHp > 0 && t.statuses.length === 0) {
        applyStatus(draft, t, "ELECTRIFIED", 1, 0, "BOLT");
      }
      if (healOnHit > 0 && attacker.curHp > 0) healCard(draft, attacker, healOnHit, attacker);
      // Liquification (Bahari): flat heal per landed basic hit.
      if (aDef.healPerHit && attacker.curHp > 0) healCard(draft, attacker, aDef.healPerHit * r.landedHits, attacker);
      // Hastened Assault: heal per critical hit landed.
      if (aDef.healPerCrit && r.critHits && attacker.curHp > 0) {
        const h = healCard(draft, attacker, aDef.healPerCrit * r.critHits, attacker);
        if (h > 0) draft.log.push(`${label(draft, attacker)} feeds on the frenzy (+${h} HP).`);
      }
    }
    agg.landedHits += r.landedHits;
    agg.dodgedHits += r.dodgedHits;
    agg.totalToHp += r.totalToHp;
    agg.targetDied = agg.targetDied || r.targetDied;
    agg.attackerDied = agg.attackerDied || r.attackerDied;
  }

  // Sandman's Nightmare: a flat bonus added ONCE after the volley resolves (not
  // per hit), landing on the primary target.
  const bonus = aDef.basicBonus;
  if (bonus && agg.landedHits > 0 && attacker.curHp > 0) {
    const primary = draft.cards[groups[0].targetId];
    let extra = 0;
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
    attacker.dmgBonus += osb.dmg;
    draft.log.push(`${label(draft, attacker)}'s temper flares (+${osb.dmg} DMG).`);
  }
  // Hillside (Hillbilly): a landed basic attack shields allies in the row ahead.
  const hab = aDef.onHitAllyBuff;
  if (hab?.shields && agg.landedHits > 0 && attacker.curHp > 0 && attacker.pos && !(hab.firstTimeOnly && attacker.onHitBuffFired)) {
    const aheadRow = attacker.pos.row + (attacker.owner === "P1" ? -1 : 1);
    const allies = boardCards(draft, attacker.owner).filter(
      (c) => c.instanceId !== attacker.instanceId && c.pos?.row === aheadRow && c.curHp > 0,
    );
    for (const a of allies) a.curShields += hab.shields;
    if (allies.length > 0)
      draft.log.push(`${label(draft, attacker)} rallies ${allies.length} ally(ies) from the hill (+${hab.shields} shields).`);
    attacker.onHitBuffFired = true;
  }
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
  applyStatus(draft, target, rider.kind, rider.duration, rider.power, getDef(attacker.defId).element);
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

function maybeStatus(
  draft: GameState,
  attacker: CardInstance,
  target: CardInstance,
  params: Record<string, number | string>,
): void {
  const kind = params.statusKind as StatusKind | undefined;
  if (!kind || target.curHp <= 0 || !draft.cards[target.instanceId]) return;
  applyStatus(
    draft,
    target,
    kind,
    num(params, "statusDuration", 1),
    num(params, "statusPower", 0),
    getDef(attacker.defId).element,
  );
}

/** Advance a card up to `steps` open slots toward the enemy home row (the
 *  reposition half of a move-and-strike special). Stops at a captured/occupied
 *  slot; can end on an uncaptured enemy home slot (a capture push). */
function chargeForward(draft: GameState, card: CardInstance, steps: number): void {
  const dir = card.owner === "P1" ? -1 : 1;
  const enemyHome = homeRow(enemyOf(card.owner), draft.boardSize);
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos;
    if (!pos) break;
    const row: number = pos.row + dir;
    if (row < 0 || row >= draft.boardSize) break;
    if (draft.slots[row][pos.col].capturedBy) break;
    if (cardAt(draft, row, pos.col)) break;
    card.pos = { row: row as Pos["row"], col: pos.col };
    moved++;
    if (row === enemyHome) break; // stop on the enemy home row
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} charges forward ${moved} slot(s).`);
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
  const canDiagonal = diagonal || Boolean(getDef(card.defId).keywords.FLYING);
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
      for (const e of boardCards(draft, enemyOf(card.owner))) {
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
function rowAhead(owner: CardInstance["owner"], row: number): number {
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
  const block = Number(tDef.keywords.BLOCK ?? 0) + wallFlatReduction(draft, t) + fieldBonus(draft, t, "block");
  if (block > 0) remaining = Math.max(0, remaining - block); // BLOCK applies even to PEN
  let toHp: number;
  if (pen) {
    toHp = remaining;
  } else {
    toHp = Math.max(0, remaining - t.curShields);
    if (t.curShields > 0) t.curShields--;
  }
  t.curHp -= toHp;
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

export function directDamage(
  draft: GameState,
  source: CardInstance,
  target: CardInstance,
  dmg: number,
  pen: boolean,
): boolean {
  if (!draft.cards[target.instanceId] || target.curHp <= 0) return false;
  const r = resolveHit(draft, source, target, { kind: "reflect", dmg, hits: 1, pen, crit: false });
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
  const boosted = amount + fieldBonus(draft, attacker, "drainBonus");
  const taken = Math.max(0, Math.min(boosted, target.maxHp - 1));
  if (taken <= 0) return 0;
  target.maxHp -= taken;
  target.curHp = Math.min(target.curHp, target.maxHp);
  attacker.maxHp += taken;
  draft.log.push(`${label(draft, attacker)} drains ${taken} max HP from ${label(draft, target)}.`);
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
    if (def.onKill) applyOnKill(draft, source, def.onKill);
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
  const victims = boardCards(draft, enemyOf(deadOwner)).filter((c) => c.pos?.row === row);
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
    for (const e of boardCards(draft, enemyOf(defender.owner))) {
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

/** On-kill: buff the killer / heal / blast. */
function applyOnKill(draft: GameState, killer: CardInstance, def: OnKillDef): void {
  const name = getDef(killer.defId).name;
  if (def.buffDmg) {
    killer.dmgBonus += def.buffDmg;
    draft.log.push(`${name} grows stronger (+${def.buffDmg} DMG) on the kill.`);
  }
  if (def.buffDmgRound) killer.dmgBonusRound += def.buffDmgRound;
  if (def.buffSp) killer.spBonus += def.buffSp;
  if (def.spawnToken) {
    // Harvester: the fallen get up again on her side.
    const raised = spawnTokens(draft, killer, def.spawnToken.token, def.spawnToken.count);
    if (raised.length) draft.log.push(`${name} harvests the fallen — ${raised.length} rise.`);
  }
  if (def.buffHits) {
    killer.hitsBonus += def.buffHits;
    draft.log.push(`${name} gains +${def.buffHits} hit on its basic attack.`);
  }
  if (def.buffMaxHp) {
    killer.maxHp += def.buffMaxHp;
    killer.curHp += def.buffMaxHp;
    draft.log.push(`${name} feeds on the kill (+${def.buffMaxHp} HP).`);
  }
  if (def.coinBonusDmg) {
    const bonus = coin(draft) ? def.coinBonusDmg : def.coinBonusDmg - 1;
    killer.dmgBonus += bonus;
    draft.log.push(`${name} claims the spoils (+${bonus} DMG).`);
  }
  if (def.healSelf) {
    const h = healCard(draft, killer, def.healSelf, killer);
    if (h > 0) draft.log.push(`${name} heals ${h} on the kill.`);
  }
  if (def.gainShields) killer.curShields += def.gainShields;
  if (def.extendStatus) {
    const { kind, rounds } = def.extendStatus;
    let n = 0;
    for (const e of boardCards(draft, enemyOf(killer.owner))) {
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
    for (const e of boardCards(draft, enemyOf(killer.owner)))
      directDamage(draft, killer, e, def.aoeDmg, false);
    draft.log.push(`${name} discharges ${def.aoeDmg} to all enemies!`);
  }
  // Powertrip (Voltogon): once per round, jolt every ELECTRIFIED (statused) enemy.
  if (def.aoeDmgElectrified && !killer.onKillAoeFiredRound) {
    const shocked = boardCards(draft, enemyOf(killer.owner)).filter((e) => e.statuses.length > 0);
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
    caster.maxHp += maxHp;
    caster.curHp += maxHp;
    draft.log.push(`${label(draft, caster)} gains +${maxHp} max HP.`);
  }
  const sp = num(params, "selfSp");
  if (sp !== 0) caster.spBonus += sp;
  const shields = num(params, "selfShields"); // Timberer: brace behind the felled tree
  if (shields > 0) {
    caster.curShields += shields;
    draft.log.push(`${label(draft, caster)} braces (+${shields} shield).`);
  }
  const dmg = num(params, "selfDmg"); // permanent +DMG per use (Volcanon's Bad Temper)
  if (dmg !== 0) {
    caster.dmgBonus += dmg;
    draft.log.push(`${label(draft, caster)} grows hotter (+${dmg} DMG).`);
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
  if (push > 0) pushBack(draft, target, push, attacker?.owner);
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
  for (const e of boardCards(draft, enemyOf(caster.owner))) {
    if (!e.pos) continue;
    const dr = Math.abs(e.pos.row - caster.pos.row);
    const dc = Math.abs(e.pos.col - caster.pos.col);
    if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
      applyStatus(draft, e, kind, num(params, "adjStatusDuration", 1), num(params, "adjStatusPower", 0), getDef(caster.defId).element);
    }
  }
}

export const SPECIAL_HANDLERS: Record<string, SpecialHandler> = {
  /** Spawn N token cards near the caster (Imperator's Strike of Dawn → Heir). */
  spawn(draft, attacker, _targets, params) {
    // `radius` tethers the bodies to the summoner (RIP's Horde), so the burst
    // can't drop husks across the board while the round-tick is leashed.
    const radius = params.radius == null ? undefined : num(params, "radius", 1);
    spawnTokens(draft, attacker, String(params.token ?? ""), num(params, "count", 1), radius);
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
      const dmg = (i === hits - 1 ? finisher : base) + boost;
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
    const center = target.pos ? { ...target.pos } : null; // splash centre (target may die)
    // Rover (Rollo): the roll comes BEFORE the bash — it closes the distance and
    // THEN hits, rather than striking from where it stood and repositioning
    // after. `chargeFirst` chooses which side of the strike the movement lands
    // on; without it `charge` keeps its original after-the-hit behaviour, which
    // is what every existing charger (Skelider, Shadow Horsemen, Griffith) wants.
    const chargeFirst = num(params, "chargeFirst") > 0;
    if (chargeFirst && num(params, "charge") > 0 && center) {
      if (num(params, "chargeLateral") > 0)
        chargeToward(
          draft, attacker, num(params, "charge"), center,
          num(params, "trampleDmg"), num(params, "chargeDiagonal") > 0,
        );
      else chargeForward(draft, attacker, num(params, "charge"));
    }
    const r = resolveHit(draft, attacker, target, {
      kind: "special",
      dmg: num(params, "dmg"),
      hits: num(params, "hits", 1),
      pen: num(params, "pen") > 0,
      crit: false,
    });
    // Self-buff status only if the strike KILLED (Jungle Culling → STEALTH on kill).
    const onKillStatus = params.onKillSelfStatus;
    if (r.targetDied && typeof onKillStatus === "string" && onKillStatus && attacker.curHp > 0) {
      applyStatus(draft, attacker, onKillStatus as StatusKind, num(params, "onKillSelfStatusDuration", 1), 0, getDef(attacker.defId).element);
    }
    // Culling the Weak (Trinezer): a kill made BY this Special lifts the whole
    // side, permanently and cumulatively. Lives on the Special's params rather
    // than the card's onKill so it can't also fire off a basic attack.
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
    // statusSplash (Fenix's Phoenix Blast): the applied status also spreads to
    // enemies adjacent (chess-king) to the struck slot.
    if (params.statusSplash && typeof params.statusKind === "string" && center) {
      const kind = params.statusKind as StatusKind;
      for (const e of boardCards(draft, enemyOf(attacker.owner))) {
        if (e.instanceId === target.instanceId || !e.pos || e.curHp <= 0) continue;
        if (Math.max(Math.abs(e.pos.row - center.row), Math.abs(e.pos.col - center.col)) === 1)
          applyStatus(draft, e, kind, num(params, "statusDuration", 1), num(params, "statusPower"), getDef(attacker.defId).element);
      }
    }
    // Boon Striker (Sticks): sap the target's NEXT basic attack by N (statusless).
    const nextDebuff = num(params, "nextAtkDebuff");
    if (nextDebuff > 0 && draft.cards[target.instanceId] && target.curHp > 0)
      target.nextAttackDmgDebuff = nextDebuff;
    // Splash: reduced damage to enemies adjacent (chess-king) to the struck slot
    // (Dive Bomb 11, Shadow Charge 9).
    const splash = num(params, "splash");
    if (splash > 0 && center) {
      for (const e of boardCards(draft, enemyOf(attacker.owner))) {
        if (e.instanceId === target.instanceId || !e.pos) continue;
        if (Math.max(Math.abs(e.pos.row - center.row), Math.abs(e.pos.col - center.col)) === 1)
          directDamage(draft, attacker, e, splash, num(params, "pen") > 0);
      }
    }
    const selfDamage = num(params, "selfDamage");
    if (selfDamage > 0 && attacker.curHp > 0) {
      attacker.curHp -= selfDamage;
      draft.log.push(`${label(draft, attacker)} pays ${selfDamage} HP.`);
      if (attacker.curHp <= 0) defeatCard(draft, attacker, "self-damage");
      else checkLowHpTransform(draft, attacker);
    }
    // Recoil: the caster takes back a % of the HP damage this strike dealt to the
    // main target (Griffith's Dive Bomb). Self-inflicted and lethal — a dive that
    // lands hard enough can finish an already-wounded caster.
    const recoilPct = num(params, "recoilPct");
    if (recoilPct > 0 && r.totalToHp > 0 && attacker.curHp > 0) {
      const recoil = Math.round((r.totalToHp * recoilPct) / 100);
      if (recoil > 0) {
        attacker.curHp -= recoil;
        draft.log.push(`${label(draft, attacker)} takes ${recoil} recoil.`);
        if (attacker.curHp <= 0) defeatCard(draft, attacker, "recoil");
        else checkLowHpTransform(draft, attacker);
      }
    }
    const healSelf = num(params, "healSelf");
    if (healSelf > 0 && attacker.curHp > 0) healCard(draft, attacker, healSelf, attacker);
    // Lifesteal: heal the caster for the HP damage this strike dealt (Darth's
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
    if (!chargeFirst && num(params, "charge") > 0 && attacker.curHp > 0) {
      if (num(params, "chargeLateral") > 0 && center)
        chargeToward(draft, attacker, num(params, "charge"), center);
      else chargeForward(draft, attacker, num(params, "charge"));
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
    const lane = boardCards(draft, enemyOf(attacker.owner))
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
        pushBack(draft, first, num(params, "push", 1), attacker.owner);
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
    // scaleDmg: fold the caster's permanent DMG bonus into each hit (Fallona's
    // Fall's Emergence boosts Leaf Storm too).
    const dmg =
      num(params, "dmg") +
      (num(params, "scaleDmg") > 0 ? attacker.dmgBonus : 0) +
      (getDef(attacker.defId).attackTrade?.bonusDmg ?? 0); // Ethereal Trade rides the Special too
    // Timberer: ROOT only the FIRST target the volley lands on, not the row.
    const firstOnly = num(params, "firstOnlyStatus") > 0;
    let struck = 0;
    for (const target of pool.slice(0, n)) {
      if (!draft.cards[target.instanceId]) continue;
      resolveHit(draft, attacker, target, {
        kind: "special",
        dmg,
        hits: num(params, "hits", 1),
        pen: num(params, "pen") > 0,
        crit: num(params, "crit") > 0,
        // Hunting Season: the volley is aimed, not sprayed — EVASION doesn't save you.
        alwaysHit: num(params, "alwaysHit") > 0,
        // Incinerate (Sol) rides the Special too, not just basics. Seeded with
        // hits already landed on this target this round, same as basicAttack —
        // the ramp is "consecutive hits on the same target within a round",
        // and it shouldn't reset just because the hits came from a Special.
        incinerate: getDef(attacker.defId).incinerate,
        incinerateBase: attacker.struckThisRound[target.instanceId] ?? 0,
      });
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
    if (!chargeFirst && num(params, "charge") > 0 && attacker.curHp > 0)
      chargeForward(draft, attacker, num(params, "charge"));
    // Root Spring: the same burst that snares the enemy waters its own side.
    const healEl = typeof params.healAlliesElement === "string" ? params.healAlliesElement : "";
    const healAmt = num(params, "healAllies");
    if (healEl && healAmt > 0 && attacker.curHp > 0) {
      let touched = 0;
      for (const a of boardCards(draft, attacker.owner))
        if (getDef(a.defId).element === healEl && healCard(draft, a, healAmt, attacker.owner) > 0) touched++;
      if (touched) draft.log.push(`${label(draft, attacker)} waters ${touched} ${healEl} ally(ies) (+${healAmt} HP).`);
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
      applyDebuffRiders(draft, target, params, attacker); // Mighty Winds push + −SP
      // Bluflames (Sarra): mark the target so it can't be healed.
      const sealR = num(params, "sealRounds");
      if (sealR > 0 && target.curHp > 0 && draft.cards[target.instanceId])
        applyStatus(draft, target, "SEAL", sealR, 0, getDef(attacker.defId).element);
    }
    applySelfRiders(draft, attacker, params); // e.g. Guan's +5 max HP
  },
  /**
   * Blue Wind Spiral (Wista): a shot that ricochets. It lands on the target,
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
      current = boardCards(draft, enemyOf(attacker.owner)).find(
        (e) => !hit.has(e.instanceId) && e.curHp > 0 && e.pos != null && chebyshev(e.pos, from) <= 1,
      )!;
    }
    draft.log.push(`${label(draft, attacker)}'s spiral touches ${hit.size} opponent(s).`);
  },

  /**
   * Static Pressure Overload (Shoksa): a conditional two-way nova — already
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
      target.curHp = Math.min(target.curHp, target.maxHp);
      if (!deleteOnly) attacker.maxHp += stolen;
      draft.log.push(
        deleteOnly
          ? `${label(draft, attacker)} carves ${stolen} max HP out of ${label(draft, target)} — gone for good.`
          : `${label(draft, attacker)} drains ${stolen} max HP from ${label(draft, target)}.`,
      );
    }
    const selfShields = num(params, "selfShields", 0);
    if (selfShields > 0) {
      attacker.curShields += selfShields;
      draft.log.push(`${label(draft, attacker)} gains +${selfShields} shields.`);
    }
  },

  /** Grant shields to one ally. */
  grantShield(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target) return;
    const amount = num(params, "amount", 1);
    target.curShields += amount;
    draft.log.push(
      `${label(draft, attacker)} grants +${amount} shields to ${label(draft, target)}.`,
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
    for (const ally of targets.slice(0, n)) {
      if (amount > 0 && healCard(draft, ally, amount, attacker) > 0) healed++;
      if (doCleanse && ally.statuses.length) ally.statuses = [];
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
  /** Flaming Slasher (SSeerr): light the blade. The next `attacks` basic attacks
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
    const target = targets[0];
    let hit = 0;
    let missed = 0;
    for (let i = 0; i < shots; i++) {
      const t = target && draft.cards[target.instanceId];
      if (!t || t.curHp <= 0 || attacker.curHp <= 0) break;
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

  /** Dirt Driller (Obsidi): drop underground — STEALTH for up to `stealthRounds`
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

  empower(draft, attacker, _targets, params) {
    const dmg = num(params, "selfDmg");
    const hp = num(params, "selfMaxHp");
    const sp = num(params, "selfSp");
    // buffRounds turns the grant TEMPORARY (Ravven's Night Stalk). Without it
    // the buff is permanent, as Heir's Crowned has always been.
    const rounds = num(params, "buffRounds");
    if (rounds > 0) {
      applyTimedBuff(attacker, dmg, sp, rounds);
      // Was hardcoded to Ravven's "+N DMG" flavour, which read as "+0 DMG" for
      // any timed buff that grants SP instead (Hawk's Glide Rush).
      const parts = [dmg ? `+${dmg} DMG` : "", sp ? `+${sp} SP` : ""].filter(Boolean);
      draft.log.push(`${label(draft, attacker)} surges (${parts.join(", ")} for ${rounds} rounds).`);
      return;
    }
    if (dmg) attacker.dmgBonus += dmg;
    if (hp > 0) { attacker.maxHp += hp; attacker.curHp += hp; }
    if (sp) attacker.spBonus += sp;
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
    if (sp > 0) for (const a of kin) applyTimedBuff(a, 0, sp, rounds);
    draft.log.push(
      `${label(draft, attacker)} accelerates the burn (2x BURN for ${rounds}r, +${sp} SP to ${kin.length} ${el} all(y/ies)).`,
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
