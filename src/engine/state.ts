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
    traps: [],
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
    // A hand-picked spellbook wins — INCLUDING an empty one. `undefined` means
    // "this deck never chose", so derive from its elements; `[]` means "chose
    // none", which used to fall through to the derive branch and hand a
    // spell-less deck the entire elemental set.
    spellbook: spellIds ? spellbookFromIds(spellIds) : spellbookFor(deck),
    gold: 0,
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
  // Credit the HEALER (`by`) and the recipient separately. `by` used to default
  // to the recipient, which quietly filed every unattributed heal as the
  // patient's own self-sustain — self-heals now say so explicitly at the call
  // site instead, so a missing source stays visibly unattributed.
  creditHeal(state.stats, by ?? null, healed, card);
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
  key: "regen" | "shield" | "sp" | "dmgBonus" | "block" | "reflect" | "specialDiscount" | "electrify" | "drainBonus",
): number {
  const el = getDef(card.defId).element;
  const f = state.fields.find((fs) => fs.owner === card.owner && fs.element === el);
  return f ? (f[key] ?? 0) : 0;
}

/**
 * Extra duration a status gains from an ENEMY field (Lushfield — LEAF).
 *
 * Keyed on the victim rather than the applier. applyStatus has 31 call sites
 * and no idea who caused the status, and threading a player through all of them
 * is exactly the kind of change where one gets missed. The inference is exact
 * here: nothing in the game applies BLEED or ROOT to a friendly card — the only
 * ally-targeted status is Shadow Step's EVASION, and wall ally-buffs are
 * block/evasion/dmgReduction — so a BLEED or ROOT landing on someone who is NOT
 * the field owner's card was, by definition, applied by that owner's side.
 */
export function fieldStatusExtend(state: GameState, victim: CardInstance, kind: StatusKind): number {
  for (const f of state.fields) {
    if (f.owner === victim.owner) continue; // your own field never lengthens what lands on you
    if (f.extendStatus?.kinds.includes(kind)) return f.extendStatus.rounds;
  }
  return 0;
}

/** Extra knockback distance the field owner's push effects travel (Jetstream —
 *  GALE). Keyed on the PUSHER's side rather than the victim's, and not element
 *  matched: a push can originate from a spell or a wall, which have no card. */
export function fieldPushBonus(state: GameState, owner: PlayerId): number {
  return state.fields.find((f) => f.owner === owner && f.push)?.push ?? 0;
}

/** A boolean Field grant, element-matched to the card the same way fieldBonus
 *  is: only a DUSK card under its owner's DUSK field gets Nightfall's EVASION,
 *  only a DAWN card under Blazing Sun stops missing. */
export function fieldFlag(
  state: GameState,
  card: CardInstance,
  key: "evasion" | "neverMiss" | "seeStealth",
): boolean {
  const el = getDef(card.defId).element;
  return state.fields.some((f) => f.owner === card.owner && f.element === el && !!f[key]);
}

