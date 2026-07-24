// Rule-based opponent. A readable heuristic, not a search. Every intent it
// returns is validated through rules.ts, and it sees only what a player
// would see (its own hand + the board — it never reads P1's hand or deck).

import { getDef } from "../data/cards";
import { getSpell, spellPickKind } from "./spells";
import {
  boardCards,
  cardAt,
  effectiveDmg,
  effectiveMaxHp,
  isCaptured,
  moveReachFor,
} from "./state";
import { hasEvasion } from "./combat";
import {
  canCastSpell,
  spellAllyTargets,
  canFireSpecial,
  canFireTalent,
  canMove,
  canSummon,
  canTarget,
  legalWallRows,
  spellEnemyTargets,
  validAllyTargets,
  specialTargets,
  validTargets,
} from "./rules";
import type {
  CardInstance,
  GameState,
  Intent,
  PlayerId,
  Pos,
  StatusKind,
} from "./types";
import { enemyOf, homeRow, NEGATIVE_STATUSES } from "./types";

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
    for (let col = 0; col < state.boardSize; col++) {
      if (canSummon(state, player, h.handId, col).ok) {
        return { type: "SUMMON", player, handId: h.handId, col };
      }
    }
  }

  // 2. Cast a high-value spell (once per game each): a Cost-1 damage spell to
  //    secure a kill, or a Cost-4 wall over a row packed with opponents.
  const spell = findSpellCast(state, player);
  if (spell) return spell;

  // 3. Capture step: an uncaptured enemy Home slot in reach is the win
  //    condition itself — take it. (Also the endgame stall-breaker: forward-
  //    only advancing never walks sideways along the enemy home row.)
  if (!state.prep?.movedThisTurn) {
    const grab = findCaptureMove(state, player);
    if (grab) return grab;
  }

  // 3. Advance one card toward the enemy Home if it looks survivable.
  if (!state.prep?.movedThisTurn) {
    const move = findAdvance(state, player, false);
    if (move) return move;
    // Stall-breaker: total standoff (none of our cards can reach anything) —
    // camping forever is a guaranteed non-win, so make progress toward the
    // capture win regardless of the threat estimate. Without this, two ranged
    // lines camp home rows (where nothing is targetable) until the round cap.
    const standoff = boardCards(state, player).every(
      (c) => validTargets(state, c.instanceId).length === 0,
    );
    if (standoff) {
      const desperate = findAdvance(state, player, true) ?? findClosingMove(state, player);
      if (desperate) return desperate;
    }
  }

  return { type: "PASS", player };
}

/**
 * Cast a spell from the AI's spellbook if it's clearly worth the one-shot:
 * a damage spell that finishes an opponent (prefer an invader on our Home),
 * or a wall over the placeable row holding the most opponents (≥2).
 */
/** Total HP the caster side is missing — the yardstick for whether a heal is
 *  worth spending a one-shot spell on. */
function woundedTotal(state: GameState, player: PlayerId): number {
  return boardCards(state, player).reduce(
    (a, c) => a + Math.max(0, effectiveMaxHp(state, c) - c.curHp),
    0,
  );
}

/** How many of the caster cards carry a negative status right now. */
/** How many negative statuses a card is carrying — the "who needs the cleanse
 *  most" score. */
function countNegative(card: CardInstance): number {
  return card.statuses.filter((s) => NEGATIVE_STATUSES.includes(s.kind)).length;
}

function afflictedCount(state: GameState, player: PlayerId): number {
  return boardCards(state, player).filter(
    (c) => c.curHp > 0 && c.statuses.some((x) => NEGATIVE_STATUSES.includes(x.kind)),
  ).length;
}

/** Does this card satisfy an AoE spell double-damage rider? */
function matchesDoubleIf(target: CardInstance, cond: StatusKind | "noShields"): boolean {
  return cond === "noShields"
    ? target.curShields <= 0
    : target.statuses.some((s) => s.kind === cond);
}

