// THE FOIL MARKET — the half of each trade the client applies to its own save
// (data/market.ts). The server half is supabase/market.sql.
import { describe, expect, it } from "vitest";
import SQL from "../../../supabase/market.sql?raw";
import { CARDS } from "../../data/cards";
import { addShiny, newHero, newSave, type StorySave } from "../../data/story";
import {
  MARKET_BANDS, MARKET_FEE_PCT, applySettlements, escrowFoil, priceInBand, sellableFoils, sellerTake,
  type MarketSettlement,
} from "../../data/market";

const mythic = CARDS.find((c) => c.rarity === "mythic" && !c.boss)!.id;
const rare = CARDS.find((c) => c.rarity === "rare" && !c.boss)!.id;

const withFoil = (id: string, shards = 0): StorySave => {
  const s = newSave();
  return addShiny({ ...s, collection: [...new Set([...s.collection, id])], hero: { ...newHero(), shards } }, [id]);
};
const settle = (o: Partial<MarketSettlement>): MarketSettlement =>
  ({ id: "L1", role: "seller", outcome: "sold", card_id: mythic, rarity: "mythic", price: 1000, ...o });

describe("market rules", () => {
  it("the price bands match the server's CHECK exactly", () => {
    for (const [r, b] of Object.entries(MARKET_BANDS))
      expect(SQL, r).toMatch(new RegExp(`rarity = '${r}'\\s+and price between\\s+${b.min} and\\s+${b.max}`));
    expect(MARKET_BANDS.mythic.min).toBe(1000); // the owner's anchor
  });

  it("checks a price against its rarity's band", () => {
    expect(priceInBand(mythic, 1000)).toBe(true);
    expect(priceInBand(mythic, 999)).toBe(false);
    expect(priceInBand(rare, 400)).toBe(true);
    expect(priceInBand(rare, 401)).toBe(false);
    expect(priceInBand(rare, 80.5)).toBe(false);
  });

  it("listing takes the foil finish but leaves the card", () => {
    const s = withFoil(mythic);
    const e = escrowFoil(s, mythic)!;
    expect(e.hero!.shiny).not.toContain(mythic);
    expect(e.collection).toContain(mythic);
    expect(escrowFoil(e, mythic)).toBeNull(); // not held any more
  });

  it("sells only foils of ordinary cards", () => {
    const boss = CARDS.find((c) => c.boss)!.id;
    const s = addShiny(withFoil(mythic), [boss]);
    expect(sellableFoils(s)).toEqual([mythic]);
  });

  it("a sale pays the seller the price less the fee, once", () => {
    const s = escrowFoil(withFoil(mythic, 10), mythic)!;
    const once = applySettlements(s, [settle({})]);
    expect(once.save.hero!.shards).toBe(10 + sellerTake(1000));
    expect(sellerTake(1000)).toBe(1000 - 1000 * MARKET_FEE_PCT / 100);
    const again = applySettlements(once.save, [settle({})]);
    expect(again.save).toBe(once.save);
    expect(again.notes).toEqual([]);
  });

  it("a cancelled or expired listing gives the foil back", () => {
    const s = escrowFoil(withFoil(mythic), mythic)!;
    for (const outcome of ["cancelled", "expired"] as const) {
      const r = applySettlements(s, [settle({ id: outcome, outcome })]);
      expect(r.save.hero!.shiny, outcome).toContain(mythic);
    }
  });

  it("a purchase charges the buyer and gives the card in foil", () => {
    const s = { ...newSave(), hero: { ...newHero(), shards: 1500 } };
    const r = applySettlements(s, [settle({ role: "buyer", id: "L2" })]);
    expect(r.save.hero!.shards).toBe(500);
    expect(r.save.collection).toContain(mythic);
    expect(r.save.hero!.shiny).toContain(mythic);
    // Applied once only.
    expect(applySettlements(r.save, [settle({ role: "buyer", id: "L2" })]).save.hero!.shards).toBe(500);
  });

  it("the seller's and buyer's halves of one listing are separate marks", () => {
    const s = { ...withFoil(mythic, 0) };
    const r = applySettlements(s, [settle({ role: "seller" }), settle({ role: "buyer" })]);
    expect(r.notes).toHaveLength(2);
  });
});
