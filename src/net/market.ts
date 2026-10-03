/** THE FOIL MARKET — the calls (supabase/market.sql for the server side,
 *  data/market.ts for what each settlement does to a save).
 *
 *  Every call needs a signed-in account; without one they return
 *  `{ ok: false, error: "signin" }` and the Market tab says so. Errors from the
 *  server's own guards come back with their `market: ` prefix stripped, so the
 *  player reads "no longer for sale", not a stack trace. */
import { accountClient, currentUser } from "./account";
import type { MarketSettlement } from "../data/market";

export interface Listing {
  id: string;
  seller_id: string;
  seller_name: string;
  card_id: string;
  rarity: string;
  price: number;
  status: "active" | "sold" | "cancelled" | "expired";
  created_at: string;
  expires_at: string;
}

export type MarketResult<T> = { ok: true; value: T } | { ok: false; error: string };

const TABLE = "market_listings";
const plain = (msg: string | undefined): string =>
  (msg ?? "Something went wrong").replace(/^.*market:\s*/, "").trim() || "Something went wrong";

async function signedIn() {
  const c = accountClient();
  const me = c ? await currentUser() : null;
  return c && me ? { c, me } : null;
}

/** The live listings, newest first, not counting this player's own. */
export async function browseListings(): Promise<MarketResult<Listing[]>> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { data, error } = await s.c.from(TABLE)
    .select("id,seller_id,seller_name,card_id,rarity,price,status,created_at,expires_at")
    .eq("status", "active").gt("expires_at", new Date().toISOString())
    .neq("seller_id", s.me.id)
    .order("created_at", { ascending: false }).limit(200);
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: (data ?? []) as Listing[] };
}

/** This player's own live listings. */
export async function myListings(): Promise<MarketResult<Listing[]>> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { data, error } = await s.c.from(TABLE)
    .select("id,seller_id,seller_name,card_id,rarity,price,status,created_at,expires_at")
    .eq("seller_id", s.me.id).eq("status", "active").gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: (data ?? []) as Listing[] };
}

export async function createListing(cardId: string, rarity: string, price: number, sellerName: string): Promise<MarketResult<Listing>> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { data, error } = await s.c.from(TABLE)
    .insert({ card_id: cardId, rarity, price, seller_name: sellerName.slice(0, 24) || "Keeper" })
    .select("id,seller_id,seller_name,card_id,rarity,price,status,created_at,expires_at").single();
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: data as Listing };
}

export async function buyListing(id: string): Promise<MarketResult<Listing>> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { data, error } = await s.c.rpc("market_buy", { p_id: id });
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: data as Listing };
}

export async function cancelListing(id: string): Promise<MarketResult<Listing>> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { data, error } = await s.c.rpc("market_cancel", { p_id: id });
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: data as Listing };
}

/** What this player is owed and has not yet applied: sales, returned foils,
 *  purchases. Apply them (`applySettlements`), save, then `ackSettlements`. */
export async function pendingSettlements(): Promise<MarketResult<MarketSettlement[]>> {
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { data, error } = await s.c.rpc("market_pending");
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: (data ?? []) as MarketSettlement[] };
}

export async function ackSettlements(ids: string[]): Promise<MarketResult<null>> {
  if (!ids.length) return { ok: true, value: null };
  const s = await signedIn();
  if (!s) return { ok: false, error: "signin" };
  const { error } = await s.c.rpc("market_ack", { p_ids: ids });
  return error ? { ok: false, error: plain(error.message) } : { ok: true, value: null };
}
