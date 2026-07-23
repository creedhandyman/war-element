// Legality checks — the UI and the AI both ask these questions instead of
// computing rule outcomes themselves.

import { getDef } from "../data/cards";
import {
  boardCards,
  cardAt,
  chebyshev,
  effectiveDmg,
  effectiveMaxHp,
  fieldBonus,
  fieldFlag,
  hasStatus,
  isCaptured,
  isContested,
  manhattan,
  effectiveSp,
  moveReachFor,
  movesLikeKing,
} from "./state";
import type {
  CardDef,
  CardInstance,
  GameState,
  PlayerId,
  Pos,
  SpellDef,
} from "./types";
import { enemyOf, homeRow, isMidRow } from "./types";
import { getSpell } from "./spells";

// ── prep phase ──────────────────────────────────────────────────────────────

export function canSummon(
  state: GameState,
  player: PlayerId,
  handId: string,
  col: number,
): { ok: boolean; reason?: string } {
  if (state.phase !== "prep") return { ok: false, reason: "Not the Prep Phase" };
  if (state.prep?.priority !== player)
    return { ok: false, reason: "You don't have priority" };
  const hand = state.players[player].hand.find((h) => h.handId === handId);
  if (!hand) return { ok: false, reason: "Card not in hand" };
  const def = getDef(hand.defId);
  if (def.cost > state.players[player].summonPool)
    return { ok: false, reason: "Not enough summon resources" };
  const row = homeRow(player, state.boardSize);
  if (col < 0 || col >= state.boardSize) return { ok: false, reason: "Bad column" };
  if (isCaptured(state, row, col))
    return { ok: false, reason: "Slot is permanently captured" };
  if (isContested(state, player, col))
    return { ok: false, reason: "Slot is contested by an enemy card" };
  if (cardAt(state, row, col)) return { ok: false, reason: "Slot is occupied" };
  return { ok: true };
}

/** Trample Through (WarPhant): the shove a MOVE would perform, or null if this
 *  move is not one. Exported so the reducer resolves exactly what canMove
 *  approved rather than re-deriving it and risking the two drifting apart.
 *
 *  Conditions, all required: the mover has the trait, the step is a single
 *  square, the destination holds an ENEMY, that enemy is strictly weaker by
 *  effective max HP (auras count), and the square directly beyond it — same
 *  direction, so the victim is driven straight back — is on the board, open and
 *  uncaptured. */
export function shoveTarget(
  state: GameState,
  card: CardInstance,
  to: Pos,
): { victim: CardInstance; dest: Pos } | null {
  if (!card.pos || !getDef(card.defId).shoveWeaker) return null;
  const dr = to.row - card.pos.row;
  const dc = to.col - card.pos.col;
  if (Math.max(Math.abs(dr), Math.abs(dc)) !== 1) return null; // one square only
  const victim = cardAt(state, to.row, to.col);
  if (!victim || victim.owner === card.owner) return null;
  if (effectiveMaxHp(state, victim) >= effectiveMaxHp(state, card)) return null;
  const beyond = { row: to.row + dr, col: to.col + dc };
  if (
    beyond.row < 0 || beyond.row >= state.boardSize ||
    beyond.col < 0 || beyond.col >= state.boardSize ||
    state.slots[beyond.row][beyond.col].capturedBy ||
    cardAt(state, beyond.row, beyond.col)
  )
    return null;
  return { victim, dest: beyond };
}

