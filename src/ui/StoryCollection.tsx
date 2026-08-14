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
import type { CardClass, Element } from "../engine";
import { CARDS } from "../data/cards";
import {
  PLACED_CARDS, bestSource, deckCapFor, isShiny, recruitChance, sourcesOf,
  type StorySave,
} from "../data/story";
import { EL_COLOR, EL_ICON, RARITY_STYLE } from "./shared";
import { SpIcon } from "./icons";
import { CardExpand } from "./CardExpand";

const ELEMENTS: Element[] = ["LEAF", "PYRO", "AQUA", "DAWN", "GALE", "BOLT", "DUSK", "BORE"];
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
}) {
  const { save } = props;
  const [scope, setScope] = useState<Scope>("all");
  const [el, setEl] = useState<Element | "ALL">("ALL");
  const [cls, setCls] = useState<CardClass | "ALL">("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const owned = useMemo(() => new Set(save.collection), [save.collection]);
  const inDeck = useMemo(() => new Set(save.deck), [save.deck]);
  const cap = deckCapFor(save.cleared);

  // The denominator is what the campaign can actually GIVE you, not the whole
  // 300-card set — otherwise the counter reads as permanently broken while the
  // remaining regions are unbuilt.
  const placed = useMemo(() => new Set(PLACED_CARDS), []);
  const collected = PLACED_CARDS.filter((id) => owned.has(id)).length;

  const shown = useMemo(() => {
    const list = CARDS.filter((d) => {
      if (el !== "ALL" && d.element !== el) return false;
      if (cls !== "ALL" && d.cardClass !== cls) return false;
      if (scope === "owned") return owned.has(d.id);
      // "Missing" means findable and not yet found. A card in an unbuilt region
      // is not a to-do item — it is a content gap, and listing it as one would
      // send the player looking for a node that does not exist.
      if (scope === "missing") return !owned.has(d.id) && placed.has(d.id);
      return true;
    });
    return list.sort((a, b) =>
      Number(owned.has(b.id)) - Number(owned.has(a.id)) ||
      rarityRank(a.rarity) - rarityRank(b.rarity) ||
      a.cost - b.cost || a.name.localeCompare(b.name));
  }, [scope, el, cls, owned, placed]);

  // The detail is a full-screen expand now, so selecting a card no longer has to
  // prise the deck rail open just to be seen.
  const pick = (id: string) => setDetailId(id);

  const detail = detailId ? CARDS.find((d) => d.id === detailId) ?? null : null;

  return (
    <div className="story-wrap col-wrap">
      <header className="story-head">
        <div>
          <div className="story-eyebrow">COLLECTION</div>
          <h2>{collected} of {PLACED_CARDS.length} recruited</h2>
        </div>
        <div className="story-stats">
          <span className={save.deck.length === cap ? "col-deck-full" : undefined}>
            deck <b>{save.deck.length}</b>/{cap}
          </span>
          <span><b>{PLACED_CARDS.length - collected}</b> still out there</span>
        </div>
        <div className="story-actions">
          {props.onOpenBuilder && (
            <button className="bb" onClick={props.onOpenBuilder}>Build a team</button>
          )}
          <button className="ghost" onClick={props.onClose}>Back to the map</button>
        </div>
      </header>

      <div className="story-body">
        <div className="col-pool">
          <div className="db-filters col-scope">
            {([["all", "All"], ["owned", "Owned"], ["missing", "Missing"]] as const).map(([k, label]) => (
              <button key={k} className={`db-fl ${scope === k ? "on" : ""}`} onClick={() => setScope(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="db-filters">
            <button className={`db-fl ${el === "ALL" ? "on" : ""}`} onClick={() => setEl("ALL")}>All</button>
            {ELEMENTS.map((e) => (
              <button
                key={e}
                className={`db-fl el-fl ${el === e ? "on" : ""}`}
                onClick={() => setEl(e)}
                style={{
                  borderColor: EL_COLOR[e], color: EL_COLOR[e],
                  background: el === e ? `color-mix(in srgb, ${EL_COLOR[e]} 26%, transparent)` : undefined,
                }}
              >
                <span className="el-fl-dot" style={{ background: EL_COLOR[e] }} />
                {e}
              </button>
            ))}
          </div>
          <div className="db-sort">
            <span className="db-sort-lbl">Class</span>
            <button className={`db-fl ${cls === "ALL" ? "on" : ""}`} onClick={() => setCls("ALL")}>All</button>
            {CLASSES.map((c) => (
              <button key={c} className={`db-fl ${cls === c ? "on" : ""}`} onClick={() => setCls(c)}>{c}</button>
            ))}
          </div>

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
                    className={`deck-thumb carded db-card col-card ${have ? "" : "locked"} ${on ? "selected" : ""} ${foil ? "foil" : ""}`}
                    role="button"
                    tabIndex={0}
                    title={foil ? `${d.name} — foil` : have ? d.name : `${d.name} — not yet recruited`}
                    onClick={() => pick(d.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(d.id); } }}
                  >
                    {foil && <span className="foil-tag">FOIL</span>}
                    <img className="card-art" src={`/cards/${d.art ?? d.id}.webp`} alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="dt-top">
                      <span className="dt-cost">{d.cost}</span>
                      <span className="dt-el" title={d.element} style={{ borderColor: EL_COLOR[d.element] }}>
                        <img src={EL_ICON[d.element]} alt={d.element} draggable={false}
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </span>
                      {have ? (
                        on ? <span className="dt-add on" title="In your current deck">✓</span> : null
                      ) : (
                        <span className="dt-locked" aria-label="Not recruited">🔒</span>
                      )}
                    </div>
                    {rar && (
                      <span className="dt-rarity" style={{ color: rar.color, borderColor: rar.color }}>
                        {rar.label}
                      </span>
                    )}
                    <div className="dt-name">{d.name}</div>
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
        <CardExpand
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
