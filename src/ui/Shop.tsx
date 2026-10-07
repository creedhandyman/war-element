/** The Shop — two economies, two tabs.
 *
 *  It used to stack both in one scroll and apologise for one of them
 *  ("Boosters are not built yet"). They answer different questions, so they are
 *  no longer the same screen:
 *
 *    Packs    buys VOLUME with shards — five cards, one Epic or better, and you
 *             do not choose any of them.
 *    Crafter  buys ONE EXACT CARD with that element's essence. It exists because
 *             the story's recruitment roll can miss the same card for a whole
 *             campaign.
 *
 *  Both tabs state the other side of the trade, because the code already ties
 *  them together and nothing in the UI said so: duplicates from packs refund
 *  essence, and essence is what the crafter spends. A pack is worth opening
 *  partly for the cards you already own.
 *
 *  Every number here is READ from data/story.ts rather than written down — the
 *  odds bar is `packOdds` (PACK_WEIGHT over the real pull pool), the refunds are
 *  derived from CRAFT_COST the same way dupeEssenceFor derives them, the prices
 *  are CRAFT_COST. A shop that quotes odds has to quote the real ones, and
 *  quoting them from a literal is how they drift the first time someone retunes
 *  the table.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketTab } from "./MarketTab";
import { useBackLayer } from "./use-back-layer";
import { CARDS, getDef } from "../data/cards";
import {
  BOX_BONUS_PACKS, BOX_COST, BOX_PACKS, BOX_PAID_PACKS, BOX_SAVING,
  CRAFT_COST, PACK_COST, PACK_SIZE, REGIONS, SHINY_CHANCE,
  applyPack, buyBox, buyPremadeDeck, canBuyBox, canBuyPremadeDeck, premadeDeckPrice, shopDecks, shopRefreshAt, type ShopDeckSize, canCraft, canOpenPack, canRerollFoil, craftCard, craftCostOf,
  dupeEssenceFor, foilStatsOf, freePacks, keepFoilStat, openPack, packIsFree, packLeanCost,
  packLeanOf, packOdds, PACK_LEAN, PACK_LEAN_CHANGE_COST, rerollFoil, setPackLean, type PackResult, type StorySave,
} from "../data/story";
import { FOIL_BONUS, FOIL_REROLL_COST, FOIL_STAT_LABEL, foilStatOf, type FoilStat } from "../data/foils";
import { cardThumbSrc, EL_COLOR, EL_ICON, RARITY_STYLE } from "./shared";
import { CardView } from "./CardView";
import { TIER_LABEL, type PremadeDeck } from "../data/custom-decks";
import { saveSquad, type Squad } from "../data/squads";
import { track } from "../net/telemetry";

/** "3d 4h", "5h 12m", "9m": the time left on the weekly deck shelf. */
function untilText(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** One hue per difficulty on the premade shelf, easiest coolest. */
const TIER_HUE: Record<string, string> = {
  easy: "#5fc77a", mid: "#4f9dde", hard: "#e08a3c", elite: "#b071e8",
};
const RARITY_RANK: Record<string, number> = { rare: 0, epic: 1, legendary: 2, mythic: 3 };
/** The card a deck is shown by: its rarest, then its dearest. */
const faceOf = (deck: PremadeDeck) =>
  [...deck.cards].map((id) => getDef(id)).sort((a, b) =>
    (RARITY_RANK[b.rarity ?? "rare"] ?? 0) - (RARITY_RANK[a.rarity ?? "rare"] ?? 0) || b.cost - a.cost)[0];

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };
/** A share as the Shop prints it: one decimal for the common tiers, two
 *  significant figures under 1% so a Mythic does not round away to nothing. */
const fmtPct = (p: number): string =>
  p >= 1 ? String(Math.round(p * 10) / 10) : p > 0 ? p.toPrecision(2) : "0";
/** Commonest first, which is the order the bar stacks them in. `pct` is the
 *  REAL chance a pulled card is that rarity — `packOdds`, not the raw weight
 *  (PACK_WEIGHT is per card; see the note on `packOdds`). */
const oddsRowsFor = (lean: string | null) => {
  const odds = packOdds(false, lean);
  return (["rare", "epic", "legendary", "mythic"] as const).map((r) => ({
    rarity: r as string,
    pct: (odds[r] ?? 0) * 100,
    refund: Math.max(1, Math.floor((CRAFT_COST[r] ?? 4) / 2)),
  }));
};
const ODDS_ROWS = oddsRowsFor(null);
/** ...and what the guaranteed last card rolls at, when the guarantee fires. */
const GUARANTEE_LINE = (() => {
  const odds = packOdds(true);
  return (["epic", "legendary", "mythic"] as const)
    .map((r) => `${fmtPct((odds[r] ?? 0) * 100)}% ${RARITY_STYLE[r]?.label ?? r}`)
    .join(" · ");
})();

/** The pull, ordered so the BEST card is the LAST one turned over.
 *
 *  Ascending rarity. The pack guarantees an Epic or better, so the guarantee
 *  always lands at the bottom of the stack rather than showing up first and
 *  leaving four commons to sit through. Ties break on foil, then on cost, so
 *  the final card is the best thing in the pack on every axis a player reads,
 *  not just on its label.
 *
 *  Returns INDICES into `pulled` rather than a re-ordered list: the summary
 *  counts, the refund table and the new/dupe test all key off the original
 *  positions, and re-ordering the source to drive a presentation choice is how
 *  those quietly start disagreeing.
 */
function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function revealOrder(pulled: readonly string[], shiny: readonly string[] = []): number[] {
  const rank = (id: string) => -(RARITY_ORDER[getDef(id).rarity ?? ""] ?? 9);
  return pulled
    .map((id, i) => ({ id, i }))
    .sort((a, b) =>
      rank(a.id) - rank(b.id)
      || Number(shiny.includes(a.id)) - Number(shiny.includes(b.id))
      || getDef(a.id).cost - getDef(b.id).cost)
    .map((x) => x.i);
}

/** The essence mark on a price: the element's own painted sigil, the same one
 *  the purses and every card of that element wear. Falls back to the generic
 *  gold coin only if the art fails to load, so a price never loses its unit. */
