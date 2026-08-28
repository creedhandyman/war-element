/** Story Mode — the collection: what you own, and where the rest of it is.
 *
 *  Deliberately NOT a deck editor. Building happens in the real Deck Builder
 *  (`DeckBuilder` with its `story` mode), which is a far better tool than the
 *  grid-with-plus-buttons that used to live here — filters that stack, sorting,
 *  a live cost curve, card detail. Two ways to add a card is worse than one good
 *  one, so this screen kept the job the builder cannot do and gave up the job it
 *  does better.
 *
 *  The load-bearing feature is the MISSING half. Pillar 3 says you fight what
 *  you want to own — which is only true if the collection can answer "so where
 *  is it?". Every unowned card names the node that drops it and the odds there,
 *  so this screen doubles as the campaign's to-do list.
 */
import { useMemo, useState } from "react";
import type { CardClass, Element, Keyword } from "../engine";
import { CARDS } from "../data/cards";
import {
  PLACED_CARDS, bestSource, deckCapFor, isShiny, markSeen, recruitChance, sourcesOf,
  type StorySave,
} from "../data/story";
import { EL_COLOR, EL_ICON, ELEMENTS, RARITY_STYLE } from "./shared";
import {
  ClassRow, CostRow, FilterToggle, KeywordRow, RarityRow,
  matchesCost, useFilterFold, type CostFilter, type RarityFilter,
} from "./filters";
import { SpIcon } from "./icons";
import { CardView } from "./CardView";

const CLASSES: CardClass[] = ["Assassin", "Warrior", "Tank", "Ranger", "Mage", "Support"];
const RARITY_RANK: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
const rarityRank = (r?: string) => (r && r in RARITY_RANK ? RARITY_RANK[r] : 99);

type Scope = "all" | "owned" | "missing";

