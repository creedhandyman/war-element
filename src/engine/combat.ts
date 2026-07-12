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
import { chance, coin } from "./rng";
import { cardAt, effectiveDmg, hasStatus, removeCard } from "./state";
import type {
  CardInstance,
  Element,
  GameState,
  StatusKind,
} from "./types";

export interface HitOptions {
  kind: "basic" | "special" | "reflect";
  dmg: number; // damage per sub-hit
  hits: number;
  pen: boolean;
  crit: boolean; // CRIT keyword in play (basic attacks only)
}

export interface AttackResult {
  landedHits: number;
  dodgedHits: number;
  totalToHp: number;
  targetDied: boolean;
  attackerDied: boolean; // via REFLECT
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

function die(draft: GameState, card: CardInstance, cause: string): void {
  draft.log.push(`${label(draft, card)} is defeated (${cause}).`);
  removeCard(draft, card.instanceId);
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
  };
  let reflectBack = 0;

  for (let i = 0; i < opts.hits; i++) {
    if (target.curHp <= 0) break;

    // 1. EVASION — not re-checked for reflect damage (no dodge chains).
    if (opts.kind !== "reflect" && tDef.keywords.EVASION) {
      if (coin(draft)) {
        result.dodgedHits++;
        draft.log.push(`${label(draft, target)} evades a hit from ${aDef.name}.`);
        continue;
      }
    }

    // 2. BLOCK — flat reduction, applies before shields and even to PEN.
    let remaining = opts.dmg;
    const block = Number(tDef.keywords.BLOCK ?? 0);
    if (block > 0) remaining = Math.max(0, remaining - block);

    // 3. Shield gate.
    let toHp: number;
    if (opts.pen) {
      toHp = remaining; // no shield stripped
    } else {
      if (opts.crit && target.curShields === 0) {
        if (coin(draft)) {
          remaining *= 2;
          draft.log.push(`${aDef.name} CRITS ${tDef.name}!`);
        }
      }
      toHp = Math.max(0, remaining - target.curShields);
      if (target.curShields > 0) target.curShields--;
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
    // Any hit wakes a sleeper (SLEEP removed the moment it's struck).
    if (hasStatus(target, "SLEEP") && target.curHp > 0) {
      target.statuses = target.statuses.filter((s) => s.kind !== "SLEEP");
      draft.log.push(`${label(draft, target)} is jolted awake!`);
    }
  }

  // 5. On-hit keywords — basic attacks only.
  if (opts.kind === "basic" && result.landedHits > 0) {
    if (aDef.keywords.LIFESTEAL && result.totalToHp > 0) {
      const healed = Math.min(result.totalToHp, attacker.maxHp - attacker.curHp);
      if (healed > 0) {
        attacker.curHp += healed;
        draft.log.push(`${aDef.name} lifesteals ${healed} HP.`);
      }
    }
    if (aDef.keywords.DRAIN) {
      if (target.maxHp > 1) {
        target.maxHp -= 1;
        target.curHp = Math.min(target.curHp, target.maxHp);
        attacker.maxHp += 1;
        draft.log.push(`${aDef.name} drains 1 max HP from ${tDef.name}.`);
      }
    }
    // Data-driven on-hit status rider (e.g. StickViper's BLEED).
    if (aDef.onHitStatus && target.curHp > 0) {
      applyStatus(
        draft,
        target,
        aDef.onHitStatus.kind,
        aDef.onHitStatus.duration,
        aDef.onHitStatus.power,
        aDef.element,
      );
    }
  }

  if (target.curHp <= 0) {
    result.targetDied = true;
    die(draft, target, `${aDef.name}'s ${opts.kind}`);
    // On-death retaliation (Lingering Venom / Bird Bomb): hits the killer
    // directly — no evasion, no chains (kind 'reflect' guards recursion; a
    // retaliation-killed card's own rider stops at the already-dead attacker).
    if (tDef.onDeath && opts.kind !== "reflect" && attacker.curHp > 0) {
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
  // BLIND: −50% accuracy → coin; a miss negates the whole attack, no strip.
  if (hasStatus(attacker, "BLIND") && !coin(draft)) {
    draft.log.push(`${label(draft, attacker)} misses (BLIND).`);
    return missed;
  }
  // PARALYZE: 50% chance to attack at all.
  if (hasStatus(attacker, "PARALYZE") && !chance(draft, 50)) {
    draft.log.push(`${label(draft, attacker)} is paralyzed and can't attack.`);
    return missed;
  }

  // Allocate the volley: one pick takes every hit; multiple picks take one hit
  // each (consecutive repeats of the same target merge into one gated volley).
  const groups: { targetId: string; hits: number }[] = [];
  if (picks.length === 1) {
    groups.push({ targetId: picks[0], hits: aDef.hits });
  } else {
    for (const id of picks) {
      const last = groups[groups.length - 1];
      if (last && last.targetId === id) last.hits++;
      else groups.push({ targetId: id, hits: 1 });
    }
  }

  const agg: AttackResult = { ...missed };
  for (const g of groups) {
    const t = draft.cards[g.targetId];
    if (!t || attacker.curHp <= 0) continue; // target fell / attacker died to REFLECT
    const r = resolveHit(draft, attacker, t, {
      kind: "basic",
      dmg: effectiveDmg(draft, attacker),
      hits: g.hits,
      pen: Boolean(aDef.keywords.PEN),
      crit: Boolean(aDef.keywords.CRIT),
    });
    agg.landedHits += r.landedHits;
    agg.dodgedHits += r.dodgedHits;
    agg.totalToHp += r.totalToHp;
    agg.targetDied = agg.targetDied || r.targetDied;
    agg.attackerDied = agg.attackerDied || r.attackerDied;
  }
  return agg;
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

export const SPECIAL_HANDLERS: Record<string, SpecialHandler> = {
  /** Single-target damage w/ optional pen, self-damage, self-heal, status. */
  strike(draft, attacker, targets, params) {
    const target = targets[0];
    if (!target) return;
    resolveHit(draft, attacker, target, {
      kind: "special",
      dmg: num(params, "dmg"),
      hits: num(params, "hits", 1),
      pen: num(params, "pen") > 0,
      crit: false,
    });
    maybeStatus(draft, attacker, target, params);
    const selfDamage = num(params, "selfDamage");
    if (selfDamage > 0 && attacker.curHp > 0) {
      attacker.curHp -= selfDamage;
      draft.log.push(`${label(draft, attacker)} pays ${selfDamage} HP.`);
      if (attacker.curHp <= 0) {
        draft.log.push(`${label(draft, attacker)} is defeated (self-damage).`);
        removeCard(draft, attacker.instanceId);
      }
    }
    const healSelf = num(params, "healSelf");
    if (healSelf > 0 && attacker.curHp > 0) {
      attacker.curHp = Math.min(attacker.maxHp, attacker.curHp + healSelf);
    }
  },

  /** Damage to up to N valid enemy targets (chosen target first). Optional
   *  hits (dmg × hits per target), pen, crit, and a statusKind applied to each
   *  surviving target (FREEZE/BLIND/SCALD/PARALYZE nova). */
  barrage(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    for (const target of targets.slice(0, n)) {
      if (!draft.cards[target.instanceId]) continue;
      resolveHit(draft, attacker, target, {
        kind: "special",
        dmg: num(params, "dmg"),
        hits: num(params, "hits", 1),
        pen: num(params, "pen") > 0,
        crit: num(params, "crit") > 0,
      });
      maybeStatus(draft, attacker, target, params);
      if (attacker.curHp <= 0) break; // died to REFLECT mid-volley
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
    }
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

  /** Heal up to N allies (chosen first), optionally cleansing them (DAWN). */
  heal(draft, attacker, targets, params) {
    const n = num(params, "targets", 1);
    const amount = num(params, "amount", 0);
    const doCleanse = num(params, "cleanse", 0) > 0;
    let healed = 0;
    for (const ally of targets.slice(0, n)) {
      if (amount > 0 && ally.curHp < ally.maxHp) {
        ally.curHp = Math.min(ally.maxHp, ally.curHp + amount);
        healed++;
      }
      if (doCleanse && ally.statuses.length) ally.statuses = [];
    }
    draft.log.push(
      `${label(draft, attacker)} restores allies (+${amount} HP${doCleanse ? ", CLEANSE" : ""}, ${healed} healed).`,
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
