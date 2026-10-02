// PREMADE DECKS IN THE SHOP (owner's call, 2026-10-02): one ready-made deck per
// difficulty, priced at what its cards are worth, less every card the player
// already holds. Buying adds the missing cards to the collection.
import { describe, expect, it } from "vitest";
import { getDef } from "../../data/cards";
import { DECK_TIERS } from "../../data/custom-decks";
import {
  CRAFT_COST, PACK_COST, PACK_SIZE, buyPremadeDeck, canBuyPremadeDeck, deckCardShards,
  newHero, newSave, premadeDeckPrice, shopDeckPool, shopDecks, shopRefreshAt, shopWeek, type StorySave,
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

// THE WEEKLY SHELF (owner, 2026-10-02): the four decks switch out once a week,
// at random, one per difficulty, with a countdown.
describe("the premade shelf rotates weekly", () => {
  const monday = new Date(2026, 9, 5, 0, 0, 0); // Mon 5 Oct 2026, local midnight
  const weekOf = (n: number) => new Date(2026, 9, 5 + 7 * n, 12, 0, 0);

  it("every week's pick comes from that difficulty's 4x4 pool", () => {
    for (let w = 0; w < 30; w++)
      for (const { tier, deck } of shopDecks(weekOf(w)))
        expect(shopDeckPool(tier).map((d) => d.id)).toContain(deck.id);
  });

  it("holds all week, and changes exactly at Monday midnight", () => {
    const ids = (d: Date) => shopDecks(d).map((x) => x.deck.id).join();
    const sunNight = new Date(2026, 9, 11, 23, 59, 0);
    expect(ids(monday)).toBe(ids(sunNight));
    expect(shopWeek(new Date(2026, 9, 12, 0, 0, 0))).toBe(shopWeek(monday) + 1);
    expect(shopWeek(new Date(2026, 9, 4, 23, 59, 0))).toBe(shopWeek(monday) - 1);
  });

  it("never offers the same deck two weeks running, and gets round to every deck", () => {
    const seen: Record<string, Set<string>> = {};
    for (let w = 0; w < 120; w++) {
      const now = shopDecks(weekOf(w)), next = shopDecks(weekOf(w + 1));
      now.forEach(({ tier, deck }, i) => {
        expect(next[i].deck.id, `${tier} week ${w}`).not.toBe(deck.id);
        (seen[tier] ??= new Set()).add(deck.id);
      });
    }
    for (const tier of DECK_TIERS) expect(seen[tier].size).toBe(shopDeckPool(tier).length);
  });

  it("the countdown points at the next Monday's midnight, through a clock change too", () => {
    // Every hour for a year: DST shifts must not move the turn off midnight.
    for (let t = new Date(2026, 0, 1).getTime(); t < new Date(2027, 0, 1).getTime(); t += 3_600_000) {
      const now = new Date(t);
      const at = shopRefreshAt(now);
      expect(at.getDay()).toBe(1);
      expect(at.getHours()).toBe(0);
      expect(at.getTime()).toBeGreaterThan(t);
      expect(at.getTime() - t).toBeLessThanOrEqual(7 * 86_400_000 + 3_600_000);
      expect(shopWeek(at)).toBe(shopWeek(now) + 1);
    }
  });
});
