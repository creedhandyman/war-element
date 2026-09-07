/** DRAFT, THE PICKING HALF — three warbands, then a spellbook.
 *
 *  A pick is a GROUP OF THREE, not a card, and the three share a tribe: Avian,
 *  Zombie, Pirate, Dragon. Eighteen cards is therefore six decisions rather
 *  than eighteen, and each one is about what KIND of squad you are building
 *  instead of which of three strangers is marginally better. The set is already
 *  shaped for it — 29 tribes, every one of them at least three cards deep.
 *
 *  UNTRIBED CARDS STILL GET DRAFTED. Ninety-nine of the 360 draftable cards
 *  carry no tribe at all, and a purely tribal draft would delete a quarter of
 *  the set from the mode. Those form ELEMENT groups instead — three GALE cards
 *  under the banner "GALE" — so the whole pool stays reachable and the format
 *  stays honest about which kind of group you are being offered.
 *
 *  THEN THE SPELLS. They used to be derived from the finished deck's elements,
 *  which is the right default for a deck somebody built on purpose and the
 *  wrong one for a draft: the book is half of what a deck does, and having it
 *  handed to you is a decision taken away. Same shape as the cards — one of
 *  three, until the board's book is full — and every offer is filtered through
 *  the cost-tier law, so a draft can only ever assemble a book the deck builder
 *  would also have allowed.
 *
 *  PURE, with `rand` injected, exactly like the half it replaces.
 */

import { CARDS, getDef } from "./cards";
import { deckSizeFor, rollOpponent, type DeckTier } from "./custom-decks";
import { tierForStreak } from "./matchmaker";
import type { StorySave } from "./story";
import { PACK_WEIGHT } from "./story";
import { SPELLS, spellCapForBoard, spellCostCap } from "../engine/spells";
import type { CardDef, Element, SpellDef } from "../engine";

/** Cards in one group, and groups on the table. Both three, and unrelated:
 *  the first is how big a warband is, the second is how many choices a pick
 *  offers. */
export const GROUP_SIZE = 3;
export const OFFER_SIZE = 3;

/** THE CURVE A DRAFT AIMS AT — measured off the 30 hand-tuned 18-card premades,
 *  which are the decks the game ships as good. Unchanged by the move to groups:
 *  the target is a property of what a deck should look like, not of how it was
 *  assembled. */
export const TARGET_CURVE: Record<string, number> = {
  "1-2": 0.36, "3-4": 0.34, "5-6": 0.18, "7-8": 0.07, "9+": 0.04,
};

/** The least a group's curve weight can fall to. Never 0 — a drafter four
 *  cards over on 9-costs should find heavy groups scarce, not banned. */
export const CURVE_FLOOR = 0.15;

/** Share of a drafted deck that should cost 1 or less.
 *
 *  SEPARATE from `TARGET_CURVE`, which buckets 1 and 2 together — and that
 *  bucketing is exactly what hid the problem. A draft that lands the "1-2"
 *  bucket perfectly can still be all twos, and the two costs are not
 *  interchangeable: gold pays 1 a round until round 6, so a 1-drop is a play on
 *  round one and a 2-drop is a play on round three.
 *
 *  Measured over 600 random drafts before this existed: 17.5% of finished decks
 *  held fewer than two cards costing 1, and 2.5% held none at all — decks the
 *  opening-hand guarantee in `state.ts` cannot help, because there is nothing
 *  cheap in them to guarantee. One of them dealt 1,1,3,3,3,3,5,5,5,5,5,6,7,7,
 *  8,8,9,10: more than half of it uncastable before round ten.
 *
 *  0.18 is a bit over three in an eighteen-card deck. Deliberately below the
 *  0.36 the "1-2" bucket asks for — this is a FLOOR under the cheapest cards,
 *  not a second curve competing with the first. */