/**
 * Pick a spell to cast, across EVERY spell kind.
 *
 * Spells are one-shot for the whole game, so each branch carries a threshold it
 * has to clear before spending one — otherwise the AI dumps its entire book on
 * round one for marginal value. Ordered by how decisive the effect is rather
 * than by cost.
 *
 * Previously only `damage` and `wall` were considered, so 28 of the 46 spells
 * in the game (heal, aoe, field, convert, choice — 61% of the book) were dead
 * weight in the AI hands. That also meant no balance run ever exercised them.
 */
function findSpellCast(state: GameState, player: PlayerId): Intent | null {
  const p = state.players[player];
  const book = p.spellbook.filter((s) => !s.used);
  if (book.length === 0) return null;
  const myHome = homeRow(player, state.boardSize);
  const foes = boardCards(state, enemyOf(player)).filter((c) => c.curHp > 0);
  const mine = boardCards(state, player).filter((c) => c.curHp > 0);
  const affordable = book.filter((s) => p.magicPool >= getSpell(s.defId).cost);
  const of = (kind: string) => affordable.filter((s) => getSpell(s.defId).kind === kind);

  // 1. Damage spell -> secure a kill. One-shot economy: only for an actual kill.
  const enemies = spellEnemyTargets(state, player);
  for (const slot of of("damage")) {
    const spell = getSpell(slot.defId);
    const dmg = spell.dmg ?? 0;
    const pen = Boolean(spell.pen);
    const killable = enemies.filter((t) => estimateVolley(dmg, 1, pen, t) >= t.curHp);
    if (killable.length === 0) continue;
    // Prefer finishing an invader parked on our Home row, else the lowest HP.
    const target =
      killable.find((t) => t.pos!.row === myHome) ??
      killable.reduce((b, t) => (t.curHp < b.curHp ? t : b));
    if (canCastSpell(state, player, spell.id, { targetId: target.instanceId }).ok)
      return { type: "CAST_SPELL", player, spellId: spell.id, targetId: target.instanceId };
  }

  // 2. AoE -> the row (or board) where it does the most work. Scored on real
  //    damage against real HP so it fires on a cluster it can actually hurt
  //    rather than on a headcount; a kill counts double.
  for (const slot of of("aoe")) {
    const spell = getSpell(slot.defId);
    const dmg = spell.dmg ?? 0;
    const pen = Boolean(spell.pen);
    const score = (hit: CardInstance[]) =>
      hit.reduce((a, t) => {
        const raw = spell.doubleIf && matchesDoubleIf(t, spell.doubleIf) ? dmg * 2 : dmg;
        const dealt = estimateVolley(raw, 1, pen, t);
        return a + Math.min(dealt, t.curHp) + (dealt >= t.curHp ? t.curHp : 0);
      }, 0);
    if (spell.area === "board") {
      // No pick to make. Worth a one-shot once it lands on two or more bodies.
      if (foes.length >= 2 && canCastSpell(state, player, spell.id).ok)
        return { type: "CAST_SPELL", player, spellId: spell.id };
      continue;
    }
    let bestRow = -1;
    let best = 0;
    for (let r = 0; r < state.boardSize; r++) {
      if (!canCastSpell(state, player, spell.id, { row: r }).ok) continue;
      const hit = foes.filter(
        (e) => e.pos!.row === r || (spell.area === "tworows" && e.pos!.row === r + 1),
      );
      if (hit.length < 2) continue; // one body does not justify a one-shot
      const v = score(hit);
      if (v > best) {
        best = v;
        bestRow = r;
      }
    }
    if (bestRow >= 0)
      return { type: "CAST_SPELL", player, spellId: spell.id, row: bestRow };
  }

  // 3. Wall -> the legal row holding the most opponents (2+).
  for (const slot of of("wall")) {
    const spell = getSpell(slot.defId);
    let bestRow = -1;
    let bestCount = 1; // require at least 2 to justify the one-shot
    for (const r of legalWallRows(state, player, spell)) {
      const count = foes.filter((e) => e.pos!.row === r).length;
      if (count > bestCount) {
        bestCount = count;
        bestRow = r;
      }
    }
    if (bestRow >= 0 && canCastSpell(state, player, spell.id, { row: bestRow }).ok)
      return { type: "CAST_SPELL", player, spellId: spell.id, row: bestRow };
  }

  // 4. Field -> a board-wide, multi-round buff. Only one per side at a time, so
  //    hold it until there is a board worth buffing rather than an empty one.
  for (const slot of of("field")) {
    const spell = getSpell(slot.defId);
    if (mine.length < 2) continue;
    if (canCastSpell(state, player, spell.id).ok)
      return { type: "CAST_SPELL", player, spellId: spell.id };
  }

  // 5. Heal / support -> once the side has taken real damage, or a cleanse has
  //    two or more afflicted allies to clear. The threshold stops it burning a
  //    one-shot to top a card up by a point.
  for (const slot of of("heal")) {
    const spell = getSpell(slot.defId);
    const worth = (spell.allyHeal ?? 0) + (spell.allyHealIfRooted ?? 0);
    const cleansing = (spell.cleanse ?? 0) > 0 && afflictedCount(state, player) >= 2;
    if (!cleansing && woundedTotal(state, player) < Math.max(4, worth)) continue;
    // These AIM now rather than auto-resolving, so the AI names its ally like
    // a player does. It FIZZLES when the caster has none of that element on the
    // board, and a fizzle still spends the one-shot — so require a target.
    const kin = spellAllyTargets(state, player, spell);
    if (kin.length === 0) continue;
    // Neediest kin: a cleanse wants the most afflicted card, everything else
    // wants the one closest to dying.
    const pick = kin
      .slice()
      .sort((a, b) =>
        cleansing
          ? countNegative(b) - countNegative(a)
          : a.curHp / a.maxHp - b.curHp / b.maxHp,
      )[0];
    const opts = spellPickKind(spell) === "ally" ? { targetId: pick.instanceId } : {};
    if (canCastSpell(state, player, spell.id, opts).ok)
      return { type: "CAST_SPELL", player, spellId: spell.id, ...opts };
  }

  // 6. Trap -> a mine on the square the opponent most wants to walk onto. It
  //    never expires, so there is no rush, but it is worth laying once there is
  //    an enemy on the board that might actually move.
  //
  //    Scored by how likely a square is to be STEPPED ON: its own uncaptured
  //    Home slots first (an invader has to stand there to capture, and that is
  //    the one move it cannot decline), then squares adjacent to advancing
  //    enemies. A trap on an unreachable square is a wasted one-shot.
  for (const slot of of("trap")) {
    const spell = getSpell(slot.defId);
    if (foes.length === 0) continue;
    const home = homeRow(player, state.boardSize);
    let best: Pos | null = null;
    let bestScore = 0;
    for (let row = 0; row < state.boardSize; row++) {
      for (let col = 0; col < state.boardSize; col++) {
        if (!canCastSpell(state, player, spell.id, { row, col }).ok) continue;
        // An uncaptured home slot is the square the opponent is obliged to enter.
        let score = row === home && !isCaptured(state, row, col) ? 6 : 0;
        // ...otherwise, how many enemies could reach it on their next move?
        for (const e of foes) {
          const d = Math.max(Math.abs(e.pos!.row - row), Math.abs(e.pos!.col - col));
          if (d <= moveReachFor(state, e)) score += 3;
          else if (d <= moveReachFor(state, e) + 1) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          best = { row, col } as Pos;
        }
      }
    }
    if (best && bestScore >= 3)
      return { type: "CAST_SPELL", player, spellId: spell.id, row: best.row, col: best.col };
  }

  // 7. Repositioning (Rewire, Full Reroute) -> pull a card that is about to die
  //    out of reach, or push one onto an uncaptured enemy Home slot. Both cost a
  //    one-shot, so they need a real reason: a card under lethal threat, or a
  //    capture that wins ground.
  for (const slot of [...of("convert")]) {
    const spell = getSpell(slot.defId);
    if (!spell.swapAllies && !spell.rerouteCount) continue;
    const mine = boardCards(state, player).filter((c) => c.curHp > 0);
    if (mine.length < (spell.swapAllies ? 2 : 1)) continue;
    // Who is in the most danger where they stand?
    const scored = mine
      .map((c) => ({ c, risk: threatAt(state, c, c.pos!) - (c.curHp + c.curShields * 2) }))
      .sort((a, b) => b.risk - a.risk);
    const doomed = scored[0];
    if (!doomed || doomed.risk < 0) continue; // nobody is actually losing the trade
    if (spell.rerouteCount) {
      // Move it somewhere nothing can reach it; take an open enemy Home slot if
      // one is going spare, since that is the win condition itself.
      const enemyHome = homeRow(enemyOf(player), state.boardSize);
      let best: Pos | null = null;
      let bestRisk = doomed.risk;
      for (let r = 0; r < state.boardSize; r++)
        for (let c = 0; c < state.boardSize; c++) {
          if (cardAt(state, r, c) || isCaptured(state, r, c)) continue;
          const risk = threatAt(state, doomed.c, { row: r, col: c } as Pos) - (doomed.c.curHp + doomed.c.curShields * 2);
          const capture = r === enemyHome ? -6 : 0; // treat a capture as worth taking
          if (risk + capture < bestRisk) { bestRisk = risk + capture; best = { row: r, col: c } as Pos; }
        }
      if (best && canCastSpell(state, player, spell.id, { targetIds: [doomed.c.instanceId], slots: [best] }).ok)
        return { type: "CAST_SPELL", player, spellId: spell.id, targetIds: [doomed.c.instanceId], slots: [best] };
      continue;
    }
    // Rewire: trade places with the safest ally, so the hurt one steps back.
    const safest = scored[scored.length - 1];
    if (safest && safest.c.instanceId !== doomed.c.instanceId &&
        canCastSpell(state, player, spell.id, { targetIds: [doomed.c.instanceId, safest.c.instanceId] }).ok)
      return {
        type: "CAST_SPELL", player, spellId: spell.id,
        targetIds: [doomed.c.instanceId, safest.c.instanceId],
      };
  }

  // 8. Convert -> magic into summoning resource. Only when something in hand is
  //    unaffordable now and the conversion would actually unlock it.
  for (const slot of of("convert")) {
    const spell = getSpell(slot.defId);
    const cheapest = p.hand.reduce((m, h) => Math.min(m, getDef(h.defId).cost), Infinity);
    const gain = spell.gainSummon ?? 0;
    const stuck =
      cheapest !== Infinity && p.summonPool < cheapest && p.summonPool + gain >= cheapest;
    if (!stuck) continue;
    if (canCastSpell(state, player, spell.id).ok)
      return { type: "CAST_SPELL", player, spellId: spell.id };
  }

  // 9. Choice (Chill) -> attack mode when it kills, else shield an ally while
  //    the board is under real pressure. Never cast for nothing.
  for (const slot of of("choice")) {
    const spell = getSpell(slot.defId);
    const dmg = spell.dmg ?? 0;
    const kill = enemies.find((t) => estimateVolley(dmg, 1, Boolean(spell.pen), t) >= t.curHp);
    if (
      kill &&
      canCastSpell(state, player, spell.id, { targetId: kill.instanceId, mode: "attack" }).ok
    )
      return {
        type: "CAST_SPELL",
        player,
        spellId: spell.id,
        targetId: kill.instanceId,
        mode: "attack",
      };
    // Shield mode now aims too — brace the ally closest to dying.
    const kin = spellAllyTargets(state, player, spell)
      .slice()
      .sort((a, b) => a.curHp / a.maxHp - b.curHp / b.maxHp)[0];
    if (
      kin &&
      woundedTotal(state, player) >= 6 &&
      canCastSpell(state, player, spell.id, { mode: "shield", targetId: kin.instanceId }).ok
    )
      return { type: "CAST_SPELL", player, spellId: spell.id, mode: "shield", targetId: kin.instanceId };
  }
  return null;
}

