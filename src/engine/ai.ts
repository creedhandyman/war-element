// Rule-based opponent. A readable heuristic, not a search. Every intent it
// returns is validated through rules.ts, and it sees only what a player
// would see (its own hand + the board — it never reads P1's hand or deck).

import { getDef } from "../data/cards";
import {
  boardCards,
  effectiveSp,
  isCaptured,
  moveReach,
} from "./state";
import {
  canFireSpecial,
  canMove,
  canSummon,
  canTarget,
  validAllyTargets,
  validTargets,
} from "./rules";
import type {
  CardInstance,
  GameState,
  Intent,
  PlayerId,
  Pos,
} from "./types";
import { BOARD_SIZE, enemyOf, homeRow } from "./types";

// ── mulligan ────────────────────────────────────────────────────────────────

/** Toss anything above the early curve; keep the 1–4 cost cards. */
export function aiMulligan(state: GameState, player: PlayerId = "P2"): string[] {
  return state.players[player].hand
    .filter((h) => getDef(h.defId).cost > 4)
    .map((h) => h.handId);
}

// ── prep ────────────────────────────────────────────────────────────────────

/** One intent per call: summon > move > pass. */
export function aiPrepIntent(state: GameState, player: PlayerId = "P2"): Intent {
  // 1. Summon the highest-cost affordable card into an open Home slot.
  const hand = state.players[player].hand
    .slice()
    .sort((a, b) => getDef(b.defId).cost - getDef(a.defId).cost);
  for (const h of hand) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (canSummon(state, player, h.handId, col).ok) {
        return { type: "SUMMON", player, handId: h.handId, col };
      }
    }
  }

  // 2. Advance one card toward the enemy Home if it looks survivable.
  if (!state.prep?.movedThisTurn) {
    const move = findAdvance(state, player);
    if (move) return move;
  }

  return { type: "PASS", player };
}

/** Rough incoming damage at a position: sum of enemy volleys that could reach it. */
function threatAt(state: GameState, mover: CardInstance, pos: Pos): number {
  const ghost: CardInstance = { ...mover, pos: { ...pos } };
  let total = 0;
  for (const enemy of boardCards(state, enemyOf(mover.owner))) {
    if (canTarget(state, enemy, ghost)) {
      const def = getDef(enemy.defId);
      total += (def.dmg + enemy.dmgBonus) * def.hits;
    }
  }
  return total;
}

function findAdvance(state: GameState, player: PlayerId): Intent | null {
  // Prefer the card already deepest into enemy territory.
  const enemyHome = homeRow(enemyOf(player));
  const forward = player === "P2" ? 1 : -1; // P2 pushes toward row 3, P1 toward row 0
  const movers = boardCards(state, player)
    .filter((c) => moveReach(effectiveSp(state, c)) > 0)
    .sort((a, b) => (b.pos!.row - a.pos!.row) * forward);

  for (const mover of movers) {
    const reach = moveReach(effectiveSp(state, mover));
    const candidates: Pos[] = [];
    for (let d = reach; d >= 1; d--) {
      const row = mover.pos!.row + d * forward;
      if (row < 0 || row >= BOARD_SIZE) continue;
      const clamped = forward === 1 ? Math.min(enemyHome, row) : Math.max(enemyHome, row);
      if (clamped === mover.pos!.row) continue;
      const remaining = reach - Math.abs(clamped - mover.pos!.row);
      for (let dc = -remaining; dc <= remaining; dc++) {
        const col = mover.pos!.col + dc;
        if (col < 0 || col >= BOARD_SIZE) continue;
        candidates.push({ row: clamped, col } as Pos);
      }
    }
    for (const to of candidates) {
      if (!canMove(state, player, mover.instanceId, to).ok) continue;
      const invading = to.row === enemyHome && !isCaptured(state, to.row, to.col);
      const threat = threatAt(state, mover, to);
      const survivable =
        threat < mover.curHp + mover.curShields * 2 || (invading && mover.curHp > 6);
      if (survivable) {
        return { type: "MOVE", player, instanceId: mover.instanceId, to };
      }
    }
  }
  return null;
}

