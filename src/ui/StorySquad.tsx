/** Who is fighting in this region, on the map screen, under the map.
 *
 *  The squad was only ever visible inside the prep screen for a specific fight —
 *  so the question "who am I actually carrying here" could only be asked while
 *  standing on a node, about to commit. That is the worst moment to discover you
 *  left your only healer in another region: you are one tap from a battle and
 *  the answer arrives as a surprise.
 *
 *  It belongs on the map, because the squad is a property of the REGION and the
 *  map is the region. Local cards ride free — you are in their homeland — so the
 *  only real choice is what you bring from elsewhere, and that is what the
 *  editor edits.
 *
 *  At home (a region whose Throne you hold, or anywhere after DUSK falls) the
 *  whole collection fights and there is nothing to choose; the strip says so
 *  rather than showing an editor that cannot change anything.
 */
import { useMemo, useState } from "react";
import type { CardClass, Keyword } from "../engine";
import {
  CostRow, FilterToggle, KeywordRow, RarityRow,
  cardHasKeyword, matchesCost, useFilterFold, type CostFilter, type RarityFilter,
} from "./filters";
import { getDef } from "../data/cards";
import {
  autoSquad, localCards, packSquad, packableFor, squadCapInRegion, squadFor,
  type StoryRegion, type StorySave,
} from "../data/story";
import { EL_COLOR, EL_ICON, ELEMENTS } from "./shared";
import { loadSquads, packFromSquad } from "../data/squads";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
/** Filter order, fixed rather than derived, so the chips do not reshuffle
 *  between regions as the packable pool changes. */
const CLASSES: CardClass[] = ["Assassin", "Warrior", "Tank", "Ranger", "Mage", "Support"];

