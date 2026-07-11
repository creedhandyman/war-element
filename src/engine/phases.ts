// Phase reducers + the intent reducer + the advance() driver.
// All reducers clone the incoming state once and mutate only the clone.

import { getDef } from "../data/cards";
import { basicAttack, label, SPECIAL_HANDLERS } from "./combat";
import { coin } from "./rng";
import {
  applyMulligan,
  boardCards,
  cardAt,
  drawCards,
  effectiveSp,
  hasCaptureWin,
  isEliminated,
  removeCard,
  summonCard,
} from "./state";
import {
  canFireSpecial,
  canMove,
  canSummon,
  isActionBlocked,
  validAllyTargets,
  validTargets,
} from "./rules";
import type {
  CardInstance,
  GameState,
  Intent,
  PlayerId,
} from "./types";
import {
  BOARD_SIZE,
  POOL_CARRYOVER_CAP,
  enemyOf,
  homeRow,
} from "./types";
import { chooseBattleAction, aiMulligan, aiPrepIntent } from "./ai";

function clone(state: GameState): GameState {
  return structuredClone(state);
}

// ── intent reducer ──────────────────────────────────────────────────────────

/** Apply one player intent. Throws on illegal intents (UI should pre-check via rules). */
export function applyIntent(state: GameState, intent: Intent): GameState {
  const draft = clone(state);
  switch (intent.type) {
    case "MULLIGAN": {
      if (draft.phase !== "mulligan") throw new Error("Not the mulligan phase");
      applyMulligan(draft, intent.player, intent.returnHandIds);
      return draft;
    }
    case "SUMMON": {
      const check = canSummon(draft, intent.player, intent.handId, intent.col);
      if (!check.ok) throw new Error(`Illegal summon: ${check.reason}`);
      const p = draft.players[intent.player];
      const hand = p.hand.find((h) => h.handId === intent.handId)!;
      const def = getDef(hand.defId);
      p.hand = p.hand.filter((h) => h.handId !== intent.handId);
      p.pool -= def.cost;
      const inst = summonCard(draft, intent.player, hand.defId, {
        row: homeRow(intent.player),
        col: intent.col as 0 | 1 | 2 | 3,
      });
      if (intent.player === "P2") inst.autoMode = "full";
      draft.prep!.consecutivePasses = 0;
      draft.log.push(
        `${intent.player} summons ${def.name} (cost ${def.cost}) into column ${intent.col}.`,
      );
      return draft;
    }
    case "MOVE": {
      const check = canMove(draft, intent.player, intent.instanceId, intent.to);
      if (!check.ok) throw new Error(`Illegal move: ${check.reason}`);
      const card = draft.cards[intent.instanceId];
      card.pos = { ...intent.to };
      draft.prep!.movedThisTurn = true;
      draft.prep!.consecutivePasses = 0;
      draft.log.push(
        `${intent.player} moves ${getDef(card.defId).name} to r${intent.to.row}c${intent.to.col}.`,
      );
      return draft;
    }
    case "PASS": {
      if (draft.phase !== "prep" || draft.prep?.priority !== intent.player)
        throw new Error("Can't pass now");
      draft.prep.consecutivePasses++;
      draft.log.push(`${intent.player} passes.`);
      if (draft.prep.consecutivePasses >= 2) {
        startBattle(draft);
      } else {
        draft.prep.priority = enemyOf(intent.player);
        draft.prep.movedThisTurn = false;
      }
      return draft;
    }
    case "SET_AUTO": {
      const card = draft.cards[intent.instanceId];
      if (!card || card.owner !== intent.player) throw new Error("Not your card");
      card.autoMode = intent.mode;
      return draft;
    }
    case "BATTLE_ACTION": {
      if (draft.phase !== "battle" || !draft.battle)
        throw new Error("Not the Battle Phase");
      const activeId = draft.battle.queue[draft.battle.index];
      if (draft.battle.awaitingInput !== activeId || !activeId)
        throw new Error("Not awaiting input");
      const card = draft.cards[activeId];
      if (!card || card.owner !== intent.player) throw new Error("Not your card");
      draft.battle.awaitingInput = null;
      const picks =
        intent.targetIds && intent.targetIds.length > 0
          ? intent.targetIds
          : intent.targetId
            ? [intent.targetId]
            : undefined;
      performBattleAction(draft, activeId, intent.action, picks);
      draft.battle.index++;
      return draft;
    }
  }
}