export function canMove(
  state: GameState,
  player: PlayerId,
  instanceId: string,
  to: Pos,
): { ok: boolean; reason?: string } {
  if (state.phase !== "prep") return { ok: false, reason: "Not the Prep Phase" };
  if (state.prep?.priority !== player)
    return { ok: false, reason: "You don't have priority" };
  if (state.prep.movedThisTurn)
    return { ok: false, reason: "Already moved a card this priority turn" };
  const card = state.cards[instanceId];
  if (!card || !card.pos) return { ok: false, reason: "No such card on board" };
  if (card.owner !== player) return { ok: false, reason: "Not your card" };
  if (hasStatus(card, "STUN"))
    return { ok: false, reason: "STUNNED — no attack, move, or Special" };
  if (hasStatus(card, "SLEEP"))
    return { ok: false, reason: "ASLEEP — cannot move until woken" };
  if (hasStatus(card, "FRIGHTEN"))
    return { ok: false, reason: "FRIGHTENED — cannot move" };
  const reach = moveReachFor(state, card);
  if (reach === 0) return { ok: false, reason: "This card can't move (SP 0)" };
  if (to.row < 0 || to.row >= state.boardSize || to.col < 0 || to.col >= state.boardSize)
    return { ok: false, reason: "Off the board" };
  // FLYING, MOUNTED and FAST-tier cards move like a chess king — a diagonal step
  // costs 1, not 2. See movesLikeKing.
  const dist = movesLikeKing(getDef(card.defId), card, effectiveSp(state, card))
    ? chebyshev(card.pos, to)
    : manhattan(card.pos, to);
  if (dist === 0) return { ok: false, reason: "Already there" };
  if (dist > reach)
    return { ok: false, reason: `Too far (reach ${reach})` };
  // No home-to-home dash: a card standing on its OWN home row may not land on
  // the enemy's in a single move. With the fast tier reaching 3 slots, a 4x4
  // board is exactly 3 rows deep — so a quick card could otherwise leave the
  // back line and take a capture slot in one step, before the opponent had a
  // turn to answer it. Crossing still takes two moves; this costs the dash, not
  // the destination.
  if (
    card.pos.row === homeRow(card.owner, state.boardSize) &&
    to.row === homeRow(enemyOf(card.owner), state.boardSize)
  )
    return { ok: false, reason: "Can't cross from your Home row to theirs in one move" };
  if (cardAt(state, to.row, to.col) && !shoveTarget(state, card, to))
    return { ok: false, reason: "Destination occupied" };
  // Captured slots are locked: cards may pass through, but can't stop on one.
  if (isCaptured(state, to.row, to.col))
    return { ok: false, reason: "Slot is permanently captured (locked)" };
  return { ok: true };
}

/** All slots `instanceId` may legally move to right now. */
export function legalMoves(state: GameState, player: PlayerId, instanceId: string): Pos[] {
  const out: Pos[] = [];
  for (let row = 0; row < state.boardSize; row++)
    for (let col = 0; col < state.boardSize; col++) {
      const pos = { row, col } as Pos;
      if (canMove(state, player, instanceId, pos).ok) out.push(pos);
    }
  return out;
}

// ── targeting ───────────────────────────────────────────────────────────────

/**
 * Can `attacker` target `target` with an attack or targeted special?
 * - Melee: adjacent squares only — the 8 surrounding cells (within 1 row AND
 *   1 column, chess-king reach). Ranged: any slot.
 * - Home Slot Targeting Rule: a slot in the DEFENDER's home row can only be
 *   targeted from a Mid row (1/2) or from inside that home row itself.
 * - FLYING: immune to Melee — unless the attacker is ALSO flying (a flying
 *   melee card can strike other fliers). STEALTH: untargetable until it attacks.
 */
/** How far a ranged BASIC attack sees, in king-steps (Chebyshev distance). */
export const RANGED_REACH = 2;

/**
 * Ranged line of sight: everything within RANGED_REACH king-steps — a 5×5 box
 * centred on the shooter — with bodies blocking along the straight lines.
 *
 * Range is Chebyshev distance, NOT a queen's ray. Ray-only left holes at the
 * knight-shaped squares (one row over, two columns across): a card two steps
 * away, plainly beside you, was untargetable at any odds. The gap showed up in
 * play — a Dart Frog on r1c3 could not shoot Rhe on r2c1 and had its whole
 * attack greyed out with two enemies standing next to it.
 *
 * Blocking still applies, but only where a straight line exists (same row,
 * same column, or a true diagonal). On those the single intervening square
 * stops the shot; the blocker itself stays a legal target, since you can always
 * shoot the thing in your face. Knight-shaped shots have no single line to
 * interrupt, so they arc over the gap and cannot be screened.
 *
 * Only ENEMY bodies block. Chess would have your own pieces screen too, but a
 * formation that silently disarms your own archer reads as a broken UI rather
 * than as a tactic — you advance into your own firing lane constantly. Allies
 * are shot past; the enemy front line is what shields their back row.
 */
