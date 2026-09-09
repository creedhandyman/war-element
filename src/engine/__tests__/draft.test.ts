// DRAFT — warbands, then singles, then a spellbook.
//
// The early picks are GROUPS OF THREE sharing a tribe, so the shape of the
// squad is chosen before any of its gaps are. The LAST SIX are single cards out
// of five, which is the only point in the format where a specific hole can be
// answered — a warband arrives whole, and no amount of reweighting finds a
// 1-drop inside a Dragon warband. Then the book, which used to be derived from
// the finished deck's elements — the right default for a deck somebody built
// and a decision taken away from a drafter.
//
// Half of this file is measurement rather than assertion, for the same reason
// as before: whether a draft produces a playable CURVE cannot be checked on one
// run, only over hundreds, and it is measured against a CONTROL built here.
import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { deckSizeFor } from "../../data/custom-decks";
import { SPELLS, spellCapForBoard, spellCostCap } from "../spells";
import { createInitialState } from "../state";
import { advance } from "../phases";
import {
  CHEAP_COST, CHEAP_OFFERS, GROUP_SIZE, OFFER_SIZE, SINGLE_OFFER, SINGLE_PICKS,
  TARGET_CURVE, cardsComplete, costBucket, curveDeficit, draftComplete, draftSize,
  draftSpellCap, groupCards, inGroupPhase, inSinglePhase, picksLeft, pickCard,
  pickGroup, pickSpell, rollCardOffer, rollGroups, spellsComplete, startDraft,
  type DraftRun,
} from "../../data/draft";

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole draft — warbands, then singles, then spells — by a drafter with no
 *  taste. Three phases now, and it asks the run which one it is in rather than
 *  counting picks itself: the boundary is `groupCards`'s to own. */
function autoDraft(seed: number, board = 4): DraftRun {
  const rand = seeded(seed);
  let run = startDraft(board, rand);
  while (!cardsComplete(run)) {
    run = inGroupPhase(run)
      ? pickGroup(run, run.offer[Math.floor(rand() * run.offer.length)].label, rand)
      : pickCard(run, run.cardOffer![Math.floor(rand() * run.cardOffer!.length)], rand);
  }
  while (!spellsComplete(run))
    run = pickSpell(run, run.spellOffer![Math.floor(rand() * run.spellOffer!.length)], rand);
  return run;
}

/** One pick, in whichever phase the run is in. The tests that step through a
 *  draft assertion-by-assertion use this so none of them has to know where the
 *  phase boundary is — that is `groupCards`'s to own. */
function takeAny(run: DraftRun, rand: () => number): DraftRun {
  return inGroupPhase(run)
    ? pickGroup(run, run.offer[0].label, rand)
    : pickCard(run, run.cardOffer![0], rand);
}

/** THE CONTROL: three cards drawn flat out of the pool, no banners, no
 *  steering. What this format would look like unshaped. */
function uniformDraft(seed: number, board = 4): string[] {
  const rand = seeded(seed);
  const pool = CARDS.filter((c) => !c.boss);
  const picks: string[] = [];
  const taken = new Set<string>();
  while (picks.length < deckSizeFor(board)) {
    const c = pool[Math.floor(rand() * pool.length)];
    if (taken.has(c.id)) continue;
    picks.push(c.id); taken.add(c.id);
  }
  return picks;
}

const curveError = (decks: string[][]): number => {
  const n: Record<string, number> = {};
  let total = 0;
  for (const d of decks) for (const id of d) {
    n[costBucket(getDef(id).cost)] = (n[costBucket(getDef(id).cost)] ?? 0) + 1;
    total++;
  }
  return Object.entries(TARGET_CURVE)
    .reduce((e, [b, want]) => e + Math.abs((n[b] ?? 0) / total - want), 0);
};

const meanTribes = (runs: DraftRun[]): number =>
  runs.reduce((s, r) => {
    const t = new Set<string>();
    for (const id of r.picks) {
      const tr = getDef(id).tribe;
      for (const x of tr == null ? [] : Array.isArray(tr) ? tr : [tr]) t.add(x);
    }
    return s + t.size;
  }, 0) / runs.length;

