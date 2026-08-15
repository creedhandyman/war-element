import { describe, expect, it } from "vitest";
import { CARDS, getDef } from "../../data/cards";
import {
  PACK_COST, applyPack, loadStory, markSeen, markUnseen, newHero, openPack, saveStory,
  type StorySave,
} from "../../data/story";
import { revealOrder } from "../../ui/Shop";

/** The pack is turned over one card at a time, worst first, so the last thing
 *  you see is the best thing you got. That is the whole point of the stack —
 *  a grid hands you the Epic as one tile of five and the pack has no shape.
 */

/** A seeded generator, so a failure names a reproducible pack. */
function rng(seed: number) {
  let x = seed + 0x6d2b79f5;
  return () => {
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANK: Record<string, number> = { rare: 0, epic: 1, legendary: 2, mythic: 3 };
const rank = (id: string) => RANK[getDef(id).rarity ?? "rare"] ?? 0;

describe("pack reveal order", () => {
  it("never puts a better card before a worse one", () => {
    // Every real pack the generator can produce, not a hand-picked five.
    const save: StorySave = { cleared: [], collection: [], pity: {}, deck: [], blight: {} };
    for (let seed = 0; seed < 300; seed++) {
      const pack = openPack(save, rng(seed));
      const order = revealOrder(pack.pulled, pack.shiny);
      const ranks = order.map((i) => rank(pack.pulled[i]));
      for (let k = 1; k < ranks.length; k++) {
        expect(ranks[k], `seed ${seed}: ${order.map((i) => pack.pulled[i]).join(" -> ")}`)
          .toBeGreaterThanOrEqual(ranks[k - 1]);
      }
    }
  });

  it("puts the pack's guarantee last", () => {
    // Every pack holds an Epic or better; that card is the payoff and it is
    // what the last swipe has to turn over.
    const save: StorySave = { cleared: [], collection: [], pity: {}, deck: [], blight: {} };
    for (let seed = 0; seed < 200; seed++) {
      const pack = openPack(save, rng(seed));
      const order = revealOrder(pack.pulled, pack.shiny);
      const last = pack.pulled[order[order.length - 1]];
      expect(rank(last), `seed ${seed}: ended on ${last}`).toBe(Math.max(...pack.pulled.map(rank)));
    }
  });

  it("breaks a rarity tie towards the foil", () => {
    // Two cards of one rarity, one of them shiny: the shiny is the better
    // pull and has to be the later one.
    const pair = CARDS.filter((c) => (c.rarity ?? "rare") === "rare").slice(0, 2).map((c) => c.id);
    expect(pair).toHaveLength(2);
    const order = revealOrder(pair, [pair[0]]);
    expect(pair[order[order.length - 1]]).toBe(pair[0]);
  });

  it("returns every card exactly once", () => {
    // It indexes into `pulled` rather than re-ordering it, so a bug here would
    // drop or double a card in the reveal while the summary still counted five.
    const save: StorySave = { cleared: [], collection: [], pity: {}, deck: [], blight: {} };
    for (let seed = 0; seed < 50; seed++) {
      const pack = openPack(save, rng(seed));
      const order = revealOrder(pack.pulled, pack.shiny);
      expect([...order].sort((a, b) => a - b)).toEqual(pack.pulled.map((_, i) => i));
    }
  });
});

/** The NEW flag on a collection card. A card is "new" from the moment you own
 *  it until the moment you open it, and that is a SAVE field — this project
 *  has already lost one of those to a rebuild that listed fields by name. */
describe("unseen cards", () => {
  const base = (): StorySave => ({ cleared: [], collection: [], pity: {}, deck: [], blight: {} });

  /** The suite runs headless; `loadStory`/`saveStory` want a Storage. Same stub
   *  the story tests use, restored afterwards so it cannot leak across files. */
  function withStorage(body: (store: Map<string, string>) => void) {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try { body(store); } finally { g.localStorage = prior; }
  }

  it("flags what a pack gave you, and only what it gave you", () => {
    const save: StorySave = { ...base(), hero: newHero(), collection: ["leaf_sakuroot"] };
    save.hero!.shards = PACK_COST;
    const pack = openPack(save, rng(7));
    const after = applyPack(save, pack);
    expect(new Set(after.unseen)).toEqual(new Set(pack.fresh));
    // A duplicate is not a new card; it paid essence instead.
    for (const id of pack.pulled) {
      if (!pack.fresh.includes(id)) expect(after.unseen).not.toContain(id);
    }
    expect(after.unseen).not.toContain("leaf_sakuroot");
  });

  it("clears one card without touching the rest", () => {
    const save = markUnseen(base(), ["leaf_sakuroot", "leaf_nettle", "leaf_weeds"]);
    const seen = markSeen(save, "leaf_nettle");
    expect(seen.unseen).toEqual(["leaf_sakuroot", "leaf_weeds"]);
    // Idempotent: opening it twice is not an error and changes nothing.
    expect(markSeen(seen, "leaf_nettle")).toBe(seen);
  });

  it("reads a save written before the field existed as ALL SEEN", () => {
    // The other reading — everything you own is suddenly new — would greet a
    // finished collection with three hundred badges.
    withStorage((store) => {
      store.set("we_story_v1", JSON.stringify(
        { cleared: [], collection: ["leaf_sakuroot"], pity: {}, deck: [], blight: {} }));
      expect(loadStory().unseen).toEqual([]);
    });
  });

  it("survives a save/load round trip, and drops ids you no longer own", () => {
    const save = markUnseen(
      { ...base(), collection: ["leaf_sakuroot", "leaf_nettle"] },
      ["leaf_sakuroot", "leaf_nettle"],
    );
    // A flag for a card that is not in the collection is a badge on a row that
    // does not exist.
    withStorage(() => {
      saveStory({ ...save, collection: ["leaf_sakuroot"] });
      expect(loadStory().unseen).toEqual(["leaf_sakuroot"]);
    });
  });
});