export const CHEAP_TARGET = 0.18;
/** What "cheap" means for that floor — the same 1 the opening hand guarantees. */
export const CHEAP_COST = 1;
/** How many of the three offers must hold a cheap card while the drafter is
 *  behind on them.
 *
 *  TWO, not three, and that is the whole design: there is always something
 *  affordable on the table and always one group that was left alone, so a
 *  drafter who wants a greedy warband can still take one. A floor to reach, not
 *  one to be pushed through.
 *
 *  Measured over 600 random drafts — finished decks holding fewer than two
 *  cards costing 1, with the seat alone (no banner weighting):
 *
 *      no floor    17.5%   (2.5% held none at all)
 *      one offer    6.8%
 *      two offers   3.3%
 *      all three    2.2%   — and every choice on the table is steered
 *
 *  With the banner weighting in `rollGroups` on top, two offers lands at 0.3%
 *  short and 0.0% empty, and the 1-2 bucket goes from 31.2% to 35.7% against
 *  its own 36% target — the floor pulled the curve ONTO its aim, because the
 *  drift it corrects is the drift the bucket was already losing to.
 *
 *  Those are with a RANDOM chooser, which takes the cheap group a third of the
 *  time. A person picking with any intent does better than the number says;
 *  what the floor has to survive is the person who does not know yet that they
 *  need to. */
export const CHEAP_OFFERS = 2;

export const costBucket = (cost: number): string =>
  cost <= 2 ? "1-2" : cost <= 4 ? "3-4" : cost <= 6 ? "5-6" : cost <= 8 ? "7-8" : "9+";

/** Three cards that belong together, and why. */
export interface DraftGroup {
  /** "Avian", "Dragon" — or an element, when the three had no tribe to share. */
  label: string;
  kind: "tribe" | "element";
  cards: string[];
}

export interface DraftRun {
  board: number;
  /** Cards taken, in pick order. Three land at a time. */
  picks: string[];
  /** The three groups on the table. Empty once the cards are done. */
  offer: DraftGroup[];
  /** Spells taken. Absent until the card half finishes. */
  spells?: string[];
  /** The three spells on the table. Empty once the book is full. */
  spellOffer?: string[];
  /** Matches won with the finished deck. */
  won?: number;
  /** Matches lost. `DRAFT_LOSSES` of them ends the run. */
  lost?: number;
  /** The premade this run faces next, dealt and stored. */
  seat?: string;
}

const POOL: CardDef[] = CARDS.filter((c) => !c.boss);

const tribesOf = (d: CardDef): string[] =>
  d.tribe == null ? [] : Array.isArray(d.tribe) ? d.tribe : [d.tribe];

/** Every tribe with a card in it, and the untribed pool keyed by element.
 *  Built once — the card set does not change at runtime. */
const BANNERS: { label: string; kind: "tribe" | "element"; ids: string[] }[] = (() => {
  const tribe = new Map<string, string[]>();
  const element = new Map<string, string[]>();
  for (const d of POOL) {
    const ts = tribesOf(d);
    if (ts.length) for (const t of ts) tribe.set(t, [...(tribe.get(t) ?? []), d.id]);
    else element.set(d.element, [...(element.get(d.element) ?? []), d.id]);
  }
  return [
    ...[...tribe.entries()].map(([label, ids]) => ({ label, kind: "tribe" as const, ids })),
    ...[...element.entries()].map(([label, ids]) => ({ label, kind: "element" as const, ids })),
  ];
})();

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

/** How far off its curve the deck-so-far is, per bucket.
 *
 *  PACE-RELATIVE. Against the FINISHED deck's target an empty draft is 6.5
 *  cheap cards behind before it has seen a card, so the first offers would be
 *  nothing but 1-drops. Against the target AT THIS POINT, an empty run is
 *  exactly on pace and every weight is 1 — steering appears only once somebody
 *  drifts, and fades as they come back. */
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

export function leadingElements(picks: readonly string[]): Element[] {
  const n = new Map<Element, number>();
  for (const id of picks) {
    const el = getDef(id).element;
    n.set(el, (n.get(el) ?? 0) + 1);
  }
  return [...n.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([el]) => el);
}

/** Build one group from a banner, or null when it cannot field three.
 *
 *  Rarity is rolled ONCE per group and used as a PREFERENCE rather than a
 *  filter — a tribe of eight cards cannot always field three of one rarity,
 *  and refusing to offer Zombies because they are not all epic would quietly
 *  delete the small tribes. Preferred first, then whatever else the banner has.
 */