// ── phase transitions ───────────────────────────────────────────────────────

function startRound(draft: GameState): void {
  draft.round++;
  draft.phase = "draw";
}

function doDrawPhase(draft: GameState): void {
  // Draw 1 each, +1 on every 5th round. At the 7-card cap the draw is skipped.
  const n = draft.round % 5 === 0 ? 2 : 1;
  for (const player of ["P1", "P2"] as PlayerId[]) {
    const drawn = drawCards(draft, player, n);
    if (drawn > 0) draft.log.push(`${player} draws ${drawn}.`);
  }
  draft.phase = "resource";
}

function doResourcePhase(draft: GameState): void {
  const gain = Math.min(draft.round, 10);
  for (const player of ["P1", "P2"] as PlayerId[]) {
    const p = draft.players[player];
    p.pool = Math.min(p.pool, POOL_CARRYOVER_CAP) + gain;
  }
  draft.log.push(`— Round ${draft.round}: both pools +${gain}. —`);
  draft.phase = "prep";
  draft.prep = {
    priority: draft.firstPlayer,
    consecutivePasses: 0,
    movedThisTurn: false,
  };
}

function startBattle(draft: GameState): void {
  draft.phase = "battle";
  draft.prep = null;
  // Speed queue: all cards SP 15→0, ties broken by seeded coin flip.
  const units = boardCards(draft).map((c) => ({
    id: c.instanceId,
    sp: effectiveSp(draft, c),
  }));
  units.sort((a, b) => b.sp - a.sp);
  // coin-flip adjacent ties (repeated passes = a fair-enough shuffle per tie group)
  for (let i = 0; i < units.length - 1; i++) {
    if (units[i].sp === units[i + 1].sp && coin(draft)) {
      [units[i], units[i + 1]] = [units[i + 1], units[i]];
    }
  }
  draft.battle = { queue: units.map((u) => u.id), index: 0, awaitingInput: null };
  draft.log.push(`Battle! Queue: ${units.length} card(s).`);
}

/**
 * Resolve one card's battle action. `picks` is an ordered target selection:
 * a single entry takes the full volley / legacy auto-spread; multiple entries
 * assign one hit (or one barrage strike) per entry, repeats stack.
 */
function performBattleAction(
  draft: GameState,
  instanceId: string,
  action: "basic" | "special" | "skip",
  picks?: string[],
): void {
  const card = draft.cards[instanceId];
  if (!card) return;
  if (action === "skip") {
    draft.log.push(`${label(draft, card)} waits.`);
    return;
  }
  if (action === "special") {
    const check = canFireSpecial(draft, instanceId);
    if (!check.ok) throw new Error(`Can't fire Special: ${check.reason}`);
    const def = getDef(card.defId);
    const special = def.special!;
    const valid =
      special.targetSide === "ally"
        ? validAllyTargets(draft, instanceId)
        : validTargets(draft, instanceId);
    let targets: typeof valid;
    if (picks && picks.length > 1) {
      // Explicit multi-selection: one strike per entry, in order.
      const maxPicks = Number(special.params?.targets ?? 1);
      if (picks.length > maxPicks)
        throw new Error(`Too many targets (max ${maxPicks})`);
      targets = picks.map((id) => {
        const t = valid.find((v) => v.instanceId === id);
        if (!t) throw new Error("Illegal Special target");
        return t;
      });
    } else if (picks && picks.length === 1) {
      // Single pick: chosen first, then auto-spread over the rest (AI path).
      const chosen = valid.find((t) => t.instanceId === picks[0]);
      if (!chosen) throw new Error("Illegal Special target");
      targets = [chosen, ...valid.filter((t) => t.instanceId !== picks[0])];
    } else {
      targets = valid;
    }
    draft.players[card.owner].pool -= special.cost;
    card.specialCooldown = 2; // ticks down each Cleanup → blocked next round
    card.attackedThisRound = true; // STEALTH breaks on any attack
    draft.log.push(`${label(draft, card)} fires ${special.name}!`);
    const handler = SPECIAL_HANDLERS[special.handler];
    if (!handler) throw new Error(`Unknown special handler: ${special.handler}`);
    handler(draft, card, targets, special.params ?? {});
    return;
  }
  // basic attack
  const def = getDef(card.defId);
  const valid = validTargets(draft, instanceId);
  const chosen =
    picks && picks.length > 0 ? picks : valid[0] ? [valid[0].instanceId] : [];
  if (chosen.length === 0) throw new Error("Illegal basic-attack target");
  if (chosen.length > def.hits)
    throw new Error(`Too many targets (this card has ${def.hits} hit(s))`);
  for (const id of chosen) {
    if (!valid.some((t) => t.instanceId === id))
      throw new Error("Illegal basic-attack target");
  }
  basicAttack(draft, instanceId, chosen.length === 1 ? chosen[0] : chosen);
}

