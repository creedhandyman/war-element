/** THE FOIL MARKET — the Shop's third tab (owner, 2026-10-03). Browse other
 *  players' foils and buy them for shards; list your own spare foils.
 *  Rules: data/market.ts. Calls: net/market.ts. Server: supabase/market.sql. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDef } from "../data/cards";
import type { StorySave } from "../data/story";
import { isShiny } from "../data/story";
import {
  MARKET_BANDS, MARKET_FEE_PCT, MARKET_LISTING_DAYS, MARKET_MAX_LISTINGS,
  escrowFoil, priceInBand, rarityOf, sellableFoils, sellerTake, type MarketRarity,
} from "../data/market";
import { accountConfigured, currentUser } from "../net/account";
import { browseListings, buyListing, cancelListing, createListing, myListings, type Listing } from "../net/market";
import { cardThumbSrc } from "./shared";

const RARITIES: MarketRarity[] = ["rare", "epic", "legendary", "mythic"];
const RARITY_LABEL: Record<MarketRarity, string> = { rare: "Rare", epic: "Epic", legendary: "Legendary", mythic: "Mythic" };

const daysLeft = (iso: string): string => {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.max(0, Math.round(ms / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)}d left` : `${h}h left`;
};
const safeName = (id: string) => { try { return getDef(id).name; } catch { return id; } };

export function MarketTab(props: {
  save: StorySave;
  onSave: (next: StorySave) => void;
  /** Collect what the server says this player is owed (sales, returned foils,
   *  purchases) into the save — App's `runMarketSettle`. */
  onSettle: () => Promise<void>;
  onSignIn?: () => void;
}) {
  const { save } = props;
  const shards = save.hero?.shards ?? 0;
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [view, setView] = useState<"browse" | "sell">("browse");
  const [rarity, setRarity] = useState<MarketRarity | "all">("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [sellId, setSellId] = useState<string | null>(null);
  const [price, setPrice] = useState(0);

  const refresh = useCallback(async () => {
    const [all, own] = await Promise.all([browseListings(), myListings()]);
    if (all.ok) setListings(all.value); else if (all.error !== "signin") setMsg(all.error);
    if (own.ok) setMine(own.value);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const me = accountConfigured ? await currentUser() : null;
      if (!live) return;
      setSignedIn(!!me);
      if (me) { await props.onSettle(); await refresh(); }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(
    () => listings.filter((l) => rarity === "all" || l.rarity === rarity).sort((a, b) => a.price - b.price),
    [listings, rarity],
  );
  const foils = useMemo(() => sellableFoils(save), [save]);

  async function buy(l: Listing) {
    if (armed !== l.id) { setArmed(l.id); return; }
    setBusy(true); setMsg(null);
    const r = await buyListing(l.id);
    if (!r.ok) setMsg(r.error === "signin" ? "Sign in to buy." : r.error);
    else await props.onSettle();
    setArmed(null);
    await refresh();
    setBusy(false);
  }

  async function cancel(l: Listing) {
    setBusy(true); setMsg(null);
    const r = await cancelListing(l.id);
    if (!r.ok) setMsg(r.error);
    else await props.onSettle();
    await refresh();
    setBusy(false);
  }

  async function list() {
    if (!sellId) return;
    if (!priceInBand(sellId, price)) { setMsg("That price is outside the band for this rarity."); return; }
    if (mine.length >= MARKET_MAX_LISTINGS) { setMsg(`You can have ${MARKET_MAX_LISTINGS} listings at once.`); return; }
    const escrowed = escrowFoil(save, sellId);
    if (!escrowed) { setMsg("You don't hold that foil any more."); return; }
    setBusy(true); setMsg(null);
    // ESCROW FIRST, then list: a crash between the two loses the listing, never
    // duplicates the foil. A refused listing puts the foil straight back.
    props.onSave(escrowed);
    const r = await createListing(sellId, rarityOf(sellId), price, save.hero?.name ?? "Keeper");
    if (!r.ok) {
      props.onSave(save);
      setMsg(r.error === "signin" ? "Sign in to sell." : r.error);
    } else {
      setSellId(null);
      setView("browse");
    }
    await refresh();
    setBusy(false);
  }

  if (!accountConfigured || signedIn === false) {
    return (
      <div className="mkt">
        <div className="mkt-empty">
          <b>The Market needs an account</b>
          <p>Buying and selling foils happens between players, so it needs you signed in — the same account that keeps your cloud save.</p>
          {props.onSignIn && accountConfigured && <button className="lockin" onClick={props.onSignIn}>Sign in</button>}
          {!accountConfigured && <p className="mkt-note">Accounts are not set up on this build.</p>}
        </div>
      </div>
    );
  }
  if (signedIn === null) return <div className="mkt"><div className="mkt-empty">Opening the Market…</div></div>;

  const band = sellId ? MARKET_BANDS[rarityOf(sellId)] : null;

  return (
    <div className="mkt">
      <div className="shop-tabs mkt-views">
        <button className={`shop-tab ${view === "browse" ? "on" : ""}`} onClick={() => setView("browse")}>For sale</button>
        <button className={`shop-tab ${view === "sell" ? "on" : ""}`} onClick={() => setView("sell")}>
          Sell a foil{mine.length ? ` · ${mine.length}/${MARKET_MAX_LISTINGS}` : ""}
        </button>
      </div>
      {msg && <div className="mkt-msg" role="status">{msg}</div>}

      {view === "browse" ? (
        <>
          <div className="mkt-filters">
            {(["all", ...RARITIES] as const).map((r) => (
              <button key={r} className={`mkt-chip ${rarity === r ? "on" : ""}`} onClick={() => setRarity(r)}>
                {r === "all" ? "All" : RARITY_LABEL[r]}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="mkt-empty">Nothing for sale{rarity === "all" ? "" : ` at ${RARITY_LABEL[rarity]}`} right now. Check back later — or put up one of your own.</div>
          ) : (
            <div className="mkt-grid">
              {shown.map((l) => {
                const have = isShiny(save, l.card_id);
                const can = !busy && !have && shards >= l.price;
                return (
                  <div key={l.id} className={`mkt-card r-${l.rarity}`}>
                    <img className="mkt-art" src={cardThumbSrc(getDef(l.card_id))} alt="" loading="lazy" draggable={false}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    <span className="mkt-foil" aria-hidden="true">FOIL</span>
                    <div className="mkt-body">
                      <b>{safeName(l.card_id)}</b>
                      <small>{RARITY_LABEL[l.rarity as MarketRarity] ?? l.rarity} · by {l.seller_name} · {daysLeft(l.expires_at)}</small>
                      <button className={`box-buy ${can ? "can" : ""} ${armed === l.id ? "armed" : ""}`} disabled={!can}
                        onClick={() => buy(l)}
                        title={have ? "You already hold this foil" : shards < l.price ? `${l.price - shards} more shards` : undefined}>
                        {have ? "You have this foil"
                          : shards < l.price ? <>{l.price}<i className="shard" /> · need {l.price - shards} more</>
                          : armed === l.id ? <>Confirm · {l.price}<i className="shard" /></>
                          : <>Buy · {l.price}<i className="shard" /></>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <div className="sr-label">YOUR LISTINGS · {mine.length} OF {MARKET_MAX_LISTINGS}</div>
              <div className="mkt-mine">
                {mine.map((l) => (
                  <div key={l.id} className="mkt-row">
                    <img src={cardThumbSrc(getDef(l.card_id))} alt="" loading="lazy" draggable={false} />
                    <span className="mkt-row-meta">
                      <b>{safeName(l.card_id)}</b>
                      <small>{l.price} shards · you get {sellerTake(l.price)} · {daysLeft(l.expires_at)}</small>
                    </span>
                    <button className="ghost sm" disabled={busy} onClick={() => cancel(l)}>Take down</button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="sr-label">YOUR FOILS</div>
          <p className="mkt-note">
            Listing takes the foil finish off your card while it is for sale — you keep the card itself. It sells for your
            price less a {MARKET_FEE_PCT}% fee, and comes back if it does not sell in {MARKET_LISTING_DAYS} days or you take it down.
          </p>
          {foils.length === 0 ? (
            <div className="mkt-empty">You have no foils to sell. Foils come from packs and story drops (about 1 in 100 cards).</div>
          ) : (
            <div className="mkt-foils">
              {foils.map((id) => (
                <button key={id} className={`mkt-pick ${sellId === id ? "on" : ""}`}
                  onClick={() => { setSellId(id); setPrice(MARKET_BANDS[rarityOf(id)].min); setMsg(null); }}>
                  <img src={cardThumbSrc(getDef(id))} alt="" loading="lazy" draggable={false} />
                  <span>{safeName(id)}</span>
                </button>
              ))}
            </div>
          )}
          {sellId && band && (
            <div className="mkt-sell">
              <b>{safeName(sellId)} · {RARITY_LABEL[rarityOf(sellId)]} foil</b>
              <label className="mkt-price">
                Price
                <input type="number" inputMode="numeric" min={band.min} max={band.max} step={10} value={price}
                  onChange={(e) => setPrice(Math.round(Number(e.target.value) || 0))} />
                <small>{band.min}–{band.max} shards</small>
              </label>
              <input type="range" min={band.min} max={band.max} step={10} value={Math.min(band.max, Math.max(band.min, price))}
                onChange={(e) => setPrice(Number(e.target.value))} aria-label="Price" />
              <small className="mkt-note">You receive {priceInBand(sellId, price) ? sellerTake(price) : "—"} shards if it sells.</small>
              <button className="lockin" disabled={busy || !priceInBand(sellId, price) || mine.length >= MARKET_MAX_LISTINGS} onClick={list}>
                {mine.length >= MARKET_MAX_LISTINGS ? `${MARKET_MAX_LISTINGS} listings is the most` : "List it"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