export function StoryCollection(props: {
  save: StorySave;
  onSave: (next: StorySave) => void;
  onClose: () => void;
  /** Jump to a node on the map. Absent = the map isn't showing this region. */
  onGoToNode?: (nodeId: string) => void;
  /** The region on screen — passed through to the builder so a team saved there
   *  is tagged with it. */
  element?: string;
  /** Open the real deck builder. Building does not happen on this screen. */
  onOpenBuilder?: () => void;
  /** What the close button says. This screen is reached from the map AND from
   *  the Home tab now, and "Back to the map" is a lie in the second case. */
  closeLabel?: string;
}) {
  const { save } = props;
  // EVERY FILTER OPENS ON "ALL", on every screen size.
  //
  // Scope used to open on MISSING below 720px, on the reasoning that the
  // load-bearing half of a collection screen is what you have NOT got and a
  // phone grid costs a lot of scrolling to reach it. That is a fair argument
  // about the second visit and the wrong one for the first: opening on a filter
  // means the screen greets you with a grid of cards you do not own, the count
  // in the header does not match what is under it, and the one control that
  // would explain it is a chip you have to notice is already pressed. A screen
  // that starts filtered has to be un-filtered before it can be read.
  //
  // The chips are one tap away and they persist for as long as the screen is
  // open, so the browsing cost the old default was avoiding is paid once by
  // the players who want it rather than by everyone.
  const [scope, setScope] = useState<Scope>("all");
  const [el, setEl] = useState<Element | "ALL">("ALL");
  const [cls, setCls] = useState<CardClass | "ALL">("ALL");
  const [kw, setKw] = useState<Keyword | "ALL">("ALL");
  const [rar, setRar] = useState<RarityFilter>("ALL");
  const [cost, setCost] = useState<CostFilter>("ALL");
  /** Same one-button collapse as the builder, and the same reasoning: the rows
   *  cost a phone most of its first screen of cards. Shares the stored key, so
   *  the preference follows you between the two grids rather than being set
   *  twice. */
  const [filtersOpen, toggleFilters] = useFilterFold();
  const [detailId, setDetailId] = useState<string | null>(null);
  const owned = useMemo(() => new Set(save.collection), [save.collection]);
  const inDeck = useMemo(() => new Set(save.deck), [save.deck]);
  const cap = deckCapFor(save.cleared);

  // The denominator is what the campaign can actually GIVE you, not the whole
  // 300-card set — otherwise the counter reads as permanently broken while the
  // remaining regions are unbuilt.
  const placed = useMemo(() => new Set(PLACED_CARDS), []);
  const collected = PLACED_CARDS.filter((id) => owned.has(id)).length;
  const foils = (save.hero?.shiny ?? []).length;

  /** What is narrowing the grid. Scope counts (it hides cards); sort does not. */
  const filterSummary = [
    scope !== "all" ? scope[0].toUpperCase() + scope.slice(1) : null,
    el !== "ALL" ? el : null,
    cls !== "ALL" ? cls : null,
    kw !== "ALL" ? kw : null,
    rar !== "ALL" ? rar.toUpperCase() : null,
    cost !== "ALL" ? `${cost}◆` : null,
  ].filter(Boolean) as string[];
  const anyFilter = filterSummary.length > 0;
  const clearFilters = () => {
    setScope("all"); setEl("ALL"); setCls("ALL"); setKw("ALL"); setRar("ALL"); setCost("ALL");
  };

  const shown = useMemo(() => {
    const list = CARDS.filter((d) => !d.boss).filter((d) => {
      if (el !== "ALL" && d.element !== el) return false;
      if (cls !== "ALL" && d.cardClass !== cls) return false;
      if (kw !== "ALL" && !d.keywords[kw]) return false;
      if (rar !== "ALL" && d.rarity !== rar) return false;
      if (!matchesCost(d.cost, cost)) return false;
      if (scope === "owned") return owned.has(d.id);
      // "Missing" means findable and not yet found. A card in an unbuilt region
      // is not a to-do item — it is a content gap, and listing it as one would
      // send the player looking for a node that does not exist.
      if (scope === "missing") return !owned.has(d.id) && placed.has(d.id);
      return true;
    });
    // In the Missing scope the question is not "what is rarest" but "what
    // should I go and fight", so it sorts by BEST ODDS FIRST. Rarity ordering
    // answers a collector's question; odds ordering answers a player's, and
    // Missing is the scope you open when you want to do something about it.
    if (scope === "missing") {
      const oddsOf = (id: string) => {
        const src = bestSource(save, id);
        if (!src) return -1;                    // locked or unplaced — the tail
        return recruitChance(id, save.pity[`${src.node.id}:${id}`] ?? 0, src.overflow);
      };
      return list.sort((a, b) =>
        oddsOf(b.id) - oddsOf(a.id) ||
        rarityRank(a.rarity) - rarityRank(b.rarity) ||
        a.cost - b.cost || a.name.localeCompare(b.name));
    }
    return list.sort((a, b) =>
      Number(owned.has(b.id)) - Number(owned.has(a.id)) ||
      rarityRank(a.rarity) - rarityRank(b.rarity) ||
      a.cost - b.cost || a.name.localeCompare(b.name));
  }, [scope, el, cls, kw, rar, cost, owned, placed, save]);

  /** Per-element completion. The grid can tell you a card is missing; only this
   *  can tell you WHICH REGION to go back to, which is the version of the
   *  question the player actually acts on. Counted over placed cards, for the
   *  same reason the headline is: an unbuilt region is a content gap, not a
   *  shortfall the player can close. */
  const byElement = useMemo(() => {
    const rows = ELEMENTS.map((e) => {
      const pool = PLACED_CARDS.filter((id) => CARDS.find((c) => c.id === id)?.element === e);
      return { el: e, have: pool.filter((id) => owned.has(id)).length, total: pool.length };
    }).filter((r) => r.total > 0);
    // Only name a thinnest element when there IS one. Early in a campaign
    // seven elements sit at 0/39 and picking the first of them would be
    // arbitrary dressed up as advice — the strip already shows the tie, and a
    // sentence claiming PYRO in particular is where to go would be made up.
    const sorted = [...rows].sort((a, b) => a.have / a.total - b.have / b.total);
    const lowest = sorted[0];
    const unique = !!lowest && (sorted.length < 2 || lowest.have / lowest.total < sorted[1].have / sorted[1].total);
    const thinnest = unique && lowest.have < lowest.total ? { el: lowest.el, pct: lowest.have / lowest.total } : null;
    return { rows, thinnest };
  }, [owned]);

  // The detail is a full-screen expand now, so selecting a card no longer has to
  // prise the deck rail open just to be seen.
  /** Opening a card is what "checked out" means, so the flag clears here and
   *  nowhere else. Writing on open rather than on close: a player who backs out
   *  with the system key has still seen it. */
  const pick = (id: string) => {
    setDetailId(id);
    if ((save.unseen ?? []).includes(id)) props.onSave(markSeen(save, id));
  };
  const unseen = useMemo(() => new Set(save.unseen ?? []), [save.unseen]);

  const detail = detailId ? CARDS.find((d) => d.id === detailId) ?? null : null;

  return (
    <div className="story-wrap col-wrap">
      <header className="story-head">
        <div>
          <div className="story-eyebrow">
            COLLECTION{save.hero?.name ? ` · ${save.hero.name}` : ""}
          </div>
          <h2>{collected} of {PLACED_CARDS.length} recruited</h2>
        </div>
        <div className="story-stats">
          <span className={save.deck.length === cap ? "col-deck-full" : undefined}>
            deck <b>{save.deck.length}</b>/{cap}
          </span>
          <span><b>{PLACED_CARDS.length - collected}</b> still out there</span>
          {foils > 0 && <span className="col-foils"><b>{foils}</b> foil</span>}
        </div>
        <div className="story-actions">
          {props.onOpenBuilder && (
            <button className="bb" onClick={props.onOpenBuilder}>Build a squad</button>
          )}
          <button className="ghost" onClick={props.onClose}>
            {props.closeLabel ?? "Back to the map"}
          </button>
        </div>
      </header>

      {/* Per element, of its own placed pool — and the element FILTER, because
          they were the same eight things twice. The count answers "where am I
          thin", the filter answers "show me those", and those are one question
          asked twice.

          THE BAR IS THE RING. This was nine bordered boxes, each with a sigil, a
          fraction and a straight track under it, laid out three-across on a
          phone — three rows of chrome above the grid, most of it padding, for
          nine numbers. The progress is drawn AROUND the logo now: same nine
          filters, same nine numbers, one row, and the sigil is the whole
          control instead of a thing sitting inside one.

          The sigil replaces the colour dot for the reason it did on the chips:
          eight dots differ only by hue, which is the one channel a colourblind
          player does not have. */}
      <div className="col-elrow">
        <button
          className={`col-el col-el-all ${el === "ALL" ? "on" : ""}`}
          style={{ ["--pct" as string]: (collected / PLACED_CARDS.length) * 100 }}
          onClick={() => setEl("ALL")}
          aria-pressed={el === "ALL"}
          title={`${collected} of ${PLACED_CARDS.length} recruited — every element`}
        >
          <span className="col-el-ring" aria-hidden="true">
            <b>All</b>
          </span>
          <em>{collected}</em>
        </button>
        {byElement.rows.map((r) => (
          <button
            key={r.el}
            className={`col-el ${r.have === r.total ? "done" : ""} ${el === r.el ? "on" : ""}`}
            data-el={r.el}
            style={{ ["--pct" as string]: (r.have / r.total) * 100 }}
            aria-pressed={el === r.el}
            title={`${r.have} of ${r.total} ${r.el} cards — tap to filter`}
            onClick={() => setEl(el === r.el ? "ALL" : r.el)}
          >
            <span className="col-el-ring" aria-hidden="true">
              <img className="col-el-sig" src={EL_ICON[r.el]} alt="" draggable={false}
                onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
            </span>
            <em>{r.have}<i>/{r.total}</i></em>
          </button>
        ))}
      </div>
      {byElement.thinnest && (
        <p className="col-elnote">
          <b style={{ color: EL_COLOR[byElement.thinnest.el] }}>{byElement.thinnest.el}</b> is where the
          collection is thinnest — and where a clear pays the most.
        </p>
      )}

      <div className="story-body">
        <div className="col-pool">
          <FilterToggle open={filtersOpen} onToggle={toggleFilters} summary={filterSummary} count={shown.length} />
          {filtersOpen && (<>
          <div className="db-filters col-scope">
            {([["all", "All"], ["owned", "Owned"], ["missing", "Missing"]] as const).map(([k, label]) => (
              <button key={k} className={`db-fl ${scope === k ? "on" : ""}`} onClick={() => setScope(k)}>
                {label}
              </button>
            ))}
          </div>
          <ClassRow all={CLASSES} value={cls} onChange={setCls} />
          <KeywordRow value={kw} onChange={setKw} />
          <RarityRow value={rar} onChange={setRar} />
          <CostRow value={cost} onChange={setCost} />
          {anyFilter && (
            <div className="db-sort">
              <button className="db-fl db-clear" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
          </>)}

          {shown.length === 0 ? (
            <p className="story-hint col-empty">
              {scope === "missing"
                ? "Nothing missing here — you own everything this filter covers."
                : "No cards match this filter."}
            </p>
          ) : (
            <div className="db-grid">
              {shown.map((d) => {
                const have = owned.has(d.id);
                const on = inDeck.has(d.id);
                const rar = d.rarity ? RARITY_STYLE[d.rarity] : null;
                const src = have ? null : bestSource(save, d.id);
                const foil = have && isShiny(save, d.id);
                return (
                  <div
                    key={d.id}
                    className={`deck-thumb carded db-card col-card ${have ? "" : "locked"} ${on ? "selected" : ""} ${foil ? "foil" : ""} ${unseen.has(d.id) ? "unseen" : ""}`}
                    role="button"
                    tabIndex={0}
                    title={foil ? `${d.name} — foil` : have ? d.name : `${d.name} — not yet recruited`}
                    onClick={() => pick(d.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(d.id); } }}
                  >
                    <img className="card-art" src={`/cards/${d.art ?? d.id}.webp`} alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="dt-top">
                      <span
                        className="dt-cost"
                        title={`${d.element} · cost ${d.cost}`}
                        style={{ borderColor: EL_COLOR[d.element], backgroundImage: `url(${EL_ICON[d.element]})` }}
                      >
                        <b>{d.cost}</b>
                      </span>
                      {/* NEW until you have actually opened it. It sits where
                          the in-deck tick would, and the tick wins when both
                          apply — a card already in your deck is not news. */}
                      {have && unseen.has(d.id) && !on && (
                        <span className="dt-new" title="Recruited — you have not looked at this one yet">NEW</span>
                      )}
                      {have ? (
                        on ? <span className="dt-mark" title="In your current deck">✓</span> : null
                      ) : (
                        <span className="dt-locked" aria-label="Not recruited">🔒</span>
                      )}
                    </div>
                    {rar && (
                      <span className="dt-rarity" style={{ color: rar.color, borderColor: rar.color }}>
                        {rar.label}
                      </span>
                    )}
                    <div className="dt-name">{foil && <i className="foil-tag" title="Foil">✦</i>}{d.name}</div>
                    {have ? (
                      <div className="dt-stats">
                        <span className="s-dmg">⚔<span className="atk-dmg">{d.dmg}</span>{d.hits > 1 ? <span className="atk-x"> ×{d.hits}</span> : ""}</span>
                        <span className="s-hp">♥{d.hp}</span>
                        <span className="s-sp"><SpIcon />{d.sp}</span>
                      </div>
                    ) : (
                      // The whole point of the locked state: say where it is.
                      <div className="dt-where">{whereLabel(save, d.id, src)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* The same expanded card the deck builder shows, plus the one thing only
          the Collection knows: where this card actually drops. */}
      {detail && (
        <CardView mode="browse" foil={isShiny(save, detail.id)}
          def={detail}
          onClose={() => setDetailId(null)}
          extra={
            <div className="dbd-sect">
              <SourceList save={save} defId={detail.id} owned={owned.has(detail.id)}
                onGoToNode={props.onGoToNode} />
            </div>
          }
        />
      )}
    </div>
  );
}

/** The one-line answer under a locked card. */
function whereLabel(save: StorySave, defId: string, src: ReturnType<typeof bestSource>): string {
  if (src) {
    const pity = save.pity[`${src.node.id}:${defId}`] ?? 0;
    return `${src.node.id} · ${recruitChance(defId, pity, src.overflow)}%`;
  }
  // Placed but every source is still locked — the honest answer is "keep going",
  // not a percentage the player cannot act on yet.
  return sourcesOf(defId).length > 0 ? "Locked — push further in" : "Not in the world yet";
}

/** Full where-to-find for the selected card, including still-locked nodes so the
 *  player can see the route rather than only the reachable end of it. */
function SourceList(props: {
  save: StorySave; defId: string; owned: boolean; onGoToNode?: (id: string) => void;
}) {
  const sources = sourcesOf(props.defId);
  if (sources.length === 0)
    return <p className="np-adds">Not placed in any built region yet.</p>;

  return (
    <>
      <div className="np-label">{props.owned ? "Farm it at" : "Found at"}</div>
      <ul className="np-roster">
        {sources.map((s) => {
          const pity = props.save.pity[`${s.node.id}:${props.defId}`] ?? 0;
          const open = s.node.requires.every((r) => props.save.cleared.includes(r));
          return (
            <li key={s.node.id} className={open ? "" : "have"}>
              <span className="npr-name">{s.node.id} · {s.node.name}</span>
              {s.overflow && <span className="npr-over">overflow</span>}
              <span className="npr-drop">
                {open ? `${recruitChance(props.defId, pity, s.overflow)}%` : "locked"}
              </span>
              {open && props.onGoToNode && (
                <button className="cdl-go" onClick={() => props.onGoToNode!(s.node.id)}>Show</button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