describe("a pick is a warband, not a card", () => {
  it("offers three groups of three", () => {
    const run = startDraft(4, seeded(1));
    expect(run.offer).toHaveLength(OFFER_SIZE);
    for (const g of run.offer) {
      expect(g.cards, `${g.label} is not a trio`).toHaveLength(GROUP_SIZE);
      expect(new Set(g.cards).size, "a group repeats a card").toBe(GROUP_SIZE);
      for (const id of g.cards) expect(getDef(id).boss ?? false).toBe(false);
    }
  });

  it("every group actually shares the thing it is named after", () => {
    // A banner that does not describe its three is a lie on the button.
    for (let seed = 0; seed < 30; seed++) {
      for (const g of startDraft(4, seeded(seed)).offer) {
        for (const id of g.cards) {
          const d = getDef(id);
          if (g.kind === "tribe") {
            const tr = d.tribe == null ? [] : Array.isArray(d.tribe) ? d.tribe : [d.tribe];
            expect(tr, `${d.id} is not a ${g.label}`).toContain(g.label);
          } else {
            expect(d.element, `${d.id} is not ${g.label}`).toBe(g.label);
          }
        }
      }
    }
  });

  it("never offers the same banner twice at once", () => {
    for (let seed = 0; seed < 30; seed++) {
      const labels = startDraft(4, seeded(seed)).offer.map((g) => g.label);
      expect(new Set(labels).size, "two of the same banner").toBe(labels.length);
    }
  });

  it("takes all three and never offers a taken card again", () => {
    const rand = seeded(7);
    let run = startDraft(4, rand);
    while (inGroupPhase(run)) {
      for (const g of run.offer)
        for (const id of g.cards) expect(run.picks).not.toContain(id);
      const before = run.picks.length;
      run = pickGroup(run, run.offer[0].label, rand);
      expect(run.picks.length - before, "a warband pick is three cards").toBe(GROUP_SIZE);
    }
    // ...and the singles take exactly one, off a table that is also clean.
    while (!cardsComplete(run)) {
      for (const id of run.cardOffer!) expect(run.picks).not.toContain(id);
      const before = run.picks.length;
      run = pickCard(run, run.cardOffer![0], rand);
      expect(run.picks.length - before, "a single pick is one card").toBe(1);
    }
    expect(new Set(run.picks).size, "the deck holds no duplicate").toBe(run.picks.length);
  });

  it("lands on exactly the board's deck size", () => {
    // 18 and 30 both divide by three, so six picks and ten picks land square.
    expect(autoDraft(3).picks).toHaveLength(deckSizeFor(4));
    expect(autoDraft(3, 5).picks).toHaveLength(deckSizeFor(5));
  });

  it("refuses a banner that is not on the table", () => {
    const run = startDraft(4, seeded(5));
    expect(() => pickGroup(run, "Not A Tribe", seeded(5))).toThrow(/not on offer/);
  });

  it("replays identically from a seed", () => {
    expect(autoDraft(42).picks).toEqual(autoDraft(42).picks);
    expect(autoDraft(42).spells).toEqual(autoDraft(42).spells);
    expect(autoDraft(42).picks).not.toEqual(autoDraft(43).picks);
  });
});

