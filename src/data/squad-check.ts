/** SQUAD CHECK — the mistakes that measurably cost a squad games, read off a
 *  squad while it is being built, and the fill the builder's Auto-fill uses.
 *
 *  WHAT IS NOT HERE MATTERS AS MUCH AS WHAT IS. The obvious checklist — a
 *  third of the squad cheap, a couple of Tanks, a healer, plenty of reach —
 *  was built first and measured before it shipped, and most of it was wrong.
 *  Each line was tested by taking the fill's own squads (the cost stride over
 *  each of the 28 element pairs) and pushing that one property with
 *  same-cost swaps, then playing every result against all thirty 4x4
 *  premades from both seats (120 games a pair, 3,360 a line):
 *
 *      six cheap cards, made by cutting the dearest      -4.3   (4 of 28 better)
 *      six cheap cards, made by swapping 3s for 2s       +0.1
 *      one more Support                                  +0.5
 *      two more ranged / two fewer ranged                +1.6 / -2.1
 *      one more card at 7+ / one fewer                   +0.5 / -1.2
 *      one more Tank                                     +1.8
 *      EVERY Tank taken out                              +5.6   (18 of 26 better)
 *      the whole first checklist at once                 -4.6
 *
 *  (The swaps take the best card on offer, so small plus signs partly measure
 *  that; the minus signs are the ones to believe.) A line telling players to
 *  add Tanks would have been advice to lose, and one pushing cheap cards would
 *  have cost them their finishers.
 *  What survives is only what the ENGINE guarantees or what flags a squad more
 *  extreme than anything on the premade shelf — the mistakes a player can
 *  make by hand and a tuned list never does. Tips, not rules: `validateDeck`
 *  is the only law about what can be saved, and nothing here blocks a save.
 *
 *  Pure, and in data/ rather than in the builder, so the thresholds are
 *  tested against the shelf they were read from.
 */
import { getDef } from "./cards";
import { autoDeck } from "./story";
import { OPENING_CHEAP_COST, OPENING_CHEAP_MIN } from "../engine/state";
import type { CardDef, Element } from "../engine/types";

export type CheckId = "opening" | "topEnd" | "elements";

/** How a line reads right now.
 *
 *  `short` is the one that keeps this from nagging: a squad six cards in is
 *  not missing its 1-drops, it simply has not got to them yet. A floor only
 *  turns into a warning once the empty slots left could no longer meet it. */
export type CheckState = "ok" | "short" | "warn";

export interface CheckResult {
  id: CheckId;
  state: CheckState;
  have: number;
  /** A floor for `opening`, a ceiling for `topEnd`, the smallest good count
   *  for `elements`. */
  want: number;
}

/** Which cards count toward each counted line. Shared by the check and the
 *  builder's "show me these" lens, so the two cannot disagree. */
export const CHECK_PRED: Record<Exclude<CheckId, "elements">, (d: CardDef) => boolean> = {
  opening: (d) => d.cost <= OPENING_CHEAP_COST,
  topEnd: (d) => d.cost >= 7,
};

/** The numbers, scaled to the squad's size so the campaign's twelve-card caps
 *  get twelve-card advice.
 *
 *    opening  OPENING_CHEAP_MIN. The engine swaps that many 1-cost cards into
 *             every opening hand (state.ts `seedOpeningCurve`), but only ones
 *             the squad owns — and round one pays exactly 1 Gold, which buys
 *             nothing else.
 *    topEnd   a CEILING of two ninths at cost 7+: four of 18, six of 30. That
 *             is the most any premade on either shelf carries, so it flags
 *             only a squad heavier than every tuned list. The heavy end is
 *             where "fill with my best cards" goes, and that fill won 3-14%
 *             (see `autoDeck`). The ceiling does NOT push the other way:
 *             cutting a squad's dearest cards measured -4.3.
 */
export function squadTargets(size: number): Record<Exclude<CheckId, "elements">, number> {
  return {
    opening: Math.min(OPENING_CHEAP_MIN, size),
    topEnd: Math.floor((size * 2) / 9),
  };
}

/** The squad's elements, most-carried first (ties by name, so the order holds
 *  still while you add cards). */
export function squadElements(cards: readonly string[]): Element[] {
  const n = new Map<Element, number>();
  for (const id of cards) {
    const el = getDef(id).element;
    n.set(el, (n.get(el) ?? 0) + 1);
  }
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || a.localeCompare(b));
}

