// Legality checks — the UI and the AI both ask these questions instead of
// computing rule outcomes themselves.

import { getDef } from "../data/cards";
import {
  boardCards,
  cardAt,
  effectiveSp,
  hasStatus,
  isCaptured,
  isContested,
  manhattan,
  moveReach,
} from "./state";
import type {
  CardInstance,
  GameState,
  PlayerId,
  Pos,
} from "./types";
import { BOARD_SIZE, enemyOf, homeRow } from "./types";

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
  const row = homeRow(player);
  if (col < 0 || col >= BOARD_SIZE) return { ok: false, reason: "Bad column" };
  if (isCaptured(state, row, col))
    return { ok: false, reason: "Slot is permanently captured" };
  if (isContested(state, player, col))
    return { ok: false, reason: "Slot is contested by an enemy card" };
  if (cardAt(state, row, col)) return { ok: false, reason: "Slot is occupied" };
  return { ok: true };
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
  if (hasStatus(card, "FRIGHTEN"))
    return { ok: false, reason: "FRIGHTENED — cannot move" };
  const reach = moveReach(effectiveSp(state, card));
  if (reach === 0) return { ok: false, reason: "This card can't move (SP 0)" };
  if (to.row < 0 || to.row >= BOARD_SIZE || to.col < 0 || to.col >= BOARD_SIZE)
    return { ok: false, reason: "Off the board" };
  const dist = manhattan(card.pos, to);
  if (dist === 0) return { ok: false, reason: "Already there" };
  if (dist > reach)
    return { ok: false, reason: `Too far (reach ${reach})` };
  if (cardAt(state, to.row, to.col))
    return { ok: false, reason: "Destination occupied" };
  // Captured slots are locked: cards may pass through, but can't stop on one.
  if (isCaptured(state, to.row, to.col))
    return { ok: false, reason: "Slot is permanently captured (locked)" };
  return { ok: true };
}

/** All slots `instanceId` may legally move to right now. */
export function legalMoves(state: GameState, player: PlayerId, instanceId: string): Pos[] {
  const out: Pos[] = [];
  for (let row = 0; row < BOARD_SIZE; row++)
    for (let col = 0; col < BOARD_SIZE; col++) {
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
 * - FLYING: immune to Melee. STEALTH: untargetable until it attacks.
 */
export function canTarget(
  _state: GameState,
  attacker: CardInstance,
  target: CardInstance,
): boolean {
  if (!attacker.pos || !target.pos) return false;
  if (target.owner === attacker.owner) return false;
  const aDef = getDef(attacker.defId);
  const tDef = getDef(target.defId);

  if (tDef.keywords.STEALTH && !target.attackedThisRound) return false;
  if (tDef.keywords.FLYING && aDef.attackType === "Melee") return false;

  if (aDef.attackType === "Melee") {
    if (
      Math.abs(attacker.pos.row - target.pos.row) > 1 ||
      Math.abs(attacker.pos.col - target.pos.col) > 1
    )
      return false;
  }

  const defenderHome = homeRow(target.owner);
  if (
    target.pos.row === defenderHome &&
    defenderHome === homeRow(enemyOf(attacker.owner)) &&
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
export function validTargets(state: GameState, attackerId: string): CardInstance[] {
  const attacker = state.cards[attackerId];
  if (!attacker || !attacker.pos) return [];
  return boardCards(state, enemyOf(attacker.owner)).filter((t) =>
    canTarget(state, attacker, t),
  );
}

/** Ally cards a friendly-targeted special may pick (any ally on board, incl. self). */
export function validAllyTargets(state: GameState, attackerId: string): CardInstance[] {
  const attacker = state.cards[attackerId];
  if (!attacker || !attacker.pos) return [];
  return boardCards(state, attacker.owner);
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
): CardInstance[] {
  if (!card.pos) return [];
  const def = getDef(card.defId);
  const dir = card.owner === "P1" ? -1 : 1; // toward the enemy home
  const enemyHome = homeRow(enemyOf(card.owner));
  const maxDepth =
    def.attackType === "Ranged" ? Math.max(1, Math.abs(enemyHome - card.pos.row)) : 1;
  const out: CardInstance[] = [];
  for (const enemy of boardCards(state, enemyOf(card.owner))) {
    const dRow = (enemy.pos!.row - card.pos.row) * dir; // forward distance
    const dCol = Math.abs(enemy.pos!.col - card.pos.col);
    if (dRow >= 1 && dRow <= maxDepth && dCol <= spread && canTarget(state, card, enemy))
      out.push(enemy);
  }
  return out;
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

export function canFireSpecial(
  state: GameState,
  instanceId: string,
): { ok: boolean; reason?: string } {
  const card = state.cards[instanceId];
  if (!card) return { ok: false, reason: "No such card" };
  const def = getDef(card.defId);
  if (!def.special) return { ok: false, reason: "No Special" };
  if (card.summonedThisRound)
    return { ok: false, reason: "Summon-turn lockout (basic attack only)" };
  if (card.specialCooldown > 0)
    return { ok: false, reason: "Special is recharging (1-round cooldown)" };
  if (hasStatus(card, "MUTED")) return { ok: false, reason: "MUTED" };
  if (isActionBlocked(card)) return { ok: false, reason: "Status prevents acting" };
  if (state.players[card.owner].magicPool < def.special.cost)
    return { ok: false, reason: "Not enough magic" };
  const targets =
    def.special.targetSide === "ally"
      ? validAllyTargets(state, instanceId)
      : validTargets(state, instanceId);
  if (targets.length === 0) return { ok: false, reason: "No valid target" };
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
