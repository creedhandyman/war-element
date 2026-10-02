// PREMADE DECKS IN THE SHOP (owner's call, 2026-10-02): one ready-made deck per
// difficulty, priced at what its cards are worth, less every card the player
// already holds. Buying adds the missing cards to the collection.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { DECK_TIERS } from "../../data/custom-decks";
import {
  CRAFT_COST, PACK_COST, PACK_SIZE, buyPremadeDeck, canBuyPremadeDeck, deckCardShards,
  newHero, newSave, premadeDeckPrice, shopDecks, type StorySave,
} from "../../data/story";

const withShards = (n: number, collection?: string[]): StorySave => {
  const s = newSave();
  return { ...s, collection: collection ?? s.collection, hero: { ...newHero(), shards: n } };
};

describe("the shop's premade decks", () => {
  it("offers one standard-board deck for every difficulty", () => {
    const decks = shopDecks();
    expect(decks.map((d) => d.tier)).toEqual([...DECK_TIERS]);
    for (const { tier, deck } of decks) {
      expect(deck.tier).toBe(tier);
      expect(deck.boardSize).toBe(4);
    }
  });

  it("prices a card from the pack price, keeping the crafter's rarity ratios", () => {
    const per = PACK_COST / PACK_SIZE;
    for (const { deck } of shopDecks())
      for (const id of deck.cards) {
        const r = getDef(id).rarity ?? "rare";
        expect(deckCardShards(id)).toBe(Math.round(per * CRAFT_COST[r] / CRAFT_COST.rare));
      }
  });

  it("knocks off every card already owned, and charges nothing for a complete deck", () => {
    const { deck } = shopDecks()[0];
    const none = premadeDeckPrice(withShards(0, []), deck);
    expect(none.price).toBe(none.full);
    expect(none.owned).toBe(0);

    const half = deck.cards.slice(0, Math.floor(deck.cards.length / 2));
    const some = premadeDeckPrice(withShards(0, half), deck);
    expect(some.price).toBe(none.full - half.reduce((n, id) => n + deckCardShards(id), 0));
    expect(some.owned).toBe(half.length);

    const all = premadeDeckPrice(withShards(0, [...deck.cards]), deck);
    expect(all.price).toBe(0);
    expect(all.missing).toEqual([]);
  });

  it("buying spends the price and adds exactly the missing cards", () => {
    const { deck } = shopDecks()[1];
    const owned = deck.cards.slice(0, 3);
    const start = withShards(10_000, owned);
    const { price, missing } = premadeDeckPrice(start, deck);
    const after = buyPremadeDeck(start, deck);
    expect(after.hero!.shards).toBe(10_000 - price);
    expect(after.collection.filter((id) => id === owned[0])).toHaveLength(1);
    for (const id of deck.cards) expect(after.collection).toContain(id);
    expect(after.collection).toHaveLength(owned.length + missing.length);
    expect(canBuyPremadeDeck(after, deck)).toBe(false); // nothing left to buy
  });

  it("refuses rather than going negative", () => {
    const { deck } = shopDecks()[3];
    const { price } = premadeDeckPrice(withShards(0, []), deck);
    const poor = withShards(price - 1, []);
    expect(canBuyPremadeDeck(poor, deck)).toBe(false);
    expect(buyPremadeDeck(poor, deck)).toBe(poor);
  });

});