describe("then the spellbook", () => {
  it("opens the moment the cards are done, and not before", () => {
    const rand = seeded(11);
    let run = startDraft(4, rand);
    expect(run.spellOffer, "no book while there are cards to take").toBeUndefined();
    while (!cardsComplete(run)) {
      run = takeAny(run, rand);
      if (!cardsComplete(run))
        expect(run.spellOffer, "still no book mid-draft").toBeUndefined();
    }
    expect(run.spells, "the book opens empty").toEqual([]);
    expect(run.spellOffer, "with three on the table").toHaveLength(OFFER_SIZE);
    expect(run.offer, "and the cards are off it").toEqual([]);
  });

  it("fills to the board's cap and then stops", () => {
    const run = autoDraft(9);
    expect(run.spells).toHaveLength(spellCapForBoard(4));
    expect(draftSpellCap(run)).toBe(spellCapForBoard(4));
    expect(spellsComplete(run)).toBe(true);
    expect(draftComplete(run), "cards and book both done").toBe(true);
    expect(run.spellOffer, "nothing left on the table").toEqual([]);
  });

  it("assembles only a book the deck builder would allow", () => {
    // The cost-tier law: one spell at cost 5+, two at 3-4, unlimited below. A
    // draft that could out-build the builder would be a way around the rule.
    for (let seed = 0; seed < 25; seed++) {
      const spells = autoDraft(seed * 31 + 7).spells!;
      expect(new Set(spells).size, "the same spell twice").toBe(spells.length);
      const perCost = new Map<number, number>();
      for (const id of spells) {
        const sp = SPELLS.find((s) => s.id === id)!;
        perCost.set(sp.cost, (perCost.get(sp.cost) ?? 0) + 1);
      }
      for (const [cost, n] of perCost)
        expect(n, `${n} spells at cost ${cost}`).toBeLessThanOrEqual(spellCostCap(cost));
    }
  });

  it("leans toward the elements the deck actually plays", () => {
    // A book for elements you did not draft is the incoherent book the derived
    // one at least avoided. Off-element still appears — a splash is a real
    // choice — so this is a lean, measured over many drafts, not a rule.
    let on = 0, total = 0;
    for (let seed = 0; seed < 60; seed++) {
      const run = autoDraft(seed * 17 + 3);
      const mine = new Set(run.picks.map((id) => getDef(id).element));
      for (const id of run.spells!) {
        total++;
        if (mine.has(SPELLS.find((s) => s.id === id)!.element)) on++;
      }
    }
    expect(on / total, `${(100 * on / total).toFixed(0)}% on-element`).toBeGreaterThan(0.6);
  });

  it("comes out castable, not ornamental", () => {
    // Uniform offers hand a drafter a book they cannot cast. Magic income tops
    // out around 18 across a median 11-round match and Specials spend from the
    // same pool, so a book averaging cost 7 is decoration — and five of the
    // eight cost-10 spells are never cast by anyone in 896 real matches.
    // Measured over 200 drafts: mean book cost 3.48.
    let sum = 0, n = 0, top = 0;
    for (let seed = 0; seed < 120; seed++)
      for (const id of autoDraft(seed * 31 + 7).spells!) {
        const c = SPELLS.find((s) => s.id === id)!.cost;
        sum += c; n++;
        if (c >= 8) top++;
      }
    const mean = sum / n;
    expect(mean, `mean book cost ${mean.toFixed(2)}`).toBeLessThan(4.5);
    // Thinned, not banned — a finisher is still a real gamble worth taking.
    expect(top, "the top of the curve never appears at all").toBeGreaterThan(0);
    expect(top / n, "and it must not dominate").toBeLessThan(0.2);
  });

  it("refuses a spell that is not on the table", () => {
    const rand = seeded(4);
    let run = startDraft(4, rand);
    while (!cardsComplete(run)) run = takeAny(run, rand);
    expect(() => pickSpell(run, "leaf_sprout_not_real", rand)).toThrow(/not on offer/);
  });
});

describe("the countdown", () => {
  it("counts all three stages, so neither the singles nor the book is a surprise", () => {
    // Four warbands, six singles and five spells on the small board: 15.
    const fresh = startDraft(4, seeded(2));
    expect(picksLeft(fresh)).toBe(
      groupCards(fresh) / GROUP_SIZE + SINGLE_PICKS + spellCapForBoard(4),
    );
    expect(picksLeft(fresh), "and that is fifteen, spelled out").toBe(15);
    expect(picksLeft(autoDraft(2)), "nothing left when it is done").toBe(0);
  });

  it("counts DOWN by one per pick, in every phase", () => {
    // The bug this pins: dividing the whole card remainder by three understated
    // a draft in its last six picks, so the countdown jumped four at the
    // boundary and then stalled.
    const rand = seeded(5);
    let run = startDraft(4, rand);
    let left = picksLeft(run);
    while (!cardsComplete(run)) {
      run = takeAny(run, rand);
      const now = picksLeft(run);
      expect(now, `went ${left} -> ${now} at ${run.picks.length} cards`).toBe(left - 1);
      left = now;
    }
    while (!spellsComplete(run)) {
      run = pickSpell(run, run.spellOffer![0], rand);
      expect(picksLeft(run)).toBe(left - 1);
      left = picksLeft(run);
    }
    expect(left).toBe(0);
  });
});

