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
import { useState } from "react";
import { getDef } from "../data/cards";
import {
  autoSquad, localCards, packSquad, packableFor, squadCapInRegion, squadFor,
  type StoryRegion, type StorySave,
} from "../data/story";
import { EL_COLOR } from "./shared";

const RARITY_ORDER: Record<string, number> = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };

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

  // HOME: everything fights, nothing to pack.
  if (limit === null) {
    return (
      <section className="squad-strip home">
        <div className="sq-head">
          <span className="sq-title">Your army here</span>
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

  const packable = packableFor(save, region);
  const full = draft.length >= limit;
  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : full ? d : [...d, id]));
  const byRarity = [...packable].sort(
    (a, b) =>
      (RARITY_ORDER[getDef(a).rarity ?? ""] ?? 9) - (RARITY_ORDER[getDef(b).rarity ?? ""] ?? 9) ||
      getDef(b).cost - getDef(a).cost,
  );

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
            onClick={() => { setDraft(carried); setEditing((v) => !v); }}
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
              <button className="ghost sm" onClick={() => setDraft(byRarity.slice(0, limit))}>Best</button>
              <button className="ghost sm" disabled={!draft.length} onClick={() => setDraft([])}>Clear</button>
            </span>
          </div>
          <div className="sq-grid">
            {byRarity.map((id) => {
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
