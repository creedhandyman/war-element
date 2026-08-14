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
import { useMemo, useState } from "react";
import { CARDS, getDef } from "../data/cards";
import {
  CRAFT_COST, PACK_COST, PACK_SIZE, PACK_WEIGHT, REGIONS, SHINY_CHANCE,
  applyPack, canCraft, canOpenPack, craftCard, craftCostOf, dupeEssenceFor,
  openPack, type PackResult, type StorySave,
} from "../data/story";
import { EL_COLOR, RARITY_STYLE } from "./shared";
import { CardView } from "./CardView";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };
/** Commonest first, which is the order the bar stacks them in. */
const ODDS_ROWS = (["rare", "epic", "legendary", "mythic"] as const).map((r) => ({
  rarity: r as string,
  weight: PACK_WEIGHT[r] ?? 0,
  refund: Math.max(1, Math.floor((CRAFT_COST[r] ?? 4) / 2)),
}));

export function Shop(props: { save: StorySave; onSave: (next: StorySave) => void }) {
  const { save } = props;
  const [tab, setTab] = useState<"packs" | "crafter">("packs");
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

  function tearOpen() {
    const result = openPack(save);
    setOpened(result);
    setLastRefund(Object.values(result.refund).reduce((a, b) => a + b, 0));
    props.onSave(applyPack(save, result));
  }

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
          <div className="pack-seal">
            <span className="pack-seal-tag">SEALED</span>
            <span className="pack-seal-mark">✦</span>
          </div>
          <div className="pack-title">Booster pack</div>
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
                    {check.ok ? (
                      <button className="craft-buy" onClick={() => props.onSave(craftCard(save, c.id))}
                        title={`Conjure for ${cost} ${c.element} essence`}>
                        Conjure<span>{cost}<i className="coin" /></span>
                      </button>
                    ) : (
                      <span className="craft-cost" title={check.reason}>
                        {have}/{cost}<i className="coin" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {opened && (
        <div className="overlay on-top" onClick={() => setOpened(null)}>
          <div className="modal pack-reveal" onClick={(e) => e.stopPropagation()}>
            <div className="pack-reveal-head">
              <h2>Pack opened</h2>
              <span className="pack-spend">−{PACK_COST}<i className="shard" /></span>
            </div>
            {/* Five cards, one row, no carousel — a pack is small enough to read
                at once, and the row is what makes the Epic guarantee visible. */}
            <div className="pack-cards">
              {opened.pulled.map((id, i) => {
                const d = getDef(id);
                const isNew = opened.fresh.includes(id) && opened.pulled.indexOf(id) === i;
                const foil = opened.shiny.includes(id);
                const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                return (
                  <div key={i} className={`pack-card r-${d.rarity ?? "rare"} ${isNew ? "new" : "dupe"} ${foil ? "foil" : ""}`}>
                    <img src={`/cards/${d.art ?? d.id}.webp`} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    {rar && <span className="pack-rar" style={{ color: rar.color, borderColor: rar.color }}>{rar.label}</span>}
                    <span className="pack-name">
                      {foil && <i className="foil-tag" title="Foil">✦</i>}
                      {d.name}
                    </span>
                    {/* The one thing you cannot see from the art: new, foil, or
                        what the duplicate paid back. */}
                    <span className={`pack-tag ${isNew ? "is-new" : foil ? "is-foil" : "is-dupe"}`}>
                      {isNew ? "NEW" : foil ? "FOIL" : `+${dupeEssenceFor(id)} ${d.element}`}
                    </span>
                  </div>
                );
              })}
            </div>
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
          </div>
        </div>
      )}

      {previewId && <CardView mode="browse" def={getDef(previewId)} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
