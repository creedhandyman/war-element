// DRAFT — three warbands a pick, then a spellbook.
//
// A pick is a GROUP OF THREE sharing a tribe, so eighteen cards is six
// decisions about what KIND of squad you are building rather than eighteen
// about which of three strangers is marginally better. Then the book, which
// used to be derived from the finished deck's elements — the right default for
// a deck somebody built and a decision taken away from a drafter.
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
  GROUP_SIZE, OFFER_SIZE, TARGET_CURVE, cardsComplete, costBucket, curveDeficit,
  draftComplete, draftSize, draftSpellCap, picksLeft, pickGroup, pickSpell,
  rollGroups, spellsComplete, startDraft, type DraftRun,
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

/** A whole draft — groups then spells — by a drafter with no taste. */
function autoDraft(seed: number, board = 4): DraftRun {
  const rand = seeded(seed);
  let run = startDraft(board, rand);
  while (!cardsComplete(run))
    run = pickGroup(run, run.offer[Math.floor(rand() * run.offer.length)].label, rand);
  while (!spellsComplete(run))
    run = pickSpell(run, run.spellOffer![Math.floor(rand() * run.spellOffer!.length)], rand);
  return run;
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
    while (!cardsComplete(run)) {
      for (const g of run.offer)
        for (const id of g.cards) expect(run.picks).not.toContain(id);
      const before = run.picks.length;
      run = pickGroup(run, run.offer[0].label, rand);
      expect(run.picks.length - before, "a pick is three cards").toBe(GROUP_SIZE);
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
    while (!cardsComplete(run)) run = pickGroup(run, run.offer[0].label, rand);
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
    while (!cardsComplete(run)) run = pickGroup(run, run.offer[0].label, rand);
    expect(() => pickSpell(run, "leaf_sprout_not_real", rand)).toThrow(/not on offer/);
  });
});

describe("the countdown", () => {
  it("counts both stages, so the book is never a surprise", () => {
    // Six group picks and five spell picks on the small board.
    const fresh = startDraft(4, seeded(2));
    expect(picksLeft(fresh)).toBe(deckSizeFor(4) / GROUP_SIZE + spellCapForBoard(4));
    expect(picksLeft(autoDraft(2)), "nothing left when it is done").toBe(0);
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
    while (!cardsComplete(run)) {
      expect(run.offer.length, `only ${run.offer.length} groups at pick ${run.picks.length / 3}`)
        .toBe(OFFER_SIZE);
      run = pickGroup(run, run.offer[0].label, rand);
    }
    expect(draftSize(run)).toBe(18);
  });
});
