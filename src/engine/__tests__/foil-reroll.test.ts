// FOIL REROLLS (owner's call, 2026-10-01): once a collection is done, spare
// essence buys a reroll in the Crafter — a foil you hold rolls one of the other
// three bonuses for 100 essence of the card's own element, and the player keeps
// the new bonus or the old one (the essence is spent either way). The reroll is
// recorded in the save's gifts ledger (an older build that loads the save keeps
// every gifts string and drops fields it does not know), and stamped on the
// seat in a match, where summoning a foil reads it.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import {
  FOIL_REROLL_COST, FOIL_STATS, foilMark, foilStatFor, foilStatOf, foilStatsFromLedger,
  rollFoilStat, withFoilMark, type FoilStat,
} from "../../data/foils";
import {
  canRerollFoil, foilStatsOf, keepFoilStat, loadStory, newHero, newSave, rerollFoil, saveStory,
  type StorySave,
} from "../../data/story";
import { summonCard } from "../state";
import { prepState } from "./helpers";

const CARD = "leaf_grizzly";
const EL = getDef(CARD).element;

/** A save holding CARD in foil with `essence` of its element. */
function holding(essence: number): StorySave {
  const save = newSave();
  return {
    ...save,
    collection: [...save.collection, CARD],
    hero: { ...newHero(), shiny: [CARD], essence: { [EL]: essence } },
  };
}

describe("the roll", () => {
  it("always lands on one of the OTHER three, and can reach each of them", () => {
    for (const from of FOIL_STATS) {
      const seen = new Set<FoilStat>();
      for (let i = 0; i < 12; i++) seen.add(rollFoilStat(from, () => i / 12));
      expect(seen.has(from), from).toBe(false);
      expect(seen.size, from).toBe(3);
    }
    expect(rollFoilStat("dmg", () => 0.9999999)).not.toBe("dmg");
  });
});

describe("the ledger", () => {
  it("records one stat per card, the latest replacing the last, and ignores junk", () => {
    let gifts = withFoilMark(["ach:first-win"], CARD, "hp");
    gifts = withFoilMark(gifts, CARD, "sp");
    expect(gifts.filter((g) => g.startsWith("foil:"))).toEqual([foilMark(CARD, "sp")]);
    expect(gifts).toContain("ach:first-win");
    expect(foilStatsFromLedger([...gifts, "foil:", "foil:x:nonsense", "foil:y:shield"]))
      .toEqual({ [CARD]: "sp", y: "shield" });
    expect(foilStatOf(CARD, {})).toBe(foilStatFor(CARD)); // no reroll: the hashed stat
  });
});

describe("rerolling in the collection", () => {
  it("needs the foil, and 100 essence of the card's element", () => {
    expect(canRerollFoil({ ...holding(500), hero: { ...newHero(), shiny: [], essence: { [EL]: 500 } } }, CARD).ok)
      .toBe(false);
    expect(canRerollFoil(holding(FOIL_REROLL_COST - 1), CARD).ok).toBe(false);
    expect(canRerollFoil(holding(FOIL_REROLL_COST), CARD).ok).toBe(true);
    expect(rerollFoil(holding(FOIL_REROLL_COST - 1), CARD, () => 0)).toBeNull();
  });

  it("spends the essence and rolls; the card changes only when the new bonus is kept", () => {
    const r = rerollFoil(holding(250), CARD, () => 0.5)!;
    expect(r.from).toBe(foilStatFor(CARD));
    expect(r.to).not.toBe(r.from);
    expect(r.save.hero!.essence[EL]).toBe(250 - FOIL_REROLL_COST);
    expect(foilStatsOf(r.save)[CARD], "nothing kept yet").toBeUndefined();
    // Keep the old: the card is as it was, the essence is still spent.
    const old = keepFoilStat(r.save, CARD, r.from);
    expect(foilStatOf(CARD, foilStatsOf(old))).toBe(r.from);
    expect(old.hero!.essence[EL]).toBe(250 - FOIL_REROLL_COST);
    // Keep the new: remembered.
    const kept = keepFoilStat(r.save, CARD, r.to);
    expect(foilStatsOf(kept)[CARD]).toBe(r.to);
    // A second reroll starts from the kept stat and replaces the record.
    const again = rerollFoil(kept, CARD, () => 0)!;
    expect(again.from).toBe(r.to);
    const kept2 = keepFoilStat(again.save, CARD, again.to);
    expect(kept2.hero!.essence[EL]).toBe(250 - 2 * FOIL_REROLL_COST);
    expect(Object.keys(foilStatsOf(kept2))).toEqual([CARD]);

    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      saveStory(kept2);
      expect(foilStatsOf(loadStory())[CARD]).toBe(again.to);
    } finally { g.localStorage = prior; }
  });
});

describe("in a match", () => {
  it("a rerolled foil is summoned with its NEW stat, not the hashed one", () => {
    const hashed = foilStatFor(CARD);
    const rolled: FoilStat = hashed === "hp" ? "sp" : "hp";
    const summon = (stats?: Record<string, FoilStat>) => {
      const s = prepState();
      s.players.P1.foils = [CARD];
      if (stats) s.players.P1.foilStats = stats;
      return summonCard(s, "P1", CARD, { row: 3, col: 0 } as never);
    };
    const plain = summon();
    const rerolled = summon({ [CARD]: rolled });
    const def = getDef(CARD);
    // The hashed bonus is gone...
    if (hashed === "dmg") expect(rerolled.dmgBonus).toBe(plain.dmgBonus - 1);
    if (hashed === "sp") expect(rerolled.spBonus).toBe(plain.spBonus - 1);
    if (hashed === "shield") expect(rerolled.curShields).toBe(plain.curShields - 1);
    // ...and the rerolled one is there.
    if (rolled === "hp") expect(rerolled.maxHp).toBe(def.hp + 2);
    else expect(rerolled.spBonus).toBe(1);
  });
});