/**
 * Advance the battle by one queue entry (the next card that is dead/blocked/
 * auto/AI). Returns true if it consumed an entry, false if input is needed
 * or the battle is over.
 */
function stepBattle(draft: GameState): boolean {
  const battle = draft.battle!;
  if (battle.index >= battle.queue.length) {
    doCleanupPhase(draft);
    return true;
  }
  const id = battle.queue[battle.index];
  const card = draft.cards[id];
  if (!card || !card.pos) {
    battle.index++; // died before its turn
    return true;
  }

  // SLEEP: coin flip to wake when the card would act; tails = it sleeps through.
  if (card.status?.kind === "SLEEP") {
    if (coin(draft)) {
      card.status = null;
      draft.log.push(`${label(draft, card)} wakes up!`);
    } else {
      draft.log.push(`${label(draft, card)} is asleep.`);
      battle.index++;
      return true;
    }
  }
  if (isActionBlocked(card)) {
    draft.log.push(`${label(draft, card)} can't act (${card.status?.kind}).`);
    battle.index++;
    return true;
  }

  const canBasic = validTargets(draft, id).length > 0;
  const canSpec = canFireSpecial(draft, id).ok;
  if (!canBasic && !canSpec) {
    draft.log.push(`${label(draft, card)} has no valid action.`);
    battle.index++;
    return true;
  }

  if (card.owner === "P2") {
    const choice = chooseBattleAction(draft, id);
    performBattleAction(draft, id, choice.action, choice.targetId ? [choice.targetId] : undefined);
    battle.index++;
    return true;
  }

  // P1 card:
  if (card.autoMode === "manual") {
    battle.awaitingInput = id;
    return false;
  }
  if (card.autoMode === "full" && canSpec) {
    // Full auto may fire Specials and spend pool: fire if it can kill,
    // otherwise basic attack (mirrors the AI's restraint).
    const choice = chooseBattleAction(draft, id);
    performBattleAction(draft, id, choice.action, choice.targetId ? [choice.targetId] : undefined);
    battle.index++;
    return true;
  }
  if (canBasic) {
    // Auto-basic: attack the lowest-HP reachable target it can kill, else lowest HP.
    const targets = validTargets(draft, id);
    const pick = pickBasicTarget(draft, card, targets);
    performBattleAction(draft, id, "basic", [pick.instanceId]);
  } else {
    performBattleAction(draft, id, "skip");
  }
  battle.index++;
  return true;
}

export function pickBasicTarget(
  _draft: GameState,
  attacker: CardInstance,
  targets: CardInstance[],
): CardInstance {
  const def = getDef(attacker.defId);
  const volley = (def.dmg + attacker.dmgBonus) * def.hits;
  const killable = targets.filter((t) => {
    const tDef = getDef(t.defId);
    const shieldSoak = tDef.keywords.PEN ? 0 : t.curShields; // rough estimate
    return volley - shieldSoak >= t.curHp;
  });
  const pool = killable.length > 0 ? killable : targets;
  return pool.reduce((best, t) => (t.curHp < best.curHp ? t : best), pool[0]);
}