export function rangedCanSee(
  state: GameState,
  from: Pos,
  to: Pos,
  shooter: PlayerId,
  reach: number = RANGED_REACH,
): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  if (adr === 0 && adc === 0) return false;
  const dist = Math.max(adr, adc);
  if (dist > reach) return false;
  // Straight line → walk it and let an ENEMY body in between stop the shot.
  const onLine = dr === 0 || dc === 0 || adr === adc;
  if (onLine) {
    const sr = Math.sign(dr);
    const sc = Math.sign(dc);
    for (let i = 1; i < dist; i++) {
      // Stop BEFORE the target: a body between blocks, the target itself doesn't.
      const between = cardAt(state, from.row + sr * i, from.col + sc * i);
      if (between && between.owner !== shooter) return false;
    }
  }
  return true;
}

/**
 * How far this card's BASIC attack reaches, in king-steps.
 *
 * King of the Hill's reach half: a card that has left its OWN summoning row
 * sees one square further. Holding the back line keeps you short-sighted;
 * pushing off it is what buys the extra square, and a shooter that has fought
 * all the way onto the enemy's home row keeps the bonus.
 *
 * Melee is deliberately excluded — it keeps plain king-step adjacency, so this
 * never turns a melee card into a reach-2 attacker. Returns the base reach for
 * a melee card anyway; the melee branch in canTarget never consults it.
 */
export function rangedReachFor(state: GameState, card: CardInstance): number {
  const advanced = card.pos != null && card.pos.row !== homeRow(card.owner, state.boardSize);
  return RANGED_REACH + (advanced ? 1 : 0);
}

export function canTarget(
  state: GameState,
  attacker: CardInstance,
  target: CardInstance,
  asRanged = false, // a ranged special ignores the melee reach/FLYING limits
  forBasic = false, // BASIC attacks only: applies the ranged queen-line limit
): boolean {
  if (!attacker.pos || !target.pos) return false;
  if (target.owner === attacker.owner) return false;
  const aDef = getDef(attacker.defId);
  const tDef = getDef(target.defId);
  const melee = aDef.attackType === "Melee" && !asRanged;

  // STEALTH: untargetable until it attacks — unless the attacker is standing in
  // its own Blazing Sun, the one effect in the game that reveals cloaked cards.
  if (
    ((tDef.keywords.STEALTH && !target.attackedThisRound) || hasStatus(target, "STEALTH")) &&
    !fieldFlag(state, attacker, "seeStealth")
  )
    return false;
  // FLYING dodges melee — but a flying attacker can still strike other fliers.
  if (tDef.keywords.FLYING && melee && !aDef.keywords.FLYING) return false;
  // Shadow (Vaga): only adjacent attackers reach it — ranged shots from a row
  // or more away find nothing to hit.
  if (
    tDef.onlyAdjacentAttackers &&
    (Math.abs(attacker.pos.row - target.pos.row) > 1 || Math.abs(attacker.pos.col - target.pos.col) > 1)
  )
    return false;

  if (melee) {
    const dRow = Math.abs(attacker.pos.row - target.pos.row);
    const dCol = Math.abs(attacker.pos.col - target.pos.col);
    if (dRow > 1 || dCol > 1) {
      // Long Reach (Shadow Horsemen): a BASIC may also strike along the four
      // straight lines out to `basicLineReach`. Everything off those lines stays
      // at melee's usual one step, so this widens the threat into a cross rather
      // than into a bigger square.
      const lineReach = forBasic ? aDef.basicLineReach ?? 0 : 0;
      const onLine = dRow === 0 || dCol === 0;
      if (
        lineReach < 2 ||
        !onLine ||
        Math.max(dRow, dCol) > lineReach ||
        // Reuse the ranged sight rule so an enemy standing in the lane screens
        // the card behind it — a lance does not reach through a body.
        !rangedCanSee(state, attacker.pos, target.pos, attacker.owner, lineReach)
      )
        return false;
    }
  } else if (forBasic) {
    // Ranged BASIC: king-step reach, blocked by enemy bodies on a straight line.
    // Reach is 2 from the summoning row and 3 once advanced off it — see
    // rangedReachFor. Specials are deliberately exempt and keep their full-board
    // reach, so the AoE specials tuned in the balance pass are untouched.
    const reach = rangedReachFor(state, attacker);
    if (!rangedCanSee(state, attacker.pos, target.pos, attacker.owner, reach)) return false;
  }

  const defenderHome = homeRow(target.owner, state.boardSize);
  if (
    target.pos.row === defenderHome &&
    defenderHome === homeRow(enemyOf(attacker.owner), state.boardSize) &&
    !aDef.ignoresHomeRule // Catapult-style passives skip this rule
  ) {
    const ar = attacker.pos.row;
    const inMid = ar === 1 || ar === 2;
    const inThatHome = ar === defenderHome;
    if (!inMid && !inThatHome) return false;
  }
  return true;
}

