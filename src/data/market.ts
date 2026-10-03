/** THE FOIL MARKET — the rules, applied to the player's own save (owner,
 *  2026-10-03: "players trade foils they don't want for shards").
 *
 *  The server (supabase/market.sql) holds the LISTINGS: one buyer per listing,
 *  the price band, five live listings a seller, seven days a listing. Everything
 *  a player OWNS still lives in their save, so each side applies its own half of
 *  a trade here, from the ledger the server keeps:
 *
 *    listing   the foil finish leaves the seller's save (`escrowFoil`) — the
 *              plain card stays; a foil is the finish, not the only copy.
 *    sold      the seller is paid the price less MARKET_FEE_PCT.
 *    cancelled / expired   the foil finish comes back to the seller.
 *    bought    the buyer pays the price and gains the card (if new) in foil.
 *
 *  Every settlement is applied ONCE, guarded by a mark in the save's gifts
 *  ledger (`mkt:<listing>:<role>`), so retrying after a crash — the server only
 *  forgets a settlement when the client acknowledges it — can never pay twice.
 *  Pure: no network here. */
import { getDef } from "./cards";
import { addShards, addShiny, isShiny, type StorySave } from "./story";

export type MarketRarity = "rare" | "epic" | "legendary" | "mythic";

/** The price band per rarity, in shards: the crafting cost ratios (4 : 8 : 16 :
 *  50) anchored on a Mythic foil at 1,000 (owner). Mirrored by the
 *  `market_price_band` CHECK in supabase/market.sql — change both. */
export const MARKET_BANDS: Readonly<Record<MarketRarity, { min: number; max: number }>> = {
  rare: { min: 80, max: 400 },
  epic: { min: 160, max: 800 },
  legendary: { min: 320, max: 1600 },
  mythic: { min: 1000, max: 5000 },
};
/** The market's cut of a sale — a shard sink, and a brake on flipping. */
export const MARKET_FEE_PCT = 10;
export const MARKET_MAX_LISTINGS = 5;
export const MARKET_LISTING_DAYS = 7;

export const rarityOf = (defId: string): MarketRarity => (getDef(defId).rarity ?? "rare") as MarketRarity;
export const priceInBand = (defId: string, price: number): boolean => {
  const b = MARKET_BANDS[rarityOf(defId)];
  return Number.isInteger(price) && price >= b.min && price <= b.max;
};
/** What the seller receives for a sale at `price`. */
export const sellerTake = (price: number): number => Math.floor(price * (100 - MARKET_FEE_PCT) / 100);

/** The foils this save may put up for sale: held in foil, not a boss or token. */
export function sellableFoils(save: StorySave): string[] {
  return (save.hero?.shiny ?? []).filter((id) => {
    try {
      const d = getDef(id);
      return !d.boss && !id.endsWith("_tok") && d.rarity != null;
    } catch {
      return false;
    }
  });
}

/** Take the foil finish off the seller's card for the life of a listing. The
 *  plain card stays in the collection. Null when the save does not hold it. */
export function escrowFoil(save: StorySave, defId: string): StorySave | null {
  if (!isShiny(save, defId) || !save.hero) return null;
  return { ...save, hero: { ...save.hero, shiny: save.hero.shiny.filter((id) => id !== defId) } };
}

/** One line of the server's ledger (`market_pending`). */
export interface MarketSettlement {
  id: string;
  role: "seller" | "buyer";
  outcome: "sold" | "cancelled" | "expired";
  card_id: string;
  rarity: string;
  price: number;
}

const markOf = (s: MarketSettlement) => `mkt:${s.id}:${s.role}`;

/** Apply settlements to the save, each at most once. Returns the new save and
 *  a plain-language line per settlement actually applied (for a toast). */
export function applySettlements(
  save: StorySave,
  list: readonly MarketSettlement[],
): { save: StorySave; notes: string[] } {
  let next = save;
  const notes: string[] = [];
  for (const s of list) {
    if ((next.gifts ?? []).includes(markOf(s))) continue;
    let name = s.card_id;
    try { name = getDef(s.card_id).name; } catch { /* a retired card: still settle it */ }
    if (s.role === "seller" && s.outcome === "sold") {
      const paid = sellerTake(s.price);
      next = addShards(next, paid);
      notes.push(`Your ${name} foil sold — +${paid} shards (after the ${MARKET_FEE_PCT}% fee).`);
    } else if (s.role === "seller") {
      next = addShiny(next, [s.card_id]);
      notes.push(`Your ${name} foil ${s.outcome === "expired" ? "listing expired" : "listing was taken down"} — the foil is back.`);
    } else if (s.outcome === "sold") {
      const hero = next.hero;
      const owned = new Set(next.collection);
      next = {
        ...next,
        collection: owned.has(s.card_id) ? next.collection : [...next.collection, s.card_id],
        hero: hero ? { ...hero, shards: Math.max(0, hero.shards - s.price) } : hero,
      };
      next = addShiny(next, [s.card_id]);
      notes.push(`Bought ${name} in foil for ${s.price} shards.`);
    } else continue;
    next = { ...next, gifts: [...(next.gifts ?? []), markOf(s)] };
  }
  return { save: next, notes };
}
