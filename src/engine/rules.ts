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
  hasTotemSpirit,
  isCaptured,
  isContested,
  manhattan,
  effectiveSp,
  moveReachFor,
  movesLikeKing,
  SP_MID_MAX, enemyCards } from "./state";
import type {
  CardDef,
  CardInstance,
  GameState,
  PlayerId,
  Pos,
  SpellDef,
  StatusKind,
} from "./types";
import { OPENING_COST_CAP, bossHeldHome, enemyOf, homeRow } from "./types";
import { getSpell, spellPickKind } from "./spells";
import { hasElementAura } from "./auras";
import { dominationMap, isImpassable, isShrine, runsAlongRoad } from "../data/domination";

/** The map this match is played on, or undefined in every ordinary match.
 *  One lookup, so no rule below has to know how the mode is stored. */
export function domMap(state: GameState) {
  return state.domination ? dominationMap(state.domination.mapId) : undefined;
}

/** Nothing may STAND here — a Point's citadel, or the closed centre of the
 *  road cross. Cards may still pass over one; what they cannot do is stop. */
export function slotIsImpassable(state: GameState, row: number, col: number): boolean {
  const m = domMap(state);
  return !!m && isImpassable(m, row, col);
}

// ── prep phase ──────────────────────────────────────────────────────────────

export function canSummon(
  state: GameState,
  player: PlayerId,
  handId: string,
  col: number,
  row?: number,
): { ok: boolean; reason?: string } {
  if (state.phase !== "prep") return { ok: false, reason: "Not the Prep Phase" };
  if (state.prep?.priority !== player)
    return { ok: false, reason: "You don't have priority" };
  const hand = state.players[player].hand.find((h) => h.handId === handId);
  if (!hand) return { ok: false, reason: "Card not in hand" };
  const def = getDef(hand.defId);
  if (state.opening) {
    // Free placement: slots are the currency, not gold — but the card still has
    // to be something you could plausibly lead with.
    if ((state.opening[player] ?? 0) <= 0) return { ok: false, reason: "No deployment slots left" };
    if (def.cost > OPENING_COST_CAP)
      return { ok: false, reason: `Opening placement is cost ${OPENING_COST_CAP} or less` };
  } else if (def.cost > state.players[player].gold) {
    return { ok: false, reason: "Not enough Gold" };
  }
  // A NAMED SQUARE rather than a column landing on your own Home row: a shrine,
  // which anyone may use, or one of your own edge squares. Gold and the opening
  // cost cap above still apply — naming a square changes WHERE a summon may go,
  // not what it costs or whether you can afford it.
  //
  // Humans and the AI both come through here, which is the point: they were
  // briefly reading two different lists, and an AI restricted to shrines while
  // the player also had a Home row is an AI that appears to deploy in places
  // nobody else can.
  if (row !== undefined) return namedSquareBlocker(state, player, row, col);
  // ...and in Domination there IS no other way in. A column-addressed summon
  // means "my Home row, this column", and this mode has no Home row — refusing
  // it here is what stops the board's two end rows quietly behaving like one.
  if (domMap(state)) return { ok: false, reason: "Summon at a shrine" };
  const blocked = homeSlotBlocker(state, player, col);
  if (!blocked) return { ok: true };
  // The line falls back when the home row is gone entirely — see
  // `summonLandingRow`. Without this a side with a full hand and a full deck has
  // no legal move at all, which is a softlock rather than a defeat.
  if (summonLandingRow(state, player, col) !== null) return { ok: true };
  return { ok: false, reason: blocked };
}

/** The squares `player` may deploy onto.
 *
 *  `homeRow` answers this for a two-seat match and cannot answer it for more:
 *  it returns a ROW, and a square board has two of those to hand out. A third
 *  and fourth seat have to come in from the left and right EDGES, which is not
 *  a row number at all.
 *
 *  So Domination hands each seat a SHRINE instead — the map has exactly four,
 *  one per edge, in perfect rotational symmetry, which is what makes the map a
 *  four-player map in the first place. A seat's own shrine is its foothold; the
 *  other three stay neutral and anyone may still take them (see `shrineBlocker`),
 *  so a foothold is a starting point rather than a safe back line.
 *
 *  Everything that is not Domination still gets its Home row, unchanged. */
export function homeSlots(state: GameState, player: PlayerId): Pos[] {
  const n = state.boardSize;
  const m = domMap(state);
  if (!m) {
    const row = homeRow(player, n);
    return Array.from({ length: n }, (_, col) => ({ row, col }));
  }
  // DOMINATION HAS NO HOME ROW. Every seat deploys at the four SHRINES and
  // nowhere else, and all four are neutral — first there holds one.
  //
  // That is what lets a square board seat FOUR players: `homeRow` hands out
  // rows and there are only two of those, so a third and fourth seat had
  // nowhere of their own to come in. Shrines are squares, there are four, and
  // they sit one per edge in the map's own rotational symmetry — the map was
  // always shaped for this.
  //
  // It also removes the back line as a concept here, which is the point of an
  // objective mode: there is no safe row to build behind, only ground to hold.
  return m.shrines.map((sh) => ({ row: sh.row, col: sh.col }));
}

/** Every shrine on the map — neutral ground any seat may deploy onto. Empty on
 *  a board that has none, which is every board but Domination's. */
export function neutralDeploySlots(state: GameState): Pos[] {
  const m = domMap(state);
  return m ? m.shrines.map((sh) => ({ row: sh.row, col: sh.col })) : [];
}

/** Whether a shrine square will take a summon from EITHER side.
 *
 *  Deliberately owner-blind: the four shrines are neutral ground, so the only
 *  questions are whether the square is a shrine at all and whether anything is
 *  already standing on it. First there holds it — which is what makes the lanes
 *  between the Points worth contesting rather than just worth walking down. */
function namedSquareBlocker(
  state: GameState,
  player: PlayerId,
  row: number,
  col: number,
): { ok: boolean; reason?: string } {
  const m = domMap(state);
  if (!m) return { ok: false, reason: "This battlefield deploys by column" };
  if (row < 0 || row >= state.boardSize || col < 0 || col >= state.boardSize)
    return { ok: false, reason: "Off the board" };
  // Either a neutral shrine, or a square on this seat's own edge.
  const shrine = isShrine(m, row, col);
  const mine = homeSlots(state, player).some((s) => s.row === row && s.col === col);
  if (!shrine && !mine) return { ok: false, reason: "Not a shrine or your own edge" };
  if (isImpassable(m, row, col)) return { ok: false, reason: "Nothing can stand there" };
  if (cardAt(state, row, col)) return { ok: false, reason: shrine ? "Shrine is occupied" : "Slot is occupied" };
  if (isCaptured(state, row, col)) return { ok: false, reason: "Slot is permanently captured" };
  return { ok: true };
}

/** Why this Home-row column can't take a summon, or null if it can — the
 *  SLOT-side half of canSummon. Deliberately card-agnostic: Gold, the opening
 *  cost ceiling and the deployment allowance are the other half. */