/** Move a healthy card onto an uncaptured, open enemy Home slot if one is in reach. */
function findCaptureMove(state: GameState, player: PlayerId): Intent | null {
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  const movers = boardCards(state, player)
    .filter((c) => moveReachFor(state, c) > 0)
    // A card mid-capture (standing on a NOT-yet-captured enemy home slot)
    // stays put — moving would reopen its slot and oscillate forever. Once
    // its slot is permanently captured it's free to go take the next one.
    .filter((c) => !isMidCapture(state, c, enemyHome))
    // closest to the enemy home row first, tougher bodies as tie-break
    .sort(
      (a, b) =>
        Math.abs(a.pos!.row - enemyHome) - Math.abs(b.pos!.row - enemyHome) ||
        b.curHp + b.curShields * 2 - (a.curHp + a.curShields * 2),
    );
  for (const mover of movers) {
    for (let col = 0; col < state.boardSize; col++) {
      if (state.slots[enemyHome][col].capturedBy) continue; // already locked
      const to = { row: enemyHome, col } as Pos;
      if (!canMove(state, player, mover.instanceId, to).ok) continue;
      // Don't feed a chip-damage body into a defended slot: require the mover
      // to plausibly survive the defender's round, unless nothing can reach it.
      const threat = threatAt(state, mover, to);
      if (threat < mover.curHp + mover.curShields * 2 || threat === 0) {
        return { type: "MOVE", player, instanceId: mover.instanceId, to };
      }
    }
  }
  return null;
}

