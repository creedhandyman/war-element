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
  homeSlotsHeld,
  isCaptured,
  moveReachFor, enemyCards } from "./state";
import { hasEvasion, TARGETLESS_HANDLERS } from "./combat";
import {
  canCastSpell,
  spellAllyTargets,
  canFireSpecial,
  canFireTalent,
  canMove,
  canSummon,
  canTarget,
  legalWallRows,
  openHomeSlots,
  spellEnemyTargets,
  validAllyTargets,
  specialTargets,
  validTargets,
  homeSlots,
  domMap,
} from "./rules";
import type {
  CardInstance,
  GameState,
  Intent,
  PlayerId,
  Pos,
  StatusKind,
} from "./types";
import { enemyOf, homeRow, NEGATIVE_STATUSES, seatsOf } from "./types";
import { isImpassable, poiAt, poiRing, type PoiDef } from "../data/domination";

// ── mulligan ────────────────────────────────────────────────────────────────

/** Toss anything above the early curve; keep the 1–4 cost cards. */
export function aiMulligan(state: GameState, player: PlayerId = "P2"): string[] {
  return state.players[player].hand
    .filter((h) => getDef(h.defId).cost > 4)
    .map((h) => h.handId);
}

/** How many home slots the AI keeps occupied while it still has cards to buy.
 *
 *  One. Income is 1/round + 1 per slot held, so a single held slot doubles the
 *  base grant, and every slot above the first is worth advancing instead — the
 *  win conditions are all forward. Higher values measured worse: the AI camped,
 *  and camping is a guaranteed non-win. */
const HOME_RESERVE = 1;

/** How much gold the AI will wait for before calling a card in hand "buyable".
 *  Without this the reserve drops the moment the pool dips below the cheapest
 *  card, which is exactly the round it most needs the income. */
const HOME_RESERVE_LOOKAHEAD = 2;

// ── prep ────────────────────────────────────────────────────────────────────


/** The squares to try deploying into, BEST FIRST.
 *
 *  Outside Domination this is just the Home row, whose columns are equivalent.
 *
 *  Inside it, the four shrines are the only way onto the board and they are one
 *  per edge of the road cross — so the one you take decides which Points you can
 *  get to. Ordered by how close each is to a Point this side actually wants,
 *  which stops every seat driving at the map's first-declared shrine and
 *  crowding the top of the board regardless of where the fight is. */
function deploySlots(state: GameState, player: PlayerId): Pos[] {
  const slots = homeSlots(state, player);
  const m = domMap(state);
  if (!m) return slots;
  // ITS OWN DOOR FIRST. Sorting purely by distance to a wanted Point looks
  // right and is not: every shrine sits on an edge between two Points, so the
  // distances TIE, every tie fell to the map's declaration order, and all four
  // AI seats walked in through the same shrine — the whole table queueing at
  // one square while three stood empty.
  //
  // Each seat is anchored to the shrine at its own index, and the shrines are
  // one per edge, so four seats enter from four sides. Distance to what it
  // actually wants still orders the rest, which is what makes the fallback
  // sensible when its own door is taken.
  const seat = Math.max(0, seatsOf(state).indexOf(player));
  const anchor = m.shrines[seat % m.shrines.length];
  const isAnchor = (p: Pos) => !!anchor && p.row === anchor.row && p.col === anchor.col;
  const goals = pointGoals(state, player);
  const near = (p: Pos) => goals.length === 0 ? 0
    : Math.min(...goals.map((g) => Math.max(Math.abs(g.row - p.row), Math.abs(g.col - p.col))));
  return [...slots].sort((a, b) =>
    (isAnchor(a) ? -1 : 0) - (isAnchor(b) ? -1 : 0) || near(a) - near(b));
}