function buildGroup(
  banner: { label: string; kind: "tribe" | "element"; ids: string[] },
  taken: ReadonlySet<string>,
  deficit: Record<string, number>,
  rand: () => number,
  /** The drafter is short of 1-drops — hold one of the three slots for one. */
  needCheap: boolean,
): DraftGroup | null {
  const free = banner.ids.filter((id) => !taken.has(id));
  if (free.length < GROUP_SIZE) return null;
  const rarity = weightedPick(Object.keys(PACK_WEIGHT), (r) => PACK_WEIGHT[r] ?? 0, rand);
  const weightOf = (id: string) => {
    const d = getDef(id);
    const curve = Math.max(CURVE_FLOOR, 1 + (deficit[costBucket(d.cost)] ?? 0));
    return curve * (d.rarity === rarity ? 3 : 1);
  };
  const left = [...free];
  const cards: string[] = [];
  // ONE CHEAP CARD, when the drafter is behind on them. Nudging the weights was
  // tried first and measured: multiplying the curve pull by four moved decks
  // with fewer than two 1-drops from 17.5% to 16.3%, because the banner decides
  // what is on offer long before the weighting does — no amount of reweighting
  // finds a 1-drop inside a Dragon warband. A seat is the only thing that
  // works, and it costs the group one of its three slots, not its theme.
  if (needCheap) {
    const cheap = left.filter((id) => getDef(id).cost <= CHEAP_COST);
    const got = cheap.length ? weightedPick(cheap, weightOf, rand) : null;
    if (got) { cards.push(got); left.splice(left.indexOf(got), 1); }
  }
  while (cards.length < GROUP_SIZE && left.length) {
    const got = weightedPick(left, weightOf, rand);
    if (!got) break;
    cards.push(got);
    left.splice(left.indexOf(got), 1);
  }
  return cards.length === GROUP_SIZE
    ? { label: banner.label, kind: banner.kind, cards }
    : null;
}

/** Roll the three groups a pick chooses between. */
export function rollGroups(run: DraftRun, rand: () => number = Math.random): DraftGroup[] {
  const taken = new Set(run.picks);
  const deficit = curveDeficit(run.picks);
  const lead = new Set(leadingElements(run.picks).slice(0, 2));
  // A banner the drafter is already in is likelier to come back, so a squad
  // can actually be built — but SOFT, and only once there is something to
  // follow. Tribes concentrate elements on their own, so this is a nudge on top
  // of that rather than the whole of the pressure the card-at-a-time draft
  // needed.
  const own = new Set(run.picks.flatMap((id) => tribesOf(getDef(id))));
  /** `unmet` = the cheap floor still wants a group. A banner that can actually
   *  field a 1-drop is favoured while it does — because the seat inside
   *  `buildGroup` can only fill from what the banner HAS, and a Dragon warband
   *  has nothing cheap to give however hard the weights push. Measured: without
   *  this, 2.8% of opening offers came up with no affordable group anywhere on
   *  the table, which is the one case the floor exists to prevent. */
  const bannerWeight = (b: typeof BANNERS[number], unmet: boolean) => {
    const canCheap = unmet
      && b.ids.some((id) => !taken.has(id) && getDef(id).cost <= CHEAP_COST);
    const cheapPull = canCheap ? 3 : 1;
    if (run.picks.length === 0) return cheapPull;
    const mine = b.kind === "tribe" ? own.has(b.label) : lead.has(b.label as Element);
    return (mine ? 2.5 : 1) * cheapPull;
  };

  // PACE-RELATIVE, like `curveDeficit` and for the same reason: measured against
  // the finished deck's floor an empty draft is three cheap cards behind before
  // it has seen a card, and every early offer would be a 1-drop. Against the
  // floor AT THIS POINT, a run that is keeping up is never steered at all.
  const haveCheap = run.picks.filter((id) => getDef(id).cost <= CHEAP_COST).length;
  const needCheap = haveCheap < CHEAP_TARGET * (run.picks.length + GROUP_SIZE);

  const usable = BANNERS.filter((b) => b.ids.filter((id) => !taken.has(id)).length >= GROUP_SIZE);
  const out: DraftGroup[] = [];
  const left = [...usable];
  // A FLOOR THE DRAFTER CAN REACH, not one they are pushed through. The seat is
  // held open until ONE group on the table has a cheap card, and then released
  // — so there is always something affordable to take and never an offer where
  // all three choices have been steered. Most of the time it costs nothing at
  // all: a group that came up with a 1-drop on its own clears it.
  let cheapOffers = 0;
  while (out.length < OFFER_SIZE && left.length) {
    const unmet = needCheap && cheapOffers < CHEAP_OFFERS;
    const b = weightedPick(left, (x) => bannerWeight(x, unmet), rand);
    if (!b) break;
    left.splice(left.indexOf(b), 1);
    const g = buildGroup(b, taken, deficit, rand, unmet);
    // Two groups on the table must not be the same banner, which falls out of
    // removing it from `left` above; a banner that cannot field three is simply
    // skipped rather than retried.
    if (g) {
      out.push(g);
      if (g.cards.some((id) => getDef(id).cost <= CHEAP_COST)) cheapOffers++;
    }
  }
  return out;
}