function doCleanupPhase(draft: GameState): void {
  draft.phase = "cleanup";
  draft.battle = null;

  // 1. DOT — bypasses shields, straight to HP, no shield stripped.
  for (const card of boardCards(draft)) {
    const s = card.status;
    if (!s) continue;
    if (s.kind === "BLEED" || s.kind === "BURN" || s.kind === "SCALD" || s.kind === "DOT") {
      card.curHp -= s.power;
      draft.log.push(`${label(draft, card)} takes ${s.power} ${s.kind} damage.`);
      if (card.curHp <= 0) {
        draft.log.push(`${label(draft, card)} is defeated (${s.kind}).`);
        removeCard(draft, card.instanceId);
      }
    }
  }

  // 2. REGEN heals (then the one alpha aura: LEAF Photosynthesis +1 HP).
  for (const card of boardCards(draft)) {
    const def = getDef(card.defId);
    const regen = Number(def.keywords.REGEN ?? 0);
    if (regen > 0 && card.curHp < card.maxHp) {
      card.curHp = Math.min(card.maxHp, card.curHp + regen);
      draft.log.push(`${label(draft, card)} regenerates ${regen}.`);
    }
    // ALPHA AURA (the only aura implemented in alpha): Photosynthesis.
    // Active because each fixed alpha deck is ≥50% its lead element.
    if (def.element === "LEAF" && card.curHp < card.maxHp) {
      card.curHp += 1;
    }
  }

  // 3. Status durations tick down; expired statuses removed.
  for (const card of boardCards(draft)) {
    if (!card.status) continue;
    card.status.duration--;
    if (card.status.duration <= 0) card.status = null;
  }

  // 4. Clear round flags (STEALTH re-engages; summon lockout ends;
  //    special cooldowns tick down).
  for (const card of boardCards(draft)) {
    card.summonedThisRound = false;
    card.attackedThisRound = false;
    if (card.specialCooldown > 0) card.specialCooldown--;
  }

  // 5. Capture by survival: an enemy card still standing on a home slot at
  //    Cleanup captures it permanently.
  for (const player of ["P1", "P2"] as PlayerId[]) {
    const row = homeRow(player);
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (draft.slots[row][col].capturedBy) continue;
      const occ = cardAt(draft, row, col);
      if (occ && occ.owner !== player) {
        draft.slots[row][col].capturedBy = occ.owner;
        draft.log.push(
          `${label(draft, occ)} survives on ${player}'s home slot ${col} — permanently captured!`,
        );
      }
    }
  }

  // 6. Win conditions — capture takes precedence if both trigger.
  for (const player of ["P1", "P2"] as PlayerId[]) {
    if (hasCaptureWin(draft, player)) {
      draft.win = { winner: player, by: "capture" };
      draft.phase = "gameover";
      draft.log.push(`${player} WINS by capture!`);
      return;
    }
  }
  for (const player of ["P1", "P2"] as PlayerId[]) {
    if (isEliminated(draft, enemyOf(player))) {
      draft.win = { winner: player, by: "elimination" };
      draft.phase = "gameover";
      draft.log.push(`${player} WINS by elimination!`);
      return;
    }
  }

  startRound(draft);
}

// ── driver ──────────────────────────────────────────────────────────────────

/** Does the game currently need P1's input? */
export function needsP1Input(state: GameState): boolean {
  if (state.phase === "gameover") return false;
  if (state.phase === "mulligan") return !state.players.P1.mulliganDone;
  if (state.phase === "prep") return state.prep?.priority === "P1";
  if (state.phase === "battle") return state.battle?.awaitingInput !== null;
  return false;
}

/**
 * Advance one atomic step: resolve a non-interactive phase, one AI prep
 * intent, or one battle-queue entry. Returns the same reference when the
 * game is waiting on P1 (idempotent) — callers loop or setTimeout on it.
 */
export function advance(state: GameState): GameState {
  if (state.phase === "gameover") return state;
  if (needsP1Input(state)) return state;
  const draft = clone(state);

  switch (draft.phase) {
    case "mulligan": {
      if (!draft.players.P2.mulliganDone) {
        applyMulligan(draft, "P2", aiMulligan(draft));
      }
      if (draft.players.P1.mulliganDone && draft.players.P2.mulliganDone) {
        startRound(draft);
      }
      return draft;
    }
    case "draw":
      doDrawPhase(draft);
      return draft;
    case "resource":
      doResourcePhase(draft);
      return draft;
    case "prep": {
      // AI priority turn: one intent per advance() call.
      const intent = aiPrepIntent(draft);
      return applyIntent(draft, intent);
    }
    case "battle": {
      stepBattle(draft);
      return draft;
    }
    case "cleanup":
      // cleanup runs synchronously at the end of stepBattle; nothing to do
      return draft;
    default:
      return draft;
  }
}

/** Run advance() until P1 input is needed or the game ends. For tests/headless. */
export function advanceUntilInput(state: GameState, maxSteps = 10_000): GameState {
  let cur = state;
  for (let i = 0; i < maxSteps; i++) {
    if (cur.phase === "gameover" || needsP1Input(cur)) return cur;
    cur = advance(cur);
  }
  throw new Error("advanceUntilInput: exceeded step budget (engine stuck?)");
}
