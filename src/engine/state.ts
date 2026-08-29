// Game state construction + shared query helpers. Pure — reducers clone the
// incoming state once (structuredClone) and mutate only the clone.

import { getDef, deckById } from "../data/cards";
import { hasElementAura, tailwindDmg, weakenMult, weakenStacks } from "./auras";
import { coin, shuffle } from "./rng";
import { BURN_HEAL_MULT } from "./matchups";
import { spellCapForBoard, spellbookFor, spellbookFromIds } from "./spells";
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
  FieldBuff,
} from "./types";
import { BOARD_SIZE, HAND_CAP, OPENING_HAND, enemyOf, hillGivesHit, homeRow, isMidRow } from "./types";
import { getSpell } from "./spells";

/** A deck is either a registered deck/core id, or an explicit list of card ids
 *  (a pairing built at the picker). */
function resolveDeck(deck: string | string[]): string[] {
  return Array.isArray(deck) ? deck.slice() : deckById(deck).cards.slice();
}

/** The numeric halves of a Field buff. Everything NOT in here is a flag — the
 *  signature effect a Field spell is really bought for. */
const TERRAIN_NUMERIC = [
  "regen", "shield", "sp", "dmgBonus", "block",
  "reflect", "specialDiscount", "electrify", "drainBonus", "push",
] as const;

/**
 * A Field spell reduced to standing terrain (§4).
 *
 * A cast Field costs 6 magic and lasts 3 rounds. Terrain is free and runs the
 * whole battle in every node of a region, so it cannot be the same thing at the
 * same strength. Two rules:
 *
 *   - **Numeric bonuses halve**, floored at 1 so no region ends up with terrain
 *     that does nothing (Heatwave's dmgBonus is already 1 — halving it to zero
 *     would leave PYRO standing on bare ground).
 *   - **Flags are dropped entirely.** burnPersists, evasion, neverMiss,
 *     seeStealth, flowRepick, enemyMissChance and the extendStatus rider are
 *     the payoff you spend six magic on. Permanent `neverMiss` across every
 *     DAWN card, in every DAWN node, is not a battlefield — it is a rule change.
 *
 * Casting the real spell still gives the full version, and takes precedence.
 */
export function terrainBuff(field: FieldBuff): FieldBuff {
  const out: FieldBuff = {};
  for (const key of TERRAIN_NUMERIC) {
    const v = field[key];
    if (typeof v === "number" && v > 0) out[key] = Math.max(1, Math.floor(v / 2));
  }
  return out;
}