function homeSlotBlocker(
  state: GameState,
  player: PlayerId,
  col: number,
): string | null {
  const row = homeRow(player, state.boardSize);
  if (col < 0 || col >= state.boardSize) return "Bad column";
  if (isCaptured(state, row, col)) return "Slot is permanently captured";
  if (isContested(state, player, col)) return "Slot is contested by an enemy card";
  if (cardAt(state, row, col)) return "Slot is occupied";
  return null;
}

/** WHERE a summon into `col` actually lands: the home row if that slot is free,
 *  otherwise the nearest open slot up that column — and ONLY when the player has
 *  no open home slot left at all. Null means there is nowhere.
 *
 *  THE SOFTLOCK THIS FIXES. Summoning is column-addressed with the row implied
 *  to be your home row, so a side whose home row is entirely occupied by enemies
 *  cannot play a card at all. In an ordinary match that state ends the game at
 *  once — holding every enemy home slot IS the capture win — so the lockout is
 *  never visible. Void Tower switches capture OFF, so it persists: measured, at
 *  the moment an overrun fired the player held 6.92 cards in hand and 23.79 in
 *  deck, with 0.00 open home slots and 0% of them playable. Thirty-one cards and
 *  no legal move for the rest of the fight.
 *
 *  So the line falls back rather than ceasing to exist. Reinforcements arrive at
 *  the nearest open square in the column you aimed at, which is FORWARD, toward
 *  the thing that took your back line — dangerous ground, deliberately. It is an
 *  escape hatch, not a free redeploy, and it only opens once the home row is
 *  completely gone. */
export function summonLandingRow(
  state: GameState,
  player: PlayerId,
  col: number,
): number | null {
  // Domination has no Home row to fall back FROM, and no lockout to escape: a
  // seat whose shrine is taken has three more, all neutral. Letting the fallback
  // run here would have walked its spawn deeper into the board every time its
  // end filled up — which is exactly what it looks like when an opponent
  // appears somewhere nothing should be able to deploy.
  if (domMap(state)) return null;
  const home = homeRow(player, state.boardSize);
  if (homeSlotBlocker(state, player, col) === null) return home;
  // Only when the row is wholly unavailable — otherwise use the open slot.
  if (openHomeSlots(state, player).length > 0) return null;
  // ...and only when it is blocked by things this side CANNOT clear. A home row
  // packed with your OWN cards is not a lockout: move one forward and the slot
  // is yours again, so the fallback stays shut and the ordinary tempo of the
  // game is untouched. Enemy bodies and captured slots are the ones you have no
  // answer to from the hand.
  const home2 = homeRow(player, state.boardSize);
  for (let c = 0; c < state.boardSize; c++) {
    const sitting = cardAt(state, home2, c);
    if (sitting && sitting.owner === player) return null;
  }
  const dir = player === "P1" ? -1 : 1; // away from home, into the board
  for (let row = home + dir; row >= 0 && row < state.boardSize; row += dir) {
    if (isCaptured(state, row, col)) continue;
    if (cardAt(state, row, col)) continue;
    return row;
  }
  return null;
}

/** Every Home-row column that could take a summon right now — the board's half
 *  of the answer, for the three callers that need it without naming a card. An
 *  empty result means NOTHING in hand is placeable, however much Gold is on the
 *  table, and the UI leans on that distinction: "can't afford it" and "nowhere
 *  to put it" are fixed by different actions. */
export function openHomeSlots(state: GameState, player: PlayerId): number[] {
  const out: number[] = [];
  for (let col = 0; col < state.boardSize; col++)
    if (homeSlotBlocker(state, player, col) === null) out.push(col);
  return out;
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
  if (!card.pos || !getDef(card.defId).keywords.TRAMPLE) return null;
  const dr = to.row - card.pos.row;
  const dc = to.col - card.pos.col;
  if (Math.max(Math.abs(dr), Math.abs(dc)) !== 1) return null; // one square only
  const victim = cardAt(state, to.row, to.col);
  if (!victim || victim.owner === card.owner) return null;
  // Braced Stance (pushImmune) holds here too. `pushBack` and `pull` both
  // refuse to move these cards, and a trample that shoved one anyway would be
  // the single push in the game that ignores "it doesn't budge" — most visibly
  // in a Stormhide Bison mirror, where the same card carries both.
  if (getDef(victim.defId).pushImmune) return null;
  // WEIGHT, unless the trampler is a falling rock. See `tramplesAnything`.
  if (!getDef(card.defId).tramplesAnything
      && effectiveMaxHp(state, victim) >= effectiveMaxHp(state, card)) return null;
  const open = (p: { row: number; col: number }) =>
    p.row >= 0 && p.row < state.boardSize && p.col >= 0 && p.col < state.boardSize
    && !state.slots[p.row][p.col].capturedBy && !cardAt(state, p.row, p.col);

  // STRAIGHT BACK FIRST — the shove proper, and still what happens whenever
  // there is room for it.
  const beyond = { row: to.row + dr, col: to.col + dc };
  if (open(beyond)) return { victim, dest: beyond as Pos };

  // KNOCKED ASIDE. When the square straight back is off the board, occupied or
  // captured, the victim is driven into any other free square that puts it
  // FURTHER from the trampler than it started.
  //
  // Why this exists: direction was never what stopped a sideways trample — the
  // room beyond was. Forward, "beyond" is deeper into the board and usually
  // empty; sideways it is the next column out, off the edge half the time on a
  // 4-wide board. Same rule, wildly different hit rate, which is why TRAMPLE
  // read as a forward-only charge when it never was one.
  //
  // ANY free square around the victim EXCEPT the one the trampler is vacating,
  // which is what keeps this a shove rather than a swap.
  //
  // "Strictly further from the trampler" was the first cut and it does not do
  // the job: the victim is already adjacent, so at a board edge every free
  // neighbour it has is the same distance away, and the exact lateral case this
  // was built for would still have failed. Preference, not requirement —
  // genuinely-further squares sort first, and a sideways nudge is the fallback.
  //
  // The cost, stated plainly: a victim now resists only when ALL its free
  // neighbours are gone, so TRAMPLE lands far more often for every carrier
  // (Burnout, Hoarfell, WarPhant, Bearocks, Oakgre, Stormhide Bison).
  //
  // Deterministic ordering, because a telegraph broken at random is a lie:
  // furthest from the trampler first, then lowest row, then lowest column. The
  // same tie rule as aimLateral and the spawn placements.
  const origin = card.pos;
  const cand = AROUND
    .map(([r, c]) => ({ row: to.row + r, col: to.col + c }))
    .filter((p) => open(p) && !(p.row === origin.row && p.col === origin.col))
    .sort((a, b) =>
      chebyshev(b as Pos, origin) - chebyshev(a as Pos, origin)
      || a.row - b.row || a.col - b.col);
  return cand.length ? { victim, dest: cand[0] as Pos } : null;
}