/** Enemy cards `attacker` can currently hit with a basic attack / enemy-targeted special. */
export function validTargets(
  state: GameState,
  attackerId: string,
  forBasic = true,
): CardInstance[] {
  const attacker = state.cards[attackerId];
  if (!attacker || !attacker.pos) return [];
  // forBasic defaults TRUE: this is the basic-attack target list (UI, AI, the
  // battle resolver). On-summon abilities borrow it for "everything in normal
  // range" and pass false — they are not basics and keep the old full reach,
  // same exemption the Specials get.
  const enemies = boardCards(state, enemyOf(attacker.owner)).filter((t) =>
    canTarget(state, attacker, t, false, forBasic),
  );
  // Morning Dew (Sprinu): a healer aims its basic at hurt friends too. Only
  // wounded allies are offered — healing something at full HP is a wasted turn,
  // and it keeps the AI from picking one.
  if (!getDef(attacker.defId).basicHealsAllies) return enemies;
  const hurtAllies = boardCards(state, attacker.owner).filter(
    (a) => a.instanceId !== attackerId && a.curHp > 0 && a.curHp < effectiveMaxHp(state, a),
  );
  return [...enemies, ...hurtAllies];
}

/** Ally cards a friendly-targeted special may pick (any ally on board, incl. self). */
export function validAllyTargets(state: GameState, attackerId: string): CardInstance[] {
  const attacker = state.cards[attackerId];
  if (!attacker || !attacker.pos) return [];
  return boardCards(state, attacker.owner);
}

/** Enemy targets for this card's Special — like validTargets, but a special
 *  flagged `ranged` reaches any slot even on a Melee card. */
export function validSpecialTargets(state: GameState, attackerId: string): CardInstance[] {
  const attacker = state.cards[attackerId];
  if (!attacker || !attacker.pos) return [];
  const asRanged = Boolean(getDef(attacker.defId).special?.ranged);
  return boardCards(state, enemyOf(attacker.owner)).filter((t) =>
    canTarget(state, attacker, t, asRanged),
  );
}

/**
 * Enemies inside a forward "corridor" projected from `card` toward the enemy
 * home — used by on-summon blasts and other AOE-ahead effects.
 * - Direction: toward the enemy home row.
 * - `spread` = columns to EACH side (0 = a single lane, 1 = the card's column
 *   plus left/right = 3 wide).
 * - Depth by range: a Ranged card reaches all the way to the enemy battlefield;
 *   a Melee card reaches one row ahead.
 * - Still filtered by canTarget, so FLYING / STEALTH / the Home-Slot rule apply
 *   (e.g. from your own home row the enemy home row stays off-limits).
 */
export function forwardAreaTargets(
  state: GameState,
  card: CardInstance,
  spread: number,
  depth?: number, // explicit forward reach; projects past melee adjacency
): CardInstance[] {
  if (!card.pos) return [];
  const def = getDef(card.defId);
  const dir = card.owner === "P1" ? -1 : 1; // toward the enemy home
  const enemyHome = homeRow(enemyOf(card.owner), state.boardSize);
  const maxDepth =
    depth ?? (def.attackType === "Ranged" ? Math.max(1, Math.abs(enemyHome - card.pos.row)) : 1);
  const out: CardInstance[] = [];
  for (const enemy of boardCards(state, enemyOf(card.owner))) {
    const dRow = (enemy.pos!.row - card.pos.row) * dir; // forward distance
    const dCol = Math.abs(enemy.pos!.col - card.pos.col);
    if (dRow < 1 || dRow > maxDepth || dCol > spread) continue;
    const eDef = getDef(enemy.defId);
    if (depth != null) {
      // A deep, committed corridor blast reaches past melee range and the Home
      // Slot rule — only STEALTH keeps a card out of it.
      if (eDef.keywords.STEALTH && !enemy.attackedThisRound) continue;
    } else if (!canTarget(state, card, enemy)) {
      continue;
    }
    out.push(enemy);
  }
  // Nearest first. Timberer ROOTs "the first target the volley lands on", and
  // for a corridor that has to mean the closest one — board order is arbitrary,
  // so without this the tree pinned whichever body the array happened to list.
  return out.sort(
    (a, b) => (a.pos!.row - card.pos!.row) * dir - (b.pos!.row - card.pos!.row) * dir,
  );
}