export function createInitialState(
  seed: number,
  p1Deck: string | string[] = "leaf_pyro",
  p2Deck: string | string[] = "bore_dusk",
  humans: PlayerId[] = ["P1"],
  p1Spells?: string[],
  p2Spells?: string[],
  boardSize: number = BOARD_SIZE,
  /** Opening deployment slots per side (§10.6). Omit for the ordinary ramp. */
  opening?: { P1: number; P2: number },
  /** A Field spell id to run as standing terrain for the whole battle (§4).
   *  Story nodes pass their region's; ordinary matches pass nothing. */
  terrainSpellId?: string,
  /** How each side's deck is stacked on top of the shuffle. A NUMBER hoists
   *  that many of its cheapest cards (`PlayerState.stackCheapest`); a LIST of
   *  card ids hoists exactly those, in order (`PlayerState.stackFirst`). Omit
   *  for an ordinary match. */
  stacked?: { P1?: number | readonly string[]; P2?: number | readonly string[] },
): GameState {
  const state: GameState = {
    rngState: seed | 0,
    round: 0,
    phase: "mulligan",
    humans,
    firstPlayer: "P1",
    players: {
      // Spellbook cap follows the battlefield: 5 on the standard board, 8 on the
      // large one (the deeper deck gets a deeper book).
      P1: emptyPlayer(resolveDeck(p1Deck), p1Spells, spellCapForBoard(boardSize), stacked?.P1),
      P2: emptyPlayer(resolveDeck(p2Deck), p2Spells, spellCapForBoard(boardSize), stacked?.P2),
    },
    cards: {},
    boardSize,
    opening,
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
  restackByCost(state.players.P1);
  restackByCost(state.players.P2);
  state.firstPlayer = coin(state) ? "P1" : "P2";
  // §4: the region's Field spell is permanently active for BOTH sides — no
  // cost, no duration. `fieldBonus` keys on the card's own owner, so this needs
  // one entry per player rather than one shared entry, or only half the board
  // would ever feel it. The buff is WEAKENED — see `terrainBuff`.
  if (terrainSpellId) {
    const terrain = getSpell(terrainSpellId);
    if (terrain?.kind === "field" && terrain.field) {
      const buff = terrainBuff(terrain.field);
      for (const player of ["P1", "P2"] as PlayerId[])
        state.fields.push({
          owner: player, spellId: terrain.id, element: terrain.element,
          roundsLeft: 1, permanent: true, ...buff,
        });
      state.log.push(`— ${terrain.name} runs over the whole battlefield, at terrain strength. —`);
    }
  }

  drawCards(state, "P1", OPENING_HAND);
  drawCards(state, "P2", OPENING_HAND);
  state.log.push(
    `Coin flip: ${state.firstPlayer} preps first. Opening hands dealt.`,
  );
  return state;
}

/** Hoist a scripted deck's N cheapest cards to the top, leaving the rest in the
 *  order the shuffle left them. No-op for ordinary players.
 *
 *  A DEPTH rather than a whole-deck sort, and the difference is measured, not a
 *  matter of taste. Sorting the entire deck helps a top-heavy list and HURTS an
 *  already-cheap one, because it front-loads every cheap body before anything
 *  with weight: across the campaign's seventeen Thrones a full sort swung the
 *  average up 19 points but sent BOLT's City Power Core (thirteen 1-drops in
 *  thirty) DOWN from 43% to 25%, and LEAF's Spirit Tree from 45% to 20%.
 *  Guaranteeing an opening it can afford is the part that was actually wanted.
 *
 *  Called immediately after every `shuffle` of a deck, which is what makes the
 *  property hold rather than merely start out true — `applyMulligan` reshuffles.
 *
 *  The shuffle still RUNS first: the deck's own seed is consumed either way, so
 *  turning this on cannot shift the rest of the match's RNG. */
export function restackByCost(p: PlayerState): void {
  const n = p.stackCheapest ?? 0;
  if (n > 0 && p.deck.length) {
    // Indices sorted by cost, ties broken by current (shuffled) position so the
    // result is deterministic for a given seed.
    const order = p.deck
      .map((_, i) => i)
      .sort((a, b) => getDef(p.deck[a]).cost - getDef(p.deck[b]).cost || a - b);
    const head = order.slice(0, n);
    const taken = new Set(head);
    p.deck = [
      ...head.map((i) => p.deck[i]),                 // cheapest, ascending
      ...p.deck.filter((_, i) => !taken.has(i)),     // the rest, still shuffled
    ];
  }
  // …then the named cards, which end up above the cheap ones when both apply:
  // `stackFirst` names the cards the fight is ABOUT, so it outranks a heuristic
  // about affordability. One deck slot per entry, so a formation listing three
  // Arctiks hoists three of them and leaves any fourth where the shuffle put it.
  const named = p.stackFirst;
  if (named?.length && p.deck.length) {
    const rest = [...p.deck];
    const head: string[] = [];
    for (const id of named) {
      const i = rest.indexOf(id);
      if (i >= 0) head.push(...rest.splice(i, 1));
    }
    p.deck = [...head, ...rest];
  }
}

function emptyPlayer(
  deck: string[], spellIds?: string[], spellCap?: number,
  stack?: number | readonly string[],
): PlayerState {
  return {
    deck,
    ...(typeof stack === "number" ? (stack ? { stackCheapest: stack } : {})
      : stack?.length ? { stackFirst: stack } : {}),
    hand: [],
    // A hand-picked spellbook wins — INCLUDING an empty one. `undefined` means
    // "this deck never chose", so derive from its elements; `[]` means "chose
    // none", which used to fall through to the derive branch and hand a
    // spell-less deck the entire elemental set.
    spellbook: spellIds ? spellbookFromIds(spellIds, spellCap) : spellbookFor(deck, spellCap),
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
  // The reshuffle is exactly what used to undo a stacked deck — a scripted
  // opponent that mulligans must still redraw on curve.
  restackByCost(p);
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

/** Every board card that is NOT `player`'s.
 *
 *  This is `enemyCards(state, player)` written so it does not assume
 *  there is exactly one opponent. Ninety-seven call sites asked that question
 *  through `enemyOf`, and every one of them meant "the other side's cards"
 *  rather than "seat P2's cards" — the two are the same sentence only while a
 *  match has two seats in it.
 *
 *  Identical to the old expression in a two-player game, which is what lets the
 *  substitution be made everywhere at once and checked against the existing
 *  suite: nothing about a 1v1 changes. */
export function enemyCards(state: GameState, player: PlayerId): CardInstance[] {
  return Object.values(state.cards).filter((c) => c.pos !== null && c.owner !== player);
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

/** How many of `player`'s OWN home slots they are standing in.
 *
 *  The summon economy is built on this (see `doResourcePhase`): income is one
 *  gold a round plus one per slot held, so the back line pays for the front. An
 *  enemy standing in your home row does not count — that slot is contested, not
 *  held — and neither does one of your cards standing anywhere else, which is
 *  the tension: a card that advances stops paying for itself. */
export function homeSlotsHeld(state: GameState, player: PlayerId): number {
  const row = homeRow(player, state.boardSize);
  let held = 0;
  for (let col = 0; col < state.boardSize; col++) {
    const occ = cardAt(state, row, col);
    if (occ && occ.owner === player) held++;
  }
  return held;
}

/** Does the card currently carry a status of this kind? */
export function hasStatus(card: CardInstance, kind: StatusKind): boolean {
  return card.statuses.some((s) => s.kind === kind);
}

/** Bloodfire — the leaf_pyro archetype's signature condition: a card carrying
 *  BOTH BLEED and BURN at once (blood + fire). It's a DERIVED tag, not a stored
 *  status: payoff cards key off it (bonus damage / lifesteal against a target
 *  that's bleeding AND burning), so the LEAF blood engine and the PYRO fire
 *  engine reinforce each other instead of acting in parallel. */
export function isBloodfire(card: CardInstance): boolean {
  return hasStatus(card, "BLEED") && hasStatus(card, "BURN");
}

/** Effective speed: ROOT and FREEZE pin SP to 0. */
/** Best (non-stacking) aura bonus a card gets from living allies whose aura
 *  matches it — Trinezer's Brood Command (Reptile +1/+1), Skyrend's GALE +SP.
 *  The single highest matching bonus applies; auras never sum. */
function auraMatches(a: AuraBonusDef, holder: CardInstance, target: CardInstance): boolean {
  const holderDef = getDef(holder.defId);
  const targetDef = getDef(target.defId);
  // An optional element filter narrows whatever the scope selected.
  if (a.element != null && targetDef.element !== a.element) return false;
  switch (a.scope) {
    case "all": return true;
    case "element": return targetDef.element === (a.match ?? holderDef.element);
    // A card can carry more than one tribe (Ravven is Dark AND Avian), so it
    // answers to either tribe's aura.
    case "tribe": return targetDef.tribe != null && a.match != null &&
      (Array.isArray(targetDef.tribe) ? targetDef.tribe.includes(a.match) : targetDef.tribe === a.match);
    case "class": return targetDef.cardClass === a.match;
    // Touching allies only — Lightning Rod's field reaches the 8 surrounding
    // slots (self is distance 0, so it never buffs itself).
    case "adjacent": return !!holder.pos && !!target.pos && chebyshev(holder.pos, target.pos) === 1;
    default: return false;
  }
}

/** Fold a set of matching aura values into one, NON-STACKING IN BOTH
 *  DIRECTIONS: the strongest positive applies, the harshest negative applies,
 *  and two auras of the same sign never add.
 *
 *  The old rule was `if (v > best) best = v` starting at 0, which quietly
 *  discarded every NEGATIVE value — a penalty aura simply did nothing, with no
 *  error and no log line. Magmadon's Volcanic (+2 DMG, -1 HP) is the first aura
 *  in the game to charge for what it gives, and it would have been a free +2. */
function auraPick(values: readonly number[]): number {
  let up = 0;
  let down = 0;
  for (const v of values) {
    if (v > up) up = v;
    else if (v < down) down = v;
  }
  return up + down;
}

export function auraBonus(state: GameState, card: CardInstance, stat: "dmg" | "sp"): number {
  const vals: number[] = [];
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    for (const a of [hDef.aura, ...(hDef.auras ?? [])]) {
      if (!a || !auraMatches(a, holder, card)) continue;
      vals.push(stat === "dmg" ? a.dmg ?? 0 : a.sp ?? 0);
    }
  }
  return auraPick(vals);
}

/** Every allied aura currently touching `card`, named by its source holder — for
 *  the UI to show WHERE a buff comes from. */
export function auraSources(state: GameState, card: CardInstance): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    for (const a of [hDef.aura, ...(hDef.auras ?? [])]) {
      if (!a || !auraMatches(a, holder, card)) continue;
      const bits = [
        // Signed: an aura may now COST something, and "+-1 HP" is not a number.
        a.dmg && `${a.dmg > 0 ? "+" : ""}${a.dmg} DMG`,
        a.sp && `${a.sp > 0 ? "+" : ""}${a.sp} SP`,
        a.maxHp && `${a.maxHp > 0 ? "+" : ""}${a.maxHp} HP`,
        a.shields && `+${a.shields} shield`, a.reflect && `REFLECT ${a.reflect}`, a.pen && "PEN",
      ].filter(Boolean);
      if (bits.length) out.push({ name: hDef.name, text: bits.join(", ") });
    }
  }
  return out;
}

/** A card's effective max HP = its own maxHp plus the highest matching friendly
 *  maxHP aura (Kraken's SeaC +4). Equals maxHp for cards under no such aura, so
 *  it's a safe drop-in for every healing cap and the HP display. */
export function effectiveMaxHp(state: GameState, card: CardInstance): number {
  const vals: number[] = [];
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    // `auras` too, not just `aura` — the extra slot was skipped here while
    // auraBonus read both, so a second aura's maxHp was invisible.
    for (const a of [hDef.aura, ...(hDef.auras ?? [])]) {
      if (!a?.maxHp || !auraMatches(a, holder, card)) continue;
      vals.push(a.maxHp);
    }
  }
  // Floored at 1: a penalty aura must be able to make a card frail, never to
  // reduce it to a 0-HP body that every cap and heal then divides against.
  return Math.max(1, card.maxHp + auraPick(vals));
}

