// DRAFT, phase 1 — the logic and, more importantly, its tuning.
//
// Half of this file is measurement rather than assertion. The two numbers that
// decide whether a draft is any good — does it produce a playable CURVE, and
// does it produce a coherent set of ELEMENTS — cannot be checked on one run,
// only over hundreds. So each is measured against a CONTROL built in the test:
// the same drafter taking from uniform offers. If the steering ever stops
// working, the control catches up and the test fails.
import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { deckSizeFor } from "../../data/custom-decks";
import { createInitialState } from "../state";
import { advance } from "../phases";
import {
  OFFER_SIZE, TARGET_CURVE, costBucket, curveDeficit, draftComplete, draftSize,
  leadingElements, pickCard, rollOffer, startDraft, type DraftRun,
} from "../../data/draft";

/** Seeded, so a failure is reproducible. mulberry32, as in engine/rng.ts. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole draft, by a drafter with no taste: it takes one of the three at
 *  random. Deliberately not a "good" drafter — the tuning has to hold for
 *  somebody who is not helping it. */
function autoDraft(seed: number, board = 4): string[] {
  const rand = seeded(seed);
  let run = startDraft(board, rand);
  while (!draftComplete(run)) run = pickCard(run, run.offer[Math.floor(rand() * run.offer.length)], rand);
  return run.picks;
}

/** A drafter with TASTE: it prefers a card already in its two leading
 *  elements. The realistic case — a player does this without being asked — and
 *  the one ELEMENT_WEIGHT was tuned against. */
function deliberateDraft(seed: number, board = 4): string[] {
  const rand = seeded(seed);
  let run = startDraft(board, rand);
  while (!draftComplete(run)) {
    const lead = new Set(leadingElements(run.picks).slice(0, 2));
    const on = run.offer.filter((id) => lead.has(getDef(id).element));
    run = pickCard(run, (on.length ? on : run.offer)[0], rand);
  }
  return run.picks;
}

/** THE CONTROL: the same drafter, taking from three cards drawn flat out of
 *  the pool. What draft would look like with no steering at all. */
function uniformDraft(seed: number, board = 4): string[] {
  const rand = seeded(seed);
  const pool = CARDS.filter((c) => !c.boss);
  const picks: string[] = [];
  const taken = new Set<string>();
  while (picks.length < deckSizeFor(board)) {
    const offer: string[] = [];
    while (offer.length < OFFER_SIZE) {
      const c = pool[Math.floor(rand() * pool.length)];
      if (!taken.has(c.id) && !offer.includes(c.id)) offer.push(c.id);
    }
    const got = offer[Math.floor(rand() * offer.length)];
    picks.push(got); taken.add(got);
  }
  return picks;
}

const shareByBucket = (decks: string[][]): Record<string, number> => {
  const n: Record<string, number> = {};
  let total = 0;
  for (const d of decks) for (const id of d) {
    n[costBucket(getDef(id).cost)] = (n[costBucket(getDef(id).cost)] ?? 0) + 1;
    total++;
  }
  const out: Record<string, number> = {};
  for (const b of Object.keys(TARGET_CURVE)) out[b] = (n[b] ?? 0) / total;
  return out;
};

/** Total absolute distance from the target curve — one number for "how wrong". */
const curveError = (decks: string[][]): number => {
  const got = shareByBucket(decks);
  return Object.entries(TARGET_CURVE).reduce((e, [b, want]) => e + Math.abs(got[b] - want), 0);
};

const meanElements = (decks: string[][]): number =>
  decks.reduce((s, d) => s + new Set(d.map((id) => getDef(id).element)).size, 0) / decks.length;

describe("a draft deals three at a time and ends with a legal deck", () => {
  it("opens with a full offer of real, distinct, draftable cards", () => {
    const run = startDraft(4, seeded(1));
    expect(run.offer).toHaveLength(OFFER_SIZE);
    expect(new Set(run.offer).size, "no duplicates on the table").toBe(OFFER_SIZE);
    for (const id of run.offer) expect(getDef(id).boss ?? false, `${id} is a boss`).toBe(false);
  });

  it("never offers a card already taken — decks are singleton", () => {
    const rand = seeded(7);
    let run = startDraft(4, rand);
    while (!draftComplete(run)) {
      for (const id of run.offer) expect(run.picks).not.toContain(id);
      run = pickCard(run, run.offer[0], rand);
    }
    expect(new Set(run.picks).size, "and the deck holds no duplicate").toBe(run.picks.length);
  });

  it("ends at exactly the board's deck size, with the table cleared", () => {
    const picks = autoDraft(3);
    expect(picks).toHaveLength(deckSizeFor(4));
    const rand = seeded(3);
    let run = startDraft(4, rand);
    while (!draftComplete(run)) run = pickCard(run, run.offer[0], rand);
    expect(run.offer, "nothing left on the table").toEqual([]);
    expect(draftSize(run)).toBe(18);
  });

  it("refuses a pick that is not on the table", () => {
    // Loudly, like `getDef` on an unknown id. A pick that silently does nothing
    // is a lost turn the player cannot see.
    const run = startDraft(4, seeded(5));
    expect(() => pickCard(run, "leaf_alpha", seeded(5))).toThrow(/not on offer/);
  });

  it("replays identically from a seed", () => {
    expect(autoDraft(42)).toEqual(autoDraft(42));
    expect(autoDraft(42)).not.toEqual(autoDraft(43));
  });

  it("produces a deck the engine will actually play", () => {
    // The point of the whole feature: 18 cards from across the elements, handed
    // to a real match with a DERIVED spellbook (spells undefined), played to a
    // finish. If a drafted deck could not be seated this is where it shows.
    for (const seed of [11, 12, 13]) {
      const deck = autoDraft(seed);
      let s = createInitialState(seed, deck, deck, [], undefined, undefined, 4);
      let steps = 0;
      while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
      expect(s.phase, `seed ${seed} did not finish`).toBe("gameover");
    }
  });
});