/** Where a card's ON-SUMMON effect would land if summoned at `pos` — used by the
 *  UI to preview the damage/effect AREA before the player confirms placement.
 *  Returns board positions (the forward corridor tiles for a spread blast, or the
 *  reachable enemy card slots otherwise). Empty for ally / no-on-summon cards.
 *  Mirrors the on-summon target resolution in phases.ts. */
export function previewOnSummonArea(
  state: GameState,
  def: CardDef,
  owner: PlayerId,
  pos: Pos,
): Pos[] {
  const os = def.onSummon;
  if (!os || os.targetSide === "ally") return [];
  const p = os.params ?? {};
  const spread = Number(p.spread ?? -1);
  const out: Pos[] = [];
  if (spread >= 0) {
    // Forward corridor: `spread` cols each side, `forwardDepth` rows deep
    // (Ranged reaches the enemy home when no depth is given).
    const dir = owner === "P1" ? -1 : 1;
    const enemyHome = homeRow(enemyOf(owner), state.boardSize);
    const maxDepth =
      p.forwardDepth != null
        ? Number(p.forwardDepth)
        : def.attackType === "Ranged"
          ? Math.max(1, Math.abs(enemyHome - pos.row))
          : 1;
    for (let d = 1; d <= maxDepth; d++) {
      const r = pos.row + dir * d;
      if (r < 0 || r >= state.boardSize) continue;
      for (let dc = -spread; dc <= spread; dc++) {
        const c = pos.col + dc;
        if (c < 0 || c >= state.boardSize) continue;
        out.push({ row: r as Pos["row"], col: c as Pos["col"] });
      }
    }
    return out;
  }
  // No spread → normal targeting reach (king's move for Melee, full for Ranged).
  const ghost = { defId: def.id, owner, pos, attackedThisRound: false } as unknown as CardInstance;
  for (const t of boardCards(state, enemyOf(owner))) {
    if (t.pos && canTarget(state, ghost, t)) out.push({ ...t.pos });
  }
  return out;
}

/** The enemy/ally set a card's Special reaches — ally-targeted, a forward
 *  corridor (forwardDepth), or the normal special reach. */
export function specialTargets(state: GameState, instanceId: string): CardInstance[] {
  const card = state.cards[instanceId];
  const special = card && getDef(card.defId).special;
  if (!card || !special) return [];
  // Self-targeting: the caster is the whole target list, so the UI has exactly
  // one "choice" and fires straight through instead of prompting.
  if (special.targetSide === "self") return [card];
  if (special.targetSide === "ally") return validAllyTargets(state, instanceId);
  const fd = Number(special.params?.forwardDepth ?? 0);
  let list =
    fd > 0
      ? forwardAreaTargets(state, card, Number(special.params?.spread ?? 0), fd)
      : validSpecialTargets(state, instanceId);
  // Extinguisher (Vaga): a finisher — only aimable at foes below the HP line.
  const belowHp = Number(special.params?.requireBelowHp ?? 0);
  if (belowHp > 0) list = list.filter((t) => t.curHp < belowHp);
  return list;
}

/** Would this card's basic attack accomplish literally nothing? True only for a
 *  0-DMG card that also carries no on-hit effect of any kind. Such a card is
 *  skipped rather than prompted, so a pure turret (UFO) does not stop the game
 *  each round to ask where to aim an attack that cannot do anything.
 *
 *  Deliberately conservative — anything that makes contact matter keeps the
 *  attack. PYRO always burns on hit (Scorch), which is why Smog still attacks;
 *  BOLT's Electrify turns 0 DMG into 1 against a statused target. The one thing
 *  knowingly given up is stripping a shield with a 0-damage hit, which is a side
 *  effect of the damage gate rather than a designed ability. */