/** The single choke-point for RAISING a card's max HP, and the only place
 *  `maxHpCap` is enforced. Returns the amount actually gained, which is what
 *  callers must add to `curHp` — every growth site pairs the two, and adding
 *  the requested amount instead of the granted one would push curHp above a
 *  capped ceiling for Cleanup to silently claw back.
 *
 *  A card with no cap gains exactly what it was given, so routing the growth
 *  sites through this changed nothing for any of them. */
export function gainMaxHp(card: CardInstance, amount: number): number {
  if (amount <= 0) return 0;
  const cap = getDef(card.defId).maxHpCap;
  const gain = cap == null ? amount : Math.max(0, Math.min(amount, cap - card.maxHp));
  card.maxHp += gain;
  return gain;
}

/** The single choke-point for restoring HP. Honors Bluflame (SEAL): a sealed
 *  card can't be healed by REGEN, LIFESTEAL/DRAIN, or aura heals. Caps at
 *  effective max HP. Returns the amount actually restored (0 if blocked). */
export function healCard(state: GameState, card: CardInstance, amount: number, by?: CardInstance | PlayerId): number {
  if (amount <= 0 || card.curHp <= 0) return 0;
  if (hasStatus(card, "SEAL")) return 0; // Bluflame — no healing while sealed
  const before = card.curHp;
  // Root Growth (Oak): drinks in double (or more) from every healing source.
  const mult = getDef(card.defId).healReceivedMult ?? 1;
  // Searing (PYRO matchup): a BURNing card heals at 75% — wounds don't close
  // while they cook. Floored rather than rounded so the penalty can't vanish on
  // small heals, but never below 1 on a heal that was going to land at all.
  const burned = hasStatus(card, "BURN");
  const gross = amount * mult;
  const net = burned ? Math.max(1, Math.floor(gross * BURN_HEAL_MULT)) : gross;
  card.curHp = Math.min(effectiveMaxHp(state, card), card.curHp + net);
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
  return boardCards(state, card.owner).some((holder) => {
    const hDef = getDef(holder.defId);
    return !!hDef.aura?.pen && auraMatches(hDef.aura, holder, card);
  });
}

