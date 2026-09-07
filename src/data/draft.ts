/** DRAFT — build a deck out of cards you do not own, three at a time.
 *
 *  Arena-style, not booster draft, and the deck rules are what decide that.
 *  `DECK_LIMITS` is `{min: 18, max: 18, target: 18}` — a deck is one EXACT size,
 *  there is no range. A booster draft hands you ~45 cards and makes you cut to
 *  18, which is the hardest screen in the feature and the one most likely to
 *  stop a player halfway. Picking N times where N is the deck size makes the
 *  size fall out for free, needs no pass-around and no seven bot drafters, and
 *  is one decision per screen — which is the shape a phone wants.
 *
 *  PURE. Every function here takes its randomness as an argument, the way
 *  `startRun` in gauntlet.ts does, so a test can pin a draft and the tuning
 *  below can be measured over thousands of runs instead of argued about.
 *
 *  THE RUN CARRIES ITS OWN OFFER. It is stored rather than derived on render
 *  for the same reason `GauntletRun` stores its dealt `seats`: an offer that
 *  regenerated on mount could be re-rolled by leaving the screen and coming
 *  back, and "close the app until you like the three" is not a draft.
 *
 *  This is phase 1 — the logic and its tuning. No UI, no rewards, no opponents;
 *  those are later phases and they do not get to change the numbers here.
 */

import { CARDS, getDef } from "./cards";
import { deckSizeFor } from "./custom-decks";
import { PACK_WEIGHT } from "./story";
import type { CardDef, Element } from "../engine";

/** How many cards a pick chooses between. */
export const OFFER_SIZE = 3;

/** Picks taken before element pressure starts. The first few are where a
 *  drafter finds a lane; biasing them would be choosing the lane for them. */
export const OPEN_PICKS = 3;

/** How many of the drafter's own elements the pressure favours. Two, not one:
 *  a deck's spellbook is derived from its elements (`spellbookFor`), and one
 *  element derives a thin book while eight derive an incoherent one. */
export const PRESSURE_ELEMENTS = 2;

/** How much likelier a card in one of those elements is to be shown. SOFT — a
 *  multiplier rather than a filter, so a splash is always still possible and an
 *  off-element bomb can still turn up and tempt you.
 *
 *  SIX, measured rather than guessed. Distinct elements in a finished 18-card
 *  deck, over 250 drafts, by a drafter that picks at random and by one that
 *  prefers its own two leading elements (the realistic case — a player does
 *  this without being asked):
 *
 *      weight    random    deliberate     curve error
 *         3       6.68        4.17           0.058
 *         6       5.82        3.00           0.059
 *        10       5.26        2.61           0.055
 *        16       4.56        2.36           0.058
 *
 *  The first number tried was 3, and it barely worked: 6.68 of 8 elements is
 *  still a mush, and a mush is what derives an incoherent spellbook — the exact
 *  thing the pressure exists to prevent. At 6 a deliberate drafter lands on
 *  THREE elements, which is coherent with room for a splash, while a random one
 *  still spreads across 5.8, so nothing is being forced on anybody. Past 10 the
 *  deliberate figure stops moving and the pressure is only taking choices away.
 *
 *  The curve error does not move across any of them, which is worth stating:
 *  the two weights multiply and they do not fight. Tuning one will not silently
 *  undo the other. */
export const ELEMENT_WEIGHT = 6;

/** THE CURVE A DRAFT AIMS AT, measured off the 30 hand-tuned 18-card premades
 *  rather than chosen — those are the decks the game ships as "good".
 *
 *  It matters because the raw pool is meaningfully more top-heavy than any
 *  tuned deck (pool vs premades: 27/36 cheap, 34/34, 23/18, 11/7, 5/4), so
 *  UNIFORM offers hand a drafter a deck more expensive than anything the game
 *  itself would build. With `OPENING_COST_CAP` gating what can be played early,
 *  a top-heavy draft deck simply loses. */
export const TARGET_CURVE: Record<string, number> = {
  "1-2": 0.36, "3-4": 0.34, "5-6": 0.18, "7-8": 0.07, "9+": 0.04,
};

/** The least a bucket's weight can fall to. Never 0: a drafter who is four
 *  cards over on 9-costs should find them scarce, not banned — the card pool
 *  going visibly silent reads as a bug. */
export const CURVE_FLOOR = 0.15;

export const costBucket = (cost: number): string =>
  cost <= 2 ? "1-2" : cost <= 4 ? "3-4" : cost <= 6 ? "5-6" : cost <= 8 ? "7-8" : "9+";

export interface DraftRun {
  /** The battlefield this draft is for — it decides how many picks there are. */
  board: number;
  /** Cards taken, in pick order. This IS the deck when the run completes. */
  picks: string[];
  /** The ids currently on the table. Empty once the draft is done. */
  offer: string[];
}

/** Bosses are not draftable, for the same reason they are not pullable. */
const POOL: CardDef[] = CARDS.filter((c) => !c.boss);