describe("the curve still holds", () => {
  it("starts neutral — an empty draft is on pace by definition", () => {
    for (const v of Object.values(curveDeficit([]))) expect(v).toBe(0);
  });

  it("lands nearer the premade curve than no steering does", () => {
    // Harder than it was card-at-a-time: a group is three cards taken together,
    // so the steering can only choose WHICH trio, never trim one out of it.
    const seeds = Array.from({ length: 90 }, (_, i) => i * 31 + 7);
    const got = curveError(seeds.map((s) => autoDraft(s).picks));
    const flat = curveError(seeds.map((s) => uniformDraft(s)));
    expect(got, `grouped ${got.toFixed(3)} vs uniform ${flat.toFixed(3)}`).toBeLessThan(flat);
  });
});

describe("the shape of a drafted squad", () => {
  it("is built out of a handful of warbands, not a rainbow", () => {
    // The whole point of the format. Eighteen cards from six banners cannot be
    // eighteen unrelated cards, and the banner nudge keeps a drafter who likes
    // a tribe coming back to it.
    const runs = Array.from({ length: 60 }, (_, i) => autoDraft(i * 31 + 7));
    const mean = meanTribes(runs);
    expect(mean, `averaged ${mean.toFixed(1)} tribes across 18 cards`).toBeLessThan(12);
  });

  it("produces a deck the engine will actually play, with its own book", () => {
    // The point of the whole feature, now including the spells the drafter
    // chose rather than a book derived for them.
    for (const seed of [11, 12, 13]) {
      const run = autoDraft(seed);
      let s = createInitialState(seed, run.picks, run.picks, [], run.spells, run.spells, 4);
      let steps = 0;
      while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
      expect(s.phase, `seed ${seed} did not finish`).toBe("gameover");
    }
  });
});

describe("rollGroups", () => {
  it("fills the table while the banners can", () => {
    const run = startDraft(4, seeded(21));
    for (let i = 0; i < 40; i++)
      expect(rollGroups(run, seeded(i)), `seed ${i}`).toHaveLength(OFFER_SIZE);
  });

  it("still fills it deep into a draft, when banners are running thin", () => {
    // Six picks take eighteen cards out of the pool, and a tribe of four is
    // finished after one. The offer must not shrink.
    const rand = seeded(33);
    let run = startDraft(4, rand);
    while (inGroupPhase(run)) {
      expect(run.offer.length, `only ${run.offer.length} groups at pick ${run.picks.length / 3}`)
        .toBe(OFFER_SIZE);
      run = pickGroup(run, run.offer[0].label, rand);
    }
    expect(draftSize(run)).toBe(18);
  });
});