/** One intent per call: summon > move > pass. */
export function aiPrepIntent(state: GameState, player: PlayerId = "P2"): Intent {
  // 1. Summon the highest-cost affordable card into an open Home slot.
  const hand = state.players[player].hand
    .slice()
    .sort((a, b) => getDef(b.defId).cost - getDef(a.defId).cost);
  for (const h of hand) {
    // WHERE a card comes in. On a standard board these are the home-row columns
    // this loop always walked and they are interchangeable back-line ground, so
    // first-legal is a fine answer.
    //
    // In Domination they are the four shrines — the only deploy squares in the
    // mode, shared by the whole table — and they are NOT interchangeable: each
    // sits at a different end of the road cross, so which one you take decides
    // which Points you can reach. `deploySlots` puts the useful one first.
    //
    // (There used to be a second loop over `neutralDeploySlots` here as a
    // fallback. It was dead: since deployment became shrines-only both
    // functions return the same four squares in the same order, so it re-tested
    // a list that had just been tested. The "own shrine, then a neutral one"
    // design it was written for no longer exists — every shrine is neutral.)
    for (const slot of deploySlots(state, player)) {
      if (canSummon(state, player, h.handId, slot.col, state.domination ? slot.row : undefined).ok) {
        return {
          type: "SUMMON", player, handId: h.handId, col: slot.col,
          ...(state.domination ? { row: slot.row } : {}),
        };
      }
    }
  }

  // Opening deployment is placement only — no spells, no captures, nothing to
  // move yet. Out of slots or out of gold means done.
  if (state.opening) return { type: "PASS", player };

  // 2. Cast a high-value spell (once per game each): a Cost-1 damage spell to
  //    secure a kill, or a Cost-4 wall over a row packed with opponents.
  const spell = findSpellCast(state, player);
  if (spell) return spell;

  // 3. DOMINATION plays a different game entirely — the board is the win
  //    condition, so the whole movement plan is "stand on the Points". It
  //    replaces the capture-and-advance steps below rather than adding to
  //    them: those aim at an enemy Home row this mode does not have.
  if (state.domination && !state.prep?.movedThisTurn) {
    const dom = findDominationMove(state, player);
    if (dom) return dom;
  }

  // 3. Capture step: an uncaptured enemy Home slot in reach is the win
  //    condition itself — take it. (Also the endgame stall-breaker: forward-
  //    only advancing never walks sideways along the enemy home row.)
  if (!state.domination && !state.prep?.movedThisTurn) {
    const grab = findCaptureMove(state, player);
    if (grab) return grab;
  }

  // 3. Advance one card toward the enemy Home if it looks survivable.
  if (!state.domination && !state.prep?.movedThisTurn) {
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
    // A step to the side can be the difference between standing there and
    // fighting — see findFlankingMove. AFTER the stall-breaker, and that order
    // is the whole reason the first two attempts at this failed the smoke
    // suite: with the flank tried first, two camped ranged lines each had an
    // idle card that could always find a better angle, so `standoff` never got
    // a turn, nobody ever advanced, and matches ran to the round cap. When the
    // WHOLE army is idle the answer is to close the distance; a sidestep is for
    // the card that is idle while the rest of the board is fighting.
    const flank = findFlankingMove(state, player);
    if (flank) return flank;
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
  const foes = enemyCards(state, player).filter((c) => c.curHp > 0);
  const mine = boardCards(state, player).filter((c) => c.curHp > 0);
  const affordable = book.filter((s) => p.magicPool >= getSpell(s.defId).cost);
  const of = (kind: string) => affordable.filter((s) => getSpell(s.defId).kind === kind);

  // 0. BATTLE COMMANDS (DAWN) -> an order to your own line. These have to come
  //    FIRST and be matched on the field rather than the kind, because a command
  //    borrows a kind for the tray's colour (Charge is "damage", Retreat is
  //    "heal") while carrying none of what those branches read: no `dmg`, no
  //    `allyHeal`, no ally target, no row. Every branch below skipped them, so
  //    all three were dead to the AI from the moment they shipped — the spell
  //    sat in the book for the whole match and was never cast once.
  for (const slot of affordable) {
    const spell = getSpell(slot.defId);
    const c = spell.command;
    if (!c) continue;
    let army = boardCards(state, player).filter((a) => a.curHp > 0 && a.pos);
    if (c.sameElement) army = army.filter((a) => getDef(a.defId).element === spell.element);
    if (army.length === 0) continue;
    // Same ordering the resolver uses — nearest the enemy first — so the AI
    // judges the order on the cards that will actually receive it.
    const mineHome = homeRow(player, state.boardSize);
    army = [...army].sort((a, b) => Math.abs(b.pos!.row - mineHome) - Math.abs(a.pos!.row - mineHome));
    const ordered = c.max != null ? army.slice(0, c.max) : army;
    // A capped command is now REFUSED without picks, so the AI names its own —
    // the same nearest-first pair it was already judging the order on. Without
    // this the check below starts failing and all three commands go dead to the
    // AI again, which is the exact bug the comment above this loop records.
    const cmdOpts = c.max != null ? { targetIds: ordered.map((a) => a.instanceId) } : {};

    if (c.strike) {
      // Worth the one-shot only when the order actually connects. Measured from
      // where each card will BE — a step forward is part of the command, so
      // judging from where it stands now would refuse a Charge whose whole
      // point is to close the distance first.
      const step = c.step ?? 0;
      const dir = player === "P1" ? -1 : 1;
      const connects = ordered.filter((a) => {
        const row = Math.max(0, Math.min(state.boardSize - 1, a.pos!.row + step * dir));
        const ghost: CardInstance = { ...a, pos: { ...a.pos!, row } as Pos };
        return enemyCards(state, player).some(
          (e) => e.curHp > 0 && canTarget(state, ghost, e),
        );
      }).length;
      if (connects >= 2 && canCastSpell(state, player, spell.id, cmdOpts).ok)
        return { type: "CAST_SPELL", player, spellId: spell.id, ...cmdOpts };
      continue;
    }

    if ((c.step ?? 0) < 0) {
      // Retreat: spend it to save a line that is about to break, not to shuffle
      // a healthy one. Two or more cards standing in lethal incoming damage.
      const dying = ordered.filter(
        (a) => threatAt(state, a, a.pos!) >= a.curHp + a.curShields * 2,
      ).length;
      if (dying >= 2 && canCastSpell(state, player, spell.id, cmdOpts).ok)
        return { type: "CAST_SPELL", player, spellId: spell.id, ...cmdOpts };
    }
  }

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
        // A mine on ground nothing can ever step on is a wasted one-shot, and a
        // citadel is empty enough to look like a fine square from here.
        if (domMap(state) && isImpassable(domMap(state)!, row, col)) continue;
        // The square the opponent is obliged to enter. On a standard board that
        // is an uncaptured Home slot — an invader has to stand there to capture,
        // and it is the one move it cannot decline. In Domination there is no
        // capture and no Home row that means anything; the compelled squares are
        // the Point rings, which is what `poiTraffic` scores.
        let score = state.domination
          ? poiTraffic(state, player, row, col)
          : row === home && !isCaptured(state, row, col) ? 6 : 0;
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
      const dm = domMap(state);
      let best: Pos | null = null;
      let bestRisk = doomed.risk;
      for (let r = 0; r < state.boardSize; r++)
        for (let c = 0; c < state.boardSize; c++) {
          if (cardAt(state, r, c) || isCaptured(state, r, c)) continue;
          // A citadel is empty and unreachable, so it scored like open ground
          // and could win this scan outright — at which point `canCastSpell`
          // refused the square below and the AI cast NOTHING. A wasted turn that
          // looked like a decision.
          if (dm && isImpassable(dm, r, c)) continue;
          const risk = threatAt(state, doomed.c, { row: r, col: c } as Pos) - (doomed.c.curHp + doomed.c.curShields * 2);
          // What the destination is WORTH, beyond being safe.
          //
          // On a standard board that is an enemy Home slot — the win condition
          // itself. In Domination it is a Point we do not hold (dropping a body
          // onto a ring contests it) and, for a card that is hurt, the Well:
          // this spell is cast on something about to die, and the Well is the
          // one square on the map that mends it.
          let worth = 0;
          if (state.domination && dm) {
            const poi = poiAt(dm, r, c);
            if (poi && state.domination.held[poi.id] !== player) worth -= 6;
            const hurt = doomed.c.curHp * 2 <= effectiveMaxHp(state, doomed.c);
            if (hurt && dm.well && dm.well.at.row === r && dm.well.at.col === c) worth -= 4;
          } else if (r === enemyHome) {
            worth -= 6; // treat a capture as worth taking
          }
          if (risk + worth < bestRisk) { bestRisk = risk + worth; best = { row: r, col: c } as Pos; }
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

  // 8. Convert -> Magic into Gold. Only when something in hand is
  //    unaffordable now and the conversion would actually unlock it.
  for (const slot of of("convert")) {
    const spell = getSpell(slot.defId);
    const cheapest = p.hand.reduce((m, h) => Math.min(m, getDef(h.defId).cost), Infinity);
    const gain = spell.gainGold ?? 0;
    const stuck =
      cheapest !== Infinity && p.gold < cheapest && p.gold + gain >= cheapest;
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

// ── DOMINATION ────────────────────────────────────────────────────────────
// The AI's whole plan is "walk at the enemy Home row and stand on it", because
// on every other board that IS the win condition. Domination has no Home row
// and no capture: it is won by holding three of four Points for three rounds.
// Pointed at a row that means nothing, the AI marched its army at one edge of
// the map and lost on a clock it never knew was running.
//
// So in that mode it plays a different game, and these are its rules.

/** The Points this side should be going for, best first.
 *
 *  A Point you do not hold is worth more than one you do — taking a fourth is
 *  how the match ends, and defending a Point nobody is contesting is a card
 *  standing still. Contested Points come next, because losing one you already
 *  hold costs the streak AND the income. */
function pointsWanted(state: GameState, player: PlayerId): PoiDef[] {
  const m = domMap(state);
  const dom = state.domination;
  if (!m || !dom) return [];
  const mine = (p: PoiDef) => dom.held[p.id] === player;
  const contested = (p: PoiDef) => poiRing(p).some((s) => {
    const occ = cardAt(state, s.row, s.col);
    return occ != null && occ.curHp > 0 && occ.owner !== player;
  });
  const notMine = m.pois.filter((p) => !mine(p));
  const underThreat = m.pois.filter((p) => mine(p) && contested(p));

  // EVERY SEAT WANTS SOMETHING DIFFERENT, or all of them walk at the same
  // square. One brain plays all the AI seats, so without this they shared one
  // preference order — the map's declaration order — and a four-player game was
  // three opponents queueing for Point A while the other three stood empty.
  //
  // Two axes, both derived from the seat's own index so they need no new state
  // and replay identically:
  //
  //   WHERE IT LIVES. Each seat is anchored to the shrine it comes in at, and
  //   the shrines sit one per edge — so seat order maps to a corner and the
  //   Points get sorted by distance from it. Four seats, four different first
  //   choices, and each one's plan starts where its reinforcements arrive.
  //
  //   WHAT IT WANTS. Alternate seats are EXPANDERS or HOLDERS. An expander goes
  //   for ground it does not have; a holder answers the fight on ground it does,
  //   and only then looks outward. Two temperaments is enough to stop a table
  //   playing in lockstep without inventing four scripted personalities.
  const seat = Math.max(0, seatsOf(state).indexOf(player));
  const anchor = m.shrines[seat % m.shrines.length];
  const near = (p: PoiDef) => anchor
    ? Math.max(Math.abs(p.centre.row - anchor.row), Math.abs(p.centre.col - anchor.col))
    : 0;
  // Distance alone is not enough to separate them. Each shrine is equidistant
  // from TWO Points — it sits on an edge, between them — so every seat tied,
  // every tie fell to declaration order, and the map's last Point was nobody's
  // first choice and went uncontested.
  //
  // So the seats CLAIM in order: each takes the nearest Point no earlier seat
  // has claimed. Greedy rather than optimal, and it does not need to be optimal
  // — it needs to be different, and on this map it hands out all four.
  const claimed = new Set<string>();
  let primary: PoiDef | undefined;
  const order = seatsOf(state);
  for (let i = 0; i < order.length; i++) {
    const a = m.shrines[i % m.shrines.length];
    const pick = [...m.pois]
      .filter((p) => !claimed.has(p.id))
      .sort((x, y) =>
        (Math.max(Math.abs(x.centre.row - a.row), Math.abs(x.centre.col - a.col))
          - Math.max(Math.abs(y.centre.row - a.row), Math.abs(y.centre.col - a.col)))
        || m.pois.indexOf(x) - m.pois.indexOf(y))[0];
    if (!pick) break;
    claimed.add(pick.id);
    if (i === seat) primary = pick;
  }
  const byHome = (a: PoiDef, b: PoiDef) =>
    (a.id === primary?.id ? -1 : 0) - (b.id === primary?.id ? -1 : 0) || near(a) - near(b);
  const holder = seat % 2 === 1;
  const want = holder
    ? [...underThreat.sort(byHome), ...notMine.sort(byHome)]
    : [...notMine.sort(byHome), ...underThreat.sort(byHome)];
  // Holding everything, uncontested: spread out rather than freeze. Standing
  // still is how a side that is ahead lets the clock take it back — and it
  // spreads from its OWN corner, so the seats still do not overlap.
  return want.length > 0 ? want : [...m.pois].sort(byHome);
}

/** Every square worth standing on: the rings of the Points worth having. */
export function pointGoals(state: GameState, player: PlayerId): Pos[] {
  const m = domMap(state);
  if (!m) return [];
  return pointsWanted(state, player)
    .flatMap((p) => poiRing(p))
    .filter((s) => !isImpassable(m, s.row, s.col)
      && s.row >= 0 && s.row < state.boardSize && s.col >= 0 && s.col < state.boardSize);
}

/** Is this card already doing its job — standing on a ring the side has not
 *  yet secured? Moving it off would hand the Point straight back, which is the
 *  same oscillation `isMidCapture` exists to prevent on a standard board. */
function holdingAPoint(state: GameState, card: CardInstance, player: PlayerId): boolean {
  const m = domMap(state);
  const dom = state.domination;
  if (!m || !dom || !card.pos) return false;
  const poi = poiAt(m, card.pos.row, card.pos.col);
  if (!poi) return false;
  // Standing on a Point that is not securely ours: stay. Standing on one we
  // hold uncontested is a card that may go and take another.
  if (dom.held[poi.id] !== player) return true;
  return poiRing(poi).some((s) => {
    const occ = cardAt(state, s.row, s.col);
    return occ != null && occ.curHp > 0 && occ.owner !== player;
  });
}

/** How badly the OPPOSITION wants to stand on this square, in Domination.
 *
 *  Both the trap and the reroute used to answer this with a Home row — "the
 *  square an invader is obliged to enter, because that is how it wins". On this
 *  map nobody is obliged to enter a Home row; it is ordinary ground and the win
 *  is elsewhere. The squares that are actually compelled are the Point RINGS:
 *  you cannot hold a Point without a body standing on one, so that is where the
 *  traffic is and where a mine is worth laying.
 *
 *  A ring we do NOT hold scores highest — that is ground they have to keep
 *  walking onto, either to take it or to keep it. A ring we DO hold scores less
 *  but not nothing, because they still have to come to us to break it. */
function poiTraffic(state: GameState, player: PlayerId, row: number, col: number): number {
  const m = domMap(state);
  const dom = state.domination;
  if (!m || !dom) return 0;
  if (isImpassable(m, row, col)) return 0;
  const poi = poiAt(m, row, col);
  if (!poi) return 0;
  return dom.held[poi.id] === player ? 3 : 6;
}

/** Step ONTO a Point. The Domination equivalent of the capture step: the square
 *  that wins the game is the square to be standing on. */
function findPointMove(state: GameState, player: PlayerId): Intent | null {
  const goals = pointGoals(state, player);
  if (goals.length === 0) return null;
  const movers = boardCards(state, player)
    .filter((c) => c.curHp > 0 && moveReachFor(state, c) > 0)
    .filter((c) => !holdingAPoint(state, c, player))
    .sort((a, b) => b.curHp + b.curShields * 2 - (a.curHp + a.curShields * 2));
  for (const mover of movers) {
    for (const to of goals) {
      if (!canMove(state, player, mover.instanceId, to).ok) continue;
      // Do not feed a body into a square that kills it for nothing — a corpse
      // holds no ground. Unless nothing can reach it, in which case it is free.
      const threat = threatAt(state, mover, to);
      if (threat === 0 || threat < mover.curHp + mover.curShields * 2)
        return { type: "MOVE", player, instanceId: mover.instanceId, to };
    }
  }
  return null;
}

/** A hurt card walks to the Well. It heals 2 a round for 3 rounds and keeps
 *  healing after the card leaves, so this is a detour that pays for itself —
 *  and the Well sits at the crossroads, which is on the way to everything. */
function findWellMove(state: GameState, player: PlayerId): Intent | null {
  const m = domMap(state);
  if (!m?.well) return null;
  const at = m.well.at;
  if (cardAt(state, at.row, at.col)) return null; // taken
  const hurt = boardCards(state, player)
    .filter((c) => c.curHp > 0 && moveReachFor(state, c) > 0)
    .filter((c) => (c.regenRoundsLeft ?? 0) === 0)
    .filter((c) => c.curHp * 2 <= effectiveMaxHp(state, c))   // at or under half
    .filter((c) => !holdingAPoint(state, c, player))
    .sort((a, b) => a.curHp / effectiveMaxHp(state, a) - b.curHp / effectiveMaxHp(state, b));
  for (const mover of hurt) {
    if (canMove(state, player, mover.instanceId, at as Pos).ok)
      return { type: "MOVE", player, instanceId: mover.instanceId, to: at as Pos };
  }
  return null;
}

/** Walk toward the Points when none is in reach this turn. Same BFS the
 *  standard board uses to close on a Home row, pointed at the right squares. */
function findPointApproach(state: GameState, player: PlayerId): Intent | null {
  const goals = pointGoals(state, player);
  if (goals.length === 0) return null;
  const distToGoal = (p: Pos) => bfsDistance(state, p, goals);
  const movers = boardCards(state, player)
    .filter((c) => c.curHp > 0 && moveReachFor(state, c) > 0)
    .filter((c) => !holdingAPoint(state, c, player))
    .sort((a, b) => distToGoal(a.pos!) - distToGoal(b.pos!));
  for (const mover of movers) {
    let best: Pos | null = null;
    let bestDist = distToGoal(mover.pos!);
    for (let row = 0; row < state.boardSize; row++)
      for (let col = 0; col < state.boardSize; col++) {
        const to = { row, col } as Pos;
        if (!canMove(state, player, mover.instanceId, to).ok) continue;
        const d = distToGoal(to);
        if (d < bestDist) { bestDist = d; best = to; }
      }
    if (best) return { type: "MOVE", player, instanceId: mover.instanceId, to: best };
  }
  return null;
}

/** The Domination move, in priority order. Returns null only when there is
 *  genuinely nothing worth doing, and the caller falls through to its own
 *  sidestep-or-pass. */
function findDominationMove(state: GameState, player: PlayerId): Intent | null {
  return findPointMove(state, player)
    ?? findWellMove(state, player)
    ?? findPointApproach(state, player);
}

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
 * SIDESTEP TO LINE UP A SHOT.
 *
 * `findAdvance` generates candidates from `d = reach; d >= 1`, so every move it
 * will ever consider makes at least one row of forward progress — a purely
 * LATERAL move is not in its candidate set at all. Sideways only ever happened
 * as a rider on going forward. Reported from real games as the AI not knowing
 * when to go left or right, only forward, and that is exactly what the loop
 * says.
 *
 * It matters because reach is not a circle: the Home-slot rule, the sight
 * screen down a lane, a body parked in the column and the melee/ranged reach
 * cap all mean the difference between "cannot touch anything" and "hits two
 * cards" is frequently one square to the side. A player makes that step
 * constantly. The AI could not make it at all.
 *
 * THE RULE THAT STOPS IT PACING: only a card that can currently hit NOTHING may
 * do this, and only onto a square from which it can hit something. Idle to
 * useful, once — not "useful to slightly more useful", which is a licence to
 * shuffle.
 *
 * That bound is measured, not cautious. The first cut let any card improve its
 * target count and the smoke suite immediately stopped finishing matches: with
 * the board changing every turn, targets(A) and targets(B) can each look like
 * an improvement on different rounds, so the strict-increase argument that
 * holds within one turn does not hold across them — and even where it did, the
 * AI spent its one move a turn edging sideways instead of advancing, and games
 * ran to the round cap. Restricted to cards with nothing to shoot at, it fires
 * rarely and only when the alternative is standing still.
 *
 * Tried AFTER `findAdvance`, so closing the distance still comes first — this
 * is what a card does when it cannot usefully move up and is standing one
 * square away from being able to fight at all.
 */
function findFlankingMove(state: GameState, player: PlayerId): Intent | null {
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  const movers = boardCards(state, player)
    .filter((c) => moveReachFor(state, c) > 0)
    // A card already standing on an enemy home slot is mid-capture; walking it
    // sideways for a better angle throws away the win condition for a swing.
    .filter((c) => !isMidCapture(state, c, enemyHome))
    // IDLE ONLY — see the note above. A card that can already fight should be
    // fighting, not improving its angle.
    .filter((c) => validTargets(state, c.instanceId).length === 0)
    // ONCE A ROUND PER CARD, and this is what makes the Prep phase terminate.
    //
    // Prep ends on two consecutive passes. A repeatable move means the AI never
    // passes, and the third attempt at this hung a smoke match in `prep` for
    // exactly that reason: one idle card kept finding a better angle, turn after
    // turn, and the phase had no way to close. Because every card may take at
    // most one of these a round, the supply is finite and the AI runs out and
    // passes — which is also the honest reading of the move: it is a
    // reposition, not a dance.
    .filter((c) => !c.movedThisRound);

  for (const mover of movers) {
    let best: Pos | null = null;
    let bestCount = 0;
    let bestThreat = Infinity;
    for (let row = 0; row < state.boardSize; row++)
      for (let col = 0; col < state.boardSize; col++) {
        const to = { row, col } as Pos;
        if (!canMove(state, player, mover.instanceId, to).ok) continue;
        // Count what it could hit from there. `validTargets` reads the card's
        // CURRENT position, so the count is taken on a ghost standing at `to` —
        // the same trick `threatAt` uses.
        const ghost = { ...state, cards: { ...state.cards,
          [mover.instanceId]: { ...mover, pos: to } } };
        const after = validTargets(ghost, mover.instanceId).length;
        if (after <= bestCount) continue;
        // Do not walk into a grave for one extra target.
        const threat = threatAt(state, mover, to);
        if (threat >= mover.curHp + mover.curShields * 2 && threat > 0) continue;
        // Ties on target count go to the safer square.
        if (after > bestCount || threat < bestThreat) {
          bestCount = after;
          bestThreat = threat;
          best = to;
        }
      }
    if (best) return { type: "MOVE", player, instanceId: mover.instanceId, to: best };
  }
  return null;
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
  for (const enemy of enemyCards(state, mover.owner)) {
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
  const homeRowMine = homeRow(player, state.boardSize);
  const me = state.players[player];
  const cheapestInHand = me.hand.reduce((m, h) => Math.min(m, getDef(h.defId).cost), Infinity);

  // TWO DIFFERENT QUESTIONS, and they used to share one flag.
  //
  // `wantIncome` — is a held home slot still worth anything? Yes while ANY card
  // remains in hand, however poor the pool is. This used to be the affordability
  // test below, which inverted the rule exactly when it mattered: at 0 gold with
  // a 3-cost cheapest card the reserve DISENGAGED, the last home card walked off
  // its own income, and 1/round + 1/slot became 1/round with six cards stranded
  // in hand. Reported from a real game — round 5, no gold, no magic, an empty
  // home row and one card on the board. A poor side needs the slot most; the
  // case the reserve is meant to release is an EMPTY hand, not an empty purse.
  //
  // `canBuySoon` — would an open home slot actually get used this turn or next?
  // That one does want affordability, because unjamming the summon zone while
  // nothing can be bought trades income away for a slot that stays empty.
  const wantIncome = me.hand.length > 0;
  const canBuySoon = cheapestInHand !== Infinity
    && cheapestInHand <= me.gold + HOME_RESERVE_LOOKAHEAD;

  // A card can only be summoned into an OPEN HOME SLOT, and the AI takes one
  // action a priority turn. So when the home row is full and there is something
  // affordable in hand, the single most valuable move on the board is whichever
  // one OPENS A SLOT — and the deepest-first sort below is precisely the wrong
  // order for that, because home-row cards sort LAST and never move.
  //
  // Reported from a real game: the AI on eleven gold and fifteen magic, hand
  // held, home row full, still walking its front line forward — with Eclipse
  // arriving around round 22, by which time the fight it was bought for is
  // over. Deployment stalls at about one card per two turns because half those
  // turns go to a move that unblocks nothing.
  const jammed = openHomeSlots(state, player).length === 0;
  const homeFirst = !desperate && canBuySoon && jammed;
  const movers = boardCards(state, player)
    .filter((c) => moveReachFor(state, c) > 0)
    .sort((a, b) => {
      if (desperate) return b.curHp + b.curShields * 2 - (a.curHp + a.curShields * 2);
      // Unjamming beats depth, but only BETWEEN a home-row card and one that is
      // not — among the home-row cards themselves the usual order still decides
      // which of them leaves.
      if (homeFirst) {
        const ah = a.pos!.row === homeRowMine ? 0 : 1;
        const bh = b.pos!.row === homeRowMine ? 0 : 1;
        if (ah !== bh) return ah - bh;
      }
      return (b.pos!.row - a.pos!.row) * forward;
    });

  // Income is 1 a round plus 1 per HOME SLOT held, so a card that walks off the
  // back line stops paying for itself. Measured before this guard, the AI held
  // 0.7 home slots on average and spent 31% of its turns with cards on the board
  // and NOTHING at home — advancing its whole army into midfield and then unable
  // to afford the rest of its hand.
  //
  // The reserve is only worth holding while there is something left to buy: gold
  // you cannot spend is not income, it is a hoard. So once the hand is empty (or
  // nothing in it is within reach of the pool) every card is free to advance,
  // which keeps the capture win — and the stall-breaker below — intact.
  const held = homeSlotsHeld(state, player);

  // NO "FALL BACK AND FARM" RULE HERE, and that is a measured decision rather
  // than an oversight. Income is 1/round + 1 per home slot held, and every
  // candidate below is FORWARD, so a side killed off its own home row cannot
  // walk back onto one — income is a ratchet. Adding a rule that did walk one
  // home whenever the AI held no slots and could not afford its cheapest card
  // made it CAMP: seed 3 and the 5x5 integration match went from ~100ms to
  // ~56s each, which is not slowness but matches running to MAX_ROUNDS and
  // being decided on time instead of won.
  //
  // That is the same failure the HOME_RESERVE comment above records from its
  // own tuning ("higher values measured worse: the AI camped, and camping is a
  // guaranteed non-win"). Advancing beats income here because every win
  // condition is forward, so the reserve — which stops departures — is the
  // right shape and a repatriation rule is not.

  for (const mover of movers) {
    // Hold the last slot back while there is still something to buy with it.
    // Anything above the reserve advances as before, and `desperate` ignores it
    // outright — a total standoff is a guaranteed loss and outranks income.
    if (
      !desperate && wantIncome &&
      mover.pos!.row === homeRowMine && held <= HOME_RESERVE
    ) continue;
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
    // Don't fire a self-damaging Special (Kraken's Black Wave Crash, or Skyrend's
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
    } else if (sp.handler === "empower" || sp.handler === "powerGauntlets") {
      // Self-buff (Heir's Crowned / Velvolt's gauntlets): strong standing value —
      // take it when there's no kill to secure this turn.
      if (!basicCanKill) return { action: "special" };
    } else if (sp.handler === "magneticShield") {
      // Team REFLECT utility — fire when flush and not busy securing a kill.
      if (!basicCanKill && rich) return { action: "special" };
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
    } else if (sp.handler === "bloodyWaters") {
      // Finisher on the weakest foe — take it when that foe is in kill range of
      // the strike (heal + re-Lurk payoff), or when flush with magic.
      if (specTargets.length > 0) {
        const prey = specTargets.reduce((b, t) => (t.curHp < b.curHp ? t : b), specTargets[0]);
        const dmg = Number(sp.params?.dmg ?? 4);
        if (prey && (willKill(prey, dmg, state.boardSize) || rich)) return { action: "special", targetId: prey.instanceId };
      }
    } else if (sp.handler === "igniter") {
      // Cheap DOT amplifier — fire whenever an opponent is carrying a DOT worth
      // doubling.
      const dots = ["BURN", "BLEED", "SCALD", "DOT"];
      const withDot = specTargets.find((t) => t.statuses.some((st) => dots.includes(st.kind)));
      if (withDot) return { action: "special", targetId: withDot.instanceId };
    } else if (sp.handler === "markTarget") {
      // Mark of Hoax: brand the meatiest survivor — the guaranteed-CRIT payoff
      // is biggest on a high-HP target. Take it when there's no kill to secure.
      if (specTargets.length > 0 && !basicCanKill) {
        const fat = specTargets.reduce((b, t) => (t.curHp > b.curHp ? t : b), specTargets[0]);
        if (fat && !fat.hoaxMarked) return { action: "special", targetId: fat.instanceId };
      }
    } else if (sp.handler === "grantShield") {
      if (sp.targetSide === "self") {
        // Roosting Wing Shield (Vulture): a self shield-up + heal. Take it when
        // not securing a kill and there's magic to spare.
        if (!basicCanKill && (rich || card.curHp < card.maxHp)) return { action: "special" };
      } else {
        const allies = validAllyTargets(state, instanceId).filter(
          (a) => a.instanceId !== instanceId,
        );
        const hurt = allies.find(
          (a) => a.curHp < a.maxHp / 2 || a.pos!.row === homeRow(enemyOf(card.owner), state.boardSize),
        );
        if (hurt) return { action: "special", targetId: hurt.instanceId };
      }
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
      // Self-targeted loaders (Woof's Heat Crunch) fire with no target; the
      // strike-on-cast variants (Flaming Slasher) aim at a foe.
      if (sp.targetSide === "self") {
        if (!basicCanKill) return { action: "special" };
      } else if (!basicCanKill && targets.length > 0) {
        return { action: "special", targetId: targets[0].instanceId };
      }
    } else if (sp.handler === "accelerate") {
      // Team SP buff — the payoff is board mobility next Prep, so it wants
      // allies on the board and nothing more urgent to do with the turn.
      const allies = boardCards(state, card.owner).filter((a) => a.curHp > 0);
      if (!basicCanKill && allies.length >= 2) return { action: "special" };
    } else {
      // ── THE FALLBACK, and it is the important branch ────────────────────
      //
      // Everything above is hand-tuned per handler, and a chain of named cases
      // is a list that goes stale the moment a handler is added. It already
      // had: an audit across the live roster found FORTY-ONE handlers with no
      // branch at all — some on cards, some on BOSSES (Umbranova's smite,
      // Permafrost's polarShift, and both Floor-5 bosses' Specials) — against
      // twenty-two the chain knew. Those cards basic-attacked all game and
      // their Specials were invisible to every balance run, which is the exact
      // failure this file's own comment records happening once before.
      //
      // So the last branch reads the Special's declared SHAPE rather than its
      // name — who it targets and what its params say it does — and decides on
      // that. A new handler is now fired by default and only needs a named case
      // when the generic read is wrong for it.
      const heals = Number(params.heal ?? params.amount ?? 0) > 0;
      const shields = Number(params.shields ?? 0) > 0;
      const damages = dmg > 0;
      const selfish = sp.targetSide === "self" || TARGETLESS_HANDLERS.has(sp.handler);

      // BOARD-WIDE handlers enumerate no targets — `specialTargets` returns
      // nothing for smite, which picks every living foe itself. Falling back to
      // the living enemies keeps those castable instead of silently unreachable.
      const reachable = specTargets.length > 0
        ? specTargets
        : enemyCards(state, card.owner).filter((t) => t.curHp > 0);

      if (damages && reachable.length > 0) {
        // Same policy the strike/barrage branch uses: take a kill whenever one
        // is on the table, otherwise spend spare magic on the biggest cluster.
        const kill = reachable.find((t) => willKill(t, estimateVolley(dmg, hits, pen, t), state.boardSize));
        if (kill) return { action: "special", targetId: specTargets.length ? kill.instanceId : undefined };
        if (rich || reachable.length >= 2)
          return { action: "special", targetId: specTargets.length ? specTargets[0].instanceId : undefined };
      } else if (heals || shields) {
        const hurt = validAllyTargets(state, instanceId).filter((a) => a.curHp < a.maxHp);
        if (hurt.length > 0 && !basicCanKill)
          return { action: "special", targetId: sp.targetSide === "self" ? undefined : hurt[0].instanceId };
        if (selfish && !basicCanKill && card.curHp < card.maxHp) return { action: "special" };
      } else if (selfish) {
        // Buffs, spawns, stances and anything that aims at nobody: it costs the
        // turn, so only when there is no kill to take and the pool can afford it.
        if (!basicCanKill && rich) return { action: "special" };
      } else if (reachable.length > 0) {
        // Control with no damage number — statuses, pulls, debuffs. Worth it on
        // a cluster, or on anything at all when the magic would otherwise rot.
        if (reachable.length >= 2 || (rich && !basicCanKill))
          return { action: "special", targetId: specTargets.length ? specTargets[0].instanceId : undefined };
      }
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