export function basicIsInert(state: GameState, card: CardInstance): boolean {
  const def = getDef(card.defId);
  if (effectiveDmg(state, card) > 0) return false;
  if (def.element === "PYRO" || def.element === "BOLT") return false; // element on-hit auras
  if (def.onHitStatus || def.vsStatus || def.onHitZap || def.onHitSelfBuff) return false;
  if (def.onHitAllyBuff || def.healPerHit || def.healPerCrit || def.critStatus) return false;
  if (def.basicHealsAllies || def.onKill || def.basicBonus || def.firstStrikeBonus) return false;
  if (def.keywords.LIFESTEAL || def.keywords.DRAIN || def.keywords.CRIT) return false;
  return true;
}

/** Legal targets for a TALENT that hits something. Talents carry no targetSide
 *  or range of their own, so this is plain enemy targeting at the card's normal
 *  reach, honouring forwardDepth/spread if the talent asks for a corridor.
 *  (specialTargets can't serve here — it returns [] for a card with no Special,
 *  which is exactly the shape of a talent-only card like GoldenEagle.) */
export function talentTargets(state: GameState, instanceId: string): CardInstance[] {
  const card = state.cards[instanceId];
  const talent = card && getDef(card.defId).talent;
  if (!card || !talent) return [];
  const fd = Number(talent.params?.forwardDepth ?? 0);
  return fd > 0
    ? forwardAreaTargets(state, card, Number(talent.params?.spread ?? 0), fd)
    : validSpecialTargets(state, instanceId);
}

// ── battle actions ──────────────────────────────────────────────────────────

/**
 * Statuses that block the card from acting this turn:
 * STUN = guaranteed full skip. SLEEP = full skip until a hit wakes it.
 * (FREEZE only halves DMG + pins SP; FRIGHTEN is a positioning effect;
 * PARALYZE is a per-turn coin resolved at act time.)
 */
export function isActionBlocked(card: CardInstance): boolean {
  return hasStatus(card, "STUN") || hasStatus(card, "SLEEP");
}

export function canBasicAttack(state: GameState, instanceId: string): boolean {
  const card = state.cards[instanceId];
  if (!card) return false;
  if (isActionBlocked(card)) return false;
  return validTargets(state, instanceId).length > 0;
}

/** A Talent is free and once-per-game; it fires in the Battle Phase instead of
 *  a basic attack. */
export function canFireTalent(
  state: GameState,
  instanceId: string,
): { ok: boolean; reason?: string } {
  const card = state.cards[instanceId];
  if (!card) return { ok: false, reason: "No such card" };
  const def = getDef(card.defId);
  if (!def.talent) return { ok: false, reason: "No Talent" };
  if (card.talentUsed) return { ok: false, reason: "Talent already used this game" };
  if (isActionBlocked(card)) return { ok: false, reason: "Status prevents acting" };
  return { ok: true };
}

/** A card's Special magic cost after reductions. King Me (per-card) floors at 0;
 *  the BOLT ultimate's permanent per-player discount applies to BOLT cards and
 *  floors at 1. */
export function effectiveSpecialCost(state: GameState, card: CardInstance, cost: number): number {
  const base = Math.max(0, cost - (card.specialCostReduction ?? 0)); // King Me (per-card)
  // BOLT discounts: Total Network Control (permanent, per-player) + Power Grid
  // (temporary, per-field). fieldBonus only matches a BOLT card to a BOLT field,
  // so a non-BOLT card never picks up a specialDiscount.
  const permBolt = getDef(card.defId).element === "BOLT" ? (state.players[card.owner].boltDiscount ?? 0) : 0;
  const total = permBolt + fieldBonus(state, card, "specialDiscount");
  return total > 0 ? Math.max(1, base - total) : base;
}

