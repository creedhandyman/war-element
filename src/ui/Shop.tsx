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
 *  odds bar is PACK_WEIGHT, the refunds are derived from CRAFT_COST the same
 *  way dupeEssenceFor derives them, the prices are CRAFT_COST. A shop that
 *  quotes odds has to quote the real ones, and quoting them from a literal is
 *  how they drift the first time someone retunes the table.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CARDS, getDef } from "../data/cards";
import {
  CRAFT_COST, PACK_COST, PACK_SIZE, PACK_WEIGHT, REGIONS, SHINY_CHANCE,
  applyPack, canCraft, canOpenPack, craftCard, craftCostOf, dupeEssenceFor,
  openPack, type PackResult, type StorySave,
} from "../data/story";
import { EL_COLOR, EL_ICON, RARITY_STYLE } from "./shared";
import { CardView } from "./CardView";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };
/** Commonest first, which is the order the bar stacks them in. */
const ODDS_ROWS = (["rare", "epic", "legendary", "mythic"] as const).map((r) => ({
  rarity: r as string,
  weight: PACK_WEIGHT[r] ?? 0,
  refund: Math.max(1, Math.floor((CRAFT_COST[r] ?? 4) / 2)),
}));

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
}) {
  const { save } = props;
  const [tab, setTab] = useState<"packs" | "crafter">(props.openTab ?? "packs");
  /** Falls back to the drawn seal if the pack shot fails to load — the Packs
   *  tab should never be a hole where its one object was. */
  const [packArt, setPackArt] = useState(true);
  /** The tear-open beat. The result is already computed and saved when this is
   *  true — this only delays SHOWING it, so skipping cannot change a pull. */
  const [tearing, setTearing] = useState(false);
  const tearTimer = useRef<number | null>(null);
  /** How many of the pack's cards have been turned over. The reveal is one at
   *  a time, so this is the whole state of it. */
  const [shown, setShown] = useState(0);
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
  /** What the last pack refunded, kept after the sheet closes — it is the
   *  evidence for the claim the Packs tab makes about duplicates. */
  const [lastRefund, setLastRefund] = useState<number | null>(null);

  const essence = save.hero?.essence ?? {};
  const owned = useMemo(() => new Set(save.collection), [save.collection]);
  const shards = save.hero?.shards ?? 0;
  const totalEssence = Object.values(essence).reduce((a, b) => a + b, 0);
  const purseCount = Object.values(essence).filter((n) => n > 0).length;
  const affordablePacks = Math.floor(shards / PACK_COST);

  /** Everything missing, dearest first — the card you most want is the one you
   *  are least likely to have rolled. */
  const missing = useMemo(
    () =>
      CARDS.filter((c) => !owned.has(c.id))
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

  /** Worst to best — see `revealOrder`. */
  const reveal = useMemo(
    () => (opened ? revealOrder(opened.pulled, opened.shiny).map((i) => ({ id: opened.pulled[i], i })) : []),
    [opened],
  );
  const allShown = !!opened && shown >= reveal.length;

  function tearOpen() {
    const result = openPack(save);
    // Committed BEFORE the animation, not after: the pull is decided and saved
    // the moment you pay, so a closed tab or a skipped beat cannot lose a pack
    // the shards already bought.
    setOpened(result);
    setShown(0);
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
  const nextCard = () => {
    dragPx.current = 0;
    setDrag(0);
    setShown((n) => Math.min(n + 1, reveal.length));
  };
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
        {tab === "packs" ? (
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
      </div>

      {tab === "packs" ? (
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
          <div className="pack-sub">{PACK_SIZE} cards · at least one Epic or better</div>

          <div className="odds-head">PULL ODDS <em>the same table the story rolls on</em></div>
          <div className="odds-bar">
            {ODDS_ROWS.map((o) => (
              <span
                key={o.rarity}
                className="odds-seg"
                style={{ width: `${o.weight}%`, background: RARITY_STYLE[o.rarity]?.color }}
                title={`${o.weight}% ${o.rarity}`}
              />
            ))}
          </div>
          <div className="odds-key">
            {ODDS_ROWS.map((o) => (
              <span key={o.rarity} style={{ color: RARITY_STYLE[o.rarity]?.color }}>
                <b>{o.weight}</b> {RARITY_STYLE[o.rarity]?.label}
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

          <button className={`pack-open ${canOpenPack(save) ? "can" : ""}`} disabled={!canOpenPack(save)} onClick={tearOpen}>
            Open for {PACK_COST}<i className="shard" />
          </button>
          {/* The useful reading of a balance is how many pulls it is, not the
              number itself. */}
          <div className="pack-afford">
            {affordablePacks > 0
              ? `${affordablePacks} pack${affordablePacks === 1 ? "" : "s"} affordable`
              : `${PACK_COST - shards} more shards for a pack`}
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
                      <img src={`/cards/${c.art ?? c.id}.webp`} alt="" loading="lazy"
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

      {/* The pack itself, for as long as it takes to tear it. The reveal is
          mounted behind this and simply not seen yet, so the two cannot
          disagree about what was pulled. */}
      {opened && tearing && (
        <div className="overlay on-top pack-tear" onClick={skipTear}>
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
        <div className="overlay on-top" onClick={() => setOpened(null)}>
          <div className={`modal pack-reveal ${allShown ? "" : "revealing"}`} onClick={(e) => e.stopPropagation()}>
            {/* Header, tally and buttons all wait. While you are turning cards
                the screen is the card — chrome around it is just competition
                for the one thing you opened the pack to see. */}
            {allShown && (
              <div className="pack-reveal-head">
                <h2>Pack opened</h2>
                <span className="pack-spend">−{PACK_COST}<i className="shard" /></span>
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
                    className={`pack-card big r-${d.rarity ?? "rare"} ${isNew || foil ? "new" : "dupe"} ${foil ? "foil" : ""} ${isTop ? "top" : "behind"}`}
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
                    <img src={`/cards/${d.art ?? d.id}.webp`} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    {rar && <span className="pack-rar" style={{ color: rar.color, borderColor: rar.color }}>{rar.label}</span>}
                    <span className="pack-name">
                      {foil && <i className="foil-tag" title="Foil">✦</i>}
                      {d.name}
                    </span>
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
              <span className="pack-swipe">
                <i aria-hidden="true">⌄</i>
                swipe down
              </span>
            </div>
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
                      <img src={`/cards/${d.art ?? d.id}.webp`} alt=""
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
                  Foil {opened.shiny.map((id) => getDef(id).name).join(", ")} <i className="foil-tag">✦</i>
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
              <button className="ghost" disabled={!canOpenPack(save)} onClick={tearOpen}>
                Open another {PACK_COST}<i className="shard" />
              </button>
            </div>
            </>}
            {/* Reachable mid-reveal, because the pull is already banked and a
                sheet you cannot leave is a trap. Turning the rest is the
                flourish, not the transaction. */}

          </div>
        </div>
      )}

      {previewId && <CardView mode="browse" def={getDef(previewId)} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