/** Whether an active Field grants this card EVASION (Nightfall — DUSK). */
export function fieldEvasion(state: GameState, card: CardInstance): boolean {
  return fieldFlag(state, card, "evasion");
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
/** How much an enemy intimidator shaves off this card's basic damage.
 *
 *  Non-stacking, like every other aura here: the single strongest applicable
 *  one wins rather than summing. Both sides of the comparison use
 *  `dmgBeforeIntimidation`, which is what keeps this terminating — two Oakgres
 *  facing each other across a mirror match would otherwise each need the
 *  other's final DMG to compute their own. */
function intimidationPenalty(state: GameState, card: CardInstance, ownDmg: number): number {
  if (!card.pos) return 0;
  let worst = 0;
  for (const holder of boardCards(state, enemyOf(card.owner))) {
    const hDef = getDef(holder.defId);
    if (!hDef.intimidate || !holder.pos) continue;
    if (Math.abs(holder.pos.row - card.pos.row) > hDef.intimidate.rows) continue;
    // Strictly lower. A card that has matched the intimidator is no longer
    // afraid of it — that is the whole reason Oakgre's own DMG can grow.
    if (ownDmg >= dmgBeforeIntimidation(state, holder)) continue;
    if (hDef.intimidate.dmg > worst) worst = hDef.intimidate.dmg;
  }
  return worst;
}

export function effectiveDmg(state: GameState, card: CardInstance): number {
  const base = dmgBeforeIntimidation(state, card);
  return Math.max(0, base - intimidationPenalty(state, card, base));
}

/** Everything except Intimidation. Split out so the intimidator's own damage —
 *  the number an enemy is measured against — can be read without re-entering
 *  the penalty that depends on it. */
function dmgBeforeIntimidation(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  const buffDmg = (card.buffs ?? []).reduce((n, b) => n + b.dmg, 0);
  let dmg = def.dmg + (card.dmgBonus ?? 0) + (card.dmgBonusRound ?? 0) + buffDmg + auraBonus(state, card, "dmg") + fieldBonus(state, card, "dmgBonus");
  // High Speed Impact (Hawk): +1 DMG for each point of SP above 10.
  if (def.highSpeedImpact) dmg += Math.max(0, effectiveSp(state, card) - 10);
  // Scorched Fury: hotter as it burns down. Before WEAKEN/FREEZE so those
  // still scale the whole number, like every other flat bonus above.
  const fury = def.furyBelowHp;
  if (fury && card.curHp < fury.hp) dmg += fury.dmg;
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

/** Speed tiers. Movement is a STEP FUNCTION of SP, so these boundaries are
 *  balance cliffs: one printed point across a line is a whole extra slot of
 *  board reach, while the stat-budget formula prices SP linearly and knows
 *  nothing about them. Named constants so the cliffs are at least greppable.
 *
 *      slow  1-5  -> 1 space
 *      mid   6-10 -> 2
 *      fast  11+  -> 2, and moves like a KING (diagonals cost 1)
 *
 *  The fast tier buys MANOEUVRABILITY, not reach. A third step compounded with
 *  board depth — on a 5x5 it handed GALE and BOLT a 76% win rate against a 40
 *  point spread — whereas cutting corners is worth the same on any board size.
 *
 *  Replaces a two-tier split at 7/8, which put 97 of 162 cards in a single
 *  bucket and left SP largely inert as a stat — below the line it bought
 *  nothing, above it nothing further. */
export const SP_SLOW_MAX = 5;
export const SP_MID_MAX = 10;

export function moveReach(sp: number): number {
  if (sp <= 0) return 0; // ROOT / FREEZE pin a card outright
  if (sp <= SP_SLOW_MAX) return 1;
  return 2; // mid and fast both stride 2 — fast pays off in the king-move
}

/** Does this card cut corners? FLYING and mounted cards always have; the FAST
 *  speed tier now does too, which is what that tier buys instead of a third
 *  step. A diagonal costs such a card 1 rather than 2.
 *
 *  `transformed` is Skelider's Dismount: lose the mount, lose the king-move. */
export function movesLikeKing(def: CardDef, card: CardInstance, sp: number): boolean {
  return (
    Boolean(def.keywords.FLYING) ||
    (Boolean(def.mounted) && !card.transformed) ||
    sp > SP_MID_MAX
  );
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
  /** How far from the spawner a body may land, in king-moves. `1` is the old
   *  adjacentOnly. Omit for the default: prefer adjacent, then anywhere open. */
  radius?: number,
): CardInstance[] {
  if (!spawner.pos) return [];
  const owner = spawner.owner;
  // Never drop a body onto the OPPONENT's summoning row. A token landing there
  // sits in the enemy's home slots — free pressure the raiser never had to walk
  // in, and it clogs the squares the opponent needs to summon into. Tokens push
  // out from their spawner; they don't teleport onto the enemy's back line.
  const enemyHome = homeRow(enemyOf(owner), draft.boardSize);
  const isOpen = (r: number, c: number) =>
    r >= 0 && r < draft.boardSize && c >= 0 && c < draft.boardSize &&
    r !== enemyHome &&
    !draft.slots[r][c].capturedBy && !cardAt(draft, r, c);
  const slots: Pos[] = [];
  const push = (r: number, c: number) => {
    if (isOpen(r, c) && !slots.some((s) => s.row === r && s.col === c))
      slots.push({ row: r as Pos["row"], col: c as Pos["col"] });
  };
  // Nearest ring first, working outward, so bodies pack around the spawner
  // rather than scattering. With no radius the search then opens to the whole
  // board; with one, the horde is physically tethered to whatever raised it.
  const reach = radius ?? 1;
  for (let ring = 1; ring <= reach; ring++)
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++)
        if (Math.max(Math.abs(dr), Math.abs(dc)) === ring)
          push(spawner.pos.row + dr, spawner.pos.col + dc);
  if (radius == null)
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