export function canFireSpecial(
  state: GameState,
  instanceId: string,
): { ok: boolean; reason?: string } {
  const card = state.cards[instanceId];
  if (!card) return { ok: false, reason: "No such card" };
  const def = getDef(card.defId);
  if (!def.special) return { ok: false, reason: "No Special" };
  if (card.transformed) return { ok: false, reason: "Dismounted — Special lost" };
  if (card.summonedThisRound)
    return { ok: false, reason: "Summon-turn lockout (basic attack only)" };
  // Talent Special: free + once per game (shares the talentUsed flag).
  if (def.special.talent && card.talentUsed)
    return { ok: false, reason: "Talent already used this game" };
  // A free Special (Volcanon's On-Kill recast) ignores cooldown + magic cost.
  if (!card.freeSpecial && !def.special.talent && card.specialCooldown > 0)
    return { ok: false, reason: "Special is recharging (1-round cooldown)" };
  if (hasStatus(card, "MUTED")) return { ok: false, reason: "MUTED" };
  if (isActionBlocked(card)) return { ok: false, reason: "Status prevents acting" };
  if (!card.freeSpecial && !def.special.talent && state.players[card.owner].magicPool < effectiveSpecialCost(state, card, def.special.cost))
    return { ok: false, reason: "Not enough magic" };
  // A Special charged in HP is refused when the cost would be lethal — UNLESS it
  // opts into `selfHpLethal`. RIP's Horde does: going out to leave two more
  // bodies standing is a real closing play for a 0-DMG card whose entire
  // contribution IS bodies. The DEEPEST's does not — a 10-cost mythic deleting
  // itself is a misclick, not a play. (The auto-fire never routes through here.)
  const hpCost = Number(def.special.params?.selfHpCost ?? 0);
  const mayDie = Number(def.special.params?.selfHpLethal ?? 0) > 0;
  if (hpCost > 0 && !mayDie && card.curHp <= hpCost)
    return { ok: false, reason: `Not enough HP (costs ${hpCost})` };
  if (specialTargets(state, instanceId).length === 0) return { ok: false, reason: "No valid target" };
  return { ok: true };
}

export type PlannedAction = "AUTO" | "YOU" | "SKIP";

/**
 * What the queue UI shows next to a card before it acts:
 * AUTO = will act automatically, YOU = will prompt the owner, SKIP = nothing to do.
 */
export function plannedAction(state: GameState, instanceId: string): PlannedAction {
  const card = state.cards[instanceId];
  if (!card) return "SKIP";
  const hasAny =
    canBasicAttack(state, instanceId) || canFireSpecial(state, instanceId).ok;
  if (!hasAny) return "SKIP";
  if (card.owner === "P2") return "AUTO"; // the AI drives its own cards
  if (card.autoMode === "manual") return "YOU";
  return "AUTO";
}

// ── spells ────────────────────────────────────────────────────────────────────

/** The Home Slot rule for Spells: a caster reaches their own Home + both Mid
 *  rows freely, but to touch the ENEMY Home row they must already hold a card
 *  in a Mid row (1/2) or in that enemy Home row. */
function spellReachesEnemyHome(state: GameState, player: PlayerId): boolean {
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  return boardCards(state, player).some(
    (c) => c.pos != null && (isMidRow(c.pos.row) || c.pos.row === enemyHome),
  );
}

/** Can `player` hit this enemy card with a damage Spell right now? */
/** A row an offensive AoE spell may target: any row except the opponent's Home
 *  row, which stays off-limits until one of your cards reaches a Mid row (the
 *  same Home-slot proxy that gates single-target spells). */
export function canAoeRow(state: GameState, player: PlayerId, row: number): boolean {
  if (row < 0 || row >= state.boardSize) return false;
  if (row === homeRow(enemyOf(player), state.boardSize) && !spellReachesEnemyHome(state, player)) return false;
  return true;
}
export function canSpellHitEnemy(
  state: GameState,
  player: PlayerId,
  target: CardInstance,
): boolean {
  if (!target.pos || target.owner === player) return false;
  const tDef = getDef(target.defId);
  if ((tDef.keywords.STEALTH && !target.attackedThisRound) || hasStatus(target, "STEALTH")) return false;
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  if (target.pos.row === enemyHome && !spellReachesEnemyHome(state, player)) return false;
  return true;
}

/** Enemy cards a given damage Spell may target this Prep. */
export function spellEnemyTargets(state: GameState, player: PlayerId): CardInstance[] {
  return boardCards(state, enemyOf(player)).filter((t) => canSpellHitEnemy(state, player, t));
}

/** Can a wall Spell be laid on `row`? Own Home + both Mid rows only. The enemy
 *  Home (summon) row is OFF-LIMITS — a wall there would root/freeze every one of
 *  their summons for 3 rounds, which is too oppressive. ownHomeOnly walls (Stone
 *  Wall) restrict to the caster's Home. No two walls from the same owner on one row. */