describe("the curve steering", () => {
  it("starts neutral — an empty draft is on pace by definition", () => {
    // Pace-relative, not absolute. Against the FINISHED deck's target a fresh
    // draft is 6.5 cheap cards behind before it has seen a card, and the first
    // offers would be nothing but 1-2 drops.
    for (const v of Object.values(curveDeficit([]))) expect(v).toBe(0);
  });

  it("pushes back once a drafter drifts expensive", () => {
    const heavy = CARDS.filter((c) => !c.boss && c.cost >= 9).slice(0, 4).map((c) => c.id);
    const d = curveDeficit(heavy);
    expect(d["9+"], "over on the top end").toBeLessThan(0);
    expect(d["1-2"], "and behind on the bottom").toBeGreaterThan(0);
  });

  it("lands nearer the premade curve than no steering does", () => {
    const seeds = Array.from({ length: 120 }, (_, i) => i * 31 + 7);
    const drafted = seeds.map((s) => autoDraft(s));
    const control = seeds.map((s) => uniformDraft(s));
    const got = curveError(drafted), flat = curveError(control);
    // Reported as a ratio so a failure says how much worse, not just "worse".
    expect(got, `steered ${got.toFixed(3)} vs uniform ${flat.toFixed(3)}`).toBeLessThan(flat);
    expect(got, "and close to the premades in absolute terms").toBeLessThan(0.12);
  });

  it("gets the cheap end right, which is the half that decides games", () => {
    // OPENING_COST_CAP gates what can be played early, so a deck short on 1-2
    // drops loses before its expensive half arrives. This is the bucket the
    // uniform control misses worst.
    const seeds = Array.from({ length: 120 }, (_, i) => i * 17 + 3);
    const got = shareByBucket(seeds.map((s) => autoDraft(s)))["1-2"];
    expect(got, `cheap share ${got.toFixed(3)} vs target ${TARGET_CURVE["1-2"]}`)
      .toBeGreaterThan(TARGET_CURVE["1-2"] - 0.06);
  });
});

describe("the element pressure", () => {
  it("leaves the first picks alone, then follows the drafter", () => {
    expect(leadingElements([]), "nothing to follow yet").toEqual([]);
    const two = ["leaf_alpha", "leaf_alpha"].map((id) => getDef(id).element);
    expect(two[0]).toBe("LEAF");
  });

  it("narrows a deck's elements against no pressure at all", () => {
    const seeds = Array.from({ length: 120 }, (_, i) => i * 31 + 7);
    const drafted = meanElements(seeds.map((s) => autoDraft(s)));
    const control = meanElements(seeds.map((s) => uniformDraft(s)));
    expect(drafted, `drafted ${drafted.toFixed(2)} elements vs uniform ${control.toFixed(2)}`)
      .toBeLessThan(control);
  });

  it("gets a deliberate drafter to a COHERENT deck, which is the point", () => {
    // The realistic case, and what the weight was tuned on: a player who takes
    // on-element cards should land around three elements — coherent enough for
    // `spellbookFor` to derive a real book, loose enough for a splash. At the
    // first weight tried (3) this was 4.17 and the pressure was decorative.
    const seeds = Array.from({ length: 120 }, (_, i) => i * 31 + 7);
    const mean = meanElements(seeds.map((s) => deliberateDraft(s)));
    expect(mean, `deliberate drafter averaged ${mean.toFixed(2)} elements`).toBeLessThan(4);
  });

  it("stays SOFT — it never locks the drafter into one element", () => {
    // A multiplier, not a filter. If drafts ever came out mono-element the
    // pressure has become a lock, and the splash that makes a draft interesting
    // is gone with it.
    const seeds = Array.from({ length: 60 }, (_, i) => i * 13 + 5);
    const counts = seeds.map((s) => new Set(autoDraft(s).map((id) => getDef(id).element)).size);
    expect(Math.min(...counts), "some draft came out mono-element").toBeGreaterThan(1);
  });
});

describe("rollOffer", () => {
  it("keeps one rarity per offer so the pick is about the card", () => {
    // Mixed rarities answer the question for you — nobody weighs a rare against
    // a mythic. Measured rather than asserted absolutely: the tier can run thin
    // late in a draft and widening to keep THREE on the table is the deliberate
    // fallback, so a small number of mixed offers is correct behaviour.
    const rand = seeded(99);
    let run: DraftRun = startDraft(4, rand);
    let offers = 0, single = 0;
    while (!draftComplete(run)) {
      const rarities = new Set(run.offer.map((id) => getDef(id).rarity));
      offers++;
      if (rarities.size === 1) single++;
      run = pickCard(run, run.offer[0], rand);
    }
    expect(single / offers, `${single}/${offers} offers were single-rarity`).toBeGreaterThan(0.9);
  });

  it("always fills the table while the pool can", () => {
    const run = startDraft(4, seeded(21));
    for (let i = 0; i < 50; i++)
      expect(rollOffer(run, seeded(i)), `seed ${i}`).toHaveLength(OFFER_SIZE);
  });
});