/** Mid-capture = standing on an enemy home slot that hasn't locked yet. */
function isMidCapture(state: GameState, card: { pos: Pos | null }, enemyHome: number): boolean {
  return (
    card.pos !== null &&
    card.pos.row === enemyHome &&
    !state.slots[enemyHome][card.pos.col].capturedBy
  );
}

/**
 * BFS step-distance from `from` to the nearest uncaptured enemy Home slot,
 * walking only cells a card may STOP on (empty + not locked). Routes around
 * captured-slot walls that a straight-line metric can't.
 */
function bfsDistance(state: GameState, from: Pos, goals: Pos[]): number {
  const goalKey = new Set(goals.map((g) => `${g.row},${g.col}`));
  const seen = new Set([`${from.row},${from.col}`]);
  let frontier: Pos[] = [from];
  let dist = 0;
  while (frontier.length > 0) {
    if (frontier.some((p) => goalKey.has(`${p.row},${p.col}`))) return dist;
    const next: Pos[] = [];
    for (const p of frontier) {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const row = p.row + dr;
        const col = p.col + dc;
        if (row < 0 || row >= state.boardSize || col < 0 || col >= state.boardSize) continue;
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // A goal defended by an enemy card can't be stepped on, but standing
        // NEXT to it is arrival — combat clears the squatter from there.
        if (goalKey.has(key)) return dist + 1;
        if (state.slots[row][col].capturedBy) continue; // can't stop on locked
        if (cardAt(state, row, col)) continue; // occupied
        next.push({ row, col } as Pos);
      }
    }
    frontier = next;
    dist++;
  }
  return Infinity;
}