// A DRAFTED DECK YOU CAN PLAY BEFORE ROUND SIX.
//
// `TARGET_CURVE` buckets costs 1 and 2 together, and that bucketing hid this:
// a draft can land the "1-2" bucket perfectly and still be all twos. The two
// are not interchangeable — gold pays 1 a round until round 6, so a 1-drop is a
// play on round one and a 2-drop is a play on round three.
//
// Before the floor, 17.5% of finished decks held fewer than two cards costing 1
// and 2.5% held none. One of them came out 1,1,3,3,3,3,5,5,5,5,5,6,7,7,8,8,9,10
// — more than half of it uncastable before round ten, and nothing the opening
// hand guarantee in state.ts can do about it, because there was nothing cheap
// in the deck to guarantee.
describe("the cheap-card floor", () => {
  const cheap = (ids: readonly string[]) =>
    ids.filter((id) => getDef(id).cost <= CHEAP_COST).length;

  it("leaves almost no deck unplayable, across hundreds of drafts", () => {
    // A random chooser takes the steered group a third of the time, so this is
    // the WORST case for the floor — a person picking with any intent does
    // better. Measured over 600: 17.5% short and 2.5% empty before, 0.3% and
    // 0.0% after. The margins here are loose enough to survive a new tribe.
    let short = 0, none = 0;
    const runs = 300;
    for (let k = 0; k < runs; k++) {
      const c = cheap(autoDraft(k * 977 + 13).picks);
      if (c < 2) short++;
      if (c === 0) none++;
    }
    expect(100 * short / runs, "decks with fewer than two 1-drops").toBeLessThan(4);
    expect(100 * none / runs, "decks with NO 1-drop at all").toBeLessThan(1);
  });

  it("puts something affordable on the table while the drafter is behind", () => {
    // The offer itself, not the finished deck: an empty run is behind by
    // definition, so its first offer has to carry the floor.
    //
    // BEST EFFORT, and the test says so rather than pretending otherwise: the
    // seat inside a group can only fill from what its banner has, and some
    // banners — Dragon, the heavy tribes — hold no 1-drop at any price. What
    // must not happen is an offer with nothing affordable ANYWHERE, and that is
    // what the banner weighting fixed: 2.8% of opening offers before it, 0.4%
    // after.
    let met = 0, any = 0, rolls = 0;
    for (let k = 0; k < 300; k++) {
      const run = startDraft(4, seeded(k * 31 + 7));
      rolls++;
      const withCheap = run.offer.filter((g) => cheap(g.cards) > 0).length;
      if (withCheap >= CHEAP_OFFERS) met++;
      if (withCheap >= 1) any++;
    }
    expect(100 * any / rolls, "offers with NOTHING affordable on the table")
      .toBeGreaterThan(97);
    expect(100 * met / rolls, "offers carrying the full floor").toBeGreaterThan(88);
  });

  it("always leaves one group alone, so a greedy pick stays possible", () => {
    // Two of three, deliberately — a floor to reach, not one to be pushed
    // through. If every offer were steered the drafter would never be able to
    // take a heavy warband, which is a real thing to want.
    expect(CHEAP_OFFERS).toBeLessThan(OFFER_SIZE);
  });

  it("stops steering once the drafter is on pace", () => {
    // Pace-relative, like `curveDeficit`. A run already carrying its cheap
    // cards must be offered whatever the banners give it — otherwise the floor
    // becomes a ceiling on everything else.
    const rand = seeded(4242);
    let run = startDraft(4, rand);
    // Feed it a deck that is already very cheap.
    const cheapIds = CARDS.filter((c) => !c.boss && c.cost <= CHEAP_COST).map((c) => c.id);
    run = { ...run, picks: cheapIds.slice(0, 9) };
    let steered = 0;
    for (let k = 0; k < 60; k++) {
      const offer = rollGroups({ ...run }, seeded(k * 131 + 5));
      steered += offer.filter((g) => cheap(g.cards) > 0).length;
    }
    // With nine 1-drops already banked the floor is satisfied and the offers
    // are whatever the banners rolled — nowhere near every group.
    expect(steered / 60, "groups per offer carrying a 1-drop").toBeLessThan(CHEAP_OFFERS);
  });

  it("does not wreck the curve it already aimed at", () => {
    // The floor sits UNDER `TARGET_CURVE` rather than competing with it. If the
    // 1-2 bucket now overshoots badly, the floor is doing the curve's job.
    let cheapBucket = 0, total = 0;
    for (let k = 0; k < 200; k++)
      for (const id of autoDraft(k * 977 + 13).picks) {
        total++;
        if (costBucket(getDef(id).cost) === "1-2") cheapBucket++;
      }
    // Measured 31.2% before the floor and 35.7% after, against a 36% target —
    // the floor pulled the curve ONTO its own aim rather than off it, because
    // what it corrects is the same drift the bucket was already losing to.
    const share = cheapBucket / total;
    expect(share, "1-2 share").toBeGreaterThan(TARGET_CURVE["1-2"] - 0.06);
    expect(share, "1-2 share").toBeLessThan(TARGET_CURVE["1-2"] + 0.06);
  });
});