export function canPlaceWallRow(
  state: GameState,
  player: PlayerId,
  spell: SpellDef,
  row: number,
): boolean {
  if (!spell.wall) return false;
  if (row < 0 || row >= state.boardSize) return false;
  if (state.walls.some((w) => w.owner === player && w.row === row)) return false;
  const ownHome = homeRow(player, state.boardSize);
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  if (spell.wall.ownHomeOnly) return row === ownHome;
  if (row === enemyHome) return false; // never on the opponent's summon row
  return true; // own Home or a Mid row
}

/** Rows a wall Spell may be placed on this Prep. */
export function legalWallRows(state: GameState, player: PlayerId, spell: SpellDef): number[] {
  const out: number[] = [];
  for (let r = 0; r < state.boardSize; r++)
    if (canPlaceWallRow(state, player, spell, r)) out.push(r);
  return out;
}

/** Master legality check for a CAST_SPELL intent (UI pre-checks, reducer enforces). */
export function canCastSpell(
  state: GameState,
  player: PlayerId,
  spellId: string,
  opts: { targetId?: string; row?: number; mode?: "attack" | "shield" } = {},
): { ok: boolean; reason?: string } {
  if (state.phase !== "prep") return { ok: false, reason: "Not the Prep Phase" };
  if (state.prep?.priority !== player) return { ok: false, reason: "You don't have priority" };
  const p = state.players[player];
  const slot = p.spellbook.find((s) => s.defId === spellId);
  if (!slot) return { ok: false, reason: "Not in your spellbook" };
  if (slot.used) return { ok: false, reason: "Already cast this game" };
  let spell: SpellDef;
  try {
    spell = getSpell(spellId);
  } catch {
    return { ok: false, reason: "Unknown spell" };
  }
  if (p.magicPool < spell.cost) return { ok: false, reason: "Not enough magic" };

  if (spell.kind === "wall") {
    if (opts.row == null) return { ok: false, reason: "Pick a row" };
    if (!canPlaceWallRow(state, player, spell, opts.row))
      return { ok: false, reason: "Can't place a wall there" };
    return { ok: true };
  }
  if (spell.kind === "aoe") {
    if (spell.area === "board") return { ok: true }; // hits every opponent, no pick
    if (opts.row == null) return { ok: false, reason: "Pick a row" };
    if (!canAoeRow(state, player, opts.row)) return { ok: false, reason: "Can't reach that row" };
    if (spell.area === "tworows" && opts.row + 1 >= state.boardSize)
      return { ok: false, reason: "No row behind that one" };
    return { ok: true };
  }
  if (spell.kind === "field") {
    // Board-wide, no target. One Field per owner at a time.
    if (state.fields.some((f) => f.owner === player))
      return { ok: false, reason: "You already have a Field active" };
    return { ok: true };
  }
  if (spell.kind === "convert") {
    // Pure pool conversion — no target, no board state to check. The magic
    // check above is the only gate.
    return { ok: true };
  }
  if (spell.kind === "damage") {
    if (!opts.targetId) return { ok: false, reason: "Pick a target" };
    const target = state.cards[opts.targetId];
    if (!target || !canSpellHitEnemy(state, player, target))
      return { ok: false, reason: "Illegal target" };
    return { ok: true };
  }
  if (spell.kind === "choice") {
    // Shield mode → auto-targets an element ally; attack mode → an enemy target.
    if (opts.mode === "shield") {
      const hasAlly = boardCards(state, player).some(
        (c) => c.curHp > 0 && getDef(c.defId).element === spell.element,
      );
      if (!hasAlly) return { ok: false, reason: `No ${spell.element} ally to shield` };
      return { ok: true };
    }
    if (!opts.targetId) return { ok: false, reason: "Pick a target" };
    const target = state.cards[opts.targetId];
    if (!target || !canSpellHitEnemy(state, player, target))
      return { ok: false, reason: "Illegal target" };
    return { ok: true };
  }
  // heal / support: auto-targets an ally of the spell's element, no pick needed.
  const hasAlly = boardCards(state, player).some(
    (c) => c.curHp > 0 && getDef(c.defId).element === spell.element,
  );
  if (!hasAlly) return { ok: false, reason: `No ${spell.element} ally to heal` };
  return { ok: true };
}
