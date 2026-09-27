// The Shop quotes pack odds, and it used to quote the wrong thing. PACK_WEIGHT
// is a weight PER CARD — `pullOne` sums it over the whole pool — and the bar
// printed the weights themselves as if they were per-slot percentages, which
// put a Mythic at 2% when a pull lands one about a quarter of a percent of the
// time. `packOdds` is what the Shop reads now; this pins it three ways: it is a
// distribution, it matches the pool counted longhand, and it is what
// `openPack` actually rolls.

import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import { PACK_SIZE, PACK_WEIGHT, newSave, openPack, packOdds } from "../../data/story";

const EPIC_UP = ["epic", "legendary", "mythic"];
const sum = (o: Record<string, number>): number => Object.values(o).reduce((n, v) => n + v, 0);

/** The pool counted longhand from the RULE — every non-boss card, and for the
 *  guaranteed slot only the Epic-and-up ones — weighed and divided. Written out
 *  here rather than calling `packPool`, so a helper that drifted from the rule
 *  could not agree with itself. */
function bruteForce(guaranteed: boolean): Record<string, number> {
  const pool = CARDS.filter((c) => !c.boss && (!guaranteed || EPIC_UP.includes(c.rarity ?? "")));
  const by: Record<string, number> = {};
  let total = 0;
  for (const c of pool) {
    const r = c.rarity ?? "rare";
    const w = PACK_WEIGHT[r] ?? 0;
    by[r] = (by[r] ?? 0) + w;
    total += w;
  }
  return Object.fromEntries(Object.entries(by).map(([r, w]) => [r, w / total]));
}

/** Seeded, so the sampling test below is exact on every run, not merely likely. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("pack odds are the odds a pack really rolls", () => {
  it("sum to 1, for an ordinary pull and for the guaranteed last card", () => {
    expect(sum(packOdds())).toBeCloseTo(1, 12);
    expect(sum(packOdds(true))).toBeCloseTo(1, 12);
  });

  it("match a brute-force count of the pool, rarity by rarity", () => {
    for (const guaranteed of [false, true]) {
      const got = packOdds(guaranteed);
      const want = bruteForce(guaranteed);
      expect(Object.keys(got).sort(), `${guaranteed}`).toEqual(Object.keys(want).sort());
      for (const r of Object.keys(want))
        expect(got[r], `${r}${guaranteed ? " (guaranteed slot)" : ""}`).toBeCloseTo(want[r], 12);
    }
  });

  it("the guaranteed card is Epic or better, and nothing else", () => {
    const g = packOdds(true);
    expect(g.rare ?? 0).toBe(0);
    for (const r of EPIC_UP) expect(g[r] ?? 0, r).toBeGreaterThan(0);
  });

  it("are NOT the raw weights — the misreading they replaced", () => {
    // Weight share and real share agree only when every rarity has the same
    // number of cards. There are far fewer Mythics than Rares.
    expect(packOdds().mythic).toBeLessThan((PACK_WEIGHT.mythic ?? 0) / sum(PACK_WEIGHT));
  });

  it("are what openPack pulls, measured over thousands of packs", () => {
    // The first PACK_SIZE - 1 cards are always ordinary pulls; the last one is
    // the guarantee's only when nothing Epic-or-better came before it, and an
    // ordinary pull otherwise — so it is counted on whichever table it rolled.
    const rand = mulberry32(20260926);
    const save = newSave();
    const seen: Record<string, number> = {};
    const seenG: Record<string, number> = {};
    let n = 0;
    let nG = 0;
    const rarity = (id: string) => getDef(id).rarity ?? "rare";
    for (let pack = 0; pack < 3000; pack++) {
      const { pulled } = openPack(save, rand);
      const head = pulled.slice(0, PACK_SIZE - 1);
      for (const id of head) { seen[rarity(id)] = (seen[rarity(id)] ?? 0) + 1; n++; }
      const last = rarity(pulled[PACK_SIZE - 1]);
      if (head.some((id) => EPIC_UP.includes(rarity(id)))) { seen[last] = (seen[last] ?? 0) + 1; n++; }
      else { seenG[last] = (seenG[last] ?? 0) + 1; nG++; }
    }
    const odds = packOdds();
    for (const r of Object.keys(odds))
      expect(Math.abs((seen[r] ?? 0) / n - odds[r]), `${r}: saw ${seen[r] ?? 0}/${n}`).toBeLessThan(0.02);
    const g = packOdds(true);
    expect(nG, "the guarantee fired often enough to measure").toBeGreaterThan(200);
    for (const r of Object.keys(g))
      expect(Math.abs((seenG[r] ?? 0) / nG - g[r]), `${r} (guaranteed): saw ${seenG[r] ?? 0}/${nG}`).toBeLessThan(0.05);
  });
});
