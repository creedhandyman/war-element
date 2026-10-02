// THE PACK ELEMENT LEAN (owner's call, 2026-10-01): the player picks an
// element for packs to lean toward — each card has a PACK_LEAN chance to come
// from that element alone, else from the whole set. The first pick is free,
// a change after that costs PACK_LEAN_CHANGE_COST shards. Stored in the gifts
// ledger, so a save that an older build touches keeps it.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import {
  PACK_LEAN, PACK_LEAN_CHANGE_COST, PACK_SIZE, loadStory, newHero, newSave, openPack, packLeanCost,
  packLeanOf, packOdds, saveStory, setPackLean, type StorySave,
} from "../../data/story";

const withShards = (n: number): StorySave => ({ ...newSave(), hero: { ...newHero(), shards: n } });

/** mulberry32: a seeded rand, so the share below is the same every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("choosing the lean", () => {
  it("the first pick is free; a change costs shards; the same pick costs nothing", () => {
    const start = withShards(30);
    expect(packLeanOf(start)).toBeNull();
    expect(packLeanCost(start, "PYRO")).toBe(0);
    const first = setPackLean(start, "PYRO")!;
    expect(packLeanOf(first)).toBe("PYRO");
    expect(first.hero!.shards).toBe(30);
    expect(packLeanCost(first, "PYRO")).toBe(0);
    expect(packLeanCost(first, "AQUA")).toBe(PACK_LEAN_CHANGE_COST);
    expect(packLeanCost(first, null)).toBe(PACK_LEAN_CHANGE_COST);
    // 30 shards cannot pay for a change.
    expect(setPackLean(first, "AQUA")).toBeNull();
    const rich = { ...first, hero: { ...first.hero!, shards: 120 } };
    const changed = setPackLean(rich, "AQUA")!;
    expect(packLeanOf(changed)).toBe("AQUA");
    expect(changed.hero!.shards).toBe(120 - PACK_LEAN_CHANGE_COST);
    expect(changed.gifts!.filter((g) => g.startsWith("packlean:"))).toEqual(["packlean:AQUA"]);
    const cleared = setPackLean(changed, null)!;
    expect(packLeanOf(cleared)).toBeNull();
    expect(cleared.hero!.shards).toBe(120 - 2 * PACK_LEAN_CHANGE_COST);
    expect(setPackLean(withShards(99), "NOT_AN_ELEMENT")).toBeNull();
  });

  it("survives a save and load", () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      saveStory(setPackLean(withShards(0), "DUSK")!);
      expect(packLeanOf(loadStory())).toBe("DUSK");
    } finally { g.localStorage = prior; }
  });
});

describe("what a leaned pack pulls", () => {
  const share = (save: StorySave, el: string, packs = 400) => {
    const rand = seeded(7);
    let hit = 0;
    for (let i = 0; i < packs; i++) hit += openPack(save, rand).pulled.filter((id) => getDef(id).element === el).length;
    return hit / (packs * PACK_SIZE);
  };

  it("about half of every pack is the chosen element, and the rest of the set still turns up", () => {
    const leaned = setPackLean(withShards(0), "BOLT")!;
    const expected = PACK_LEAN + (1 - PACK_LEAN) / 8;
    expect(share(leaned, "BOLT")).toBeGreaterThan(expected - 0.07);
    expect(share(leaned, "BOLT")).toBeLessThan(expected + 0.07);
    expect(share(withShards(0), "BOLT")).toBeLessThan(0.2); // unleaned: about an eighth
    const others = new Set<string>();
    const rand = seeded(3);
    for (let i = 0; i < 50; i++) for (const id of openPack(leaned, rand).pulled) others.add(getDef(id).element);
    expect(others.size).toBe(8);
  });

  it("the quoted odds are the leaned mix, and still sum to one", () => {
    for (const lean of [null, "LEAF", "VOID"]) {
      const sum = Object.values(packOdds(false, lean)).reduce((a, b) => a + b, 0);
      expect(sum, String(lean)).toBeCloseTo(1, 9);
    }
  });
});