/** Spells legal to offer next: real, unpicked, and inside the cost-tier law.
 *
 *  The tier caps are what stop a drafted book being one the deck builder would
 *  refuse — one spell at cost 5+, two at 3-4, unlimited below. Checked against
 *  what is ALREADY taken, so the offer never shows a spell that could not be
 *  added if picked. */
export function legalSpellOffer(taken: readonly string[]): SpellDef[] {
  const perCost = new Map<number, number>();
  for (const id of taken) {
    const sp = SPELLS.find((s) => s.id === id);
    if (sp) perCost.set(sp.cost, (perCost.get(sp.cost) ?? 0) + 1);
  }
  const has = new Set(taken);
  return SPELLS.filter((s) => !has.has(s.id)
    && (perCost.get(s.cost) ?? 0) < spellCostCap(s.cost));
}

/** HOW OFTEN EACH COST RUNG IS OFFERED, by cost 1..10.
 *
 *  Uniform offers hand a drafter a book they cannot cast. Magic income is
 *  `poolGainForRound` = min(5, ceil(round/5)), so a player has earned about 15
 *  by round 10 and 21 by round 12 — and the median match is ELEVEN rounds, with
 *  Specials spending out of the same pool. A cost-10 spell is more than half
 *  the magic a whole game produces. Counted across 896 real matches, five of
 *  the eight cost-10 spells are never cast by anyone.
 *
 *  So the top of the curve is thinned rather than banned: a finisher still
 *  turns up and is still a real gamble, but a drafted book comes out mostly
 *  castable instead of mostly ornamental. A deck builder can bank for a 10 over
 *  a long game; a six-pick draft cannot plan around one.
 *
 *  Thinned rather than removed because the economy is the real problem and it
 *  is not this module's to fix — see the note on the spell curve. If the magic
 *  income is ever raised, flatten this back toward uniform. */
export const SPELL_COST_PULL: readonly number[] = [
  //  1    2    3    4    5    6    7    8    9   10
  3.0, 3.0, 2.5, 2.0, 1.4, 1.0, 0.6, 0.4, 0.3, 0.3,
];

/** Roll the three spells a pick chooses between.
 *
 *  Weighted toward the ELEMENTS the drafted deck actually plays, because a
 *  book of spells for elements you did not draft is the incoherent book the
 *  derived one at least avoided. Off-element spells still appear — a splash is
 *  a real choice — they are simply rarer. */
export function rollSpellOffer(run: DraftRun, rand: () => number = Math.random): string[] {
  const mine = new Set(run.picks.map((id) => getDef(id).element));
  const pool = legalSpellOffer(run.spells ?? []);
  const weightOf = (s: SpellDef) => (mine.has(s.element) ? 4 : 1) * SPELL_COST_PULL[s.cost - 1]!;
  const out: string[] = [];
  const left = [...pool];
  while (out.length < OFFER_SIZE && left.length) {
    const got = weightedPick(left, weightOf, rand);
    if (!got) break;
    out.push(got.id);
    left.splice(left.indexOf(got), 1);
  }
  return out;
}

export const draftSize = (run: DraftRun): number => deckSizeFor(run.board);
export const draftSpellCap = (run: DraftRun): number => spellCapForBoard(run.board);

/** The card half is done. */
export const cardsComplete = (run: DraftRun): boolean => run.picks.length >= draftSize(run);
/** The book is full. */
export const spellsComplete = (run: DraftRun): boolean =>
  (run.spells?.length ?? 0) >= draftSpellCap(run);
/** Everything is chosen and the run can be played. */
export const draftComplete = (run: DraftRun): boolean =>
  cardsComplete(run) && spellsComplete(run);

/** How many picks are left, of either kind — for a screen that counts down. */
export const picksLeft = (run: DraftRun): number =>
  Math.ceil(Math.max(0, draftSize(run) - run.picks.length) / GROUP_SIZE)
  + Math.max(0, draftSpellCap(run) - (run.spells?.length ?? 0));

