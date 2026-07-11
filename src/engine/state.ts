// Game state construction + shared query helpers. Pure — reducers clone the
// incoming state once (structuredClone) and mutate only the clone.

import { getDef, DECK_P1, DECK_P2 } from "../data/cards";
import { coin, shuffle } from "./rng";
import type {
  CardInstance,
  GameState,
  PlayerId,
  PlayerState,
  Pos,
} from "./types";
import { BOARD_SIZE, HAND_CAP, OPENING_HAND, enemyOf, homeRow } from "./types";

export function createInitialState(seed: number): GameState {
  const state: GameState = {
    rngState: seed | 0,
    round: 0,
    phase: "mulligan",
    firstPlayer: "P1",
    players: {
      P1: emptyPlayer(DECK_P1.slice()),
      P2: emptyPlayer(DECK_P2.slice()),
    },
    cards: {},
    slots: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => ({ capturedBy: null })),
    ),
    prep: null,
    battle: null,
    win: null,
    log: [],
    nextId: 1,
  };
  shuffle(state, state.players.P1.deck);
  shuffle(state, state.players.P2.deck);
  state.firstPlayer = coin(state) ? "P1" : "P2";
  drawCards(state, "P1", OPENING_HAND);
  drawCards(state, "P2", OPENING_HAND);
  state.log.push(
    `Coin flip: ${state.firstPlayer} preps first. Opening hands dealt.`,
  );
  return state;
}

function emptyPlayer(deck: string[]): PlayerState {
  return { deck, hand: [], summonPool: 0, magicPool: 3, mulliganDone: false };
}

/** Draw up to n cards; at the hand cap the excess stays in the deck. */
export function drawCards(draft: GameState, player: PlayerId, n: number): number {
  const p = draft.players[player];
  let drawn = 0;
  while (drawn < n && p.deck.length > 0 && p.hand.length < HAND_CAP) {
    const defId = p.deck.shift()!;
    p.hand.push({ handId: `h${draft.nextId++}`, defId });
    drawn++;
  }
  return drawn;
}

/** Mulligan: return a subset to the deck, reshuffle, redraw back to 5. */
export function applyMulligan(
  draft: GameState,
  player: PlayerId,
  returnHandIds: string[],
): void {
  const p = draft.players[player];
  if (p.mulliganDone) throw new Error(`${player} already mulliganed`);
  const returning = p.hand.filter((h) => returnHandIds.includes(h.handId));
  if (returning.length !== returnHandIds.length)
    throw new Error("Mulligan references a card not in hand");
  p.hand = p.hand.filter((h) => !returnHandIds.includes(h.handId));
  for (const h of returning) p.deck.push(h.defId);
  shuffle(draft, p.deck);
  drawCards(draft, player, OPENING_HAND - p.hand.length);
  p.mulliganDone = true;
  if (returning.length > 0)
    draft.log.push(`${player} mulligans ${returning.length} card(s).`);
}

// ── board queries ──────────────────────────────────────────────────────────

export function cardAt(state: GameState, row: number, col: number): CardInstance | null {
  for (const c of Object.values(state.cards)) {
    if (c.pos && c.pos.row === row && c.pos.col === col) return c;
  }
  return null;
}

export function boardCards(state: GameState, owner?: PlayerId): CardInstance[] {
  const all = Object.values(state.cards).filter((c) => c.pos !== null);
  return owner ? all.filter((c) => c.owner === owner) : all;
}

/** Contested = enemy card standing on an uncaptured home slot of `player`. */
export function isContested(state: GameState, player: PlayerId, col: number): boolean {
  const row = homeRow(player);
  if (state.slots[row][col].capturedBy) return false;
  const occ = cardAt(state, row, col);
  return occ !== null && occ.owner !== player;
}

export function isCaptured(state: GameState, row: number, col: number): boolean {
  return state.slots[row][col].capturedBy !== null;
}

/** Effective speed: ROOT and FREEZE pin SP to 0. */
export function effectiveSp(_state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  if (card.status && (card.status.kind === "ROOT" || card.status.kind === "FREEZE"))
    return 0;
  return def.sp;
}

/**
 * Effective damage per hit:
 * - WEAKEN −25% (round down), FREEZE −50% (round down)
 * - King of the Hill: +1 while in a Mid row; +1 board-wide per fully
 *   controlled Mid row (all 4 slots held by this card's owner).
 */
export function effectiveDmg(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  let dmg = def.dmg + card.dmgBonus;
  if (card.status?.kind === "WEAKEN") dmg = Math.floor(dmg * 0.75);
  if (card.status?.kind === "FREEZE") dmg = Math.floor(dmg * 0.5);
  if (card.pos && (card.pos.row === 1 || card.pos.row === 2)) dmg += 1;
  for (const midRow of [1, 2]) {
    let held = 0;
    for (let col = 0; col < BOARD_SIZE; col++) {
      const occ = cardAt(state, midRow, col);
      if (occ && occ.owner === card.owner) held++;
    }
    if (held === BOARD_SIZE) dmg += 1;
  }
  return Math.max(0, dmg);
}

/** Movement tier: SP 0 = 0 spaces, 1–7 = 1, 8–15 = 2. */
export function moveReach(sp: number): number {
  if (sp <= 0) return 0;
  return sp <= 7 ? 1 : 2;
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function summonCard(
  draft: GameState,
  player: PlayerId,
  defId: string,
  pos: Pos,
): CardInstance {
  const def = getDef(defId);
  const inst: CardInstance = {
    instanceId: `c${draft.nextId++}`,
    defId,
    owner: player,
    curHp: def.hp,
    maxHp: def.hp,
    curShields: def.shields,
    dmgBonus: 0,
    status: null,
    summonedThisRound: true,
    specialCooldown: 0,
    attackedThisRound: false,
    autoMode: "manual",
    pos,
  };
  draft.cards[inst.instanceId] = inst;
  return inst;
}

export function removeCard(draft: GameState, instanceId: string): void {
  delete draft.cards[instanceId];
  if (draft.battle?.awaitingInput === instanceId) draft.battle.awaitingInput = null;
}

/** Elimination check: no cards on board AND empty hand AND empty deck. */
export function isEliminated(state: GameState, player: PlayerId): boolean {
  const p = state.players[player];
  return (
    boardCards(state, player).length === 0 &&
    p.hand.length === 0 &&
    p.deck.length === 0
  );
}

/**
 * Capture win for `player`: all 4 of the OPPONENT's home slots are either
 * permanently captured by `player` or currently occupied by `player`'s cards.
 */
export function hasCaptureWin(state: GameState, player: PlayerId): boolean {
  const opp = enemyOf(player);
  const row = homeRow(opp);
  for (let col = 0; col < BOARD_SIZE; col++) {
    if (state.slots[row][col].capturedBy === player) continue;
    const occ = cardAt(state, row, col);
    if (occ && occ.owner === player) continue;
    return false;
  }
  return true;
}