const AROUND: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

/** The enemy card standing in the way of a two-step move, or null.
 *
 *  Until this existed `canMove` only ever looked at the DESTINATION, so any
 *  card with reach 2 walked straight through an occupied square — bodies were
 *  something you moved around only because you could not stop on them, never
 *  something that stopped you. Now a body is a body: ANY summoned card holds
 *  its square against an enemy, because any card on the board is defending its
 *  own home whatever its class or keywords say.
 *
 *  WHO IS STOPPED. Anything at SP 10 or below. That is `SP_MID_MAX`, not a
 *  written 11 — it is the same line `movesLikeKing` already draws, so "quick
 *  enough to slip past a shield wall" and "quick enough to cut corners" are one
 *  speed tier rather than two thresholds that could drift apart.
 *
 *  FLYING GOES OVER, which is not an extra rule so much as the existing one:
 *  `applyWalls` already documents that "FLYING cards soar over walls entirely"
 *  and traps skip them for the same reason. A shield wall that grounded dragons
 *  would be the odd case here, not the exemption.
 *
 *  ONLY WHEN EVERY ROUTE IS SHUT. A two-step move usually has more than one
 *  path — an L-shaped pair of orthogonal steps has two, a king's pair has
 *  several — and blocking on the first shut square would stop moves that could
 *  plainly go round. So this walks the candidate middles, in the mover's OWN
 *  step geometry, and only reports a blocker when there is no clear one.
 *
 *  Allies never block: an ally in the way reads as a clear route, which is what
 *  it was before this function existed. The ask was to stop opponents. */
/** Does MASONRY stand in every route this move could take?
 *
 *  A citadel is a wall, so a card may not walk through one. This is the passage
 *  half of that; `rangedCanSee` is the sight half. Kept separate from
 *  `pathBlocker` because that one answers "which enemy CARD is in the way" and
 *  returns it for the refusal message — a wall is not a card and has nobody to
 *  name.
 *
 *  A two-step move has up to two one-step routes between its ends. It is only
 *  blocked when EVERY one of them runs through a wall: with a way round, there
 *  is a way round. FLYING goes over, like it does over a body.
 */
export function terrainBlocksPath(state: GameState, card: CardInstance, to: Pos): boolean {
  if (!card.pos) return false;
  const def = getDef(card.defId);
  if (def.keywords.FLYING) return false;
  const sp = effectiveSp(state, card);
  const step = movesLikeKing(def, card, sp) ? chebyshev : manhattan;
  if (step(card.pos, to) !== 2) return false;
  let routes = 0;
  let walled = 0;
  for (const [dr, dc] of AROUND) {
    const mid = { row: card.pos.row + dr, col: card.pos.col + dc } as Pos;
    if (mid.row < 0 || mid.row >= state.boardSize) continue;
    if (mid.col < 0 || mid.col >= state.boardSize) continue;
    if (step(card.pos, mid) !== 1 || step(mid, to) !== 1) continue;
    routes++;
    if (slotIsImpassable(state, mid.row, mid.col)) walled++;
  }
  return routes > 0 && walled === routes;
}

export function pathBlocker(
  state: GameState,
  card: CardInstance,
  to: Pos,
): CardInstance | null {
  if (!card.pos) return null;
  const def = getDef(card.defId);
  if (def.keywords.FLYING) return null;
  const sp = effectiveSp(state, card);
  if (sp > SP_MID_MAX) return null;
  const step = movesLikeKing(def, card, sp) ? chebyshev : manhattan;
  // Two steps is the only walk-through there is, because `moveReach` caps at 2.
  // A longer move can only be Rayfen's Wind Warp, which is a warp rather than a
  // walk — there is no square it passes through for a body to stand in.
  if (step(card.pos, to) !== 2) return null;
  // The eight surrounding squares, not a board scan. Any square one step away
  // is one of these under EITHER geometry (manhattan-1 is a subset of the
  // eight, chebyshev-1 is exactly the eight), so `step` still picks the right
  // four or eight and the answer is identical. It matters because this sits
  // inside `legalMoves`, which already calls `canMove` once per square: a scan
  // here made move generation O(n^4) per card in the AI's hot loop.
  let blocker: CardInstance | null = null;
  for (const [dr, dc] of AROUND) {
    const mid = { row: card.pos.row + dr, col: card.pos.col + dc } as Pos;
    if (mid.row < 0 || mid.row >= state.boardSize) continue;
    if (mid.col < 0 || mid.col >= state.boardSize) continue;
    if (step(card.pos, mid) !== 1 || step(mid, to) !== 1) continue;
    const occ = cardAt(state, mid.row, mid.col);
    if (!occ || occ.owner === card.owner) return null; // a way round exists
    blocker = occ;
  }
  return blocker;
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
  // A boss holds its home row for the opening — see BOSS_HOLD_ROUNDS. Sliding
  // ALONG the row is still fine; what it cannot do is leave it.
  if (bossHeldHome(state, getDef(card.defId))
      && to.row !== homeRow(card.owner, state.boardSize)) {
    return { ok: false, reason: "The boss has not moved from its home row yet" };
  }
  // EMPLACED — its gait is its whole movement. See `holdsPosition`.
  if (getDef(card.defId).holdsPosition)
    return { ok: false, reason: "This card holds its position" };
  const base = moveReachFor(state, card);
  if (base === 0) return { ok: false, reason: "This card can't move (SP 0)" };
  // ROADS: +1 while the move runs along the cross. Applied to the reach rather
  // than to the distance so a rooted card (reach 0, refused above) gets nothing
  // from standing on a lane — a road is a faster way to travel, not a way to
  // travel at all.
  const dm = domMap(state);
  const onRoad = !!dm && runsAlongRoad(dm, card.pos, to);
  const reach = base + (onRoad ? 1 : 0);
  if (to.row < 0 || to.row >= state.boardSize || to.col < 0 || to.col >= state.boardSize)
    return { ok: false, reason: "Off the board" };
  // FLYING, MOUNTED and FAST-tier cards move like a chess king — a diagonal step
  // costs 1, not 2. See movesLikeKing.
  const dist = movesLikeKing(getDef(card.defId), card, effectiveSp(state, card))
    ? chebyshev(card.pos, to)
    : manhattan(card.pos, to);
  if (dist === 0) return { ok: false, reason: "Already there" };
  // Wind Warp (Rayfen): the ONLY rule it skips is the distance one. Everything
  // below still applies to it, the home-to-home ban included.
  if (dist > reach && !getDef(card.defId).windWarp)
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
  // …and now the squares BETWEEN, which nothing used to look at. Checked after
  // the destination so "occupied" still wins when both are true — the shorter,
  // more obvious reason is the more useful one to show.
  const wall = pathBlocker(state, card, to);
  if (wall)
    return { ok: false, reason: `${getDef(wall.defId).name} holds the way — too slow to slip past` };
  // ...and the same question asked of the masonry: a citadel is a wall, and the
  // only way past one is around it.
  if (terrainBlocksPath(state, card, to))
    return { ok: false, reason: "The citadel wall is in the way" };
  // Captured slots are locked: cards may pass through, but can't stop on one.
  if (isCaptured(state, to.row, to.col))
    return { ok: false, reason: "Slot is permanently captured (locked)" };
  // ...and so is a citadel or the closed centre of the road cross.
  if (slotIsImpassable(state, to.row, to.col))
    return { ok: false, reason: "Nothing can stand there" };
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
 *   melee card can strike other fliers), OR the flier is grounded by a pinning
 *   status (ROOT/FREEZE/STUN/SLEEP/PARALYZE), so melee lands. STEALTH:
 *   untargetable until it attacks.
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
 * play — a Dart Frog on r1c3 could not shoot Rhyolite on r2c1 and had its whole
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
      const r = from.row + sr * i;
      const c = from.col + sc * i;
      // A CITADEL is cover. The four Points are fortifications with a solid
      // middle, and a shot that would pass straight through one is stopped by
      // it — so the squares behind a citadel are somewhere a card can actually
      // shelter, and taking a Point means fighting around its walls rather than
      // shooting across them. Unlike a body, it screens EVERYONE: it is masonry,
      // not a formation, so it does not care whose shot it is.
      if (slotIsImpassable(state, r, c)) return false;
      // Stop BEFORE the target: a body between blocks, the target itself doesn't.
      const between = cardAt(state, r, c);
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