/** One weighted choice. Weights need not sum to anything. */
function weightedPick<T>(items: readonly T[], weightOf: (t: T) => number, rand: () => number): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items.length ? items[Math.floor(rand() * items.length)] ?? null : null;
  let r = rand() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

/** The elements this drafter is actually in, commonest first. */
export function leadingElements(picks: readonly string[]): Element[] {
  const n = new Map<Element, number>();
  for (const id of picks) {
    const el = getDef(id).element;
    n.set(el, (n.get(el) ?? 0) + 1);
  }
  return [...n.entries()]
    // Ties break by name so a run replays identically — the same reason
    // Creeping Dark picks its victim by lowest HP and then by instance id.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([el]) => el);
}

/** How badly the deck-so-far is off its curve, per bucket.
 *
 *  PACE-RELATIVE, not absolute, and that is the whole design of it. Measured
 *  against the finished deck's target, a fresh draft is 6.5 cheap cards
 *  "behind" before it has seen a single card, so the first offers would be
 *  almost entirely 1-2 drops and the drafter would never be shown an expensive
 *  card at all. Measured against what the target would be AT THIS POINT in the
 *  draft, an empty run is exactly on pace and every weight is 1 — the steering
 *  only appears once somebody actually drifts, and it fades as they come back.
 */
export function curveDeficit(picks: readonly string[]): Record<string, number> {
  const have: Record<string, number> = {};
  for (const id of picks) {
    const b = costBucket(getDef(id).cost);
    have[b] = (have[b] ?? 0) + 1;
  }
  const out: Record<string, number> = {};
  for (const [b, share] of Object.entries(TARGET_CURVE))
    out[b] = share * picks.length - (have[b] ?? 0);
  return out;
}

/** Roll the three cards a pick chooses between.
 *
 *  RARITY IS ROLLED ONCE FOR THE WHOLE OFFER, not per card, and the three are
 *  drawn from that one tier. Mixed rarities would make most picks answer
 *  themselves — nobody weighs a rare against a mythic — and a draft where the
 *  choice is obvious is a draft with no choosing in it. Same weights the shop's
 *  packs use, so the rarity a drafter sees matches the rarity they know.
 */
export function rollOffer(run: DraftRun, rand: () => number = Math.random): string[] {
  const taken = new Set(run.picks);
  const deficit = curveDeficit(run.picks);
  const lead = new Set(
    run.picks.length >= OPEN_PICKS ? leadingElements(run.picks).slice(0, PRESSURE_ELEMENTS) : [],
  );

  const rarity = weightedPick(
    Object.keys(PACK_WEIGHT),
    (r) => PACK_WEIGHT[r] ?? 0,
    rand,
  );

  let candidates = POOL.filter((c) => !taken.has(c.id) && c.rarity === rarity);
  // WIDEN RATHER THAN SHOW TWO. A tier can run thin late in a long draft
  // (mythic is the smallest at 40 cards), and an offer of two is a different
  // game from an offer of three. Falling back to the whole pool keeps the size
  // constant; the rarity was a texture choice, the count is a rule.
  if (candidates.length < OFFER_SIZE) candidates = POOL.filter((c) => !taken.has(c.id));

  const weightOf = (c: CardDef): number => {
    const curve = Math.max(CURVE_FLOOR, 1 + (deficit[costBucket(c.cost)] ?? 0));
    return curve * (lead.has(c.element) ? ELEMENT_WEIGHT : 1);
  };

  const offer: string[] = [];
  const left = [...candidates];
  while (offer.length < OFFER_SIZE && left.length) {
    const got = weightedPick(left, weightOf, rand);
    if (!got) break;
    offer.push(got.id);
    left.splice(left.indexOf(got), 1);
  }
  return offer;
}

/** Open a draft for a battlefield, with its first offer on the table. */
export function startDraft(boardSize = 4, rand: () => number = Math.random): DraftRun {
  const run: DraftRun = { board: boardSize, picks: [], offer: [] };
  return { ...run, offer: rollOffer(run, rand) };
}

export const draftSize = (run: DraftRun): number => deckSizeFor(run.board);

export const draftComplete = (run: DraftRun): boolean => run.picks.length >= draftSize(run);

/** Take one of the three. Returns a NEW run — the offer is rolled here, at the
 *  moment of the pick, so it is a fact about the run rather than about when the
 *  screen last rendered.
 *
 *  Throws on an id that is not on the table, the way `getDef` throws on an
 *  unknown card: a pick that silently does nothing is a lost turn the player
 *  cannot see, and every caller of this has the offer in front of it. */
export function pickCard(run: DraftRun, id: string, rand: () => number = Math.random): DraftRun {
  if (!run.offer.includes(id))
    throw new Error(`Draft pick ${id} is not on offer (${run.offer.join(", ")})`);
  const picks = [...run.picks, id];
  const next: DraftRun = { ...run, picks, offer: [] };
  return draftComplete(next) ? next : { ...next, offer: rollOffer(next, rand) };
}