/**
 * Standoff fallback when forward-only advancing is walled off (e.g. by
 * captured, locked slots): take any legal move that STRICTLY shrinks the
 * BFS distance to the nearest uncaptured enemy Home slot. Strictly
 * decreasing, so it can never oscillate; it routes around walls one move
 * a turn.
 */
function findClosingMove(state: GameState, player: PlayerId): Intent | null {
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  const goals: Pos[] = [];
  for (let col = 0; col < state.boardSize; col++) {
    if (!state.slots[enemyHome][col].capturedBy)
      goals.push({ row: enemyHome, col } as Pos);
  }
  if (goals.length === 0) return null;
  const distToGoal = (p: Pos) => bfsDistance(state, p, goals);

  const movers = boardCards(state, player)
    .filter((c) => moveReachFor(state, c) > 0)
    .filter((c) => !isMidCapture(state, c, enemyHome)) // mid-capture — stay put
    .sort((a, b) => distToGoal(a.pos!) - distToGoal(b.pos!));
  for (const mover of movers) {
    const cur = distToGoal(mover.pos!);
    let best: Pos | null = null;
    let bestDist = cur;
    for (let row = 0; row < state.boardSize; row++)
      for (let col = 0; col < state.boardSize; col++) {
        const to = { row, col } as Pos;
        if (!canMove(state, player, mover.instanceId, to).ok) continue;
        const d = distToGoal(to);
        if (d < bestDist) {
          bestDist = d;
          best = to;
        }
      }
    if (best) return { type: "MOVE", player, instanceId: mover.instanceId, to: best };
  }
  return null;
}