/** Is `card` currently hidden by stealth — untargetable by an ordinary attack?
 *  The SINGLE source of truth, because three call sites read it and drifted:
 *  two ignored Magalogoon's move-break and hid it "all the time".
 *
 *  Three ways to be hidden, and Magalogoon's is deliberately NOT the keyword:
 *   - a granted STEALTH status (always hides);
 *   - the STEALTH keyword — hides until the card attacks this round
 *     (Frostveil, Obsidian);
 *   - Swamp Monster (Magalogoon) — a CONDITIONAL passive, hidden only while it
 *     has neither moved nor attacked this round. No standing keyword, so it is
 *     never "always" stealthed. */
export function isStealthed(def: CardDef, card: CardInstance): boolean {
  if (hasStatus(card, "STEALTH")) return true;
  if (def.keywords.STEALTH && !card.attackedThisRound) return true;
  if (def.stealthWhenIdle && !card.attackedThisRound && !card.movedThisRound) return true;
  return false;
}

/** Statuses that drag a FLYING card out of the air. It stays aloft by actively
 *  flying, so anything that pins or incapacitates it — rooted, frozen, stunned,
 *  asleep, or paralysed — drops it to the ground where melee can reach. Pure
 *  damage/vision debuffs (BLEED/BURN/WEAKEN/BLIND) leave it flying. */
const GROUNDING_STATUSES: StatusKind[] = ["ROOT", "FREEZE", "STUN", "SLEEP", "PARALYZE"];
export function isGrounded(card: CardInstance): boolean {
  return GROUNDING_STATUSES.some((s) => hasStatus(card, s));
}

