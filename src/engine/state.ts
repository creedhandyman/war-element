// Game state construction + shared query helpers. Pure — reducers clone the
// incoming state once (structuredClone) and mutate only the clone.

import { getDef, deckById } from "../data/cards";
import { coin, shuffle } from "./rng";
import { spellbookFor } from "./spells";
import type {
  AuraBonusDef,
  CardDef,
  CardInstance,
  GameState,
  PlayerId,
  PlayerState,
  Pos,
  StatusKind,
} from "./types";
import { BOARD_SIZE, MULTI_HIT_BONUS_MIN, OPENING_HAND, enemyOf, homeRow } from "./types";

/** A deck is either a registered deck/core id, or an explicit list of card ids
 *  (a pairing built at the picker). */
function resolveDeck(deck: string | string[]): string[] {
  return Array.isArray(deck) ? deck.slice() : deckById(deck).cards.slice();
}

export function createInitialState(
  seed: number,
  p1Deck: string | string[] = "leaf_pyro",
  p2Deck: string | string[] = "bore_dusk",
  humans: PlayerId[] = ["P1"],
): GameState {
  const state: GameState = {
    rngState: seed | 0,
    round: 0,
    phase: "mulligan",
    humans,
    firstPlayer: "P1",
    players: {
      P1: emptyPlayer(resolveDeck(p1Deck)),
      P2: emptyPlayer(resolveDeck(p2Deck)),
    },
    cards: {},
    slots: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => ({ capturedBy: null })),
    ),
    prep: null,
    battle: null,
    walls: [],
    pendingFlow: null,
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
  return {
    deck,
    hand: [],
    spellbook: spellbookFor(deck),
    summonPool: 0,
    magicPool: 0,
    mulliganDone: false,
  };
}

/** Draw up to n cards; an empty deck simply stops drawing (no penalty). */
export function drawCards(draft: GameState, player: PlayerId, n: number): number {
  const p = draft.players[player];
  let drawn = 0;
  while (drawn < n && p.deck.length > 0) {
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

/** Does the card currently carry a status of this kind? */
export function hasStatus(card: CardInstance, kind: StatusKind): boolean {
  return card.statuses.some((s) => s.kind === kind);
}

/** Effective speed: ROOT and FREEZE pin SP to 0. */
/** Best (non-stacking) aura bonus a card gets from living allies whose aura
 *  matches it — Trinezer's Brood Command (Reptile +1/+1), Griffith's GALE +SP.
 *  The single highest matching bonus applies; auras never sum. */
function auraMatches(a: AuraBonusDef, holderDef: CardDef, targetDef: CardDef): boolean {
  switch (a.scope) {
    case "all": return true;
    case "element": return targetDef.element === holderDef.element;
    case "tribe": return targetDef.tribe != null && targetDef.tribe === a.match;
    case "class": return targetDef.cardClass === a.match;
    default: return false;
  }
}

export function auraBonus(state: GameState, card: CardInstance, stat: "dmg" | "sp"): number {
  const tDef = getDef(card.defId);
  let best = 0;
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    if (!hDef.aura || !auraMatches(hDef.aura, hDef, tDef)) continue;
    const v = stat === "dmg" ? hDef.aura.dmg ?? 0 : hDef.aura.sp ?? 0;
    if (v > best) best = v;
  }
  return best;
}

/** A card's effective max HP = its own maxHp plus the highest matching friendly
 *  maxHP aura (Kraken's SeaC +4). Equals maxHp for cards under no such aura, so
 *  it's a safe drop-in for every healing cap and the HP display. */
export function effectiveMaxHp(state: GameState, card: CardInstance): number {
  const tDef = getDef(card.defId);
  let bonus = 0;
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    if (!hDef.aura?.maxHp || !auraMatches(hDef.aura, hDef, tDef)) continue;
    if (hDef.aura.maxHp > bonus) bonus = hDef.aura.maxHp;
  }
  return card.maxHp + bonus;
}

/** Does a friendly aura grant this card's basic attacks PEN (Blood Ruby)? */
export function auraHasPen(state: GameState, card: CardInstance): boolean {
  const tDef = getDef(card.defId);
  return boardCards(state, card.owner).some((holder) => {
    const hDef = getDef(holder.defId);
    return !!hDef.aura?.pen && auraMatches(hDef.aura, hDef, tDef);
  });
}

/** The extra shields a card gets from friendly shield auras (Pressure) — the
 *  highest matching aura's shields, or 0 if none. Each round it's topped up to
 *  its printed shields + this bonus. */
