// Legality checks — the UI and the AI both ask these questions instead of
// computing rule outcomes themselves.

import { getDef } from "../data/cards";
import {
  boardCards,
  cardAt,
  chebyshev,
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
  SpellDef,
} from "./types";
import { BOARD_SIZE, enemyOf, homeRow } from "./types";
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
  if (hasStatus(card, "SLEEP"))
    return { ok: false, reason: "ASLEEP — cannot move until woken" };
  if (hasStatus(card, "FRIGHTEN"))
    return { ok: false, reason: "FRIGHTENED — cannot move" };
  const reach = moveReach(effectiveSp(state, card));
  if (reach === 0) return { ok: false, reason: "This card can't move (SP 0)" };
  if (to.row < 0 || to.row >= BOARD_SIZE || to.col < 0 || to.col >= BOARD_SIZE)
    return { ok: false, reason: "Off the board" };
  // FLYING cards move like a chess king — a diagonal step costs 1, not 2.
  const flying = Boolean(getDef(card.defId).keywords.FLYING);
  const dist = flying ? chebyshev(card.pos, to) : manhattan(card.pos, to);
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
 * - FLYING: immune to Melee — unless the attacker is ALSO flying (a flying
 *   melee card can strike other fliers). STEALTH: untargetable until it attacks.
 */
export function canTarget(
  _state: GameState,
  attacker: CardInstance,
  target: CardInstance,
  asRanged = false, // a ranged special ignores the melee reach/FLYING limits
): boolean {
  if (!attacker.pos || !target.pos) return false;
  if (target.owner === attacker.owner) return false;
  const aDef = getDef(attacker.defId);
  const tDef = getDef(target.defId);
  const melee = aDef.attackType === "Melee" && !asRanged;

  if ((tDef.keywords.STEALTH && !target.attackedThisRound) || hasStatus(target, "STEALTH")) return false;
  // FLYING dodges melee — but a flying attacker can still strike other fliers.
  if (tDef.keywords.FLYING && melee && !aDef.keywords.FLYING) return false;

  if (melee) {
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
  if (card.transformed) return { ok: false, reason: "Dismounted — Special lost" };
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
      : validSpecialTargets(state, instanceId);
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

// ── spells ────────────────────────────────────────────────────────────────────

/** The Home Slot rule for Spells: a caster reaches their own Home + both Mid
 *  rows freely, but to touch the ENEMY Home row they must already hold a card
 *  in a Mid row (1/2) or in that enemy Home row. */
function spellReachesEnemyHome(state: GameState, player: PlayerId): boolean {
  const enemyHome = homeRow(enemyOf(player));
  return boardCards(state, player).some(
    (c) => c.pos != null && (c.pos.row === 1 || c.pos.row === 2 || c.pos.row === enemyHome),
  );
}

/** Can `player` hit this enemy card with a damage Spell right now? */
export function canSpellHitEnemy(
  state: GameState,
  player: PlayerId,
  target: CardInstance,
): boolean {
  if (!target.pos || target.owner === player) return false;
  const tDef = getDef(target.defId);
  if ((tDef.keywords.STEALTH && !target.attackedThisRound) || hasStatus(target, "STEALTH")) return false;
  const enemyHome = homeRow(enemyOf(player));
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
  if (row < 0 || row >= BOARD_SIZE) return false;
  if (state.walls.some((w) => w.owner === player && w.row === row)) return false;
  const ownHome = homeRow(player);
  const enemyHome = homeRow(enemyOf(player));
  if (spell.wall.ownHomeOnly) return row === ownHome;
  if (row === enemyHome) return false; // never on the opponent's summon row
  return true; // own Home or a Mid row
}

/** Rows a wall Spell may be placed on this Prep. */
export function legalWallRows(state: GameState, player: PlayerId, spell: SpellDef): number[] {
  const out: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    if (canPlaceWallRow(state, player, spell, r)) out.push(r);
  return out;
}

/** Master legality check for a CAST_SPELL intent (UI pre-checks, reducer enforces). */
export function canCastSpell(
  state: GameState,
  player: PlayerId,
  spellId: string,
  opts: { targetId?: string; row?: number } = {},
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
  if (spell.kind === "damage") {
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