export function startDraft(boardSize = 4, rand: () => number = Math.random): DraftRun {
  const run: DraftRun = { board: boardSize, picks: [], offer: [] };
  return { ...run, offer: rollGroups(run, rand) };
}

/** Take a group. Throws on a label that is not on the table, the way `getDef`
 *  throws on an unknown id — a pick that silently does nothing is a lost turn
 *  the player cannot see. */
export function pickGroup(run: DraftRun, label: string, rand: () => number = Math.random): DraftRun {
  const group = run.offer.find((g) => g.label === label);
  if (!group)
    throw new Error(`Draft group ${label} is not on offer (${run.offer.map((g) => g.label).join(", ")})`);
  // Never past the deck size: the last pick of an 18-card draft is still three
  // cards, but a board whose size is not a multiple of three would otherwise
  // overfill. 18 and 30 both divide, so this is a guard rather than a rule.
  const room = draftSize(run) - run.picks.length;
  const picks = [...run.picks, ...group.cards.slice(0, room)];
  const next: DraftRun = { ...run, picks, offer: [] };
  if (!cardsComplete(next)) return { ...next, offer: rollGroups(next, rand) };
  // The cards are done, so the book opens in the same breath. No seat is dealt
  // here any more — the draft is not finished until the book is full, and
  // `pickSpell` deals it at the real finish line.
  return { ...next, spells: [], spellOffer: rollSpellOffer({ ...next, spells: [] }, rand) };
}