export function canTarget(
  state: GameState,
  attacker: CardInstance,
  target: CardInstance,
  asRanged = false, // a ranged special ignores the melee reach/FLYING limits
  forBasic = false, // BASIC attacks only: applies the ranged queen-line limit
  /** Extra melee reach, in king-steps. A Special that CHARGES may aim as far as
   *  it can travel — see validSpecialTargets. Widens the melee square ONLY: a
   *  ground charger still cannot pull a flier out of the air, which is why this
   *  exists instead of just flagging those Specials `ranged`. */
  extraReach = 0,
  /** A SPECIAL that reaches into the enemy home row. The card-level
   *  `ignoresHomeRule` widens everything a card does, basics included; this is
   *  the same exemption scoped to one ability, declared as a param so the
   *  targeting layer reads it the way it already reads `reach` and
   *  `chargeFirst`. Snapmaw's Devour is the first: it may bite anything ROOTed
   *  anywhere, and having spent a root on the target is the price. */
  ignoreHomeRule = false,
  /** ANTI-AIR: this attack may pick a FLYING target that melee could not.
   *
   *  Deliberately NOT `ranged`, which is the other way to reach a flier and
   *  the wrong one here: `asRanged` skips the whole melee block, so it also
   *  throws away the Special's `reach` and turns a "within 2 spaces" burst into
   *  a board-wide nova. This lifts ONLY the FLYING dodge and leaves the radius
   *  exactly where the card printed it.
   *
   *  Why it exists: every melee Void Tower boss was unanswerable-proof against
   *  fliers, INCLUDING the five whose Specials apply a grounding status. They
   *  could not land ROOT on a flier because they could not target one in the
   *  first place — the status was the answer and the answer needed the status. */
  antiAir = false,
): boolean {
  if (!attacker.pos || !target.pos) return false;
  if (target.owner === attacker.owner) return false;
  const aDef = getDef(attacker.defId);
  const tDef = getDef(target.defId);

  // HOLD THE LINE: a standing gate screens the home square DIRECTLY BEHIND IT.
  // Checked FIRST, above every reach and sight rule, because it must not care
  // how the attacker gets there — a flier or a shooter reaching over the wall to
  // kill what it protects is the exact thing this exists to stop.
  //
  // Per COLUMN, because the wall is five gates wide (see `voidGateSeats`): the
  // whole line is screened while it stands, and every gate you break opens the
  // lane behind that one. That is the shape of the fight — pick a gate, commit
  // to it, and live with the hole you have made. A row-wide screen off a single
  // gate would instead switch the fight off wholesale; measured, it took
  // Permafrost from 77.1% to 27.1%, since a slow ranged boss then had nothing it
  // could legally touch anywhere.
  //
  // The gates sit IN FRONT of the home row (`voidGateSeats`), so they stay
  // targetable — which is the whole idea.
  if (target.pos.row === homeRow(target.owner, state.boardSize)
      && boardCards(state, target.owner).some(
        (c) => c.curHp > 0 && c.pos && getDef(c.defId).guardsHomeRow
          && c.pos.col === target.pos!.col))
    return false;

  // A pocketed ranged shot (Surge's Electro Surge) makes THIS basic a ranged
  // one: it drops the melee reach/FLYING limits and picks up the ranged reach
  // cap and sight screen instead, exactly like any other shooter. Scoped to
  // basics — the grant is an ATTACK, not a general upgrade, so it must not
  // quietly widen the card's Specials as well.
  const pocketShot = forBasic && (attacker.rangedShotsLeft ?? 0) > 0;
  const melee = aDef.attackType === "Melee" && !asRanged && !pocketShot;

  // STEALTH: untargetable — unless the attacker stands in its own Blazing Sun, or
  // a Totem stands on its side. Those are the two effects in the game that reveal
  // cloaked cards.
  if (
    isStealthed(tDef, target) &&
    !fieldFlag(state, attacker, "seeStealth") &&
    !hasTotemSpirit(state, attacker)
  )
    return false;
  // FLYING dodges melee — but a flying attacker can still strike other fliers,
  // and a flier pinned by a grounding status (rooted/frozen/stunned/asleep/
  // paralysed) is dragged out of the air, so melee connects on it too.
  // FLYING here is the keyword OR FireFly's granted temporary flight.
  const targetFlying = tDef.keywords.FLYING || (target.flyingRoundsLeft ?? 0) > 0;
  const attackerFlying = aDef.keywords.FLYING || (attacker.flyingRoundsLeft ?? 0) > 0;
  if (targetFlying && melee && !attackerFlying && !isGrounded(target) && !antiAir) return false;
  // Shadow (Squall): only adjacent attackers reach it — ranged shots from a row
  // or more away find nothing to hit.
  if (
    tDef.onlyAdjacentAttackers &&
    (Math.abs(attacker.pos.row - target.pos.row) > 1 || Math.abs(attacker.pos.col - target.pos.col) > 1)
  )
    return false;

  if (melee) {
    const dRow = Math.abs(attacker.pos.row - target.pos.row);
    const dCol = Math.abs(attacker.pos.col - target.pos.col);
    // A MELEE GIANT still has arms the length of the board. Floor 5's rule is
    // that its bosses reach all of it with a BASIC, and two of them are melee —
    // a rule that only reached ranged cards would be a rule about half the
    // floor. The sight screen still applies below, so a body in the lane still
    // stops the swing and the player's Fortress Gates are still cover.
    const reach = aDef.fullBoardBasic && forBasic ? state.boardSize : 1 + extraReach;
    // Beyond a king-step, a giant's swing is screened exactly as a shot is:
    // ordinary melee has no sight rule because it never reaches past the next
    // square, so the rule has to be stated here rather than inherited.
    if (aDef.fullBoardBasic && forBasic && Math.max(dRow, dCol) > 1
        && !rangedCanSee(state, attacker.pos, target.pos, attacker.owner, reach))
      return false;
    if (dRow > reach || dCol > reach) {
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
  } else if (forBasic && aDef.targetsOnSound) {
    // Echolocation (The Deepest): blind, aims by sound. A basic can only find a
    // target that is right beside it (king reach) or that MOVED this round —
    // footsteps it hears anywhere on the board. A stationary far enemy is silent.
    const dRow = Math.abs(attacker.pos.row - target.pos.row);
    const dCol = Math.abs(attacker.pos.col - target.pos.col);
    const kingClose = dRow <= 1 && dCol <= 1;
    if (!kingClose) {
      if (!target.movedThisRound) return false;
      // It hears the movement anywhere, but the shot still can't pass through a
      // screen of enemy bodies — sound reaches, a projectile doesn't.
      if (!rangedCanSee(state, attacker.pos, target.pos, attacker.owner, state.boardSize)) return false;
    }
  } else if (forBasic && !aDef.ignoresHomeRule) {
    // Ranged BASIC: king-step reach, blocked by enemy bodies on a straight line.
    // Reach is 2 from the summoning row and 3 once advanced off it — see
    // rangedReachFor. Specials are deliberately exempt and keep their full-board
    // reach, so the AoE specials tuned in the balance pass are untouched.
    // Catapult (Pumpkin's ignoresHomeRule) is ALSO exempt — it lobs over the
    // whole battlefield, so it skips both this reach cap and the sight screen,
    // the same as a ranged Special. Without this the reach cap (added after
    // Catapult shipped) quietly grounded it, worst on the bigger board.
    //
    // HOME DEFENCE. A ranged card standing in its OWN home row sees the whole
    // of that row. Reach 2 meant a shooter holding the back line could not
    // answer an invader more than two columns away — on a 5x5 board a defender
    // at column 0 simply could not shoot something standing on its own home row
    // at column 4, which is the one place a defender most needs to reach. The
    // card was in position, facing the right way, and the rule said no.
    //
    // Scoped as narrowly as the problem: the attacker must be home, the target
    // must be in that same row, and it only widens the REACH. The sight screen
    // still applies, so a nearer invader in the lane still blocks the shot at a
    // farther one — you deal with what is in front of you first. King of the
    // Hill is untouched everywhere else: holding the back line still costs you
    // the +1 reach in every other direction, so this buys defence, not board
    // control.
    const ownHome = homeRow(attacker.owner, state.boardSize);
    const defendingOwnHome = attacker.pos.row === ownHome && target.pos.row === ownHome;
    // A GIANT sees the whole board — the same widening home defence performs,
    // and deliberately only the widening: the sight screen below still applies,
    // so the Fortress Gates a Void Tower player is given for free are still
    // cover on the one floor where every boss outranges them.
    const reach = aDef.fullBoardBasic || defendingOwnHome
      ? state.boardSize
      : rangedReachFor(state, attacker);
    if (!rangedCanSee(state, attacker.pos, target.pos, attacker.owner, reach)) return false;
  }

  const defenderHome = homeRow(target.owner, state.boardSize);
  if (
    target.pos.row === defenderHome &&
    defenderHome === homeRow(enemyOf(attacker.owner), state.boardSize) &&
    !aDef.ignoresHomeRule && // Catapult-style passives skip this rule
    !ignoreHomeRule &&        // …and a Special may claim the same exemption alone
    // Totem Spirit sees the invasion row from anywhere — the "hit through
    // invasion blind" half of the aura. Without it a card sitting in its own home
    // row cannot touch the enemy home row at all, however good its aim.
    !hasTotemSpirit(state, attacker)
  ) {
    // "Mid" means ANY row between the two home rows, derived from the board
    // rather than hardcoded. It used to read `ar === 1 || ar === 2`, which is
    // every mid row on a 4x4 and only SOME of them on a 5x5 — leaving row 3 a
    // safe zone that P1 alone benefited from, since row 3 is adjacent to P1's
    // home row and nowhere near P2's. An enemy could stand directly in front of
    // your back line and be told it had no valid action.
    //
    // Stated positively, the rule is simply: you cannot reach across the whole
    // board into the enemy home row from inside your own. Once you have left
    // home you are close enough, wherever you are.
    //
    // NOTE this is NOT `isMidRow`, which stays rows 1-2 at both sizes on
    // purpose (see its comment) because widening it would re-tune every King of
    // the Hill bonus at once. Same words, two different questions.
    if (attacker.pos.row === homeRow(attacker.owner, state.boardSize)) return false;
  }
  return true;
}

/** Enemy cards `attacker` can currently hit with a basic attack / enemy-targeted special. */
export function validTargets(
  state: GameState,
  attackerId: string,
  forBasic = true,
  /** Extra melee reach, in king-steps — see canTarget. The on-summon path uses
   *  it for an ability that CHARGES before it strikes: without it the target
   *  list is measured from where the card landed, which for a Melee card is its
   *  own home row, so the charge had nothing to run at. */
  extraReach = 0,
): CardInstance[] {
  const attacker = state.cards[attackerId];
  if (!attacker || !attacker.pos) return [];
  // forBasic defaults TRUE: this is the basic-attack target list (UI, AI, the
  // battle resolver). On-summon abilities borrow it for "everything in normal
  // range" and pass false — they are not basics and keep the old full reach,
  // same exemption the Specials get.
  const enemies = enemyCards(state, attacker.owner).filter((t) =>
    canTarget(state, attacker, t, false, forBasic, extraReach),
  );
  // Morning Dew (Vernal): a healer aims its basic at hurt friends too. Only
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
  const special = getDef(attacker.defId).special;
  const asRanged = Boolean(special?.ranged);
  // A Special that charges BEFORE it strikes may aim as far as it can travel.
  // Without this, a Melee charger could only ever pick a target already standing
  // beside it — and chargeToward stops the moment it is adjacent to a living
  // target, so the charge moved exactly zero every time. Stormfang's "Dash into
  // the target's row", Omega's "Move up to 3 spaces", Volcanic Charge and Razor
  // Guard all printed a move that could not happen.
  //
  // Measured in king-steps, the same metric the melee square uses. A ground
  // card walks orthogonally, so a diagonal target at the edge of this range can
  // cost more steps than the charge has and the strike still lands from a step
  // short — generous by at most that step, and far closer to the printed text
  // than refusing the Special outright.
  const chargeReach =
    Number(special?.params?.chargeFirst ?? 0) > 0 ? Number(special?.params?.charge ?? 0) : 0;
  // `reach` is a Special declaring its own melee square, in king-steps. Kraken's
  // Black Wave Crash says "all opponents" and means it — a wave 2 slots deep all
  // round — where a Melee card's default one step let it hit only what was
  // literally touching it. 1 is the ordinary melee square, so reach−1 is the
  // widening. Takes the larger of the two: a Special could both charge and sweep.
  const ownReach = Math.max(0, Number(special?.params?.reach ?? 1) - 1);
  const ignoreHome = Number(special?.params?.ignoreHomeRule ?? 0) > 0;
  const antiAir = Number(special?.params?.antiAir ?? 0) > 0;
  return enemyCards(state, attacker.owner).filter((t) =>
    canTarget(state, attacker, t, asRanged, false, Math.max(chargeReach, ownReach), ignoreHome, antiAir),
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
  for (const enemy of enemyCards(state, card.owner)) {
    const dRow = (enemy.pos!.row - card.pos.row) * dir; // forward distance
    const dCol = Math.abs(enemy.pos!.col - card.pos.col);
    if (dRow < 1 || dRow > maxDepth || dCol > spread) continue;
    const eDef = getDef(enemy.defId);
    if (depth != null) {
      // A deep, committed corridor blast reaches past melee range and the Home
      // Slot rule — only STEALTH keeps a card out of it.
      if (isStealthed(eDef, enemy)) continue;
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
  for (const t of enemyCards(state, owner)) {
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
  const p = special.params ?? {};
  /** A Special whose work is done by OTHER cards is not bound by the caster's
   *  reach — the SWARM does the reaching.
   *
   *  Silk Chase says "every allied Spider attacks", and was gated on what
   *  SARACHNID could touch: stand her one square too far back with her spiders
   *  already on top of somebody and the ability was refused, her turn skipped,
   *  and the board full of allies who could all have swung. The rule now asks
   *  the actual actors. Caster included — she attacks in her own swarm.
   *
   *  Keyed on the `tribe` param, which is exactly the set the handler iterates,
   *  so this cannot widen a Special the swarm does not carry out. */
  if (typeof p.tribe === "string" && p.tribe) {
    const tribe = p.tribe;
    const swarm = boardCards(state, card.owner).filter(
      (a) => a.curHp > 0 && a.pos
        && (a.instanceId === card.instanceId || getDef(a.defId).tribe === tribe),
    );
    const seen = new Set<string>();
    const out: CardInstance[] = [];
    for (const a of swarm)
      for (const t of enemyCards(state, card.owner))
        if (t.curHp > 0 && !seen.has(t.instanceId)
            && canTarget(state, a, t, getDef(a.defId).attackType === "Ranged", true)) {
          seen.add(t.instanceId);
          out.push(t);
        }
    return out;
  }
  const fd = Number(p.forwardDepth ?? 0);
  let list =
    fd > 0
      ? forwardAreaTargets(state, card, Number(p.spread ?? 0), fd)
      : validSpecialTargets(state, instanceId);
  // Mirror the barrage handler's own target filters, so the preview shows EXACTLY
  // what the volley will hit — not everything the card can see. Without these the
  // damage-area highlight over-reports (a row-ahead sweep lit up the whole board).
  if (Number(p.enemyHomeRow ?? 0) > 0)
    list = list.filter((t) => t.pos?.row === homeRow(enemyOf(card.owner), state.boardSize));
  if (Number(p.sameColumn ?? 0) > 0 && card.pos)
    list = list.filter((t) => t.pos?.col === card.pos!.col);
  if (Number(p.rowAhead ?? 0) > 0 && card.pos) {
    const ahead = card.pos.row + (card.owner === "P1" ? -1 : 1);
    list = list.filter((t) => t.pos?.row === ahead);
  }
  if (typeof p.requireStatus === "string" && p.requireStatus)
    list = list.filter((t) => hasStatus(t, p.requireStatus as StatusKind));
  // Extinguisher (Squall): a finisher — only aimable at foes below the HP line.
  const belowHp = Number(p.requireBelowHp ?? 0);
  if (belowHp > 0) list = list.filter((t) => t.curHp < belowHp);
  // closest N (Highroller): the volley auto-picks the nearest few — preview just those.
  if (Number(p.closest ?? 0) > 0 && card.pos) {
    list = [...list].sort((a, b) => manhattan(card.pos!, a.pos!) - manhattan(card.pos!, b.pos!))
      .slice(0, Number(p.targets ?? 1));
  }
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
  // The on-hit element auras, INCLUDING a borrowed one — a SirCrest debuffed to
  // 0 DMG still sets what it touches alight, so its basic is not inert.
  if (hasElementAura(def, "PYRO") || hasElementAura(def, "BOLT")) return false;
  if (def.onHitStatus || def.vsStatus || def.onHitZap || def.onHitSelfBuff) return false;
  // NB: Hillside (onAllyHitShield) is deliberately NOT listed — it reacts to
  // allies being hit, so it gives a 0-DMG basic no reason to swing.
  if (def.healPerHit || def.healPerCrit || def.critStatus) return false;
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
  // System Override: this round only, and NOT element-gated — it discounts
  // every Special the caster fires, which is the whole point of the spell.
  const roundWide = state.players[card.owner].specialDiscountRound ?? 0;
  const total = permBolt + roundWide + fieldBonus(state, card, "specialDiscount");
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
  // Diagnosis / Red Shift / Magic Ropes: this card's Specials are locked out.
  if ((card.specialLockedRounds ?? 0) > 0) return { ok: false, reason: "Specials locked (quarantined)" };
  // Summon-turn lockout: a card just summoned may basic-attack but not fire its
  // Special. Elemental Fury (Prism) is the one exception — it "arrives with its
  // Special already charged", so the FREE first cast is usable the moment it
  // lands. Only that charge bypasses; once spent (freeSpecial cleared) Prism is
  // locked out like anything else. Volcanon's on-kill freeSpecial does NOT open
  // this door — the gate is startsWithFreeSpecial, not freeSpecial alone.
  if (card.summonedThisRound && !(def.startsWithFreeSpecial && card.freeSpecial))
    return { ok: false, reason: "Summon-turn lockout (basic attack only)" };
  // Talent Special: free + once per game (shares the talentUsed flag).
  if (def.special.talent && card.talentUsed)
    return { ok: false, reason: "Talent already used this game" };
  // A free Special (Volcanon's On-Kill recast) ignores cooldown + magic cost.
  if (!card.freeSpecial && !def.special.talent && card.specialCooldown > 0)
    return { ok: false, reason: `Special is recharging (${card.specialCooldown} more round${card.specialCooldown === 1 ? "" : "s"})` };
  // THE BOSS CLOCK owns this Special outright. Without this the AI would also
  // cast it whenever it could afford the magic, and a threat that lands on a
  // countable beat AND at unpredictable extra moments is not a countable beat —
  // every Void Tower puzzle is built on the player being able to plan around it.
  if (getDef(card.defId).roundTick?.fireSpecialEveryN)
    return { ok: false, reason: "Fires on its own clock" };
  if (hasStatus(card, "MUTED")) return { ok: false, reason: "MUTED" };
  if (isActionBlocked(card)) return { ok: false, reason: "Status prevents acting" };
  if (!card.freeSpecial && !def.special.talent && state.players[card.owner].magicPool < effectiveSpecialCost(state, card, def.special.cost))
    return { ok: false, reason: "Not enough magic" };
  // A Special charged in HP is refused when the cost would be lethal — UNLESS it
  // opts into `selfHpLethal`. RIP's Horde does: going out to leave two more
  // bodies standing is a real closing play for a 0-DMG card whose entire
  // contribution IS bodies. The Deepest's does not — a 10-cost mythic deleting
  // itself is a misclick, not a play. (The auto-fire never routes through here.)
  // A permanent, stacking buff can opt into a lifetime cast limit. Without it
  // Oakgre parked out of reach grows +2 DMG / +3 SP every round for the rest of
  // the game, which is not a boss so much as a runaway.
  const maxStacks = Number(def.special.params?.maxStacks ?? 0);
  if (maxStacks > 0 && card.specialCasts >= maxStacks)
    return { ok: false, reason: `${def.special.name} is fully grown` };
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

/** The Home Slot rule for Spells: a caster reaches their own Home + every row
 *  between the homes freely, but to touch the ENEMY Home row they must already
 *  hold a card somewhere past their own home row. */
function spellReachesEnemyHome(state: GameState, player: PlayerId): boolean {
  const ownHome = homeRow(player, state.boardSize);
  // "Has a card past its own home row" — the same board-derived reading the
  // basic-attack rule uses, and for the same reason: `isMidRow` is rows 1-2 at
  // both sizes, so on a 5x5 a beachhead in row 3 used to count for nothing even
  // though it is the row ADJACENT to the enemy home. The proxy is meant to ask
  // "did you commit anything forward?", not "did you land on one of two rows".
  // The enemy home row is itself past your own, so it needs no separate clause.
  return boardCards(state, player).some((c) => c.pos != null && c.pos.row !== ownHome);
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
  if (isStealthed(tDef, target)) return false;
  const enemyHome = homeRow(enemyOf(player), state.boardSize);
  if (target.pos.row === enemyHome && !spellReachesEnemyHome(state, player)) return false;
  return true;
}

/** Enemy cards a given damage Spell may target this Prep. */
export function spellEnemyTargets(state: GameState, player: PlayerId): CardInstance[] {
  return enemyCards(state, player).filter((t) => canSpellHitEnemy(state, player, t));
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
/** The living cards a caster may aim an "ally"-pick spell at: their own side,
 *  of the spell's element. The element lock is part of what the spell costs —
 *  a LEAF ward mends LEAF — so widening it here would be a balance change
 *  rather than a UI one.
 *
 *  Single source of truth for which cards glow, which clicks are accepted, and
 *  which the AI chooses between. */
export function spellAllyTargets(
  state: GameState,
  player: PlayerId,
  spell: SpellDef,
): CardInstance[] {
  return boardCards(state, player).filter(
    (c) => c.curHp > 0 && getDef(c.defId).element === spell.element,
  );
}

/** The living cards a BATTLE COMMAND may be given to: the caster's own side,
 *  element-gated when the order is (all three DAWN commands are).
 *
 *  Same reason spellAllyTargets exists — which cards glow, which clicks are
 *  accepted, which the AI picks between and which the resolver actually orders
 *  are four answers that have to be one answer. The resolver used to build this
 *  list itself, so anything that widened it in the UI would have silently
 *  disagreed with what the reducer did. */
export function spellCommandTargets(
  state: GameState,
  player: PlayerId,
  spell: SpellDef,
): CardInstance[] {
  const c = spell.command;
  if (!c) return [];
  const army = boardCards(state, player).filter((a) => a.curHp > 0 && a.pos);
  return c.sameElement
    ? army.filter((a) => getDef(a.defId).element === spell.element)
    : army;
}

/** Who receives a command when nobody named them: nearest the enemy first,
 *  capped. The AI's pick and the reducer's fallback are the same order, so an
 *  unpicked cast resolves exactly as it always did. */
export function defaultCommandPicks(
  state: GameState,
  player: PlayerId,
  spell: SpellDef,
): CardInstance[] {
  const home = homeRow(player, state.boardSize);
  const army = [...spellCommandTargets(state, player, spell)].sort(
    (a, b) => Math.abs(b.pos!.row - home) - Math.abs(a.pos!.row - home),
  );
  const max = spell.command?.max;
  return max != null ? army.slice(0, max) : army;
}

export function canCastSpell(
  state: GameState,
  player: PlayerId,
  spellId: string,
  opts: {
    targetId?: string;
    row?: number;
    col?: number;
    mode?: "attack" | "shield";
    targetIds?: string[];
    slots?: Pos[];
  } = {},
): { ok: boolean; reason?: string } {
  if (state.phase !== "prep") return { ok: false, reason: "Not the Prep Phase" };
  if (state.prep?.priority !== player) return { ok: false, reason: "You don't have priority" };
  const p = state.players[player];
  // A book may hold MORE THAN ONE copy of a cheap spell, so the question is not
  // "is that spell spent" but "is there a copy of it left". Finding the first
  // slot by id and reading its `used` retired the second copy the moment the
  // first was cast — the copies were in the book and could never be reached.
  const copies = p.spellbook.filter((s) => s.defId === spellId);
  if (copies.length === 0) return { ok: false, reason: "Not in your spellbook" };
  if (copies.every((s) => s.used)) return { ok: false, reason: "Already cast this game" };
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
  if (spell.swapAllies) {
    // Exactly two of the caster's OWN cards, both on the board. Nothing else to
    // check: the two are trading squares, so neither destination can be blocked.
    const ids = opts.targetIds ?? [];
    if (ids.length !== 2) return { ok: false, reason: "Pick two of your cards" };
    if (ids[0] === ids[1]) return { ok: false, reason: "Pick two DIFFERENT cards" };
    for (const id of ids) {
      const c = state.cards[id];
      if (!c || !c.pos) return { ok: false, reason: "No such card" };
      if (c.owner !== player) return { ok: false, reason: "Not your card" };
    }
    if (boardCards(state, player).length < 2) return { ok: false, reason: "Not enough cards on the board" };
    return { ok: true };
  }
  if (spell.rerouteCount) {
    // Up to N of the caster's cards, each with a destination. Destinations must
    // be open and uncaptured, and distinct from each other — this bypasses the
    // SP movement tier, not the rules about where a card may stand.
    const ids = opts.targetIds ?? [];
    const slots = opts.slots ?? [];
    if (ids.length === 0) return { ok: false, reason: "Pick a card to move" };
    if (ids.length > spell.rerouteCount) return { ok: false, reason: `At most ${spell.rerouteCount} cards` };
    if (slots.length !== ids.length) return { ok: false, reason: "Every card needs a destination" };
    for (let i = 0; i < ids.length; i++) {
      const c = state.cards[ids[i]];
      if (!c || !c.pos || c.owner !== player) return { ok: false, reason: "Not your card" };
      const to = slots[i];
      if (to.row < 0 || to.row >= state.boardSize || to.col < 0 || to.col >= state.boardSize)
        return { ok: false, reason: "Off the board" };
      if (isCaptured(state, to.row, to.col)) return { ok: false, reason: "That slot is captured" };
      // The slot must be empty, OR held by one of the cards being moved out of
      // it in this same cast — a formation can rotate through its own squares.
      const occ = cardAt(state, to.row, to.col);
      if (occ && !ids.includes(occ.instanceId)) return { ok: false, reason: "That slot is occupied" };
      if (slots.some((o, j) => j !== i && o.row === to.row && o.col === to.col))
        return { ok: false, reason: "Two cards can't share a slot" };
    }
    return { ok: true };
  }
  if (spell.kind === "trap") {
    // One EMPTY, uncaptured square, and never one that already holds a trap.
    // Anywhere on the board is fair: the point of a mine is that the opponent
    // chooses to walk onto it, so range is not the constraint — their movement is.
    if (opts.row == null || opts.col == null) return { ok: false, reason: "Pick a slot" };
    if (opts.row < 0 || opts.row >= state.boardSize || opts.col < 0 || opts.col >= state.boardSize)
      return { ok: false, reason: "Off the board" };
    if (cardAt(state, opts.row, opts.col)) return { ok: false, reason: "That slot is occupied" };
    if (isCaptured(state, opts.row, opts.col)) return { ok: false, reason: "That slot is captured" };
    if (state.traps.some((t) => t.pos.row === opts.row && t.pos.col === opts.col))
      return { ok: false, reason: "Already trapped" };
    return { ok: true };
  }
  if (spell.kind === "field") {
    // Board-wide, no target. One CAST Field per owner at a time — standing
    // terrain does not count, or seeding it would have silently made every
    // Field spell in the game uncastable for the whole of Story Mode.
    if (state.fields.some((f) => f.owner === player && !f.permanent))
      return { ok: false, reason: "You already have a Field active" };
    if (state.fields.some((f) => f.permanent && f.spellId === spell.id))
      return { ok: false, reason: "That Field is already the terrain here" };
    return { ok: true };
  }
  // BATTLE COMMANDS: an order to your OWN line, so there is nothing to aim at.
  // Placed ahead of the kind checks because a command borrows a kind for its
  // tray colour ("damage" for Charge) and would otherwise be refused for want of
  // a target it never uses.
  if (spell.command) {
    const army = spellCommandTargets(state, player, spell);
    if (army.length === 0) return { ok: false, reason: `No ${spell.element} card to command` };
    const max = spell.command.max;
    // Uncapped: a general order, every kin obeys, nothing to name.
    if (max == null) return { ok: true };
    // Capped: the caster names who carries it out. REQUIRED, not optional —
    // "this spell needs a pick" and "this spell is refused without one" have to
    // be the same statement or the tray fires it into whatever the engine felt
    // like choosing, which is the auto-pick this replaces.
    const ids = opts.targetIds;
    if (!ids || ids.length === 0) return { ok: false, reason: "Pick who carries out the order" };
    if (ids.length > max) return { ok: false, reason: `Only ${max} can be ordered` };
    if (new Set(ids).size !== ids.length) return { ok: false, reason: "Pick different cards" };
    if (!ids.every((id) => army.some((a) => a.instanceId === id)))
      return { ok: false, reason: `Pick your own ${spell.element} cards` };
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
    // Shield mode → an element ally; attack mode → an enemy target.
    if (opts.mode === "shield") {
      const allies = spellAllyTargets(state, player, spell);
      if (allies.length === 0) return { ok: false, reason: `No ${spell.element} ally to shield` };
      return allyPick(allies, opts.targetId);
    }
    if (!opts.targetId) return { ok: false, reason: "Pick a target" };
    const target = state.cards[opts.targetId];
    if (!target || !canSpellHitEnemy(state, player, target))
      return { ok: false, reason: "Illegal target" };
    return { ok: true };
  }
  // heal / support. `allAllies` bolsters the whole element and has nothing to
  // aim; the single-target ones are AIMED by the caster.
  const allies = spellAllyTargets(state, player, spell);
  if (allies.length === 0) return { ok: false, reason: `No ${spell.element} ally to heal` };
  if (spellPickKind(spell) !== "ally") return { ok: true };
  return allyPick(allies, opts.targetId);
}

/** Shared tail for the ally-aimed spells. The target is REQUIRED: "this spell
 *  needs a pick" and "this spell is refused without one" have to be the same
 *  statement, or the tray fires it into whatever the engine felt like choosing —
 *  which is the auto-cast this replaced. */
function allyPick(allies: CardInstance[], targetId?: string): { ok: boolean; reason?: string } {
  if (!targetId) return { ok: false, reason: "Pick an ally" };
  if (!allies.some((c) => c.instanceId === targetId))
    return { ok: false, reason: "Pick one of your own matching allies" };
  return { ok: true };
}