/** Rough incoming damage at a position: sum of enemy volleys that could reach it. */
function threatAt(state: GameState, mover: CardInstance, pos: Pos): number {
  const ghost: CardInstance = { ...mover, pos: { ...pos } };
  let total = 0;
  for (const enemy of boardCards(state, enemyOf(mover.owner))) {
    // forBasic: this models incoming BASIC volleys, so it must respect the same
    // queen-line reach the attacker would actually be held to.
    if (canTarget(state, enemy, ghost, false, true)) {
      total += effectiveDmg(state, enemy) * getDef(enemy.defId).hits;
    }
  }
  return total;
}

function findAdvance(
  state: GameState,
  player: PlayerId,
  desperate: boolean,
): Intent | null {
  // Prefer the card already deepest into enemy territory; in a standoff,
  // lead with the toughest body instead.
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  const forward = player === "P2" ? 1 : -1; // P2 pushes toward row 3, P1 toward row 0
  const movers = boardCards(state, player)
    .filter((c) => moveReachFor(state, c) > 0)
    .sort((a, b) =>
      desperate
        ? b.curHp + b.curShields * 2 - (a.curHp + a.curShields * 2)
        : (b.pos!.row - a.pos!.row) * forward,
    );

  for (const mover of movers) {
    const reach = moveReachFor(state, mover);
    const candidates: Pos[] = [];
    for (let d = reach; d >= 1; d--) {
      const row = mover.pos!.row + d * forward;
      if (row < 0 || row >= state.boardSize) continue;
      const clamped = forward === 1 ? Math.min(enemyHome, row) : Math.max(enemyHome, row);
      if (clamped === mover.pos!.row) continue;
      const remaining = reach - Math.abs(clamped - mover.pos!.row);
      for (let dc = -remaining; dc <= remaining; dc++) {
        const col = mover.pos!.col + dc;
        if (col < 0 || col >= state.boardSize) continue;
        candidates.push({ row: clamped, col } as Pos);
      }
    }
    for (const to of candidates) {
      if (!canMove(state, player, mover.instanceId, to).ok) continue;
      const invading = to.row === enemyHome && !isCaptured(state, to.row, to.col);
      const threat = threatAt(state, mover, to);
      const survivable =
        threat < mover.curHp + mover.curShields * 2 || (invading && mover.curHp > 6);
      if (survivable || desperate) {
        return { type: "MOVE", player, instanceId: mover.instanceId, to };
      }
    }
  }
  return null;
}

// ── battle ──────────────────────────────────────────────────────────────────

