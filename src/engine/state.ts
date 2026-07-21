// Game state construction + shared query helpers. Pure — reducers clone the
// incoming state once (structuredClone) and mutate only the clone.

import { getDef, deckById } from "../data/cards";
import { coin, shuffle } from "./rng";
import { spellbookFor, spellbookFromIds } from "./spells";
import { creditHeal, emptyStats } from "./stats";
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
import { BOARD_SIZE, HAND_CAP, OPENING_HAND, enemyOf, hillGivesHit, homeRow, isMidRow } from "./types";

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
  p1Spells?: string[],
  p2Spells?: string[],
  boardSize: number = BOARD_SIZE,
): GameState {
  const state: GameState = {
    rngState: seed | 0,
    round: 0,
    phase: "mulligan",
    humans,
    firstPlayer: "P1",
    players: {
      P1: emptyPlayer(resolveDeck(p1Deck), p1Spells),
      P2: emptyPlayer(resolveDeck(p2Deck), p2Spells),
    },
    cards: {},
    boardSize,
    slots: Array.from({ length: boardSize }, () =>
      Array.from({ length: boardSize }, () => ({ capturedBy: null })),
    ),
    prep: null,
    battle: null,
    walls: [],
    fields: [],
    pendingFlow: null,
    win: null,
    log: [],
    nextId: 1,
    stats: emptyStats(),
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

function emptyPlayer(deck: string[], spellIds?: string[]): PlayerState {
  return {
    deck,
    hand: [],
    // A deck's hand-picked spellbook wins; otherwise derive one from its elements.
    spellbook: spellIds && spellIds.length ? spellbookFromIds(spellIds) : spellbookFor(deck),
    summonPool: 0,
    magicPool: 0,
    mulliganDone: false,
  };
}

/** Draw up to n cards; an empty deck simply stops drawing (no penalty), and a
 *  hand at HAND_CAP stops too (excess stays on top of the deck, not burned). */
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
  const row = homeRow(player, state.boardSize);
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
    // A card can carry more than one tribe (Ravven is Dark AND Avian), so it
    // answers to either tribe's aura.
    case "tribe": return targetDef.tribe != null && a.match != null &&
      (Array.isArray(targetDef.tribe) ? targetDef.tribe.includes(a.match) : targetDef.tribe === a.match);
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

/** The single choke-point for restoring HP. Honors Bluflame (SEAL): a sealed
 *  card can't be healed by REGEN, LIFESTEAL/DRAIN, or aura heals. Caps at
 *  effective max HP. Returns the amount actually restored (0 if blocked). */
export function healCard(state: GameState, card: CardInstance, amount: number, by?: CardInstance | PlayerId): number {
  if (amount <= 0 || card.curHp <= 0) return 0;
  if (hasStatus(card, "SEAL")) return 0; // Bluflame — no healing while sealed
  const before = card.curHp;
  card.curHp = Math.min(effectiveMaxHp(state, card), card.curHp + amount);
  const healed = card.curHp - before;
  // Credit the healer: an explicit source, else the recipient (self-sustain).
  creditHeal(state.stats, by ?? card, healed);
  return healed;
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

/** The value of a Field buff flag currently boosting this card: from an active
 *  Field owned by the card's controller whose element matches the card's (0 if
 *  none). One field per owner, so at most one can match. */
export function fieldBonus(
  state: GameState,
  card: CardInstance,
  key: "regen" | "shield" | "sp" | "dmgBonus" | "block" | "reflect" | "specialDiscount" | "electrify",
): number {
  const el = getDef(card.defId).element;
  const f = state.fields.find((fs) => fs.owner === card.owner && fs.element === el);
  return f ? (f[key] ?? 0) : 0;
}

/** Whether an active Field grants this card EVASION (Nightfall — DUSK). */
export function fieldEvasion(state: GameState, card: CardInstance): boolean {
  const el = getDef(card.defId).element;
  return state.fields.some((f) => f.owner === card.owner && f.element === el && !!f.evasion);
}

export function effectiveSp(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  if (hasStatus(card, "ROOT") || hasStatus(card, "FREEZE")) return 0;
  const buffSp = (card.buffs ?? []).reduce((n, b) => n + b.sp, 0);
  // Obsidian Claws (Obsidi): underground it REPLACES the printed SP rather than
  // adding to it — bonuses still stack on top of the new base.
  const base = def.spWhileStealthed != null && hasStatus(card, "STEALTH") ? def.spWhileStealthed : def.sp;
  return Math.max(
    0,
    base + (card.spBonus ?? 0) + (card.spBonusRound ?? 0) + buffSp + auraBonus(state, card, "sp") + fieldBonus(state, card, "sp"),
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
  let dmg = def.dmg + (card.dmgBonus ?? 0) + (card.dmgBonusRound ?? 0) + buffDmg + auraBonus(state, card, "dmg") + fieldBonus(state, card, "dmgBonus");
  // High Speed Impact (Hawk): +1 DMG for each point of SP above 10.
  if (def.highSpeedImpact) dmg += Math.max(0, effectiveSp(state, card) - 10);
  if (hasStatus(card, "WEAKEN")) dmg = Math.floor(dmg * 0.75);
  if (hasStatus(card, "FREEZE")) dmg = Math.floor(dmg * 0.5);
  // King of the Hill (A): sitting in a Mid row grants +1 DMG — but heavy
  // multi-hit cards get +1 HIT instead (in effectiveBasicHits), so a flat
  // per-hit +1 doesn't balloon on shredders. hillGivesHit() decides which half,
  // and this is its exact complement.
  if (card.pos && isMidRow(card.pos.row) && !hillGivesHit(def.dmg, def.hits)) dmg += 1;
  for (let midRow = 0; midRow < state.boardSize; midRow++) {
    if (!isMidRow(midRow)) continue;
    let held = 0;
    for (let col = 0; col < state.boardSize; col++) {
      const occ = cardAt(state, midRow, col);
      if (occ && occ.owner === card.owner) held++;
    }
    if (held === state.boardSize) dmg += 1;
  }
  return Math.max(0, dmg);
}

/** Movement tier: SP 0 = 0 spaces, 1–7 = 1, 8–15 = 2. */
export function moveReach(sp: number): number {
  if (sp <= 0) return 0;
  return sp <= 7 ? 1 : 2;
}

/**
 * How far this card may ACTUALLY move — the SP curve above, then PARALYZE.
 *
 * PARALYZE caps movement at a single step. It doesn't pin the card the way ROOT
 * and FREEZE do (those zero SP outright); it costs the sprint. So it only bites
 * the fast cards: anything at SP 7 or below already moves 1 and feels nothing,
 * while an SP 8+ runner loses half its reach until the jolt wears off.
 *
 * Every caller must use THIS, not moveReach() directly — the AI and the legality
 * check both compute reach, and if they disagreed the AI would offer moves the
 * rules then reject.
 */
export function moveReachFor(state: GameState, card: CardInstance): number {
  const reach = moveReach(effectiveSp(state, card));
  return hasStatus(card, "PARALYZE") ? Math.min(reach, 1) : reach;
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
    hitsTakenThisRound: 0,
    allyKilledFired: false,
    struckEver: [],
    buffs: [],
    revived: false,
    transformed: false,
    talentUsed: false,
    freeSpecial: false,
    onHitBuffFired: false,
    shieldBroken: false,
    onKillAoeFiredRound: false,
    onLowHpFired: false,
    specialCostReduction: 0,
    loadedHits: 0,
    statuses: [],
    summonedThisRound: true,
    specialCooldown: 0,
    attackedThisRound: false,
    autoMode: "manual",
    pos,
  };
  // Gate Keeper (Veil): raise the massive golden shield the moment it enters.
  if (def.summonSelfShields) inst.curShields += def.summonSelfShields;
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
    r >= 0 && r < draft.boardSize && c >= 0 && c < draft.boardSize &&
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
    for (let r = 0; r < draft.boardSize; r++) for (let c = 0; c < draft.boardSize; c++) push(r, c);

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
  const row = homeRow(opp, state.boardSize);
  for (let col = 0; col < state.boardSize; col++) {
    if (state.slots[row][col].capturedBy === player) continue;
    const occ = cardAt(state, row, col);
    if (occ && occ.owner === player) continue;
    return false;
  }
  return true;
}