// ── battle ──────────────────────────────────────────────────────────────────

export interface BattleChoice {
  action: "basic" | "special" | "skip";
  targetId?: string;
}

/** Simulate the shield gate (no RNG: assume no evasion, no crit) for a kill estimate. */
export function estimateVolley(
  dmgPerHit: number,
  hits: number,
  pen: boolean,
  target: CardInstance,
): number {
  const block = Number(getDef(target.defId).keywords.BLOCK ?? 0);
  let shields = target.curShields;
  let total = 0;
  for (let i = 0; i < hits; i++) {
    const remaining = Math.max(0, dmgPerHit - block);
    if (pen) {
      total += remaining;
    } else {
      total += Math.max(0, remaining - shields);
      if (shields > 0) shields--;
    }
  }
  return total;
}

/**
 * Battle policy (used for the AI's cards AND for P1 cards on full-auto):
 * Special only when it's clearly worth the pool (a kill, a multi-target hit,
 * or a useful status spread); otherwise basic-attack the best target.
 * Capture awareness: kill invaders standing on our own Home row first.
 */
export function chooseBattleAction(state: GameState, instanceId: string): BattleChoice {
  const card = state.cards[instanceId]!;
  const def = getDef(card.defId);
  const targets = validTargets(state, instanceId);
  const specCheck = canFireSpecial(state, instanceId);

  if (specCheck.ok && def.special) {
    const sp = def.special;
    const params = sp.params ?? {};
    const dmg = Number(params.dmg ?? 0);
    const hits = Number(params.hits ?? 1);
    const pen = Number(params.pen ?? 0) > 0;
    if (sp.handler === "strike" || sp.handler === "barrage") {
      const kill = targets.find((t) => estimateVolley(dmg, hits, pen, t) >= t.curHp);
      const basicKillsIt =
        kill &&
        estimateVolley(def.dmg + card.dmgBonus, def.hits, Boolean(def.keywords.PEN), kill) >=
          kill.curHp;
      const wide = sp.handler === "barrage" && targets.length >= 3;
      if ((kill && !basicKillsIt) || wide) {
        return { action: "special", targetId: kill?.instanceId ?? targets[0]?.instanceId };
      }
    } else if (sp.handler === "statusNova") {
      const fresh = targets.filter((t) => !t.status);
      if (fresh.length >= 2) {
        return { action: "special", targetId: fresh[0].instanceId };
      }
    } else if (sp.handler === "grantShield") {
      const allies = validAllyTargets(state, instanceId).filter(
        (a) => a.instanceId !== instanceId,
      );
      const hurt = allies.find(
        (a) => a.curHp < a.maxHp / 2 || a.pos!.row === homeRow(enemyOf(card.owner)),
      );
      if (hurt) return { action: "special", targetId: hurt.instanceId };
    }
  }

  if (targets.length === 0) return { action: "skip" };

  const est = (t: CardInstance) =>
    estimateVolley(def.dmg + card.dmgBonus, def.hits, Boolean(def.keywords.PEN), t);

  // Capture awareness: an invader standing on our own Home row dies first,
  // before it survives to a permanent capture.
  const myHome = homeRow(card.owner);
  const invaders = targets.filter((t) => t.pos!.row === myHome);
  const pool = invaders.length > 0 ? invaders : targets;

  // Kill the lowest-HP target we can actually finish…
  const killable = pool.filter((t) => est(t) >= t.curHp);
  if (killable.length > 0) {
    const pick = killable.reduce((b, t) => (t.curHp < b.curHp ? t : b));
    return { action: "basic", targetId: pick.instanceId };
  }
  // …else the highest-threat target (prefer Assassins/Mages, then raw damage).
  const threatScore = (t: CardInstance) => {
    const d = getDef(t.defId);
    const classBias = d.cardClass === "Assassin" || d.cardClass === "Mage" ? 100 : 0;
    return classBias + d.dmg * d.hits;
  };
  const pick = pool.reduce((b, t) => (threatScore(t) > threatScore(b) ? t : b));
  return { action: "basic", targetId: pick.instanceId };
}