export interface BattleChoice {
  action: "basic" | "special" | "skip" | "talent";
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

/** EVASION means ~half the hits whiff — the kill math shouldn't trust a volley
 *  that only *just* covers an evasive target's HP. */
function isEvasive(target: CardInstance, boardSize: number): boolean {
  // hasEvasion, not keywords.EVASION — Ravven only dodges on enemy ground, and
  // the AI must read it the same way the dodge roll does.
  return hasEvasion(target, boardSize) || target.statuses.some((s) => s.kind === "EVASION");
}

/** Will `volley` reliably kill `target`? Evasive targets need double, since
 *  roughly half the hits are expected to miss. */
function willKill(target: CardInstance, volley: number, boardSize: number): boolean {
  return volley >= target.curHp * (isEvasive(target, boardSize) ? 2 : 1);
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
  const specTargets = specialTargets(state, instanceId); // ranged-aware + forward-corridor
  const specCheck = canFireSpecial(state, instanceId);

  // A basic-attack kill this turn is the most urgent use of the turn — utility
  // Specials/Talents (empower, spawn, load-darts) defer to it.
  const est = (t: CardInstance) =>
    estimateVolley(effectiveDmg(state, card), def.hits, Boolean(def.keywords.PEN), t);
  const basicCanKill = targets.some((t) => willKill(t, est(t), state.boardSize));

  if (specCheck.ok && def.special) {
    const sp = def.special;
    const params = sp.params ?? {};
    const dmg = Number(params.dmg ?? 0);
    const hits = Number(params.hits ?? 1);
    const pen = Number(params.pen ?? 0) > 0;
    // Magic is its own pool now — unspent surplus is wasted value, so be
    // liberal when flush: fire anything decent, not only guaranteed kills.
    const rich = state.players[card.owner].magicPool >= sp.cost + 2;
    // Don't fire a self-damaging Special (Kraken's Black Wave Crash, or Griffith's
    // 10% Dive Bomb recoil) if it would kill the caster.
    const recoilCost = Math.round((Number(params.dmg ?? 0) * Number(params.recoilPct ?? 0)) / 100);
    const selfKills = Number(params.selfDamage ?? 0) + recoilCost >= card.curHp;
    if (selfKills) {
      // fall through to the basic-attack policy below
    } else if (sp.handler === "strike" || sp.handler === "barrage" || sp.handler === "combo") {
      const kill = specTargets.find((t) => willKill(t, estimateVolley(dmg, hits, pen, t), state.boardSize));
      const basicKillsIt =
        kill && willKill(kill, estimateVolley(effectiveDmg(state, card), def.hits, Boolean(def.keywords.PEN), kill), state.boardSize);
      const wide = sp.handler === "barrage" && specTargets.length >= 3;
      const outDamagesBasic =
        dmg * hits * (sp.handler === "barrage" ? Math.min(specTargets.length, Number(params.targets ?? 1)) : 1) >
        effectiveDmg(state, card) * def.hits;
      if ((kill && !basicKillsIt) || wide || (rich && outDamagesBasic)) {
        return { action: "special", targetId: kill?.instanceId ?? specTargets[0]?.instanceId };
      }
    } else if (sp.handler === "empower") {
      // Self-buff (Heir's Crowned): permanent value — take it when there's no
      // kill to secure this turn and the magic is there.
      if (!basicCanKill) return { action: "special" };
    } else if (sp.handler === "spawn") {
      // Spawn a body (Imperator): great value; skip only to secure a kill.
      if (!basicCanKill && rich) return { action: "special" };
    } else if (sp.handler === "statusNova") {
      const novaKind = String(params.statusKind ?? "");
      const fresh = specTargets.filter((t) => !t.statuses.some((st) => st.kind === novaKind));
      if (fresh.length >= 2 || (rich && fresh.length >= 1)) {
        return { action: "special", targetId: fresh[0].instanceId };
      }
    } else if (sp.handler === "drainMax") {
      // Card text: drain the highest-max-HP opponent. Worth it while there's
      // something meaty to steal from.
      const fat = specTargets.reduce((b, t) => (t.maxHp > b.maxHp ? t : b), specTargets[0]);
      if (fat && (fat.maxHp >= 8 || (rich && fat.maxHp >= 5))) {
        return { action: "special", targetId: fat.instanceId };
      }
    } else if (sp.handler === "grantShield") {
      const allies = validAllyTargets(state, instanceId).filter(
        (a) => a.instanceId !== instanceId,
      );
      const hurt = allies.find(
        (a) => a.curHp < a.maxHp / 2 || a.pos!.row === homeRow(enemyOf(card.owner), state.boardSize),
      );
      if (hurt) return { action: "special", targetId: hurt.instanceId };
    } else if (sp.handler === "heal") {
      const hurt = validAllyTargets(state, instanceId).filter((a) => a.curHp < a.maxHp);
      const total = hurt.reduce((s, a) => s + (a.maxHp - a.curHp), 0);
      if (hurt.length >= 2 || total >= Number(params.amount ?? 0) || (rich && hurt.length >= 1)) {
        return { action: "special", targetId: hurt[0]?.instanceId };
      }
    } else if (sp.handler === "cleanse") {
      const statused = validAllyTargets(state, instanceId).filter((a) => a.statuses.length > 0);
      if (statused.length > 0) return { action: "special", targetId: statused[0].instanceId };

      // ── handlers below here were previously unreachable ──────────────────
      // Seven of the sixteen Specials in the game fell through every branch and
      // so were NEVER fired by the AI: it basic-attacked with those cards all
      // game. Their damage was also invisible to every balance run.
    } else if (sp.handler === "spiral" || sp.handler === "rockslide" || sp.handler === "battleCharge") {
      // Multi-target damage that picks its own victims from the board (a
      // ricochet chain, a scatter of shots, a lane). Target choice barely
      // matters, so the question is only whether there is enough on the board
      // to be worth the pool.
      const kill = specTargets.find((t) => willKill(t, estimateVolley(dmg, hits, pen, t), state.boardSize));
      if (kill) return { action: "special", targetId: kill.instanceId };
      if (specTargets.length >= 2 || (rich && specTargets.length >= 1))
        return { action: "special", targetId: specTargets[0]?.instanceId };
    } else if (sp.handler === "overload") {
      // Electrified/PARALYZE spread: pure control, no damage. Worth it on a
      // cluster, or on anything at all when the pool is spare.
      if (specTargets.length >= 2 || (rich && specTargets.length >= 1))
        return { action: "special", targetId: specTargets[0]?.instanceId };
    } else if (sp.handler === "burrow") {
      // Vanish and LOAD a heavier strike for next turn. Only when there is no
      // kill on the table now — it gives up this turn's attack entirely — and
      // never while a strike is already loaded.
      if (!basicCanKill && !card.loadedStrike) return { action: "special" };
    } else if (sp.handler === "loadOnHit") {
      // Arms an on-hit status rider for the coming attacks. Same trade as
      // burrow: it spends the turn, so only take it with nothing to finish.
      if (!basicCanKill && targets.length > 0) return { action: "special", targetId: targets[0].instanceId };
    } else if (sp.handler === "accelerate") {
      // Team SP buff — the payoff is board mobility next Prep, so it wants
      // allies on the board and nothing more urgent to do with the turn.
      const allies = boardCards(state, card.owner).filter((a) => a.curHp > 0);
      if (!basicCanKill && allies.length >= 2) return { action: "special" };
    }
  }

  // Talent (Dart Frog's Bleed Out): trade this turn's attack to load the darts
  // — but only when there's nothing to kill right now and the darts aren't
  // already loaded, so next turn's basic hits far harder.
  if (
    def.talent &&
    canFireTalent(state, instanceId).ok &&
    !basicCanKill &&
    (card.loadedHits ?? 0) === 0 &&
    targets.length > 0
  ) {
    return { action: "talent" };
  }

  if (targets.length === 0) return { action: "skip" };

  // Capture awareness: an invader standing on our own Home row dies first,
  // before it survives to a permanent capture.
  const myHome = homeRow(card.owner, state.boardSize);
  const invaders = targets.filter((t) => t.pos!.row === myHome);
  const pool = invaders.length > 0 ? invaders : targets;

  // Kill the lowest-HP target we can actually finish…
  const killable = pool.filter((t) => willKill(t, est(t), state.boardSize));
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