export function StorySquad(props: {
  save: StorySave;
  region: StoryRegion;
  onSave: (next: StorySave) => void;
  /** Open a card for a proper read. */
  onPreview: (defId: string) => void;
}) {
  const { save, region } = props;
  const limit = squadCapInRegion(save.cleared, region);
  const locals = localCards(save, region);
  const [editing, setEditing] = useState(false);
  // The explicit squad if one was chosen, otherwise the one the campaign picked
  // — shown as what it is, because "your squad" that you never chose is a lie.
  const chosen = save.squads?.[region.id] ? squadFor(save, region) : null;
  const carried = chosen ?? autoSquad(save, region);
  const [draft, setDraft] = useState<string[]>(carried);
  /** The saved squads, for filling the pack from one instead of picking the
   *  same cards a second time. Read once on mount: the builder is not reachable
   *  from this screen, so the library cannot change under it. */
  const squads = useMemo(() => loadSquads(), []);
  /** Picker filters. The pool here is EVERYTHING you own that is not local, so
   *  in a late-game region it is most of the collection in one flat grid — and
   *  the question it has to answer is a narrow one. This file's own opening
   *  paragraph names it: you are trying not to leave your only healer behind.
   *  That is a CLASS question, so class is a filter, and element is the other
   *  axis because a squad is what you carry from somewhere specific.
   *  `carriedOnly` is the companion to both: filter to Tanks, pick one, filter
   *  to Support, and your Tank is now off screen with no way back to it short
   *  of clearing the filter. */
  const [fEl, setFEl] = useState<string>("ALL");
  const [fCls, setFCls] = useState<CardClass | "ALL">("ALL");
  const [carriedOnly, setCarriedOnly] = useState(false);
  const [kw, setKw] = useState<Keyword | "ALL">("ALL");
  const [rar, setRar] = useState<RarityFilter>("ALL");
  const [cost, setCost] = useState<CostFilter>("ALL");
  const [filtersOpen, toggleFilters] = useFilterFold();
  const clearFilters = () => {
    setFEl("ALL"); setFCls("ALL"); setCarriedOnly(false);
    setKw("ALL"); setRar("ALL"); setCost("ALL");
  };
  /** Carrying is a SCOPE, not a third axis. ANDed with the others its own label
   *  stops being true — "Carrying 14" showing two cards because Support was
   *  still on — so picking it clears them and picking one of them clears it. */
  const showCarried = () => {
    setFEl("ALL"); setFCls("ALL"); setKw("ALL"); setRar("ALL"); setCost("ALL"); setCarriedOnly(true);
  };

  const packable = packableFor(save, region);
  /** Only the chips this pool can actually fill. The collection screen shows
   *  all eight elements because its job is to show you what you are MISSING;
   *  this one is picking from what you hold, so a chip that filters to nothing
   *  is a dead tap. The region's own element is never here at all — local cards
   *  ride free and are not packable.
   *
   *  ABOVE the home-ground early return, and it has to stay there: a hook after
   *  a conditional return makes the component render five hooks on one branch
   *  and six on the other, and `limit` flips the moment you take this region's
   *  Throne. There is no ESLint in this repo to catch that. */
  const have = useMemo(() => {
    const els = new Set(packable.map((id) => getDef(id).element));
    const cls = new Set(packable.map((id) => getDef(id).cardClass));
    return {
      els: ELEMENTS.filter((e) => els.has(e)),
      cls: CLASSES.filter((c) => cls.has(c)),
    };
  }, [packable]);

  // HOME: everything fights, nothing to pack.
  if (limit === null) {
    return (
      <section className="squad-strip home">
        <div className="sq-head">
          <span className="sq-title">Your squad here</span>
          <span className="sq-note">home ground — every card you own fights</span>
        </div>
        <div className="sq-row">
          {[...locals].slice(0, 12).map((id) => (
            <SquadCard key={id} id={id} onPreview={props.onPreview} />
          ))}
          {save.collection.length > 12 && (
            <span className="sq-more">+{save.collection.length - 12}</span>
          )}
        </div>
      </section>
    );
  }

  const full = draft.length >= limit;
  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : full ? d : [...d, id]));
  const byRarity = [...packable].sort(
    (a, b) =>
      (RARITY_ORDER[getDef(a).rarity ?? ""] ?? 9) - (RARITY_ORDER[getDef(b).rarity ?? ""] ?? 9) ||
      getDef(b).cost - getDef(a).cost,
  );

  const filtering = fEl !== "ALL" || fCls !== "ALL" || carriedOnly;
  const shown = byRarity.filter((id) => {
    if (carriedOnly && !draft.includes(id)) return false;
    const d = getDef(id);
    return (fEl === "ALL" || d.element === fEl)
      && (fCls === "ALL" || d.cardClass === fCls)
      && (kw === "ALL" || cardHasKeyword(d, kw))
      && (rar === "ALL" || d.rarity === rar)
      && matchesCost(d.cost, cost);
  });

  /** Carrying is a SCOPE and is named separately on its own chip, so it stays
   *  out of the summary; everything else here hides cards and belongs in it. */
  const filterSummary = [
    fEl !== "ALL" ? fEl : null,
    fCls !== "ALL" ? fCls : null,
    kw !== "ALL" ? kw : null,
    rar !== "ALL" ? rar.toUpperCase() : null,
    cost !== "ALL" ? `${cost}◆` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="squad-strip">
      <div className="sq-head">
        <span className="sq-title">Your squad here</span>
        <span className="sq-note">
          <b style={{ color: EL_COLOR[region.element as keyof typeof EL_COLOR] }}>{locals.length}</b>
          {" "}{region.element} fight free · carrying <b>{carried.length}</b>/{limit} from elsewhere
        </span>
        {packable.length > 0 && (
          <button
            className="sq-edit"
            onClick={() => { setDraft(carried); clearFilters(); setEditing((v) => !v); }}
            aria-expanded={editing}
          >
            {editing ? "Close" : chosen ? "Change" : "Choose"}
          </button>
        )}
      </div>

      {!chosen && carried.length > 0 && !editing && (
        // Say when the squad was picked FOR you. It is a reasonable squad — the
        // most expensive things you own — but it is not a decision you made, and
        // presenting it as one is how a player never discovers the picker.
        <p className="sq-auto">Picked for you — your heaviest cards. Tap Choose to change it.</p>
      )}

      {!editing ? (
        <div className="sq-row">
          {locals.slice(0, 6).map((id) => (
            <SquadCard key={id} id={id} local onPreview={props.onPreview} />
          ))}
          {locals.length > 6 && <span className="sq-more">+{locals.length - 6}</span>}
          {carried.length > 0 && <span className="sq-div" aria-hidden="true" />}
          {carried.map((id) => (
            <SquadCard key={id} id={id} onPreview={props.onPreview} />
          ))}
        </div>
      ) : (
        <>
          <div className="sq-pick-head">
            Carrying <b>{draft.length}</b>/{limit}
            <span className="sq-pick-acts">
              {/* Fills from what is ON SCREEN. With no filter that is the whole
                  pool and this behaves exactly as it always did; with Support
                  selected it means "my best Supports", which is what somebody
                  who just filtered to Support is asking for. Filling from
                  behind the filter would be the surprising reading. */}
              {/* MERGES rather than replaces. `setDraft(shown.slice(0, limit))`
                  threw away every carried card the filter was hiding — narrow
                  to Mage, tap it, and your only Support was gone with the
                  counter unchanged and nothing on screen different, one tap
                  from Carry. Keeping what is hidden is the only reading that
                  cannot lose a card you cannot see. */}
              <button className="ghost sm" onClick={() => setDraft((d) => {
                const keep = filtering ? d.filter((id) => !shown.includes(id)) : [];
                return [...keep, ...shown.filter((id) => !keep.includes(id))].slice(0, limit);
              })}>
                {filtering ? "Fill shown" : "Best"}
              </button>
              <button className="ghost sm" disabled={!draft.length} onClick={() => setDraft([])}>Clear</button>
              {/* FILL FROM A SAVED SQUAD — the whole point of this control is
                  that the campaign otherwise asks you to choose twice: once in
                  the builder, and again here deciding which of those cards
                  travel. Each option states what that squad would ACTUALLY put
                  in the pack, because two things subtract from it silently:
                  the region's own element is not packable (locals fight free)
                  and cards you have not earned are not in the pool. A squad
                  that can contribute nothing says so and is disabled, rather
                  than being a tap that appears to do nothing. */}
              {squads.length > 0 && (
                <select
                  className="sq-fromsquad"
                  aria-label="Fill the pack from a saved squad"
                  value=""
                  onChange={(e) => {
                    const sq = squads.find((x) => x.id === e.target.value);
                    if (sq) { setDraft(packFromSquad(sq.cards, packable, limit)); setCarriedOnly(false); }
                  }}
                >
                  <option value="">From squad…</option>
                  {squads.map((sq) => {
                    const n = packFromSquad(sq.cards, packable, limit).length;
                    return (
                      <option key={sq.id} value={sq.id} disabled={n === 0}>
                        {sq.name} — {n === 0 ? "nothing travels" : `${n} travel`}
                      </option>
                    );
                  })}
                </select>
              )}
            </span>
          </div>

          {/* Reuses the deck builder's filter chips, which already scroll
              sideways with a faded right edge on a phone — this strip lives
              under the map and cannot afford two wrapped rows of chips, which
              is also why it folds. */}
          <FilterToggle
            open={filtersOpen}
            onToggle={toggleFilters}
            summary={filterSummary}
            count={shown.length}
          />
          {filtersOpen && (<>
          <div className="db-filters sq-filters">
            <button className={`db-fl ${fEl === "ALL" && !carriedOnly ? "on" : ""}`}
              onClick={() => { setFEl("ALL"); setCarriedOnly(false); }}>All</button>
            {have.els.map((e) => (
              <button
                key={e}
                className={`db-fl el-fl ${fEl === e ? "on" : ""}`}
                onClick={() => { setFEl(fEl === e ? "ALL" : e); setCarriedOnly(false); }}
                style={{
                  borderColor: EL_COLOR[e as keyof typeof EL_COLOR],
                  color: EL_COLOR[e as keyof typeof EL_COLOR],
                  background: fEl === e
                    ? `color-mix(in srgb, ${EL_COLOR[e as keyof typeof EL_COLOR]} 26%, transparent)`
                    : undefined,
                }}
              >
                <img className="el-fl-sig" src={EL_ICON[e as keyof typeof EL_ICON]} alt="" draggable={false}
                  onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                {e}
              </button>
            ))}
            <button
              className={`db-fl sq-fl-carried ${carriedOnly ? "on" : ""}`}
              // `!draft.length` alone let it be `on` AND `disabled` at once —
              // clear the draft while scoped to it and the chip locked itself
              // on with an empty grid behind it and no way back.
              disabled={!draft.length && !carriedOnly}
              onClick={() => (carriedOnly ? setCarriedOnly(false) : showCarried())}
            >
              Carrying {draft.length}
            </button>
          </div>
          <div className="db-sort sq-filters">
            <span className="db-sort-lbl">Class</span>
            <button className={`db-fl ${fCls === "ALL" && !carriedOnly ? "on" : ""}`}
              onClick={() => { setFCls("ALL"); setCarriedOnly(false); }}>All</button>
            {have.cls.map((c) => (
              <button key={c} className={`db-fl ${fCls === c ? "on" : ""}`}
                onClick={() => { setFCls(fCls === c ? "ALL" : c); setCarriedOnly(false); }}>{c}</button>
            ))}
          </div>
          {/* Each of these clears the carried SCOPE for the same reason the
              element and class chips do: "Carrying 14" showing two cards
              because a keyword was still on makes its own label a lie. */}
          <KeywordRow value={kw} onChange={(v) => { setKw(v); setCarriedOnly(false); }} />
          <RarityRow value={rar} onChange={(v) => { setRar(v); setCarriedOnly(false); }} />
          <CostRow value={cost} onChange={(v) => { setCost(v); setCarriedOnly(false); }} />
          </>)}

          {shown.length === 0 ? (
            <p className="story-hint sq-empty">
              {carriedOnly ? "Nothing carried yet." : "Nothing here matches that."}
              {" "}<button className="sq-empty-reset" onClick={clearFilters}>Show everything</button>
            </p>
          ) : (
          <div className="sq-grid">
            {shown.map((id) => {
              const d = getDef(id);
              const on = draft.includes(id);
              return (
                <button
                  key={id}
                  className={`sq-pick r-${d.rarity ?? "rare"} ${on ? "on" : ""}`}
                  data-el={d.element}
                  disabled={!on && full}
                  title={on ? `${d.name} — carried` : full ? "Squad is full" : `${d.name} — carry`}
                  onClick={() => toggle(id)}
                >
                  <img src={`/cards/${d.art ?? d.id}.webp`} alt="" loading="lazy"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  <span className="sq-pick-name">{d.name}</span>
                  {on && <i className="sq-tick" aria-hidden="true">✓</i>}
                </button>
              );
            })}
          </div>
          )}
          <button
            className="lockin sq-save"
            onClick={() => { props.onSave(packSquad(save, region, draft)); setEditing(false); }}
          >
            {draft.length ? `Carry these ${draft.length}` : "Travel light"}
          </button>
        </>
      )}
    </section>
  );
}

function SquadCard(props: { id: string; local?: boolean; onPreview: (id: string) => void }) {
  const d = getDef(props.id);
  return (
    <button
      className={`sq-card ${props.local ? "local" : ""}`}
      data-el={d.element}
      title={`${d.name}${props.local ? " — fights here for free" : " — carried"}`}
      onClick={() => props.onPreview(props.id)}
    >
      <img src={`/cards/${d.art ?? d.id}.webp`} alt="" loading="lazy"
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
      <span className="sq-card-name">{d.name}</span>
    </button>
  );
}