describe("the last six are single cards", () => {
  it("the warband half covers everything but the last six, on every board", () => {
    // The format rule, stated once as a subtraction. Both boards divide by
    // three, which is what keeps the last warband from being a short group.
    for (const board of [4, 5]) {
      const run = startDraft(board, seeded(1));
      expect(groupCards(run)).toBe(deckSizeFor(board) - SINGLE_PICKS);
      expect(groupCards(run) % GROUP_SIZE, `board ${board} leaves a part-warband`).toBe(0);
    }
    // Four warbands then six singles on 18; eight then six on 30.
    expect(groupCards(startDraft(4, seeded(1))) / GROUP_SIZE).toBe(4);
    expect(groupCards(startDraft(5, seeded(1))) / GROUP_SIZE).toBe(8);
  });

  it("hands over from warbands to singles exactly once, at the boundary", () => {
    const rand = seeded(9);
    let run = startDraft(4, rand);
    expect(run.cardOffer, "no singles while the warbands are up").toBeUndefined();
    while (inGroupPhase(run)) {
      expect(run.offer, "a warband table").toHaveLength(OFFER_SIZE);
      run = pickGroup(run, run.offer[0].label, rand);
    }
    expect(run.picks).toHaveLength(groupCards(run));
    expect(run.offer, "the banners come off the table").toEqual([]);
    expect(run.cardOffer, "and five cards go on it").toHaveLength(SINGLE_OFFER);
    expect(inSinglePhase(run)).toBe(true);
  });

  it("refuses a card that is not on the table", () => {
    const rand = seeded(13);
    let run = startDraft(4, rand);
    while (inGroupPhase(run)) run = pickGroup(run, run.offer[0].label, rand);
    expect(() => pickCard(run, "leaf_not_a_real_card", rand)).toThrow(/not on offer/);
    // ...and a warband cannot be taken once the banners are down.
    expect(() => pickGroup(run, "Dragon", rand)).toThrow(/not on offer/);
  });

  it("keeps the table full of five to the very last pick", () => {
    const rand = seeded(17);
    let run = startDraft(4, rand);
    while (inGroupPhase(run)) run = pickGroup(run, run.offer[0].label, rand);
    let singles = 0;
    while (!cardsComplete(run)) {
      expect(run.cardOffer, `only ${run.cardOffer!.length} cards on single ${singles + 1}`)
        .toHaveLength(SINGLE_OFFER);
      run = pickCard(run, run.cardOffer![0], rand);
      singles++;
    }
    expect(singles, "six singles, no more and no fewer").toBe(SINGLE_PICKS);
    expect(run.picks).toHaveLength(draftSize(run));
    expect(run.cardOffer, "and the table clears").toEqual([]);
  });

  it("rollCardOffer never repeats itself or offers what is taken", () => {
    for (let seed = 0; seed < 40; seed++) {
      const run = autoDraft(seed);
      const mid: DraftRun = { ...run, picks: run.picks.slice(0, groupCards(run)) };
      const offer = rollCardOffer(mid, seeded(seed));
      expect(offer, `seed ${seed}`).toHaveLength(SINGLE_OFFER);
      expect(new Set(offer).size, "a card twice on one table").toBe(offer.length);
      for (const id of offer) expect(mid.picks).not.toContain(id);
    }
  });

  it("offers something affordable while the drafter is short of cheap cards", () => {
    // The same floor `buildGroup` keeps, and here it has the whole pool to find
    // one in rather than whatever a single banner happened to hold.
    let short = 0;
    for (let seed = 0; seed < 60; seed++) {
      const greedy: DraftRun = {
        board: 4,
        // Twelve cards, none of them cheap — the state the floor exists for.
        picks: CARDS.filter((c) => !c.boss && c.cost >= 5).slice(0, 12).map((c) => c.id),
        offer: [],
      };
      const offer = rollCardOffer(greedy, seeded(seed));
      if (!offer.some((id) => getDef(id).cost <= CHEAP_COST)) short++;
    }
    expect(short, `${short} of 60 tables had nothing affordable on them`).toBe(0);
  });

  it("leans toward tribes already taken, without being unable to look elsewhere", () => {
    // A soft pull, deliberately the weakest term in the weighting: the last six
    // should look like they belong to the squad and still be able to repair it.
    const rand = seeded(4);
    let run = startDraft(4, rand);
    while (inGroupPhase(run)) run = pickGroup(run, run.offer[0].label, rand);
    const own = new Set(run.picks.flatMap((id) => {
      const t = getDef(id).tribe;
      return t == null ? [] : Array.isArray(t) ? t : [t];
    }));
    let inTribe = 0, total = 0;
    for (let seed = 0; seed < 80; seed++)
      for (const id of rollCardOffer(run, seeded(seed))) {
        const t = getDef(id).tribe;
        const ts = t == null ? [] : Array.isArray(t) ? t : [t];
        if (ts.some((x) => own.has(x))) inTribe++;
        total++;
      }
    const share = inTribe / total;
    expect(share, "the pull does nothing at all").toBeGreaterThan(0);
    expect(share, "the offer is only ever your own tribes").toBeLessThan(0.6);
  });
});