function ElCoin({ el }: { el: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <i className="coin" />;
  return (
    <img
      className="craft-coin" src={EL_ICON[el as keyof typeof EL_ICON]}
      alt={`${el} essence`} title={`${el} essence`} draggable={false}
      onError={() => setOk(false)}
    />
  );
}

export function Shop(props: {
  save: StorySave;
  onSave: (next: StorySave) => void;
  /** Which economy to open on. Home sends you here for one of two reasons and
   *  they land on different tabs: "2 packs are waiting" is Packs, "44 cards are
   *  conjurable" is the Crafter. A row that names an action has to open the
   *  thing that performs it. */
  openTab?: "packs" | "crafter";
  /** Fired whenever a pack is mid-tear or mid-reveal.
   *
   *  The level-up popup waits on this. A five-card pack is the commonest way to
   *  cross a level and the save is written the moment the pack is applied, so
   *  without it the celebration landed on top of the tear — over cards the
   *  player had not turned yet. Reported rather than inferred from "the shop is
   *  open", which is a different question: you can stand here for a minute
   *  after the cards are turned. */
  onBusy?: (busy: boolean) => void;
  /** The squad library changed: a bought deck is saved as a squad, and the
   *  App keeps the library in state. */
  onSquads?: (squads: Squad[]) => void;
  /** The foil market (MarketTab.tsx): collect what the server says this
   *  player is owed, and open the account panel to sign in. */
  onMarketSettle?: () => Promise<void>;
  onSignIn?: () => void;
}) {
  const { save } = props;
  const [tab, setTab] = useState<"packs" | "crafter" | "market">(props.openTab ?? "packs");
  /** Falls back to the drawn seal if the pack shot fails to load — the Packs
   *  tab should never be a hole where its one object was. */
  const [packArt, setPackArt] = useState(true);
  /** Same fallback for the box shot, for the same reason. */
  const [boxArt, setBoxArt] = useState(true);
  /** The tear-open beat. The result is already computed and saved when this is
   *  true — this only delays SHOWING it, so skipping cannot change a pull. */
  const [tearing, setTearing] = useState(false);
  const tearTimer = useRef<number | null>(null);
  /** How many of the pack's cards have been turned over. The reveal is one at
   *  a time, so this is the whole state of it. */
  const [shown, setShown] = useState(0);
  /** THE TOP CARD IS FACE DOWN until you turn it. `face` = it has been turned
   *  and is showing; `charging` = the beat before an Epic-or-better turns,
   *  when it shakes and its colour leaks round the edges — the tell; `burst`
   *  bumps once per turn so the flourish behind the card replays. */
  const [face, setFace] = useState(false);
  const [charging, setCharging] = useState(false);
  const [burst, setBurst] = useState(0);
  const chargeTimer = useRef<number | null>(null);
  /** Live drag offset in px while a swipe is in progress, so the card follows
   *  the finger instead of snapping when it is let go. */
  const [drag, setDrag] = useState(0);
  const dragFrom = useRef<number | null>(null);
  /** The same distance, in a ref. The STATE drives the visual and the REF
   *  decides whether the swipe took: `pointerup` reads it, and a state read
   *  there is whatever the last render saw — which on a fast flick, where move
   *  and up land in one frame before React re-renders, is still zero. The
   *  gesture would silently do nothing exactly when it was most decisive. */
  const dragPx = useRef(0);
  const [el, setEl] = useState<string>("ALL");
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** The pack just torn open, held so the player can actually read it. */
  const [opened, setOpened] = useState<PackResult | null>(null);
  // Back dismisses a pack's reveal (a tap outside it already does) and a card preview.
  useBackLayer(opened !== null, () => setOpened(null));
  useBackLayer(previewId !== null, () => setPreviewId(null));
  /** What the last pack refunded, kept after the sheet closes — it is the
   *  evidence for the claim the Packs tab makes about duplicates. */
  const [lastRefund, setLastRefund] = useState<number | null>(null);
  /** Whether the pack currently on screen cost nothing. Captured at the tear,
   *  because `applyPack` spends the free one — reading `packIsFree` while the
   *  sheet is open would report on the NEXT pack and print "−40" over the very
   *  pack the event just gave you. */
  const [openedFree, setOpenedFree] = useState(false);

  const essence = save.hero?.essence ?? {};
  const owned = useMemo(() => new Set(save.collection), [save.collection]);
  const shards = save.hero?.shards ?? 0;
  const totalEssence = Object.values(essence).reduce((a, b) => a + b, 0);
  const purseCount = Object.values(essence).filter((n) => n > 0).length;
  const affordablePacks = Math.floor(shards / PACK_COST);
  /** Packs owed for free — from an event, and whatever grants them later. */
  const owedPacks = freePacks(save);

  /** Everything missing, dearest first — the card you most want is the one you
   *  are least likely to have rolled. */
  /** FOIL REROLLS (owner's call, 2026-10-01): the foils you hold, under the
   *  same purse filter as the missing cards. Spare essence has nothing else to
   *  buy once those run out. */
  const foilStats = foilStatsOf(save);
  const myFoils = (save.hero?.shiny ?? [])
    .map((id) => getDef(id))
    .filter((c) => !!c && (el === "ALL" || c.element === el))
    .sort((a, b) => a.name.localeCompare(b.name));
  const bonusText = (st: FoilStat) => `+${FOIL_BONUS[st]} ${FOIL_STAT_LABEL[st]}`;
  /** A reroll waiting on the player's pick: keep the new bonus or the old.
   *  The essence is already spent; closing without choosing keeps the old. */
  const [foilPick, setFoilPick] = useState<{ id: string; from: FoilStat; to: FoilStat } | null>(null);
  useBackLayer(foilPick !== null, () => setFoilPick(null));
  const rerollNow = (id: string) => {
    const r = rerollFoil(save, id, Math.random);
    if (!r) return;
    props.onSave(r.save);
    setFoilPick({ id, from: r.from, to: r.to });
  };
  const keepPick = (stat: FoilStat) => {
    if (!foilPick) return;
    props.onSave(keepFoilStat(save, foilPick.id, stat));
    setFoilPick(null);
  };

  /** THE ELEMENT LEAN (owner's call): which element packs lean toward, what a
   *  change costs, and a change waiting on its confirm. The first choice is
   *  free and applies at once; after that a change costs shards, so it asks. */
  const lean = packLeanOf(save);
  const oddsRows = useMemo(() => oddsRowsFor(lean), [lean]);
  const [leanAsk, setLeanAsk] = useState<{ to: string | null } | null>(null);
  const pickLean = (to: string | null) => {
    if (to === lean && save.gifts?.some((g) => g.startsWith("packlean:"))) { setLeanAsk(null); return; }
    if (packLeanCost(save, to) === 0) {
      const next = setPackLean(save, to);
      if (next) props.onSave(next);
      setLeanAsk(null);
    } else setLeanAsk({ to });
  };
  const confirmLean = () => {
    if (!leanAsk) return;
    const next = setPackLean(save, leanAsk.to);
    if (next) props.onSave(next);
    setLeanAsk(null);
  };

  /** PREMADE DECKS (owner's call, 2026-10-02). A buy spends hundreds of shards,
   *  so the first tap arms the button and the second one pays. */
  const [deckAsk, setDeckAsk] = useState<string | null>(null);
  /** The clock the weekly deck shelf runs on. Ticks once a minute, which is
   *  both the countdown's resolution and how a shelf left open across Monday
   *  midnight swaps to the new week's decks without a reload. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const [deckDone, setDeckDone] = useState<{ id: string; added: number } | null>(null);
  /** Which premade is opened to show its cards (owner, 2026-10-04: "the
   *  premades in the shop are not clickable so the player cant tell what cards
   *  they get"). One at a time; a card in it opens the full card view. */
  const [deckOpen, setDeckOpen] = useState<string | null>(null);
  /** Which shelf: the 18-card standard-board decks or the 30-card large-board
   *  ones. Remembered per device — a convenience, so it fails quietly. */
  const [deckSize, setDeckSizeState] = useState<ShopDeckSize>(() => {
    try { return localStorage.getItem("we_shop_deck_size") === "5" ? 5 : 4; } catch { return 4; }
  });
  const setDeckSize = (n: ShopDeckSize) => {
    setDeckSizeState(n);
    setDeckAsk(null);
    try { localStorage.setItem("we_shop_deck_size", String(n)); } catch { /* private mode */ }
  };
  const keepSquad = (deck: PremadeDeck) => {
    const next = saveSquad({ name: deck.name, cards: [...deck.cards], spells: deck.spells, boardSize: deck.boardSize });
    props.onSquads?.(next);
  };
  const buyDeck = (deck: PremadeDeck) => {
    if (deckAsk !== deck.id) { setDeckAsk(deck.id); return; }
    const added = premadeDeckPrice(save, deck).missing.length;
    const next = buyPremadeDeck(save, deck);
    setDeckAsk(null);
    if (next === save) return;
    props.onSave(next);
    keepSquad(deck);
    setDeckDone({ id: deck.id, added });
  };

  const missing = useMemo(
    () =>
      CARDS.filter((c) => !owned.has(c.id) && !c.boss)
        .filter((c) => el === "ALL" || c.element === el)
        .sort(
          (a, b) =>
            (RARITY_ORDER[a.rarity ?? ""] ?? 9) - (RARITY_ORDER[b.rarity ?? ""] ?? 9) ||
            b.cost - a.cost ||
            a.name.localeCompare(b.name),
        ),
    [owned, el],
  );

  /** How long the pack is on screen before the cards are. Short on purpose:
   *  this is a shop you use in a loop, and a flourish you cannot get past is a
   *  toll. Tapping skips it, and reduced-motion never plays it at all. */
  const TEAR_MS = 1100;

  /** A pack is on screen — being torn, or turned over one card at a time.
   *
   *  The cleanup reports FALSE on unmount, which is not tidiness: leaving the
   *  shop mid-reveal would otherwise strand the flag true and suppress the
   *  level-up for the rest of the session. */
  const packBusy = tearing || opened !== null;
  const reportBusy = props.onBusy;
  useEffect(() => {
    reportBusy?.(packBusy);
    return () => reportBusy?.(false);
  }, [packBusy, reportBusy]);

  /** Worst to best — see `revealOrder`. */
  const reveal = useMemo(
    () => (opened ? revealOrder(opened.pulled, opened.shiny).map((i) => ({ id: opened.pulled[i], i })) : []),
    [opened],
  );
  const allShown = !!opened && shown >= reveal.length;

  function tearOpen() {
    // The free pack, opened for the first time ever: a step of the new-player
    // funnel (net/telemetry.ts).
    if (packIsFree(save) && !save.tally?.packs) track("first_pack");
    const result = openPack(save);
    // Read BEFORE applyPack, which is what spends it.
    setOpenedFree(packIsFree(save));
    // Committed BEFORE the animation, not after: the pull is decided and saved
    // the moment you pay, so a closed tab or a skipped beat cannot lose a pack
    // the shards already bought.
    setOpened(result);
    setShown(0);
    setFace(false);
    setCharging(false);
    setDrag(0);
    setLastRefund(Object.values(result.refund).reduce((a, b) => a + b, 0));
    props.onSave(applyPack(save, result));

    const still = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    setTearing(true);
    if (tearTimer.current) window.clearTimeout(tearTimer.current);
    tearTimer.current = window.setTimeout(() => {
      tearTimer.current = null;
      setTearing(false);
    }, TEAR_MS);
  }

  /** Swipe DOWN to turn the next card. A tap counts too — this is the same
   *  sheet on a desktop, where there is no swipe to make. */
  const SWIPE_PX = 56;
  /** WHICH OF THE TWO TO PRINT. Both gestures have always worked; the label
   *  only ever named the phone one, so on a desktop the pack said "swipe down"
   *  at someone holding a mouse — an instruction they cannot follow, over a
   *  card that would have turned on the click they were already about to make.
   *  A new player reads that as a stuck screen.
   *
   *  Asked as a media query rather than of the user agent, and re-asked on
   *  change: a tablet with a keyboard attached is both, and the answer flips
   *  under you. */
  const [coarse, setCoarse] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const read = () => setCoarse(mq.matches);
    read();
    mq.addEventListener?.("change", read);
    return () => mq.removeEventListener?.("change", read);
  }, []);
  /** How long a card's tell holds before it turns, by what it is. A Rare
   *  turns at once — the pause is what says "this one is worth something",
   *  so it means nothing if every card has it. */
  const tellMs = (id: string, foil: boolean) => {
    if (reducedMotion()) return 0;
    const r = getDef(id).rarity;
    return r === "mythic" ? 900 : r === "legendary" ? 650 : r === "epic" ? 420 : foil ? 420 : 0;
  };
  const turnTop = () => {
    const top = reveal[shown];
    if (!top || face || charging) return;
    const ms = tellMs(top.id, opened?.shiny.includes(top.id) ?? false);
    const go = () => { chargeTimer.current = null; setCharging(false); setFace(true); setBurst((b) => b + 1); };
    if (ms === 0) { go(); return; }
    setCharging(true);
    chargeTimer.current = window.setTimeout(go, ms);
  };
  const nextCard = () => {
    dragPx.current = 0;
    setDrag(0);
    // Face down: the gesture turns it. Face up: it sends it to the pile.
    if (!face) { turnTop(); return; }
    setFace(false);
    setShown((n) => Math.min(n + 1, reveal.length));
  };
  useEffect(() => () => { if (chargeTimer.current) window.clearTimeout(chargeTimer.current); }, []);
  const onDragStart = (y: number) => { dragFrom.current = y; dragPx.current = 0; };
  const onDragMove = (y: number) => {
    if (dragFrom.current === null) return;
    // Down only. An upward pull is not a gesture here and rubber-banding one
    // would suggest there is something above to reach.
    const d = Math.max(0, y - dragFrom.current);
    dragPx.current = d;
    setDrag(d);
  };
  const onDragEnd = () => {
    if (dragFrom.current === null) return;
    const far = dragPx.current >= SWIPE_PX;
    dragFrom.current = null;
    dragPx.current = 0;
    if (far) nextCard(); else setDrag(0);
  };

  /** The best card in the pack, for the tear: its colour is in the light
   *  that blows out of the seam, so the pack tells you before you see it. */
  const best = useMemo(() => {
    if (!opened) return "epic";
    return opened.pulled.map((id) => getDef(id).rarity ?? "rare")
      .sort((a, b) => (RARITY_ORDER[a] ?? 9) - (RARITY_ORDER[b] ?? 9))[0];
  }, [opened]);

  const skipTear = () => {
    if (tearTimer.current) { window.clearTimeout(tearTimer.current); tearTimer.current = null; }
    setTearing(false);
  };
  // A pending timer that fires into an unmounted Shop is a setState-after-
  // unmount; leaving the tab mid-tear is one tap away.
  useEffect(() => () => { if (tearTimer.current) window.clearTimeout(tearTimer.current); }, []);

  return (
    <div className="shop">
      <div className="shop-top">
        <h2>Shop</h2>
        {/* The balance is the currency's own colour, never gold. Gold is the
            in-battle summoning resource and nothing here spends it, so a gold
            number on this line taught the wrong thing twice over.

            Essence also is not ONE number: it does not cross elements, and
            LEAF essence buys nothing PYRO. A single total implied a pooled
            wallet the crafter will refuse to spend from — so with a purse
            selected the line reads that purse, and with none it says plainly
            that the total is spread across elements. */}
        {tab === "packs" || tab === "market" ? (
          <span className="shop-bal shards"><b>{shards}</b><i className="shard" /></span>
        ) : el === "ALL" ? (
          <span className="shop-bal">
            <b className="ess-total">{totalEssence}</b>
            <i className="ess" aria-hidden="true" /> across {purseCount} element{purseCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="shop-bal">
            <b style={{ color: EL_COLOR[el as keyof typeof EL_COLOR] }}>{essence[el] ?? 0}</b>
            <i className="ess" data-el={el} aria-hidden="true" /> {el} essence
          </span>
        )}
      </div>

      <div className="shop-tabs">
        <button className={`shop-tab ${tab === "packs" ? "on" : ""}`} onClick={() => setTab("packs")}>Packs</button>
        <button className={`shop-tab ${tab === "crafter" ? "on" : ""}`} onClick={() => setTab("crafter")}>Crafter</button>
        <button className={`shop-tab ${tab === "market" ? "on" : ""}`} onClick={() => setTab("market")}>Market</button>
      </div>

      {tab === "market" ? (
        <MarketTab save={save} onSave={props.onSave} onSignIn={props.onSignIn}
          onSettle={props.onMarketSettle ?? (async () => {})} />
      ) : tab === "packs" ? (
        /* One object, centred, with the whole cost of a mistake stated before
           you tap it: the odds, the guarantee, the foil rate, and what the
           duplicates pay back. */
        <div className="pack-object">
          {/* The real pack, not a drawn stand-in. The art carries the name and
              the count, so the "Booster pack" heading under it went — a title
              repeating what the picture already says is a line the odds table
              could have had instead. The guarantee stays: it is the one thing
              the pack shot cannot tell you. */}
          <div className={`pack-seal ${packArt ? "art" : ""}`}>
            {packArt ? (
              <img src="/pack.webp" alt={`War Element ${PACK_SIZE}-card booster pack`}
                draggable={false} onError={() => setPackArt(false)} />
            ) : (
              <>
                <span className="pack-seal-tag">SEALED</span>
                <span className="pack-seal-mark">✦</span>
              </>
            )}
          </div>
          <div className="pack-sub"
            title={`If none of the first ${PACK_SIZE - 1} is Epic or better, the last card rolls ${GUARANTEE_LINE}.`}>
            {PACK_SIZE} cards · at least one Epic or better
          </div>

          {/* ── THE ELEMENT LEAN ───────────────────────────────────────────
              Each card has a coin-flip's chance to come from the chosen
              element; the rest of the set can still turn up. First pick free,
              a change after that costs a pack's worth of shards — and asks. */}
          <div className="lean">
            <div className="odds-head">
              ELEMENT LEAN <em>{lean
                ? `about ${Math.round((PACK_LEAN + (1 - PACK_LEAN) / REGIONS.length) * 100)}% of each pack is ${lean}`
                : "packs draw evenly from every element"}</em>
            </div>
            <div className="lean-row">
              <button className={`lean-chip ${lean === null ? "on" : ""}`} onClick={() => pickLean(null)}>Any</button>
              {REGIONS.map((r) => (
                <button key={r.element}
                  className={`lean-chip ${lean === r.element ? "on" : ""}`}
                  style={lean === r.element ? { borderColor: EL_COLOR[r.element as keyof typeof EL_COLOR] } : undefined}
                  onClick={() => pickLean(r.element)}
                  title={`Lean packs toward ${r.element}`}>
                  <img src={EL_ICON[r.element as keyof typeof EL_ICON]} alt={r.element} draggable={false} />
                </button>
              ))}
            </div>
            {leanAsk ? (
              <div className="lean-ask">
                <span>
                  {leanAsk.to ? <>Lean packs to <b>{leanAsk.to}</b></> : <>Stop leaning packs</>} for{" "}
                  {packLeanCost(save, leanAsk.to)}<i className="shard" />?
                </span>
                <button className="lockin sm" disabled={shards < packLeanCost(save, leanAsk.to)} onClick={confirmLean}>
                  Confirm
                </button>
                <button className="ghost sm" onClick={() => setLeanAsk(null)}>Cancel</button>
              </div>
            ) : (
              <div className="lean-note">
                {save.gifts?.some((g) => g.startsWith("packlean:"))
                  ? <>A new element costs {PACK_LEAN_CHANGE_COST}<i className="shard" /> · Any is free</>
                  : "Your first pick is free."}
              </div>
            )}
          </div>

          {/* Per CARD, and not "the story's table": the recruitment roll is a
              different table (DROP_RATE) with a different meaning, and these
              are the real chances off `packOdds` rather than the raw weights. */}
          <div className="odds-head">PULL ODDS <em>each card, before the Epic guarantee</em></div>
          <div className="odds-bar">
            {oddsRows.map((o) => (
              <span
                key={o.rarity}
                className="odds-seg"
                style={{ width: `${o.pct}%`, background: RARITY_STYLE[o.rarity]?.color }}
                title={`${fmtPct(o.pct)}% ${o.rarity}`}
              />
            ))}
          </div>
          <div className="odds-key">
            {oddsRows.map((o) => (
              <span key={o.rarity} style={{ color: RARITY_STYLE[o.rarity]?.color }}>
                <b>{fmtPct(o.pct)}%</b> {RARITY_STYLE[o.rarity]?.label}
              </span>
            ))}
          </div>

          <div className="pack-note">
            <i className="foil-tag" aria-hidden="true">✦</i>
            1 in {Math.round(100 / SHINY_CHANCE)} cards comes out foil — duplicates included.
          </div>
          <div className="pack-note">
            ↺ Duplicates refund essence: {ODDS_ROWS.map((o) => o.refund).join(" / ")} by rarity.
            {lastRefund !== null && <> Last pack paid back <b>{lastRefund}</b>.</>}
          </div>

          {/* A free pack does not print a price. The button is the one place the
              gift has to be unmistakable — "Open for 40" over a pack you were
              given reads as being charged for it. */}
          <button className={`pack-open ${canOpenPack(save) ? "can" : ""} ${owedPacks > 0 ? "free" : ""}`}
            data-guide="shop-pack"
            disabled={!canOpenPack(save)} onClick={tearOpen}>
            {owedPacks > 0 ? "Open your free pack" : <>Open for {PACK_COST}<i className="shard" /></>}
          </button>
          {/* The useful reading of a balance is how many pulls it is, not the
              number itself. Packs you are OWED are counted separately rather
              than folded in: they are not a balance, and a total that mixed them
              would go down when you opened one and stay put when you did not. */}
          {/* THE BOX. Deliberately under the single pack rather than beside it:
              the pack is the thing being explained above — odds, guarantee, foil
              rate — and the box is the same pack seven times, so it reads as an
              upsell on something understood rather than a competing choice made
              before either is. */}
          <div className="box-offer">
            <div className={`box-shot ${boxArt ? "art" : ""}`}>
              {boxArt ? (
                <img src="/box.webp" alt={`War Element ${BOX_PACKS}-pack booster box`}
                  draggable={false} onError={() => setBoxArt(false)} />
              ) : (
                <span className="box-shot-mark">{BOX_PACKS}</span>
              )}
            </div>
            <div className="box-body">
              <div className="box-name">Booster box</div>
              <div className="box-sub">
                {BOX_PAID_PACKS} packs <em>+ {BOX_BONUS_PACKS} bonus</em> · {BOX_PACKS} total
              </div>
              {/* The saving as PACKS, not a percentage. The offer is "two of
                  these for nothing", and that is worth more than "29% off". */}
              <div className="box-save">
                Costs {BOX_PAID_PACKS} packs — {BOX_BONUS_PACKS} are free
                <span> (save {BOX_SAVING}<i className="shard" />)</span>
              </div>
              <button className={`box-buy ${canBuyBox(save) ? "can" : ""}`}
                disabled={!canBuyBox(save)}
                onClick={() => props.onSave(buyBox(save))}>
                {canBuyBox(save)
                  ? <>Buy the box for {BOX_COST}<i className="shard" /></>
                  : <>{BOX_COST - shards} more shards</>}
              </button>
            </div>
          </div>

          <div className="pack-afford">
            {owedPacks > 0 && (
              <b className="pack-owed">
                {owedPacks} free pack{owedPacks === 1 ? "" : "s"} waiting
                {affordablePacks > 0 ? " · " : ""}
              </b>
            )}
            {affordablePacks > 0
              ? `${affordablePacks} pack${affordablePacks === 1 ? "" : "s"} affordable`
              : owedPacks > 0
                ? ""
                : `${PACK_COST - shards} more shards for a pack`}
          </div>

          {/* ── PREMADE DECKS ──────────────────────────────────────────────
              One ready-made deck per difficulty. The price is what its cards
              are worth at pack rates, and every card you already hold comes
              off it, so the deck you are three cards short of costs three
              cards. Buying also saves it as a squad, ready to take into a fight. */}
          <div className="sr-label deck-shelf-label">
            <span>PREMADE DECKS · ONE PER DIFFICULTY</span>
            <span className="deck-timer" title={`New decks ${shopRefreshAt(now).toLocaleString()}`}>
              NEW IN {untilText(shopRefreshAt(now).getTime() - now.getTime())}
            </span>
          </div>
          <div className="deck-size" role="radiogroup" aria-label="Deck size">
            {([[4, "18 cards", "4x4"], [5, "30 cards", "5x5"]] as const).map(([n, label, board]) => (
              <button key={n} type="button" role="radio" aria-checked={deckSize === n}
                className={deckSize === n ? "on" : ""} onClick={() => setDeckSize(n)}>
                {label}<em>{board}</em>
              </button>
            ))}
          </div>
          <div className="deck-shelf">
            {shopDecks(now, deckSize).map(({ tier, deck }) => {
              const { full, price, owned } = premadeDeckPrice(save, deck);
              const face = faceOf(deck);
              const els = [...new Set(deck.cards.map((id) => getDef(id).element))];
              const complete = owned === deck.cards.length;
              const can = canBuyPremadeDeck(save, deck);
              const armed = deckAsk === deck.id;
              return (
                <div key={deck.id} className="deck-offer" style={{ ["--tier" as string]: TIER_HUE[tier] }}>
                  <button type="button" className="deck-shot" aria-expanded={deckOpen === deck.id}
                    title={`See the ${deck.cards.length} cards in ${deck.name}`}
                    onClick={() => setDeckOpen(deckOpen === deck.id ? null : deck.id)}>
                    <img src={cardThumbSrc(face)} alt="" loading="lazy" draggable={false}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  </button>
                  <div className="box-body">
                    <div className="deck-head">
                      <span className="deck-tier">{TIER_LABEL[tier]}</span>
                      <span className="box-name">{deck.name}</span>
                    </div>
                    <div className="deck-note">{deck.note}</div>
                    <div className="deck-meta">
                      {els.map((e) => (
                        <img key={e} className="deck-el" src={EL_ICON[e as keyof typeof EL_ICON]} alt={e} title={e} />
                      ))}
                      <span>{deck.cards.length} cards · <b>{owned}</b> owned</span>
                      <button type="button" className="deck-see" aria-expanded={deckOpen === deck.id}
                        onClick={() => setDeckOpen(deckOpen === deck.id ? null : deck.id)}>
                        {deckOpen === deck.id ? "Hide cards ▴" : "See cards ▾"}
                      </button>
                    </div>
                    {deckDone?.id === deck.id ? (
                      <div className="deck-done">
                        {deckDone.added} card{deckDone.added === 1 ? "" : "s"} added · saved to your squads
                      </div>
                    ) : complete ? (
                      <button className="box-buy can" onClick={() => { keepSquad(deck); setDeckDone({ id: deck.id, added: 0 }); }}>
                        All owned · save as a squad
                      </button>
                    ) : (
                      <div className="deck-buy-row">
                        <button className={`box-buy ${can ? "can" : ""} ${armed ? "armed" : ""}`}
                          disabled={!can} onClick={() => buyDeck(deck)}>
                          {!can
                            ? <>{price - shards} more shards</>
                            : armed
                              ? <>Confirm · {price}<i className="shard" /></>
                              : <>Buy for {price}<i className="shard" /></>}
                        </button>
                        {price < full && <s className="deck-full">{full}</s>}
                        {armed && <button className="ghost sm" onClick={() => setDeckAsk(null)}>Cancel</button>}
                      </div>
                    )}
                  </div>
                  {/* THE CARDS YOU GET, each once with its count, cheapest first;
                      the ones already in your collection say so (they come off
                      the price). Tap one for the full card. */}
                  {deckOpen === deck.id && (
                    <div className="sp-grid np-grid deck-cards">
                      {[...new Set(deck.cards)]
                        .map((id) => getDef(id))
                        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
                        .map((d) => {
                          const n = deck.cards.filter((x) => x === d.id).length;
                          const have = save.collection.includes(d.id);
                          return (
                            <button key={d.id} type="button"
                              className={`sp-tile r-${d.rarity ?? "rare"} ${have ? "have" : ""}`}
                              title={`${d.name} · ${d.rarity ?? "rare"} · ${d.cost} gold${have ? " · already yours" : ""} — see the card`}
                              onClick={() => setPreviewId(d.id)}>
                              <img src={cardThumbSrc(d)} alt="" loading="lazy"
                                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                              <span className="sp-tile-cost">{d.cost}</span>
                              <span className={`sp-tile-tag ${have ? "owned" : ""}`}>
                                {have ? "owned" : n > 1 ? `×${n}` : "new"}
                              </span>
                              <span className="sp-tile-name">{d.name}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="craft-wallet">
            {REGIONS.map((r) => {
              const n = essence[r.element] ?? 0;
              return (
                <button
                  key={r.element}
                  className={`shop-purse ${el === r.element ? "on" : ""} ${n > 0 ? "" : "empty"}`}
                  data-el={r.element}
                  onClick={() => setEl(el === r.element ? "ALL" : r.element)}
                  title={`${r.element} essence — tap to filter`}
                >
                  {/* The element's painted mark, from the same set the cards
                      wear. A purse is one of eight and they were told apart by
                      a colour and four capitals; the sigil is what the player
                      already recognises from every card of that element. */}
                  <img className="sp-el" src={EL_ICON[r.element as keyof typeof EL_ICON]} alt=""
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <b>{n}</b>
                  <span>{r.element}</span>
                </button>
              );
            })}
          </div>
          <p className="craft-blurb">
            Essence is earned clearing story nodes, in that region's element, and buys the exact
            card the dice never gave you. Tap a purse to filter.
          </p>

          {/* ── FOILS · REROLL A BONUS ───────────────────────────────────
              Above the missing list (owner's call), so a finished collection's one
              use for essence is the first thing on the tab: a foil
              you hold rolls a new bonus (one of the other three), and you
              keep whichever of the two you like better. */}
          <div className="sr-label">FOILS · {myFoils.length} · REROLL A BONUS</div>
          <p className="craft-blurb">
            Reroll a foil's bonus for {FOIL_REROLL_COST} of its element's essence. It rolls one of
            the other three bonuses, and you choose which one to keep.
          </p>
          {myFoils.length === 0 ? (
            <p className="shop-done">
              {el === "ALL" ? "You don't hold any foils yet." : `You don't hold any ${el} foils.`}
            </p>
          ) : (
            <div className="craft-list">
              {myFoils.map((c) => {
                const have = essence[c.element] ?? 0;
                const check = canRerollFoil(save, c.id);
                return (
                  <div key={c.id} className="craft-row foil-row">
                    <button className="craft-art foil" onClick={() => setPreviewId(c.id)} title={`${c.name} — see the card`}>
                      <img src={cardThumbSrc(c)} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    </button>
                    <div className="craft-meta">
                      <div className="craft-name">{c.name} <i className="foil-tag">✦ foil</i></div>
                      <div className="craft-note">
                        Carries <b className="foil-bonus">{bonusText(foilStatOf(c.id, foilStats))}</b>
                      </div>
                    </div>
                    {check.ok ? (
                      <button className="craft-buy" onClick={() => rerollNow(c.id)}
                        title={`Reroll for ${FOIL_REROLL_COST} ${c.element} essence`}>
                        Reroll<span>{FOIL_REROLL_COST}<ElCoin el={c.element} /></span>
                      </button>
                    ) : (
                      <span className="craft-cost" title={check.reason}>
                        {have}/{FOIL_REROLL_COST}<ElCoin el={c.element} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="sr-label">
            MISSING · {missing.length} · DEAREST FIRST
            {el !== "ALL" && <button className="shop-clear" onClick={() => setEl("ALL")}>all elements</button>}
          </div>

          {missing.length === 0 ? (
            <p className="shop-done">
              {el === "ALL"
                ? "Every card in the game is yours. There is nothing left to conjure."
                : `You own every ${el} card.`}
            </p>
          ) : (
            <div className="craft-list">
              {missing.map((c) => {
                const cost = craftCostOf(c.id);
                const have = essence[c.element] ?? 0;
                const check = canCraft(save, c.id);
                const rar = c.rarity ? RARITY_STYLE[c.rarity] : null;
                const short = Math.max(0, cost - have);
                return (
                  <div key={c.id} className="craft-row">
                    <button className="craft-art" onClick={() => setPreviewId(c.id)} title={`${c.name} — see the card`}>
                      <img src={cardThumbSrc(c)} alt="" loading="lazy"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    </button>
                    <div className="craft-meta">
                      <div className="craft-name">
                        {c.name}
                        {rar && <i className="craft-rar" style={{ color: rar.color, borderColor: rar.color }}>{rar.label}</i>}
                      </div>
                      {/* Distance, not a bare fraction: the bar turns "12/30"
                          into how close you are, and the note says what closes
                          it — which points back at Story instead of leaving you
                          at a locked button. */}
                      <div className="craft-track" title={`${have} of ${cost} ${c.element}`}>
                        <span style={{ width: `${Math.min(100, (have / cost) * 100)}%`, background: EL_COLOR[c.element] }} />
                      </div>
                      <div className="craft-note">
                        {short === 0
                          ? <span className="ready">ready to conjure</span>
                          : <>{short} more <i style={{ color: EL_COLOR[c.element] }}>{c.element}</i> — clear {c.element} nodes</>}
                      </div>
                    </div>
                    {/* Only affordable rows get the gold button, so the screen
                        has as many primary actions as you have cards you can
                        actually buy. */}
                    {/* The price wears its OWN element's mark, not the gold
                        coin. Essence is eight currencies, not one — LEAF buys
                        nothing PYRO, which is the whole reason the purses above
                        are separate — and a single gold coin on every row said
                        the opposite of that on the one screen where it matters.
                        Same sigil the purse above wears, so "12 LEAF" up there
                        and this price are visibly the same money. */}
                    {check.ok ? (
                      <button className="craft-buy" onClick={() => props.onSave(craftCard(save, c.id))}
                        title={`Conjure for ${cost} ${c.element} essence`}>
                        Conjure<span>{cost}<ElCoin el={c.element} /></span>
                      </button>
                    ) : (
                      <span className="craft-cost" title={check.reason}>
                        {have}/{cost}<ElCoin el={c.element} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </>
      )}

      {/* THE PICK after a reroll: the new bonus or the old one. The essence is
          spent either way, so neither button costs anything more. */}
      {foilPick && (() => {
        const c = getDef(foilPick.id);
        return (
          <div className="overlay foil-pick-overlay">
            <div className="modal foil-pick" role="dialog" aria-label={`${c.name} — keep which bonus?`}>
              <img className="foil-pick-art" src={cardThumbSrc(c)} alt="" />
              <h3>{c.name}</h3>
              <p className="foil-pick-q">The foil rolled <b>{bonusText(foilPick.to)}</b>. Which bonus will it keep?</p>
              <div className="foil-pick-btns">
                <button className="lockin" onClick={() => keepPick(foilPick.to)}>
                  Keep {bonusText(foilPick.to)} <small>new</small>
                </button>
                <button className="ghost" onClick={() => keepPick(foilPick.from)}>
                  Keep {bonusText(foilPick.from)} <small>old</small>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* The pack itself, for as long as it takes to tear it. The reveal is
          mounted behind this and simply not seen yet, so the two cannot
          disagree about what was pulled. */}
      {/* `data-guide-suppress` on both pack surfaces: the walkthrough steps aside
          while a pack is being opened. See GuideOverlay — the reveal IS the thing
          the step told you to do, and the guide advanced to the NEXT step and
          planted its card on top of the card you had just pulled, covering the
          art and the button to dismiss it. */}
      {opened && tearing && (
        <div className={`overlay on-top pack-tear best-${best}`} data-guide-suppress onClick={skipTear}>
          <span className="tear-bloom" aria-hidden="true" />
          {/* The seam is a CHILD of the pack's stage, not a sibling centred in
              the overlay: it has to sit on the crimp, and the crimp moves with
              the pack. As a sibling it landed across the middle of the art. */}
          <span className="tear-stage" aria-hidden="true">
            {packArt
              ? <img className="tear-pack" src="/pack.webp" alt="" draggable={false} />
              : <span className="tear-pack tear-fallback">✦</span>}
            <span className="tear-rip" />
          </span>
          <span className="tear-skip">tap to skip</span>
        </div>
      )}

      {opened && !tearing && (
        <div className="overlay on-top" data-guide-suppress onClick={() => setOpened(null)}>
          <div
            key={face && reveal[shown] && getDef(reveal[shown].id).rarity === "mythic" ? `quake${burst}` : "sheet"}
            className={`modal pack-reveal ${allShown ? "" : "revealing"} ${face && reveal[shown] && getDef(reveal[shown].id).rarity === "mythic" ? "quake" : ""}`}
            onClick={(e) => e.stopPropagation()}>
            {/* Header, tally and buttons all wait. While you are turning cards
                the screen is the card — chrome around it is just competition
                for the one thing you opened the pack to see. */}
            {allShown && (
              <div className="pack-reveal-head">
                <h2>Pack opened</h2>
                {/* What it actually cost you, which for a gifted pack is
                    nothing. `openedFree` is THIS pack's price, captured at the
                    tear — see the state. */}
                {openedFree
                  ? <span className="pack-spend free">FREE</span>
                  : <span className="pack-spend">−{PACK_COST}<i className="shard" /></span>}
              </div>
            )}
            {/* ONE AT A TIME, worst to best. A grid of five hands you the
                whole pack in a glance and the Epic in it is just one of the
                tiles; turned over one by one with the best last, the pack has
                a shape. The stack behind the top card is how many are left —
                it is the progress bar, so there is not a second one. */}
            {/* Gone once the last card is turned — it reserves 340px for a
                card that is no longer in it, and the tally would open on a
                hole where the stack used to be. */}
            {!allShown && (
            <div className="pack-stack" data-left={reveal.length - shown}>
              {reveal.map(({ id, i }, n) => {
                const d = getDef(id);
                const isNew = opened.fresh.includes(id) && opened.pulled.indexOf(id) === i;
                const foil = opened.shiny.includes(id);
                const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                const turned = n < shown;
                const isTop = n === shown;
                const down = !isTop || !face;
                // Only the top card and the two behind it are rendered as
                // stack; everything already turned goes to the ribbon below.
                if (turned) return null;
                const depth = n - shown;
                if (depth > 2) return null;
                return (
                  <div
                    key={i}
                    // A FOIL IS NEVER A DUPE. Pulling a shiny of a card you
                    // already own is a 1-in-100 outcome and a thing you did not
                    // have a moment ago — it was rendering at 62% opacity, faded
                    // like a dud, because `dupe` was decided on the card id
                    // alone. You keep the essence refund too; the engine was
                    // always right, only this line was not.
                    className={`pack-card big r-${d.rarity ?? "rare"} ${isNew || foil ? "new" : "dupe"} ${foil ? "foil" : ""} ${isTop ? "top" : "behind"} ${down ? "face-down" : "face-up"} ${isTop && charging ? "charging" : ""}`}
                    style={{
                      zIndex: 10 - depth,
                      transform: isTop
                        ? `translateY(${drag}px) rotate(${drag * 0.02}deg)`
                        : `translateY(${depth * 7}px) scale(${1 - depth * 0.05})`,
                      opacity: isTop ? Math.max(0.25, 1 - drag / 260) : 1,
                      transition: isTop && dragFrom.current !== null ? "none" : undefined,
                    }}
                    onPointerDown={isTop ? (e) => {
                      // Capture is a nicety — it keeps the drag alive if the
                      // finger leaves the card — and it throws for a pointer
                      // id the element never saw. The gesture works without it.
                      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
                      onDragStart(e.clientY);
                    } : undefined}
                    onPointerMove={isTop ? (e) => onDragMove(e.clientY) : undefined}
                    onPointerUp={isTop ? onDragEnd : undefined}
                    onPointerCancel={isTop ? onDragEnd : undefined}
                    onClick={isTop ? () => { if (dragFrom.current === null && dragPx.current === 0) nextCard(); } : undefined}
                  >
                    {/* The back, while it is face down. The face is rendered
                        underneath it the whole time, so turning it cannot
                        wait on the art loading. */}
                    {down && (
                      <span className="pc-back" aria-hidden="true">
                        <span className="pc-back-ring" />
                        <span className="pc-back-mark">✦</span>
                      </span>
                    )}
                    <img src={cardThumbSrc(d)} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    {rar && <span className="pack-rar" style={{ color: rar.color, borderColor: rar.color }}>{rar.label}</span>}
                    {foil && <i className="foil-tag" title="Foil">✦</i>}
                    <span className="pack-name">{d.name}</span>
                    {/* Both facts, because a foil duplicate has two: it is a
                        foil AND it paid essence. The tag used to print one and
                        drop the other whichever way it went. */}
                    <span className={`pack-tag ${foil ? "is-foil" : isNew ? "is-new" : "is-dupe"}`}>
                      {foil && isNew ? "NEW · FOIL"
                        : foil ? `FOIL · +${dupeEssenceFor(id)} ${d.element}`
                        : isNew ? "NEW"
                        : `+${dupeEssenceFor(id)} ${d.element}`}
                    </span>
                  </div>
                );
              })}
              {/* THE BURST, behind the card it belongs to: replayed once per
                  turn (`burst` in the key), in the card's own rarity. A Rare
                  gets none — see `tellMs`. */}
              {face && reveal[shown] && (() => {
                const top = reveal[shown];
                const r = getDef(top.id).rarity ?? "rare";
                const foil = opened.shiny.includes(top.id);
                if (r === "rare" && !foil) return null;
                return (
                  <span key={`burst${burst}`} className={`pc-burst b-${r} ${foil ? "b-foil" : ""}`} aria-hidden="true">
                    <span className="pc-rays" />
                    <span className="pc-ring" />
                    <span className="pc-ring pc-ring2" />
                    <span className="pc-flash" />
                    {foil && Array.from({ length: 10 }, (_, k) => (
                      <span key={k} className="pc-spark" style={{ ["--a" as string]: `${k * 36}deg` }} />
                    ))}
                  </span>
                );
              })()}
              <span className="pack-swipe">
                <i aria-hidden="true">⌄</i>
                {face
                  ? (coarse ? "swipe down for the next" : "click for the next")
                  : (coarse ? "tap to turn it over" : "click to turn it over")}
              </span>
            </div>
            )}

            {/* A WAY OUT OF THE REMAINING TURNS. Five cards is five gestures,
                and the one-at-a-time reveal is the good part of buying a pack
                — but it is the good part the FIRST time. A player opening
                their tenth is doing four presses to reach a tally they can
                already guess, and the pack does not become more exciting for
                being unskippable.

                Offered only after the first card, so the beat is always felt
                once, and only while two or more are left, so it never appears
                as a button that saves a single press. It turns the rest at
                once rather than animating through them: this is the control
                for someone who has stopped wanting the animation. */}
            {!allShown && shown > 0 && reveal.length - shown > 1 && (
              <button className="pack-rest" onClick={() => { if (chargeTimer.current) window.clearTimeout(chargeTimer.current); setCharging(false); setFace(false); setDrag(0); setShown(reveal.length); }}>
                Turn the last {reveal.length - shown}
              </button>
            )}

            {/* What has already been turned, small, so the pack accumulates
                in front of you instead of each card replacing the last. */}
            {shown > 0 && allShown && (
              <div className="pack-done-strip">
                {reveal.slice(0, shown).map(({ id, i }) => {
                  const d = getDef(id);
                  const foil = opened.shiny.includes(id);
                  const isNew = opened.fresh.includes(id) && opened.pulled.indexOf(id) === i;
                  return (
                    <span key={i} className={`pack-chip r-${d.rarity ?? "rare"} ${isNew ? "new" : ""} ${foil ? "foil" : ""}`}
                      title={`${d.name}${isNew ? " — new" : ""}${foil ? " — foil" : ""}`}>
                      <img src={cardThumbSrc(d)} alt=""
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    </span>
                  );
                })}
              </div>
            )}

            {allShown && <>
            <div className="pack-sums">
              <div>New cards <b>{opened.fresh.length}</b> of {opened.pulled.length}</div>
              {opened.shiny.length > 0 && (
                <div className="pack-foil">
                  Foil {opened.shiny.map((id) => getDef(id).name).join(", ")} <i className="foil-tag inline">✦</i>
                </div>
              )}
              {Object.keys(opened.refund).length > 0 && (
                <div>
                  Duplicates refunded{" "}
                  {Object.entries(opened.refund).map(([e, n], i) => (
                    <span key={e}>
                      {i > 0 && " · "}
                      <b style={{ color: EL_COLOR[e as keyof typeof EL_COLOR] }}>{n} {e}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* The sheet has ONE commit and it is Done; "open another" is
                outlined so a second purchase is never the default tap. */}
            <div className="pack-reveal-acts">
              <button className="lockin" onClick={() => setOpened(null)}>Done</button>
              <button className="ghost" disabled={!canOpenPack(save)} onClick={tearOpen}
                // A disabled button that says nothing reads as broken; this one
                // is short of shards, so it says by how many.
                title={canOpenPack(save) ? undefined
                  : `${PACK_COST} shards a pack — you have ${shards}`}>
                {packIsFree(save)
                  ? "Open another · free"
                  : <>Open another {PACK_COST}<i className="shard" /></>}
              </button>
            </div>
            </>}
            {/* Reachable mid-reveal, because the pull is already banked and a
                sheet you cannot leave is a trap. Turning the rest is the
                flourish, not the transaction. */}

          </div>
        </div>
      )}

      {previewId && (
        <CardView mode="browse" def={getDef(previewId)} onClose={() => setPreviewId(null)}
          foil={(save.hero?.shiny ?? []).includes(previewId)} foilStats={foilStats} />
      )}
    </div>
  );
}