/** Read a squad against the targets for a squad of `size`. */
export function checkSquad(cards: readonly string[], size: number): CheckResult[] {
  const defs = cards.map((id) => getDef(id));
  const room = Math.max(0, size - cards.length);
  const t = squadTargets(size);
  const ones = defs.filter(CHECK_PRED.opening).length;
  const top = defs.filter(CHECK_PRED.topEnd).length;
  // ONE element is the measured negative: the ladder swept mono-element builds
  // and they landed 51-54% against 55-62%, because thirty cards of one element
  // forces its weak ones in and gives up the other element's answers. Two or
  // more is not a claim — eight-element squads measured as well as pairs. A
  // one-element squad with slots still open is only on its way to a second.
  const els = squadElements(cards).length;
  return [
    { id: "opening", have: ones, want: t.opening, state: ones >= t.opening ? "ok" : ones + room >= t.opening ? "short" : "warn" },
    { id: "topEnd", have: top, want: t.topEnd, state: top <= t.topEnd ? "ok" : "warn" },
    { id: "elements", have: els, want: 2, state: els >= 2 ? "ok" : els === 1 && room === 0 ? "warn" : "short" },
  ];
}

// ── the fill ───────────────────────────────────────────────────────────────

/** The most elements a pool can hold before a fill picks some for you. */
export const FILL_ELEMENTS_MAX = 3;

export interface FillOptions {
  /** Elements the player picked in the element row. Used as given — a player
   *  who lit four chips asked for four elements, and narrowing that to a pair
   *  would be the fill overruling the one control that says what to build. */
  elements?: readonly Element[];
  rand?: () => number;
}

/** Which elements a fill should build in.
 *
 *  NOT A POWER CLAIM. The whole-pool stride this replaces landed on a 30.3%
 *  squad on 4x4 and a 62.8% one on 5x5; offset strides over the same eight
 *  elements won 52-80 and 31-71, and pair strides span 26 to 92 — which cards
 *  land matters, the element count does not. Two elements is what a squad
 *  LOOKS like: every premade runs two or three, the spellbook reads as one,
 *  and "built around LEAF + AQUA" is a squad a player can recognise and steer.
 *
 *  THE FILTERS SPEAK FIRST. Elements picked in the element row are used as
 *  given; a pool already down to three elements or fewer — a campaign
 *  collection that only holds that much — is used as it stands. Otherwise the
 *  squad's own elements when it has two or more, a partner for one, and a
 *  random pair for an empty squad (the builder names it; pressing again after
 *  Clear rolls another). Widened, in pool order, when the chosen elements
 *  cannot fill the room: a collection can run out of an element, and a squad
 *  left short is worse than one with a third colour in it. */
export function fillElements(
  picked: readonly string[],
  pool: readonly string[],
  room: number,
  opts: FillOptions = {},
): Element[] {
  const rand = opts.rand ?? Math.random;
  const inPool = squadElements(pool);
  let chosen: Element[];
  if (opts.elements?.length) chosen = inPool.filter((e) => opts.elements!.includes(e));
  else if (inPool.length <= FILL_ELEMENTS_MAX) chosen = inPool;
  else {
    const mine = squadElements(picked).filter((e) => inPool.includes(e));
    if (mine.length >= 2) chosen = mine;
    else if (mine.length === 1) {
      const others = inPool.filter((e) => e !== mine[0]);
      chosen = [mine[0], others[Math.floor(rand() * others.length)]];
    } else {
      const a = Math.floor(rand() * inPool.length);
      let b = Math.floor(rand() * (inPool.length - 1));
      if (b >= a) b++;
      chosen = [inPool[a], inPool[b]];
    }
  }
  const count = (els: Element[]) => pool.filter((id) => els.includes(getDef(id).element)).length;
  for (const e of inPool) {
    if (count(chosen) >= room) break;
    if (!chosen.includes(e)) chosen.push(e);
  }
  return chosen;
}

/** Top a squad up to `size`: the chosen elements, then `autoDeck`'s cost
 *  stride over them — the campaign's own measured fill, and nothing after it.
 *
 *  NOT EVEN SHARES, and that was measured too. One stride over both elements
 *  together can come out lopsided — 13/5 for a few pairs, because ties in the
 *  cost order break on rarity and stat weight — so striding each element to
 *  its own even share looked like the obvious fix, and like the premades'
 *  shape. Against the 5x5 premades it lost 7.0 points (5,040 games a side,
 *  5 of 28 pairs better, and it held on fresh seeds); on 4x4 it came out
 *  +3.6 +- 3.1, nothing. A repair pass that forced the check's first draft
 *  onto the stride's output (a third cheap, Tanks, reach) measured -4.6; see
 *  the banner.
 *
 *  Only ever ADDS. What you picked stays, the same promise the button always
 *  made — it tops up, it never replaces. */
export function fillSquad(
  picked: readonly string[],
  candidates: readonly string[],
  size: number,
  opts: FillOptions = {},
): { cards: string[]; elements: Element[] } {
  const room = size - picked.length;
  if (room <= 0) return { cards: [], elements: [] };
  const have = new Set(picked);
  const pool = [...new Set(candidates)].filter((id) => !have.has(id));
  const elements = fillElements(picked, pool, room, opts);
  const inEls = pool.filter((id) => elements.includes(getDef(id).element));
  return { cards: autoDeck(inEls, room), elements };
}
