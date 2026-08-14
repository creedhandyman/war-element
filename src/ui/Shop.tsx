/** The Shop — where element essence turns into cards.
 *
 *  There are three routes to a complete collection: clear the story (the dice),
 *  conjure with essence (the guarantee), and boosters (not built). This screen
 *  is the middle one, and it exists because the first is not enough on its own:
 *  recruitment is a roll, and a roll can miss the same card for a whole
 *  campaign. Essence is the answer to "I have cleared this region nine times
 *  and it still will not give me Trinezer".
 *
 *  Deliberately NOT a card browser. The Collection already does that, three taps
 *  away, and duplicating it here would leave two screens to keep in step. This
 *  one only ever shows what you do not own and could conjure — the shortest path
 *  from "what am I missing" to "I have it".
 */
import { useMemo, useState } from "react";
import { CARDS, getDef } from "../data/cards";
import {
  PACK_COST, PACK_SIZE, REGIONS, applyPack, canCraft, canOpenPack, craftCard, craftCostOf,
  openPack, type PackResult, type StorySave,
} from "../data/story";
import { EL_COLOR } from "./shared";
import type { Element } from "../engine/types";
import { CardExpand } from "./CardExpand";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3 };

export function Shop(props: { save: StorySave; onSave: (next: StorySave) => void }) {
  const { save } = props;
  const [el, setEl] = useState<string>("ALL");
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** The pack just torn open, held so the player can actually read it. */
  const [opened, setOpened] = useState<PackResult | null>(null);

  const essence = save.hero?.essence ?? {};
  const owned = useMemo(() => new Set(save.collection), [save.collection]);

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

  const total = Object.values(essence).reduce((a, b) => a + b, 0);
  const shards = save.hero?.shards ?? 0;

  return (
    <div className="shop">
      <div className="shop-head">
        <h2>Shop</h2>
        <p>
          Essence is earned by clearing story nodes and spent here on a card the
          dice never gave you. Boosters are not built yet.
        </p>
      </div>

      {/* Boosters: volume at random, paid in shards. The other half of the shop
          — essence buys the exact card, this buys a handful of unknown ones. */}
      <div className="sr-label">Boosters</div>
      <div className="shop-pack">
        <div className="shop-pack-copy">
          <b>Booster pack</b>
          <span>
            {PACK_SIZE} cards, at least one Epic or better. Duplicates come back as essence.
          </span>
        </div>
        <button
          className={`shop-pack-buy ${canOpenPack(save) ? "can" : ""}`}
          disabled={!canOpenPack(save)}
          title={canOpenPack(save)
            ? `Open a pack for ${PACK_COST} shards`
            : `Needs ${PACK_COST} shards — you have ${shards}`}
          onClick={() => {
            const result = openPack(save);
            setOpened(result);
            props.onSave(applyPack(save, result));
          }}
        >
          <b>{PACK_COST}</b><i className="shard" />
          <em>{shards} held</em>
        </button>
      </div>

      <div className="sr-label">Essence · {total}</div>
      <div className="shop-wallet">
        {REGIONS.map((r) => {
          const n = essence[r.element] ?? 0;
          return (
            <button
              key={r.element}
              className={`shop-purse ${el === r.element ? "on" : ""} ${n > 0 ? "" : "empty"}`}
              style={{ ["--el" as string]: EL_COLOR[r.element as Element] }}
              onClick={() => setEl(el === r.element ? "ALL" : r.element)}
              title={`${r.element} essence — tap to filter`}
            >
              <b>{n}</b>
              <span>{r.element}</span>
            </button>
          );
        })}
      </div>

      <div className="sr-label">
        Missing · {missing.length}
        {el !== "ALL" && (
          <button className="shop-clear" onClick={() => setEl("ALL")}>show all</button>
        )}
      </div>

      {missing.length === 0 ? (
        <p className="shop-done">
          {el === "ALL"
            ? "Every card in the game is yours. There is nothing left to conjure."
            : `You own every ${el} card.`}
        </p>
      ) : (
        <div className="shop-grid">
          {missing.map((c) => {
            const cost = craftCostOf(c.id);
            const check = canCraft(save, c.id);
            const have = essence[c.element] ?? 0;
            return (
              <div key={c.id} className={`shop-card r-${c.rarity ?? "rare"}`}>
                <button
                  className="shop-art"
                  onClick={() => setPreviewId(c.id)}
                  title={`${c.name} — see the card`}
                >
                  <img
                    src={`/cards/${c.art ?? c.id}.webp`}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                </button>
                <span className="shop-name">{c.name}</span>
                <span className="shop-meta">
                  <i style={{ color: EL_COLOR[c.element] }}>{c.element}</i> · {c.rarity}
                </span>
                <button
                  className={`shop-buy ${check.ok ? "can" : ""}`}
                  disabled={!check.ok}
                  title={check.ok ? `Conjure for ${cost} ${c.element} essence` : check.reason}
                  onClick={() => props.onSave(craftCard(save, c.id))}
                >
                  {cost}<i className="coin" />
                  {!check.ok && <em>{have}/{cost}</em>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <div className="overlay on-top" onClick={() => setOpened(null)}>
          <div className="modal pack-reveal" onClick={(e) => e.stopPropagation()}>
            <h2>Pack opened</h2>
            <div className="pack-cards">
              {opened.pulled.map((id, i) => {
                const d = getDef(id);
                const isNew = opened.fresh.includes(id) && opened.pulled.indexOf(id) === i;
                const foil = opened.shiny.includes(id);
                return (
                  <div
                    key={i}
                    className={`pack-card r-${d.rarity ?? "rare"} ${isNew ? "new" : "dupe"} ${foil ? "foil" : ""}`}
                  >
                    <img
                      src={`/cards/${d.art ?? d.id}.webp`}
                      alt=""
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                    />
                    <span className="pack-name">
                      {foil && <i className="foil-tag" title="Foil">✦</i>}
                      {d.name}
                    </span>
                    <span className="pack-tag">{isNew ? "NEW" : "dupe"}</span>
                  </div>
                );
              })}
            </div>
            <p className="pack-sum">
              <b>{opened.fresh.length}</b> new
              {opened.shiny.length > 0 && (
                <>{" · "}<b className="pack-foil">{opened.shiny.length} FOIL</b></>
              )}
              {Object.keys(opened.refund).length > 0 && (
                <>
                  {" · refunded "}
                  {Object.entries(opened.refund)
                    .map(([e, n]) => `${n} ${e}`)
                    .join(", ")}
                </>
              )}
            </p>
            <button className="lockin" onClick={() => setOpened(null)}>Done</button>
          </div>
        </div>
      )}

      {previewId && <CardExpand def={getDef(previewId)} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