/** The extra shields a card gets from friendly shield auras (Pressure) — the
 *  highest matching aura's shields, or 0 if none. Each round it's topped up to
 *  its printed shields + this bonus. */
export function auraReflectBonus(state: GameState, card: CardInstance): number {
  let bonus = 0;
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    for (const a of [hDef.aura, ...(hDef.auras ?? [])]) {
      if (!a?.reflect || !auraMatches(a, holder, card)) continue;
      if (a.reflect > bonus) bonus = a.reflect;
    }
  }
  return bonus;
}

/** The extra shields a card gets from friendly shield auras (Pressure) — the
 *  highest matching aura's shields, or 0 if none. Each round it's topped up to
 *  its printed shields + this bonus. */
export function auraShieldBonus(state: GameState, card: CardInstance): number {
  let bonus = 0;
  for (const holder of boardCards(state, card.owner)) {
    const hDef = getDef(holder.defId);
    for (const a of [hDef.aura, ...(hDef.auras ?? [])]) {
      if (!a?.shields || !auraMatches(a, holder, card)) continue;
      if (a.shields > bonus) bonus = a.shields;
    }
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

/** Totem Spirit (Totem): is a living holder standing on this card's side?
 *
 *  Lives beside fieldFlag because it answers the same question from a different
 *  source — a body on the board rather than a field over it — and because both
 *  combat.ts (never-miss) and rules.ts (STEALTH, Home-Slot) have to ask it, and
 *  both already import from here. Element-agnostic on purpose: unlike Purelight
 *  it covers the whole team, not just its own element. */
export function hasTotemSpirit(state: GameState, card: CardInstance): boolean {
  return boardCards(state, card.owner).some((c) => c.curHp > 0 && getDef(c.defId).totemSpiritAura);
}

export function effectiveSp(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  if (hasStatus(card, "ROOT") || hasStatus(card, "FREEZE")) return 0;
  const buffSp = (card.buffs ?? []).reduce((n, b) => n + b.sp, 0);
  // Obsidian Claws (Obsidian): underground it REPLACES the printed SP rather than
  // adding to it — bonuses still stack on top of the new base.
  const base = def.spWhileStealthed != null && hasStatus(card, "STEALTH") ? def.spWhileStealthed : def.sp;
  // Lurk (Liquark): +SP while hidden in STEALTH.
  const lurkSp = def.lurk && hasStatus(card, "STEALTH") ? def.lurk.sp : 0;
  const sp = base + lurkSp + (card.spBonus ?? 0) + (card.spBonusRound ?? 0) + buffSp
    + auraBonus(state, card, "sp") + fieldBonus(state, card, "sp");
  // See `statScale`. Floored at 1 rather than 0 for a card that HAS speed: a
  // halved 1-SP body would round to 0 and stop being able to move at all, which
  // is a different card, not a weaker one. A printed 0 stays 0.
  if (card.statScale != null && card.statScale !== 1 && sp > 0)
    return Math.max(1, Math.floor(sp * card.statScale));
  return Math.max(0, sp);
}

/**
 * Effective damage per hit:
 * - WEAKEN −25% per stack, compounding and capped (round down); FREEZE −50%
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
  for (const holder of enemyCards(state, card.owner)) {
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

/** Broodmother (Aranea): +DMG to every ALLY of a named tribe while a living
 *  holder stands.
 *
 *  Read live rather than stamped on at summon, which is the whole difference
 *  between this and `onDeath.allyTribeBuffDmg`: the brood is RENTED. Spiders
 *  spawned after the queen landed pick it up, and killing her takes it back
 *  from all of them at once — which is what makes her the thing to shoot.
 *
 *  Summed rather than maxed, so two queens stack. There is one card carrying
 *  this today; the rule is stated here so a second one does not need a
 *  decision made about it in a hurry. */
function tribeAuraDmg(state: GameState, card: CardInstance): number {
  const mine = getDef(card.defId).tribe;
  if (!mine) return 0;
  let bonus = 0;
  for (const a of boardCards(state, card.owner)) {
    const aura = getDef(a.defId).tribeDmgAura;
    if (!aura || a.curHp <= 0) continue;
    // The holder does not buff itself — an aura that also pumps its own damage
    // is a stat line pretending to be an ability.
    if (a.instanceId === card.instanceId) continue;
    const tribes = Array.isArray(mine) ? mine : [mine];
    if (tribes.includes(aura.tribe)) bonus += aura.dmg;
  }
  return bonus;
}

/** Everything except Intimidation. Split out so the intimidator's own damage —
 *  the number an enemy is measured against — can be read without re-entering
 *  the penalty that depends on it. */
function dmgBeforeIntimidation(state: GameState, card: CardInstance): number {
  const def = getDef(card.defId);
  const buffDmg = (card.buffs ?? []).reduce((n, b) => n + b.dmg, 0);
  // Power Grab (General): the equipped weapon replaces the printed base DMG.
  // Icicle Weapon (Blackice): its armour is its weapon — base DMG = current shields.
  const baseDmg = def.weaponFromShields
    ? card.curShields
    : def.weaponModes ? def.weaponModes[card.weaponMode ?? 0].dmg : def.dmg;
  let dmg = baseDmg + (card.dmgBonus ?? 0) + (card.dmgBonusRound ?? 0) + buffDmg + auraBonus(state, card, "dmg") + fieldBonus(state, card, "dmgBonus") + tribeAuraDmg(state, card);
  // High Speed Impact: +1 DMG per point of SP above 10, capped where the card
  // says so (Stormquill +5) and unbounded where it does not (Tempest).
  if (def.highSpeedImpact) {
    const over = Math.max(0, effectiveSp(state, card) - 10);
    dmg += def.highSpeedImpact.cap === undefined ? over : Math.min(def.highSpeedImpact.cap, over);
  }
  // Tailwind (GALE aura): the speed it paid for, converted. Keyed off SP so it
  // scales with exactly the stat GALE overspends on — see `auras.ts`.
  //
  // NOT on a card that already converts SP into damage. Tailwind exists to give
  // the other thirty-seven GALE cards what Stormquill and Tempest were always
  // getting from High Speed Impact; stacking the two would re-buff precisely
  // the pair that never needed it — one of which has already been capped once
  // for being too strong.
  if (hasElementAura(def, "GALE") && !def.highSpeedImpact) {
    dmg += tailwindDmg(effectiveSp(state, card));
  }
  // Apex Predator (Stormfang): +1 DMG per `per` SP above `above`.
  if (def.speedDmgTiered)
    dmg += Math.floor(Math.max(0, effectiveSp(state, card) - def.speedDmgTiered.above) / def.speedDmgTiered.per);
  // Volcanic Fury (Valcana): the on-hit ramp, until her Special resets it.
  dmg += card.rampDmg ?? 0;
  // Lurk (Liquark): +DMG while hidden in STEALTH.
  if (def.lurk && hasStatus(card, "STEALTH")) dmg += def.lurk.dmg;
  // Graveyard (Destro): +1 DMG per fallen ally.
  if (def.graveyardDmg) dmg += state.players[card.owner].deaths ?? 0;
  // Scorched Fury: hotter as it burns down. Before WEAKEN/FREEZE so those
  // still scale the whole number, like every other flat bonus above.
  const fury = def.furyBelowHp;
  if (fury && card.curHp < fury.hp) dmg += fury.dmg;
  // WEAKEN STACKS: -25% compounding per stack, capped (see auras.ts). One
  // Math.floor at the end rather than one per stack, so three stacks bite the
  // same whether they landed together or one at a time — flooring per stack
  // would make the ORDER of application change the result.
  const weak = weakenStacks(card);
  if (weak > 0) dmg = Math.floor(dmg * weakenMult(weak));
  if (hasStatus(card, "FREEZE")) dmg = Math.floor(dmg * 0.5);
  // A body that is a fraction (or a multiple) of what its card says — a tamed
  // boss at half, an enraged one above full. Applied AFTER the additive bonuses
  // and the status multipliers, so it scales what the card actually swings for
  // rather than only its printed number: a tamed boss that picks up an on-kill
  // buff is still fighting at half, which is what the promise means.
  if (card.statScale != null && card.statScale !== 1) dmg = Math.floor(dmg * card.statScale);
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

/** Make a body a FRACTION (or a multiple) of the card it was dealt from.
 *
 *  Two halves, because the instance model splits stats two ways. HP and shields
 *  are absolute numbers on the instance, so they are rewritten here, once, at
 *  placement. DMG and SP exist only as deltas layered on the def at read time,
 *  so those cannot be rewritten at all — `statScale` is stored and read by
 *  `effectiveDmg` / `effectiveSp` / `resolveHit` instead.
 *
 *  HP is floored at 1: halving a 1-HP body must not delete it on arrival.
 *
 *  Call it immediately after `summonCard`, before anything reads the card.
 *  Mutates and returns the instance, matching `summonCard`'s own style. */
export function scaleInstance(inst: CardInstance, scale: number): CardInstance {
  inst.statScale = scale;
  inst.maxHp = Math.max(1, Math.round(inst.maxHp * scale));
  inst.curHp = Math.max(1, Math.round(inst.curHp * scale));
  inst.curShields = Math.max(0, Math.round(inst.curShields * scale));
  return inst;
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
    shieldBroken: false,
    onKillAoeFiredRound: false,
    onLowHpFired: false,
    specialCostReduction: 0,
    loadedHits: 0,
    statuses: [],
    summonedThisRound: true,
    specialCooldown: 0,
    specialCasts: 0,
    attackedThisRound: false,
    autoMode: "manual",
    pos,
  };
  // Gate Keeper (Veil): raise the massive golden shield the moment it enters.
  if (def.summonSelfShields) inst.curShields += def.summonSelfShields;
  // Electro Surge (Surge): starts armed the moment it lands.
  if (def.electroSurge) inst.electroSurgeActive = true;
  // Lure (Anglerfish): its disorienting glow is up the moment it lands.
  if (def.lure) { inst.incomingMissPct = def.lure.pct; inst.incomingMissRounds = def.lure.rounds; }
  // Ride or Die (Omega): Luna's buff applies the instant it enters play.
  if (def.summonSelfBuff) {
    inst.dmgBonus += def.summonSelfBuff.dmg;
    gainMaxHp(inst, def.summonSelfBuff.hp);
    inst.curHp += def.summonSelfBuff.hp;
  }
  // The Butler (Nightfang): a disguised card enters play wearing another def
  // entirely — its face, its name, its stat line. `transformedFrom` is what
  // makes killing it a REVEAL rather than a death: defeatCard sees the field and
  // reverts to the true form at full HP instead of removing the card. Applied
  // here, at the single place a card comes into being, so a Nightfang summoned
  // by any route wears it.
  const dis = def.disguise;
  if (dis) {
    const mask = getDef(dis.as);
    inst.transformedFrom = defId;
    inst.defId = dis.as;
    inst.curHp = mask.hp;
    inst.maxHp = mask.hp;
    inst.curShields = mask.shields;
  }
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
  // FORWARD IS NOT THE SAME DIRECTION FOR BOTH SIDES, and this search used to
  // assume it was. Scanning `dr` from -ring upward always fills the LOWEST row
  // index first, which is toward the enemy for P1 and toward its own back line
  // for P2 — so the player's spawns screened forward while the AI's fell in
  // behind the spawner, frequently onto its own summoning row, where they also
  // clogged the slots it needed to summon into. Same card, same code, opposite
  // behaviour, purely from seat.
  //
  // Ordered by FORWARDNESS relative to the owner instead: `dr * fwd` is +1 for a
  // step toward the enemy and -1 for a step back, whichever seat is asking.
  // Column distance breaks the tie so a horde still packs beside its spawner
  // rather than fanning to the ring's corners.
  const fwd = owner === "P1" ? -1 : 1;
  // NEAREST RING FIRST, ALL THE WAY OUT. This used to search ring 1 only and
  // then fall back to a whole-board ROW SWEEP ordered by forwardness — which
  // meant that the moment the adjacent square was taken, the token deployed to
  // the furthest forward slot on the board. On a 5x5 that is four rows away,
  // alone, in front of everything: a card standing in front of the spawner sent
  // its own spawn to the other end of the battlefield.
  //
  // The ring loop already expands outward from the spawner, so it IS the
  // nearest-open-slot search the fallback was trying to be. Running it to the
  // board's width makes the fallback unnecessary, and "closest to the thing
  // that made it" falls out of the ordering rather than being a special case.
  //
  // Within a ring the forward-then-sideways preference is unchanged and still
  // deliberate — see the note above; it is what keeps a horde packed beside its
  // spawner and screening the right way for whichever seat is asking.
  const reach = radius ?? draft.boardSize - 1;
  for (let ring = 1; ring <= reach; ring++) {
    const ringSlots: { r: number; c: number; ahead: number; sideways: number }[] = [];
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++)
        if (Math.max(Math.abs(dr), Math.abs(dc)) === ring)
          ringSlots.push({
            r: spawner.pos.row + dr, c: spawner.pos.col + dc,
            ahead: dr * fwd, sideways: Math.abs(dc),
          });
    ringSlots.sort((a, b) => b.ahead - a.ahead || a.sideways - b.sideways);
    for (const k of ringSlots) push(k.r, k.c);
  }
  const out: CardInstance[] = [];
  for (const pos of slots.slice(0, count)) {
    const tok = summonCard(draft, owner, tokenDefId, pos);
    if (!draft.humans.includes(owner)) tok.autoMode = "full";
    out.push(tok);
  }
  if (out.length > 0)
    draft.log.push(`${getDef(tokenDefId).name} ×${out.length} spawns.`);
  // A spawn that finds no room used to return silently, which is how "sometimes
  // Zipp doesn't spawn the Drone" stayed a mystery: the card promised a body and
  // the log said nothing at all. If it ever happens again, it says so.
  else
    draft.log.push(`${getDef(tokenDefId).name} has nowhere to deploy — the board is full.`);
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
