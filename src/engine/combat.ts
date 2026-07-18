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
import { auraHasPen, boardCards, cardAt, effectiveDmg, effectiveMaxHp, effectiveSp, hasStatus, healCard, manhattan, removeCard, spawnTokens } from "./state";
import type {
  CardInstance,
  Element,
  GameState,
  OnHitByMeleeDef,
  OnKillDef,
  Pos,
  StatusKind,
} from "./types";
import { BOARD_SIZE, MULTI_HIT_BONUS_MIN, NEGATIVE_STATUSES, enemyOf, homeRow } from "./types";

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
  let hits = def.hits + (card.hitsBonus ?? 0) + (card.hitsBonusRound ?? 0) + (card.loadedHits ?? 0);
  if (def.hits >= MULTI_HIT_BONUS_MIN && card.pos && (card.pos.row === 1 || card.pos.row === 2)) hits += 1;
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
  const fresh = { kind, duration, power, source };
  const existing = target.statuses.findIndex((s) => s.kind === kind);
  if (existing >= 0) target.statuses[existing] = fresh;
  else target.statuses.push(fresh);
  draft.log.push(
    `${label(draft, target)} is afflicted: ${kind}${power ? ` ${power}` : ""} (${duration}r)${existing >= 0 ? " (refreshed)" : ""}.`,
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
      target.pos = { ...target.pos, row: row as 0 | 1 | 2 | 3 };
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
    if (Math.min(def.dmg, def.hp, def.sp) - d * nextCount > 0) {
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
export function pushBack(draft: GameState, card: CardInstance, steps: number): void {
  const dir = card.owner === "P1" ? 1 : -1; // toward own home (P1 = row 3, P2 = row 0)
  const home = homeRow(card.owner);
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos;
    if (!pos || pos.row === home) break;
    const row: number = pos.row + dir;
    if (row < 0 || row >= BOARD_SIZE) break;
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

  for (let i = 0; i < opts.hits; i++) {
    if (target.curHp <= 0) break;

    // 0. BLIND — −50% accuracy, rolled PER HIT on a basic attack (so a blinded
    //    multi-hit lands some and whiffs others). Specials auto-hit.
    if (opts.kind === "basic" && hasStatus(attacker, "BLIND") && !coin(draft)) {
      result.dodgedHits++;
      target.fxMiss = (target.fxMiss ?? 0) + 1;
      draft.log.push(`${label(draft, attacker)} misses (BLIND).`);
      continue;
    }

    // 1. EVASION — innate or granted by a friendly wall (Veil). Not re-checked
    //    for reflect damage (no dodge chains).
    if (opts.kind !== "reflect" && (tDef.keywords.EVASION || wallEvasion(draft, target) || hasStatus(target, "EVASION"))) {
      if (coin(draft)) {
        result.dodgedHits++;
        target.fxMiss = (target.fxMiss ?? 0) + 1;
        draft.log.push(`${label(draft, target)} evades a hit from ${aDef.name}.`);
        continue;
      }
    }

    // 1b. Rocky Force Field (Rhe): coin-flip chance to shrug off a RANGED hit.
    if (opts.kind !== "reflect" && tDef.blocksRangedChance && aDef.attackType === "Ranged" && pctChance(draft, tDef.blocksRangedChance)) {
      result.dodgedHits++;
      draft.log.push(`${label(draft, target)}'s force field deflects ${aDef.name}'s shot.`);
      continue;
    }

    // 2. BLOCK — flat reduction, applies before shields and even to PEN. Adds
    //    the card's own BLOCK to any friendly wall reduction (Stone/Radiant).
    let remaining = opts.dmg;
    // Incinerate ramp: +1 per consecutive landed hit on this target (this volley
    // + hits already landed on it this round).
    if (opts.incinerate) remaining += (opts.incinerateBase ?? 0) + result.landedHits;
    const block = Number(tDef.keywords.BLOCK ?? 0) + wallFlatReduction(draft, target);
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
    const reflect = Number(tDef.keywords.REFLECT ?? 0);
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
  }

  // 5. On-hit keywords — basic attacks only. (onHitStatus riders + vsStatus
  //    heals are applied by basicAttack, which knows the per-target gating.)
  if (opts.kind === "basic" && result.landedHits > 0) {
    if ((aDef.keywords.LIFESTEAL || opts.lifesteal) && result.totalToHp > 0) {
      const healed = healCard(draft, attacker, result.totalToHp); // SEAL blocks it
      if (healed > 0) draft.log.push(`${aDef.name} lifesteals ${healed} HP.`);
    }
    if (aDef.keywords.DRAIN) {
      if (target.maxHp > 1) {
        target.maxHp -= 1;
        target.curHp = Math.min(target.curHp, target.maxHp);
        attacker.maxHp += 1;
        draft.log.push(`${aDef.name} drains 1 max HP from ${tDef.name}.`);
      }
    }
  }

  if (target.curHp <= 0) {
    const deathPos = target.pos ? { ...target.pos } : null;
    const deadOwner = target.owner;
    const removed = defeatCard(draft, target, `${aDef.name}'s ${opts.kind}`);
    if (!removed) return result; // revived — no kill/on-death triggers
    result.targetDied = true;
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
    // On-death effects.
    if (tDef.onDeath && opts.kind !== "reflect") {
      if (tDef.onDeath.rowAhead && deathPos) {
        // Burnout: blast the enemy row directly ahead of where it fell.
        onDeathRowAhead(draft, target, deadOwner, deathPos, tDef.onDeath.dmg, Boolean(tDef.onDeath.pen));
      } else if (attacker.curHp > 0) {
        // Lingering Venom / Bird Bomb: retaliate on the killer directly.
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
    } else if (tDef.element === "DUSK" && opts.kind !== "reflect" && attacker.curHp > 0) {
      // Midnight Shade (DUSK aura): a dying card deals half its DMG to the
      // killer. Only when the card has no stronger card-specific onDeath.
      const back = Math.floor(tDef.dmg / 2);
      if (back > 0) {
        draft.log.push(`${tDef.name} lashes out from the shadows (${back} DMG).`);
        const r = resolveHit(draft, target, attacker, { kind: "reflect", dmg: back, hits: 1, pen: false, crit: false });
        if (r.targetDied) result.attackerDied = true;
      }
    }
  }

  // Skelider Dismount: transform the first time it drops below its HP threshold.
  if (target.curHp > 0) checkLowHpTransform(draft, target);

  // Thorns: retaliate when a surviving card is struck by a MELEE attacker.
  if (
    opts.kind !== "reflect" &&
    result.landedHits > 0 &&
    target.curHp > 0 &&
    attacker.curHp > 0 &&
    aDef.attackType === "Melee" &&
    tDef.onHitByMelee
  ) {
    const r = applyOnHitByMelee(draft, target, attacker, tDef.onHitByMelee);
    if (r) result.attackerDied = true;
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
    let dmg = effectiveDmg(draft, attacker);
    if (atkDebuff) { dmg = Math.max(0, dmg - atkDebuff); atkDebuff = 0; } // Boon Striker, once
    let crit = Boolean(aDef.keywords.CRIT);
    // Hastened Assault (WolfBane): CRIT only while faster than the target.
    if (aDef.critIfFaster && effectiveSp(draft, attacker) > effectiveSp(draft, t)) crit = true;
    let lifesteal = false;
    let healOnHit = 0;
    const vs = aDef.vsStatus;
    const vsMatch = vs != null && hasStatus(t, vs.status);
    if (vs && vsMatch) {
      if (vs.dmgMult) dmg = Math.floor(dmg * vs.dmgMult);
      if (vs.bonusDmg) dmg += vs.bonusDmg;
      if (vs.crit) crit = true;
      if (vs.lifesteal) lifesteal = true;
      healOnHit = vs.healOnHit ?? 0;
    }
    // Electrify (BOLT aura): +1 DMG vs any statused opponent.
    if (aDef.element === "BOLT" && t.statuses.length > 0) dmg += 1;
    // Harsh Winds / Shadow: bonus DMG the first time this card strikes a given
    // opponent. Vaga's version only counts while it stands on the enemy side.
    const homeR = attacker.owner === "P1" ? 3 : 0;
    const onEnemySide = attacker.pos != null && Math.abs(attacker.pos.row - homeR) >= 2;
    const fsEligible = Boolean(aDef.firstStrikeBonus) && (!aDef.firstStrikeEnemySideOnly || onEnemySide);
    const firstStrike = fsEligible && !attacker.struckEver.includes(t.instanceId);
    if (firstStrike) dmg += aDef.firstStrikeBonus!;
    // Ethereal Trade: +DMG on the attack (the HP cost is paid once per action).
    if (aDef.attackTrade) dmg += aDef.attackTrade.bonusDmg;

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
      if (healOnHit > 0 && attacker.curHp > 0) healCard(draft, attacker, healOnHit);
      // Hastened Assault: heal per critical hit landed.
      if (aDef.healPerCrit && r.critHits && attacker.curHp > 0) {
        const h = healCard(draft, attacker, aDef.healPerCrit * r.critHits);
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
    if (bonus.midLane && attacker.pos && (attacker.pos.row === 1 || attacker.pos.row === 2)) extra += bonus.midLane;
    if (bonus.midLaneFull && boardCards(draft).filter((c) => c.pos && (c.pos.row === 1 || c.pos.row === 2)).length >= 4)
      extra += bonus.midLaneFull;
    if (bonus.vsSleeping && primary && hasStatus(primary, "SLEEP")) extra += bonus.vsSleeping;
    if (extra > 0 && primary && primary.curHp > 0) {
      draft.log.push(`${label(draft, attacker)}'s nightmare deals +${extra} bonus damage.`);
      if (directDamage(draft, attacker, primary, extra, false)) agg.targetDied = true;
    }
  }
  attacker.loadedHits = 0; // loaded darts are spent on this attack (Bleed Out)
  // Bad Temper (Volcanon) / Regenerative (Squanch): a landed basic attack grants
  // a permanent self-buff — +DMG and/or +shields (capped at maxShields).
  const osb = aDef.onHitSelfBuff;
  if (osb && agg.landedHits > 0 && attacker.curHp > 0) {
    if (osb.dmg) {
      attacker.dmgBonus += osb.dmg;
      draft.log.push(`${label(draft, attacker)}'s temper flares (+${osb.dmg} DMG).`);
    }
    if (osb.shields) {
      const cap = osb.maxShields ?? Infinity;
      if (attacker.curShields < cap) {
        attacker.curShields = Math.min(cap, attacker.curShields + osb.shields);
        draft.log.push(`${label(draft, attacker)} regrows bark (+${osb.shields} shield).`);
      }
    }
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
  const enemyHome = homeRow(enemyOf(card.owner));
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const pos = card.pos;
    if (!pos) break;
    const row: number = pos.row + dir;
    if (row < 0 || row >= BOARD_SIZE) break;
    if (draft.slots[row][pos.col].capturedBy) break;
    if (cardAt(draft, row, pos.col)) break;
    card.pos = { row: row as Pos["row"], col: pos.col };
    moved++;
    if (row === enemyHome) break; // stop on the enemy home row
  }
  if (moved > 0) draft.log.push(`${label(draft, card)} charges forward ${moved} slot(s).`);
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
): boolean {
  const t = draft.cards[target.instanceId];
  if (!t || t.curHp <= 0) return false;
  const tDef = getDef(t.defId);
  let remaining = dmg;
  const block = Number(tDef.keywords.BLOCK ?? 0) + wallFlatReduction(draft, t);
  if (block > 0) remaining = Math.max(0, remaining - block); // BLOCK applies even to PEN
  let toHp: number;
  if (pen) {
    toHp = remaining;
  } else {
    toHp = Math.max(0, remaining - t.curShields);
    if (t.curShields > 0) t.curShields--;
  }
  t.curHp -= toHp;
  draft.log.push(`${label(draft, t)} takes ${toHp} spell damage.`);
  if (hasStatus(t, "SLEEP") && t.curHp > 0) {
    t.statuses = t.statuses.filter((s) => s.kind !== "SLEEP");
    draft.log.push(`${label(draft, t)} is jolted awake!`);
  }
  if (t.curHp <= 0) {
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
  if (row < 0 || row >= BOARD_SIZE) return;
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

/** On-kill: buff the killer / heal / blast. */
function applyOnKill(draft: GameState, killer: CardInstance, def: OnKillDef): void {
  const name = getDef(killer.defId).name;
  if (def.buffDmg) {
    killer.dmgBonus += def.buffDmg;
    draft.log.push(`${name} grows stronger (+${def.buffDmg} DMG) on the kill.`);
  }
  if (def.buffDmgRound) killer.dmgBonusRound += def.buffDmgRound;
  if (def.buffSp) killer.spBonus += def.buffSp;
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
    const h = healCard(draft, killer, def.healSelf);
    if (h > 0) draft.log.push(`${name} heals ${h} on the kill.`);
  }
  if (def.gainShields) killer.curShields += def.gainShields;
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
): void {
  if (!draft.cards[target.instanceId] || target.curHp <= 0) return;
  const push = num(params, "push");
  if (push > 0) pushBack(draft, target, push);
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
    spawnTokens(draft, attacker, String(params.token ?? ""), num(params, "count", 1));
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
    maybeStatus(draft, attacker, target, params);
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
    // main target (Griffith's Dive Bomb — 10% recoil).
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
    if (healSelf > 0 && attacker.curHp > 0) healCard(draft, attacker, healSelf);
    // Lifesteal: heal the caster for the HP damage this strike dealt (Darth's
    // Dark Hunting) — specials don't auto-lifesteal like basics do.
    if (num(params, "lifesteal") > 0 && r.totalToHp > 0 && attacker.curHp > 0)
      healCard(draft, attacker, r.totalToHp);
    if (attacker.curHp > 0) {
      adjacentCasterStatus(draft, attacker, params); // ROOT all adjacent (Squanch)
      applySelfRiders(draft, attacker, params);
    }
    // Charge: a move-and-strike special advances the attacker toward the enemy
    // home (up to `charge` open steps) after it hits — its reach came from the
    // ranged flag; this is the repositioning half of "move up to N and strike".
    if (num(params, "charge") > 0 && attacker.curHp > 0) chargeForward(draft, attacker, num(params, "charge"));
  },

  /** Damage to up to N valid enemy targets (chosen target first). Optional
   *  hits (dmg × hits per target), pen, crit, and a statusKind applied to each
   *  surviving target (FREEZE/BLIND/SCALD/PARALYZE nova). */
  barrage(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    // scaleDmg: fold the caster's permanent DMG bonus into each hit (Fallona's
    // Fall's Emergence boosts Leaf Storm too).
    const dmg =
      num(params, "dmg") +
      (num(params, "scaleDmg") > 0 ? attacker.dmgBonus : 0) +
      (getDef(attacker.defId).attackTrade?.bonusDmg ?? 0); // Ethereal Trade rides the Special too
    for (const target of targets.slice(0, n)) {
      if (!draft.cards[target.instanceId]) continue;
      resolveHit(draft, attacker, target, {
        kind: "special",
        dmg,
        hits: num(params, "hits", 1),
        pen: num(params, "pen") > 0,
        crit: num(params, "crit") > 0,
      });
      maybeStatus(draft, attacker, target, params);
      applyDebuffRiders(draft, target, params); // −SP (Angale, sinkhole)
      // A SECOND status alongside the primary (sinkhole = DOT + BLIND).
      const db = params.debuffStatus;
      if (typeof db === "string" && db && draft.cards[target.instanceId] && target.curHp > 0)
        applyStatus(draft, target, db as StatusKind, num(params, "debuffStatusRounds", 1), 0, getDef(attacker.defId).element);
      if (attacker.curHp <= 0) break; // died to REFLECT mid-volley
    }
    // Self-cost (Kraken's Black Wave Crash: "Lose 5 HP") — can dip the caster
    // low enough to trip its own From the Deep surge.
    const selfDamage = num(params, "selfDamage");
    if (selfDamage > 0 && attacker.curHp > 0) {
      attacker.curHp -= selfDamage;
      draft.log.push(`${label(draft, attacker)} pays ${selfDamage} HP.`);
      if (attacker.curHp <= 0) defeatCard(draft, attacker, "self-damage");
      else checkLowHpTransform(draft, attacker);
    }
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
      applyDebuffRiders(draft, target, params); // Mighty Winds push + −SP
      // Bluflames (Sarra): mark the target so it can't be healed.
      const sealR = num(params, "sealRounds");
      if (sealR > 0 && target.curHp > 0 && draft.cards[target.instanceId])
        applyStatus(draft, target, "SEAL", sealR, 0, getDef(attacker.defId).element);
    }
    applySelfRiders(draft, attacker, params); // e.g. Guan's +5 max HP
  },

  /** Permanently steal max HP from one enemy (DUSK's Jacked-style theft). */
  drainMax(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target) return;
    const amount = num(params, "amount", 1);
    const stolen = Math.min(amount, target.maxHp - 1); // never below 1 max HP
    if (stolen > 0) {
      target.maxHp -= stolen;
      target.curHp = Math.min(target.curHp, target.maxHp);
      attacker.maxHp += stolen;
      draft.log.push(
        `${label(draft, attacker)} drains ${stolen} max HP from ${label(draft, target)}.`,
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
      if (amount > 0 && healCard(draft, ally, amount) > 0) healed++;
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
  empower(draft, attacker, _targets, params) {
    const dmg = num(params, "selfDmg");
    const hp = num(params, "selfMaxHp");
    const sp = num(params, "selfSp");
    if (dmg) attacker.dmgBonus += dmg;
    if (hp > 0) { attacker.maxHp += hp; attacker.curHp += hp; }
    if (sp) attacker.spBonus += sp;
    draft.log.push(`${label(draft, attacker)} is Crowned (+${dmg} DMG, +${hp} HP, +${sp} SP)!`);
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