/** Take a spell. Same contract as `pickGroup`. */
export function pickSpell(run: DraftRun, id: string, rand: () => number = Math.random): DraftRun {
  if (!run.spellOffer?.includes(id))
    throw new Error(`Draft spell ${id} is not on offer (${(run.spellOffer ?? []).join(", ")})`);
  const spells = [...(run.spells ?? []), id];
  const next: DraftRun = { ...run, spells, spellOffer: [] };
  if (!spellsComplete(next)) return { ...next, spellOffer: rollSpellOffer(next, rand) };
  // THE LAST SPELL IS WHAT OPENS THE RUN, not the last card. It used to be the
  // card half that finished a draft, so the first opponent was dealt there;
  // adding the book moved the finish line and left a playing run with no seat.
  // Dealt here for the same reason it was dealt there — a run that is playing
  // always has an opponent.
  return dealDraftSeat(next, rand);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — the RUN: playing the deck you drafted.
//
// The picking above ends with eighteen cards. This half is what they are for:
// a run of matches against escalating premades that ends on three losses, and
// pays out on the way out. It mirrors gauntlet.ts deliberately — same settle
// shape, same "pure money path" rule, same reason. Whether a win actually paid,
// and paid once, is not a question to answer by playing ten matches in a
// browser.

/** Losses that end a run. Three is the Arena standard, and it is the number
 *  that makes the third match tense rather than the tenth. */
/** The pool id the drafted deck is registered under while its run is live.
 *  Reserved and double-underscored so it can never collide with a premade or a
 *  squad the player named. */
export const DRAFT_DECK_ID = "__draft__";

export const DRAFT_LOSSES = 3;

/** Wins that end a run at the top. Seven, to rhyme with the matchmaker's own
 *  ladder — "the seventh win in a row is an elite deck" — so the two ways to
 *  climb this game describe the same shape. */
export const DRAFT_MAX_WINS = 7;

/** What a run costs to enter, in shards. A pack (PACK_COST) is the anchor: a
 *  draft is the other thing you spend a pack's worth of shards on, and it buys
 *  a deck you cannot keep instead of cards you can. */
export const DRAFT_ENTRY = 50;

/** Shards paid out by wins, on the way out of the run.
 *
 *  MEASURED, not guessed. 150 full runs simulated end to end — a drafter that
 *  takes on-element cards, playing its eighteen against the rungs this run
 *  actually deals, every match played to a real finish:
 *
 *      wins    0     1     2     3     4     5     6     7
 *      runs  7.3%  9.3% 19.3% 19.3% 16.7% 11.3%  4.7% 12.0%
 *      pays    0    10    22    36    54    76   104   140
 *
 *      mean 3.41 wins · 6.2 matches a run
 *      EV 51.4 shards against a 50 entry -> net +1.4
 *
 *  That is the number this table exists to hit: a draft costs a pack and hands
 *  a pack back, so it neither inflates the economy nor punishes you for playing
 *  it. And it is not a farm — six Arena matches at `SHARDS_PER_WIN.arena` (2)
 *  and a coin-flip win rate pay about 6 shards for the same time, so shard-per-
 *  minute the Arena still beats it. Draft is the interesting way to spend an
 *  hour, not the efficient one.
 *
 *  THE KNOWN SENSITIVITY, written down rather than discovered later: the table
 *  climbs steeply at the top, so the EV moves fast with skill. Shift every run
 *  one win better and EV goes 51.4 -> 68.0, i.e. +1.4 -> +18 a run, which WOULD
 *  make this the best earner in the game. Flattening the top rungs is the dial
 *  if that is ever reported; it was left alone here because the measured figure
 *  is right and a hypothetical is not worth churning a good number for. */
export const DRAFT_PAY: readonly number[] = [0, 10, 22, 36, 54, 76, 104, 140];

export const draftWins = (run?: DraftRun): number => run?.won ?? 0;
export const draftLosses = (run?: DraftRun): number => run?.lost ?? 0;

/** The run is finished — out of lives, or at the top. Distinct from
 *  `draftComplete`, which only means the PICKING is done. */
export const draftRunOver = (run?: DraftRun): boolean =>
  !!run && draftComplete(run)
  && (draftLosses(run) >= DRAFT_LOSSES || draftWins(run) >= DRAFT_MAX_WINS);

/** True while the run still wants matches played — picking done, lives left. */
export const draftPlaying = (run?: DraftRun): boolean =>
  !!run && draftComplete(run) && !draftRunOver(run);

/** The difficulty this run is owed next.
 *
 *  Read straight off `tierForStreak` rather than given its own table, so the
 *  draft ladder and the matchmaker ladder cannot describe different games. Wins
 *  are the streak: a draft run has no losses to carry between rungs because
 *  three of them end it outright. */
export const draftTier = (run: DraftRun): DeckTier =>
  tierForStreak(draftWins(run), run.board);

/** Deal the opponent this run faces next, avoiding the one it just fought.
 *
 *  A no-op unless the run is playing, so a half-picked or finished run never
 *  holds a seat it cannot use. */
export function dealDraftSeat(run: DraftRun, rand: () => number = Math.random): DraftRun {
  if (!draftPlaying(run)) return run;
  const pick = rollOpponent(draftTier(run), run.board, run.seat, rand);
  return pick ? { ...run, seat: pick.id } : run;
}

/** Record one match, and deal the next opponent in the same step.
 *
 *  Only counts while the run is actually playing — a match fought in any other
 *  mode must not spend a life, which is the exact bug `settleArena`'s
 *  `gauntletSeat` flag exists to prevent.
 *
 *  The deal rides HERE rather than in the caller because the rung is a function
 *  of the win count: deal before recording and the seat is one rung stale, deal
 *  in a separate step and there is a window where the run is playing with no
 *  opponent. One write, one funnel. */
export function recordDraftResult(
  run: DraftRun,
  won: boolean,
  rand: () => number = Math.random,
): DraftRun {
  if (!draftPlaying(run)) return run;
  const after = won
    ? { ...run, won: draftWins(run) + 1 }
    : { ...run, lost: draftLosses(run) + 1 };
  return dealDraftSeat(after, rand);
}

/** Shards owed, and zero until the run is actually over. Paid once, on the way
 *  out — the same rule `rewardFor` follows for a Gauntlet run. */
export const draftReward = (run?: DraftRun): number =>
  draftRunOver(run) ? (DRAFT_PAY[Math.min(draftWins(run), DRAFT_PAY.length - 1)] ?? 0) : 0;

/** Settle one draft match against the save.
 *
 *  `draftSeat` is stated by the caller rather than inferred from "a run is
 *  live", for the reason written at length on `settleArena`: those are not the
 *  same question, and answering the wrong one ended a Gauntlet run with a
 *  casual match it never dealt. A draft run survives every other mode.
 *
 *  The payout rides the SAME call that records the result, so the money and the
 *  record cannot come apart. */
export function settleDraft(
  save: StorySave,
  opts: { won: boolean; draftSeat?: boolean },
  addShards: (s: StorySave, n: number) => StorySave,
): StorySave {
  const run = save.draft;
  if (!opts.draftSeat || !draftPlaying(run)) return save;
  const after = recordDraftResult(run!, opts.won);
  const paid = draftReward(after);
  const next: StorySave = { ...save, draft: after };
  return paid > 0 ? addShards(next, paid) : next;
}