export function auraShieldBonus(state: GameState, card: CardInstance): number {
  const tDef = getDef(card.defId);
  let bonus = 0;
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    if (!hDef.aura?.shields || !auraMatches(hDef.aura, hDef, tDef)) continue;
    if (hDef.aura.shields > bonus) bonus = hDef.aura.shields;
  }
  return bonus;
}

export function effectiveSp(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  if (hasStatus(card, "ROOT") || hasStatus(card, "FREEZE")) return 0;
  const buffSp = (card.buffs ?? []).reduce((n, b) => n + b.sp, 0);
  return Math.max(
    0,
    def.sp + (card.spBonus ?? 0) + (card.spBonusRound ?? 0) + buffSp + auraBonus(state, card, "sp"),
  );
}

/**
 * Effective damage per hit:
 * - WEAKEN −25% (round down), FREEZE −50% (round down)
 * - King of the Hill: +1 while in a Mid row; +1 board-wide per fully
 *   controlled Mid row (all 4 slots held by this card's owner).
 */
export function effectiveDmg(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  const buffDmg = (card.buffs ?? []).reduce((n, b) => n + b.dmg, 0);
  let dmg = def.dmg + (card.dmgBonus ?? 0) + (card.dmgBonusRound ?? 0) + buffDmg + auraBonus(state, card, "dmg");
  // High Speed Impact (Hawk): +1 DMG for each point of SP above 10.
  if (def.highSpeedImpact) dmg += Math.max(0, effectiveSp(state, card) - 10);
  if (hasStatus(card, "WEAKEN")) dmg = Math.floor(dmg * 0.75);
  if (hasStatus(card, "FREEZE")) dmg = Math.floor(dmg * 0.5);
  // King of the Hill (A): sitting in a Mid row grants +1 DMG — but heavy
  // multi-hit cards (4+ hits) get +1 HIT instead (in effectiveBasicHits), so a
  // flat per-hit +1 doesn't balloon on shredders.
  if (card.pos && (card.pos.row === 1 || card.pos.row === 2) && def.hits < MULTI_HIT_BONUS_MIN) dmg += 1;
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

/** King-move (Chebyshev) distance — a diagonal step counts as 1. FLYING cards
 *  measure movement this way, so they move freely diagonally. */
export function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
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
    dmgBonusRound: 0,
    spBonus: 0,
    spBonusRound: 0,
    hitsBonus: 0,
    hitsBonusRound: 0,
    tempShields: 0,
    struckThisRound: {},
    struckEver: [],
    buffs: [],
    revived: false,
    transformed: false,
    talentUsed: false,
    freeSpecial: false,
    onHitBuffFired: false,
    loadedHits: 0,
    statuses: [],
    summonedThisRound: true,
    specialCooldown: 0,
    attackedThisRound: false,
    autoMode: "manual",
    pos,
  };
  draft.cards[inst.instanceId] = inst;
  return inst;
}

/** Spawn `count` token cards adjacent to `spawner` (falling back to any open
 *  board slot). Tokens are full CardInstances that act like any card; their defs
 *  live in CARD_INDEX but not in CARDS, so they never enter a deck. */
export function spawnTokens(
  draft: GameState,
  spawner: CardInstance,
  tokenDefId: string,
  count: number,
  adjacentOnly = false,
): CardInstance[] {
  if (!spawner.pos) return [];
  const owner = spawner.owner;
  const isOpen = (r: number, c: number) =>
    r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE &&
    !draft.slots[r][c].capturedBy && !cardAt(draft, r, c);
  const slots: Pos[] = [];
  const push = (r: number, c: number) => {
    if (isOpen(r, c) && !slots.some((s) => s.row === r && s.col === c))
      slots.push({ row: r as Pos["row"], col: c as Pos["col"] });
  };
  // Adjacent (chess-king) slots first, then — unless adjacentOnly — any open slot.
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if (dr !== 0 || dc !== 0) push(spawner.pos.row + dr, spawner.pos.col + dc);
  if (!adjacentOnly)
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) push(r, c);

  const out: CardInstance[] = [];
  for (const pos of slots.slice(0, count)) {
    const tok = summonCard(draft, owner, tokenDefId, pos);
    if (!draft.humans.includes(owner)) tok.autoMode = "full";
    out.push(tok);
  }
  if (out.length > 0)
    draft.log.push(`${getDef(tokenDefId).name} ×${out.length} spawns.`);
  return out;
}

export function removeCard(draft: GameState, instanceId: string): void {
  delete draft.cards[instanceId];
  if (draft.battle?.awaitingInput === instanceId) draft.battle.awaitingInput = null;
  // A card awaiting its Flow Change pick can die first (e.g. onOppSummon) —
  // don't leave a dangling pending reference.
  if (draft.pendingFlow === instanceId) draft.pendingFlow = null;
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
